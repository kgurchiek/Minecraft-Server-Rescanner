// Fetches dependencies and inits variables
const config = require('./config.json');
const path = require('path');
const fs = require('fs');
const tar = require('tar');
const maxmind = require('maxmind');
const minecraftData = require('minecraft-data');
const { ping, bedrockPing, authCheck } = require('./ping.js');
let pool;
if (config.java.postgres || config.bedrock.postgres) {
    const pg = require('pg');
    pool = new pg.Pool({
        host: config.postgres.host,
        port: config.postgres.port,
        user: config.postgres.user,
        password: config.postgres.password,
        database: config.postgres.database,
        max: config.postgres.maxConnections,
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    });
}

const usernameChars = ['_'].concat(new Array(36).fill().map((a, i) => i.toString(36)), new Array(26).fill().map((a, i) => (i + 10).toString(36).toUpperCase()));
const uuidChars = ['-'].concat(new Array(16).fill().map((a, i) => i.toString(16)));

let lastAuth = 0;
try {
    let data = fs.readFileSync('./lastAuth');
    if (data?.length == 8) lastAuth = Number(data.readBigUint64BE());
    else {
        console.error('Deleting corrupted lastAuth file');
        fs.unlinkSync('./lastAuth');
    }
} catch (err) {}

function cleanDescription(description) {
    if (description == null) return null;
    if (typeof description == 'string') return cleanDescription({ text: description });
    if (typeof description != 'object') return String(description);
    if (Array.isArray(description)) return description.reduce((a, b) => a + cleanDescription(b), '');
    let newDescription = String(description.text == null ? '' : description.text) + String(description.translate == null ? '' : description.translate) + (description.extra || []).reduce((a, b) => a + cleanDescription(b), '');
    description = '';
    for (let i = 0; i < newDescription.length; i++) {
        if (newDescription[i] == '§') i++;
        else description += newDescription[i];
    }
    return description;
}

async function extractTar(buf, dir) {
        const tmpName = `mmdb_${Date.now()}_${Math.random().toString(36).slice(2)}.tar.gz`;
        const tmpPath = path.join(__dirname, tmpName);
        await fs.promises.writeFile(tmpPath, buf);
        try {
            const filter = (entryPath) => entryPath.endsWith('.mmdb');
            await tar.x({ file: tmpPath, cwd: dir, strip: 1, filter });
        } finally {
            await fs.promises.unlink(tmpPath).catch(() => {});
        }
}

async function updateMaxmind() {
    let lastUpdate = fs.statSync('GeoLite2-City.mmdb').mtimeMs;
    let response;
    try {
        response = await fetch('https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz', {
            method: 'HEAD',
            headers: {
                Authorization: `Basic ${btoa(`${config.maxmind.userId}:${config.maxmind.licenseKey}`)}`
            }
        });
        if (response.status != 200) return console.error(`Error fetching MaxMind database (code ${response.status})`);
    } catch (err) {
        return console.rerror('Error fetching MaxMind database:', err);
    }

    let newUpdate = new Date(response.headers.get('last-modified')).getTime();
    if (newUpdate > lastUpdate) {
        let city = await fetch('https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz', {
            method: 'GET',
            headers: {
                Authorization: `Basic ${btoa(`${config.maxmind.userId}:${config.maxmind.licenseKey}`)}`
            }
        });
        if (city.status == 200) {
            let buf = Buffer.from(await city.arrayBuffer());
            await extractTar(buf, '.');
        } else return console.error(`Error fetching MaxMind database (code ${city.status})`);
    }


    lastUpdate = fs.statSync('GeoLite2-ASN.mmdb').mtimeMs;
    try {
        response = await fetch('https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz', {
            method: 'HEAD',
            headers: { 
                Authorization: `Basic ${btoa(`${config.maxmind.userId}:${config.maxmind.licenseKey}`)}`
            }
        });
        if (response.status != 200) return console.error(`Error fetching MaxMind database (code ${response.status})`);
    } catch (err) {
        return console.rerror('Error fetching MaxMind database:', err);
    }

    newUpdate = new Date(response.headers.get('last-modified')).getTime();
    if (newUpdate > lastUpdate) {
        let asn = await fetch('https://download.maxmind.com/geoip/databases/GeoLite2-ASN/download?suffix=tar.gz', {
            method: 'GET',
            headers: {
                Authorization: `Basic ${btoa(`${config.maxmind.userId}:${config.maxmind.licenseKey}`)}`
            }
        });
        if (asn.status == 200) {
            let buf = Buffer.from(await asn.arrayBuffer());
            await extractTar(buf, '.');
        }
        else return console.error(`Error fetching MaxMind database (code ${asn.status})`);
    }
}

function compareArray(a1, a2) {
    for (let i = 0; i < a1.length; i++) if (a1[i] != a2[i]) return false;
    return true;
}

async function main(game) {
    let finished = false;
    if (config.maxmind.update) await updateMaxmind();
    const cityLookup = await maxmind.open('./GeoLite2-City.mmdb');
    const asnLookup = await maxmind.open('./GeoLite2-ASN.mmdb');
    let scanAuth = config.java.auth && Date.now() / 1000 >= lastAuth + config.java.authScanDelay;
    if (scanAuth) {
        console.log(`[${game}] Auth scan`);
        lastAuth = Math.round(Date.now() / 1000);
        let buf = Buffer.alloc(8);
        buf.writeBigUInt64BE(BigInt(lastAuth));
        fs.writeFileSync('./lastAuth', buf);
    }
    let serverList;
    if (game == 'java') {
        if (config.java.customIps) serverList = fs.readFileSync(config.java.ipsPath);
        else {
            while (serverList == null) {
                try {
                    serverList = Buffer.from(await (await fetch('https://github.com/kgurchiek/Minecraft-Server-Scanner/raw/main/ips')).arrayBuffer());
                } catch (err) {
                    console.error('Error fetching server list:', err);
                    await new Promise(res => setTimeout(res, 1000));
                }
            }
        }
    } else {
        if (config.bedrock.customIps) serverList = fs.readFileSync(config.bedrock.ipsPath);
        else {
            let tries = 0;
            while (serverList == null) {
                tries++;
                try {
                    serverList = Buffer.from(await (await fetch('https://github.com/kgurchiek/Minecraft-Server-Scanner/raw/main/ips_b')).arrayBuffer());
                } catch (err) {
                    console.error('Error fetching server list:', err);
                    if (tries == 3) process.exit();
                    await new Promise(res => setTimeout(res, 1000));
                }
            }
        }
    }
    let totalServers = Math.floor(serverList.length / 6);
    console.log(`[${game}] Total servers: ${totalServers.toLocaleString()}`);
    let serversPinged = 0;
    let resultCount = 0;
    let serverQueue = [];
    let playerQueue = [];
    let bedrockQueue = [];

    async function writeServers(servers, auth) {
        if (config.writeLogs) console.log(`[${game}] Writing ${size} servers...`);
        let size = servers.length;
        let placeholder = 1;
        let rows = new Array(servers.length).fill().map(a => `(${new Array(servers[0].length).fill().map(a => `$${placeholder++}`).concat([`to_tsvector('simple', $${placeholder - (auth ? 14 : 13)})`]).join(', ')})`).join(',');
        let params = servers.reduce((a, b) => a.concat(b), []);
        servers.length = 0;
        try {
            await pool.query(`INSERT INTO servers (ip, port, discovered, lastSeen, version, protocol, description, rawDescription, playerCount, playerLimit, hasFavicon, hasForgeData, enforcesSecureChat, org, country, city, lat, lon${auth ? ', cracked' : ''}, hasPlayerSample, descriptionVector)
                VALUES ${rows}
                ON CONFLICT (ip, port) DO UPDATE SET
                lastSeen = excluded.lastSeen,
                version = excluded.version,
                protocol = excluded.protocol,
                description = excluded.description,
                rawDescription = excluded.rawDescription,
                playerCount = excluded.playerCount,
                playerLimit = excluded.playerLimit,
                hasFavicon = excluded.hasFavicon,
                hasForgeData = excluded.hasForgeData,
                enforcesSecureChat = excluded.enforcesSecureChat,
                org = excluded.org,
                country = excluded.country,
                city = excluded.city,
                lat = excluded.lat,
                lon = excluded.lon,
                ${auth ? 'cracked = excluded.cracked,' : ''}
                hasPlayerSample = (servers.hasPlayerSample OR excluded.hasPlayerSample),
                descriptionVector = excluded.descriptionVector;`,
                params
            )
        } catch (err) {
            console.error(`[${game}] Error writing servers to db:`, err);
        }
        if (config.writeLogs) console.log(`[${game}] Finished writing ${size} servers.`);
    }

    async function writePlayers(players) {
        if (players.length == 0) return;
        if (config.writeLogs) console.log(`[${game}] Writing ${size} players...`);
        let size = players.length;
        let placeholder = 1;
        let rows = new Array(players.length).fill().map(a => `(${new Array(players[0].length - 2).fill().map(a => `$${placeholder++}`).join(', ')}, (SELECT serverId FROM servers WHERE ip = $${placeholder++} AND port = $${placeholder++}))`).join(',');
        let params = players.reduce((a, b) => a.concat(b), []);
        players.length = 0;
        try {
            await pool.query(`INSERT INTO playerhistory (name, id, lastSession, serverId)
                VALUES ${rows}
                ON CONFLICT (name, id, serverid) DO UPDATE SET
                lastSession = excluded.lastSession;`,
                params
            )
        } catch (err) {
            console.error('Error writing players to db:', err);
        }
        if (config.writeLogs) console.log(`[${game}] Finished writing ${size} players.`);
    }

    async function handleJavaQueue() {
        if (
            (serverQueue.length > 0 && (finished || serverQueue.length >= config.postgres.batch.java.servers.min)) ||
            (playerQueue.length > 0 && (finished || playerQueue.length >= config.postgres.batch.java.players.min))
        ) {
            let servers = serverQueue.splice(0);
            let players = playerQueue.splice(0);
            while (servers.length > 0) await writeServers(servers.splice(0, config.postgres.batch.java.servers.max), scanAuth);
            while (players.length > 0) await writePlayers(players.splice(0, config.postgres.batch.java.players.max));
        }
        if (!finished || serverQueue.length > 0 || playerQueue.length > 0) setTimeout(handleJavaQueue);
    }
    handleJavaQueue();
    
    async function writeBedrock(servers) {
        if (config.writeLogs) console.log(`[${game}] Writing ${size} servers...`);
        let size = servers.length;
        let placeholder = 1;
        let rows = new Array(servers.length).fill().map(a => `(${new Array(servers[0].length).fill().map(a => `$${placeholder++}`).join(', ')})`).join(',');
        let params = servers.reduce((a, b) => a.concat(b), []);
        servers.length = 0;
        try {
            await pool.query(`INSERT INTO bedrock (ip, port, discovered, lastSeen, education, version, protocol, description, rawDescription, description2, rawDescription2, playerCount, playerLimit, gameMode, modeId, org, country, city, lat, lon)
                VALUES ${rows}
                ON CONFLICT (ip, port) DO UPDATE SET
                lastSeen = excluded.lastSeen,
                education = excluded.education,
                version = excluded.version,
                protocol = excluded.protocol,
                description = excluded.description,
                rawDescription = excluded.rawDescription,
                description2 = excluded.description2,
                rawDescription2 = excluded.rawDescription2,
                playerCount = excluded.playerCount,
                playerLimit = excluded.playerLimit,
                gameMode = excluded.gameMode,
                modeId = excluded.modeId,
                org = excluded.org,
                country = excluded.country,
                city = excluded.city,
                lat = excluded.lat,
                lon = excluded.lon;`,
                params
            )
        } catch (err) {
            console.error(`[${game}] Error writing servers to db:`, err);
        }
        if (config.writeLogs) console.log(`[${game}] Finished writing ${size} servers.`);
    }

    async function handleBedrockQueue() {
        if (bedrockQueue.length > 0 && (finished || bedrockQueue.length >= config.postgres.batch.bedrock.servers.min)) {
            let servers = bedrockQueue.splice(0);
            while (servers.length > 0) await writeServers(servers.splice(0, config.postgres.batch.bedrock.servers.max), scanAuth);
        }
        if (!finished || bedrockQueue.length > 0) setTimeout(handleBedrockQueue);
    }
    handleBedrockQueue();
    
    async function handleBedrockQueue() {
        if (bedrockQueue.length > 0 && (finished || bedrockQueue.length >= config.postgres.batch.bedrock.servers.min)) await writeBedrock(bedrockQueue.splice(0, config.postgres.batch.bedrock.servers.max));
        if (!finished || bedrockQueue.length > 0) setTimeout(handleBedrockQueue);
    }
    handleBedrockQueue();
    
    let writeStream = config[game].saveToFile ? fs.createWriteStream(`results${game == 'java' ? '' : '_b'}${config[game].compressed ? '' : '.json'}`) : null;
    if (config[game].saveToFile && !config[game].compressed) writeStream.write('[');

    function getServer(i) {
        const ip = `${serverList[i * 6]}.${serverList[(i * 6) + 1]}.${serverList[(i * 6) + 2]}.${serverList[(i * 6) + 3]}`;
        const port = serverList[(i * 6) + 4] * 256 + serverList[(i * 6) + 5];

        return { ip, port };
    }

    async function pingServer(server) {
        serversPinged++;
        try {
            let result = {};
            let response = await (game == 'java' ? ping : bedrockPing)(server.ip, server.port, 774, config[game].timeout);
            let lastSeen = Math.floor(Date.now() / 1000);
            if (response == null || typeof response != 'object') return;
            resultCount++;
            if (config[game].ping) {
                if (config[game].postgres || (config[game].saveToFile && !config[game].compressed)) {
                    if (game == 'java') {
                        result = {
                            ip: server.ip,
                            port: server.port,
                            version: response.version,
                            players: response.players,
                            description: response.description,
                            enforcesSecureChat: response.enforcesSecureChat,
                            hasFavicon: response.favicon != null,
                            hasForgeData: response.forgeData != null,
                            lastSeen: lastSeen
                        }
                    } else result = response;
                    let location = cityLookup.get(server.ip);
                    if (location != null) {
                        result['geo'] = {};
                        if (location.country != null) {
                            result['geo']['country'] = location.country.iso_code;
                        } else {
                            result['geo']['country'] = location.registered_country.iso_code;
                        }
                        if (location.city != null) {
                            result['geo']['city'] = location.city.names.en;
                            result['geo']['lat'] = location.location.latitude;
                            result['geo']['lon'] = location.location.longitude;
                        }
                    }
                    let org = asnLookup.get(server.ip);
                    if (org != null) result['org'] = org.autonomous_system_organization;
                }
            }

            if (game == 'java' && scanAuth && (config[game].postgres || (config[game].saveToFile && !config[game].compressed))) {
                const auth = await authCheck(server.ip, server.port, (response.version?.protocol == null || minecraftData(response.version.protocol) == null) ? 763 : response.version.protocol, config[game].timeout);
                if (typeof auth != 'string') result.cracked = auth;
            }

            if (config[game].postgres) {
                let newIp = server.ip.split('.').reverse().map((a, i) => parseInt(a) * 256**i).reduce((a, b) => a + b, 0) - 2147483648;
                let newPort = server.port - 32768;

                if (game == 'java' && config[game].ping) {
                    if (response.players?.sample != null && Array.isArray(response.players.sample)) {
                        for (const player of response.players.sample) {
                            if (
                                typeof player.name != 'string' || player.name.length == 0 || player.name.length > 16 || player.name.split('').some(a => !usernameChars.includes(a)) ||
                                typeof player.id != 'string' || player.id.length != 36 || player.id.split('').some(a => !uuidChars.includes(a))
                            ) continue;
                            playerQueue.push([player.name, player.id, result.lastSeen, newIp, newPort]);
                        }
                    }
                }

                if (game == 'java') {
                    serverQueue.push([
                        newIp,
                        newPort,
                        lastSeen,
                        lastSeen,
                        result.version?.name,
                        result.version?.protocol,
                        cleanDescription(result.description),
                        JSON.stringify(result.description),
                        result.players?.online,
                        result.players?.max,
                        result.hasFavicon,
                        result.hasForgeData,
                        result.enforcesSecureChat,
                        result.org,
                        result.geo?.country,
                        result.geo?.city,
                        result.geo?.lat,
                        result.geo?.lon
                    ].concat(
                        scanAuth ? [result.cracked] : [],
                        [result.players?.sample != null]
                    ));
                } else {
                    bedrockQueue.push([
                        newIp,
                        newPort,
                        lastSeen,
                        lastSeen,
                        result.edition == 'MCEE',
                        result.version.name,
                        parseInt(result.version.protocol),
                        cleanDescription(result.description),
                        result.description,
                        cleanDescription(result.description2),
                        result.description2,
                        parseInt(result.players.online),
                        parseInt(result.players.max),
                        result.gamemode.name,
                        parseInt(result.gamemode.id),
                        result.org,
                        result.geo?.country,
                        result.geo?.city,
                        Number(result.geo?.lat),
                        Number(result.geo?.lon)
                    ].map(a => (typeof a == 'number' && isNaN(a)) ? null : a));
                }
            }
            if (config[game].saveToFile) {
                result.players = response.players;
                if (config[game].compressed) {
                    const splitIP = server.ip.split('.');
                    writeStream.write(Buffer.from([
                        parseInt(splitIP[0]),
                        parseInt(splitIP[1]),
                        parseInt(splitIP[2]),
                        parseInt(splitIP[3]),
                        Math.floor(server.port / 256),
                        server.port % 256
                    ]));
                } else {
                    writeStream.write(`${resultCount > 1 ? ',' : ''}\n${JSON.stringify(result)}`);
                }
            }
        } catch (error) {
            console.log(error);
        }
    }

    console.log(`[${game}] Starting search...`);
    let startTime = Date.now();
    const progressLog = setInterval(() => {
        const averageRate = Math.floor((Date.now() - startTime) / 1000) / serversPinged;
        let estimatedTime = Math.floor(totalServers - serversPinged) * averageRate;
        const hours = Math.floor(estimatedTime / 3600);
        estimatedTime %= 3600;
        const minutes = Math.floor(estimatedTime / 60);
        estimatedTime %= 60
        const seconds = Math.floor(estimatedTime);
        let queueLogs = [['Servers', serverQueue.length], ['Players', playerQueue.length], ['Servers', bedrockQueue.length]].filter(a => a[1] > 0);
        console.log(`[${game}] ${serversPinged}/${totalServers} (${Math.floor(serversPinged / totalServers * 100)}%)  Results: ${resultCount}  Estimated ${hours > 0 ? `${hours}:${minutes < 10 ? 0 : ''}${minutes}` : minutes}:${seconds < 10 ? 0 : ''}${seconds} remaining.${config[game].postgres ? `  Queues: ${queueLogs.map(a => `${a[0]}: ${a[1]}`).join(', ')}` : ''}`);
    }, 3000);
    serversPinged = 0;
    var startNum = Math.floor(Math.random() * totalServers) * 6;
    serverList = Buffer.concat([serverList.slice(startNum), serverList.slice(0, startNum)]);
    for (let j = 0; j < totalServers; j++) {
        await new Promise(res => {
            let interval = setInterval(() => {
                if (
                    serverQueue.length < config.postgres.batch.java.servers.max &&
                    playerQueue.length < config.postgres.batch.java.players.max &&
                    bedrockQueue.length < config.postgres.batch.bedrock.servers.max
                ) {
                    clearInterval(interval);
                    res();
                }
            });
        });
        pingServer(getServer(j));
        await new Promise(res => setTimeout(res, (1 / config[game].rate) * 1000));
    }
    await new Promise(res => setTimeout(res, config[game].timeout));
    clearInterval(progressLog);
    finished = true;
    console.log(`[${game}] Scan complete. (duration: ${((Date.now() - startTime) / 1000).toFixed(1)} seconds,  responses: ${resultCount.toLocaleString()})`);
    await new Promise(res => {
        let start = Date.now();
        let interval = setInterval(() => {
            let queueLogs = [['Servers', serverQueue.length], ['Players', playerQueue.length], ['Servers', bedrockQueue.length]].filter(a => a[1] > 0);
            if (queueLogs.length == 0) {
                clearInterval(interval);
                res();
            } else console.log(`Waiting for database queries to complete:  ${queueLogs.map(a => `${a[0]}: ${a[1]}`).join('  ')}`);
        }, 100)
    });
    if (config[game].saveToFile) {
        if (!config[game].compressed) writeStream.write('\n]');
        writeStream.close();
        console.log(`[${game}] Saved results to ${writeStream.path}`);
    }
}

(async () => {
    if (pool) {
        pool.on('connect', client => {
            client.query(`SET statement_timeout = ${config.postgres.timeout}`).catch(err => {
                console.error('Failed to set statement_timeout for upsert pool:', err);
            });
        });
        try {
            await pool.query('SELECT 1');
            console.log('Connected to database');
        } catch (err) {
            console.error('Error connecting to database:', err);
            process.exit(1);
        }
    }
    if (config.java.scan) await main('java');
    if (config.bedrock.scan) await main('bedrock');
    process.exit();
})();
