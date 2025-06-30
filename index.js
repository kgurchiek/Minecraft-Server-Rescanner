// Fetches dependencies and inits variables
const config = require('./config.json');
const fs = require('fs');
const maxmind = require('maxmind');
const minecraftData = require('minecraft-data');
const { ping, bedrockPing, authCheck } = require('./ping.js');
let client;
if (config.postgres) {
  const pg = require('pg');
  client = new pg.Client({
    host: config.sql.host,
    port: config.sql.port,
    user: config.sql.user,
    password: config.sql.password,
    database: config.sql.database,
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  });
}
let serverList;
let bedrockServers;
let totalServers;
let totalBedrock;
let lastAuth = 0;
try {
  let data = fs.readFileSync('./lastAuth');
  if (data?.length == 8) lastAuth = Number(data.readBigUint64BE());
  else {
    console.error('Deleting corrupted lastAuth file');
    fs.unlinkSync('./lastAuth');
  }
} catch (err) {}

function timeout(func, delay, ms = 0) {
  if (ms >= delay) func();
  else setTimeout(() => { timeout(func, delay, ms + 100) }, 100);
}

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

async function main(game) {
  let scanAuth = config.auth && Date.now() / 1000 >= lastAuth + config.authRepeatDelay;
  if (scanAuth) {
    console.log('Auth scan');
    lastAuth = Math.round(Date.now() / 1000);
    let buf = Buffer.alloc(8);
    buf.writeBigUInt64BE(BigInt(lastAuth));
    fs.writeFileSync('./lastAuth', buf);
  }
  const cityLookup = await maxmind.open('./GeoLite2-City.mmdb');
  const asnLookup = await maxmind.open('./GeoLite2-ASN.mmdb');
  if (config.customIps) {
    if (config.java) serverList = fs.readFileSync(config.javaIps);
    if (config.bedrock) bedrockServers = fs.readFileSync(config.bedrockIps);
  } else {
    serverList = null;
    while (serverList == null) {
      try {
        serverList = Buffer.from(await (await fetch('https://github.com/kgurchiek/Minecraft-Server-Scanner/raw/main/ips')).arrayBuffer());
      } catch (err) {
        console.error('Error fetching server list:', err);
        await new Promise(res => setTimeout(res, 1000));
      }
    }
  }
  if (config.java) serverList = Math.floor(serverList.length / 6);
  if (config.bedrock) totalBedrock = Math.floor(bedrockServers.length / 6);
  console.log(`Total servers: ${game == 'java' ? totalServers : totalBedrock}`);
  let serversPinged = 0;
  let resultCount = 0;
  let serverQueue = [];
  let playerQueue = [];
  let historyQueue = [];
  let bedrockQueue = [];

  function writeServers(servers) {
    // console.log('Writing servers to db');
    let placeholder = 1;
    let rows = new Array(servers.length).fill(null).map(a => `(${new Array(servers[0].length).fill(null).map(a => `$${placeholder++}`).concat([`to_tsvector('simple', $${placeholder - 15})`]).join(', ')})`).join(',');
    let params = servers.reduce((a, b) => a.concat(b), []);
    servers = [];
    client.query(`INSERT INTO servers (ip, port, discovered, lastSeen, version, protocol, description, rawDescription, playerCount, playerLimit, hasFavicon, hasForgeData, enforcesSecureChat, org, country, city, lat, lon, cracked, whitelisted, hasPlayerSample, descriptionVector)
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
      cracked = excluded.cracked,
      whitelisted = excluded.whitelisted,
      hasPlayerSample = excluded.hasPlayerSample,
      descriptionVector = excluded.descriptionVector;`,
      params
    )
    .catch(err => console.error('Error writing servers to db:', err))
  }

  async function writePlayers(players, history) {
    // console.log('Writing players to db');
    if (players.length > 0) {
      try {
        let placeholder = 1;
        let rows = new Array(players.length).fill(null).map(a => `(${new Array(players[0].length).fill(null).map(a => `$${placeholder++}`).join(', ')})`).join(',');
        let params = players.reduce((a, b) => a.concat(b), []);
        players = [];
        await client.query(`INSERT INTO players (name, id) VALUES ${rows} ON CONFLICT (name, id) DO NOTHING;`, params)
      } catch (err) {
        console.error('Error writing players to db:', err);
      }
    }
    if (history.length > 0) writeHistory(history);
  }

  function compareArray(a1, a2) {
    for (let i = 0; i < a1.length; i++) if (a1[i] != a2[i]) return false;
    return true;
  }

  function writeHistory(history) {
    // console.log('Writing history to db');
    let placeholder = 1;
    history = history.reduce((a, b) => a.concat(a.find(c => compareArray(b.slice(0, 4), c.slice(0, 4))) ? [] : [b]), []);
    let rows = new Array(history.length).fill(null).map(a => `((SELECT serverId FROM servers WHERE ip = $${placeholder++} AND port = $${placeholder++}), (SELECT playerId FROM players WHERE name = $${placeholder++} AND id = $${placeholder++}), $${placeholder++})`).join(',');
    let params = history.reduce((a, b) => a.concat(b), []);
    history = [];
    client.query(`INSERT INTO history (serverId, playerId, lastSession) VALUES ${rows}
      ON CONFLICT (serverId, playerId) DO UPDATE SET lastSession = excluded.lastSession;`,
      params
    )
    .catch(err => console.error('Error writing history to db:', err))
  }
  
  function writeBedrock(servers) {
    // console.log('Writing servers to db');
    let placeholder = 1;
    let rows = new Array(servers.length).fill(null).map(a => `(${new Array(servers[0].length).fill(null).map(a => `$${placeholder++}`).join(', ')})`).join(',');
    let params = servers.reduce((a, b) => a.concat(b), []);
    servers = [];
    client.query(`INSERT INTO bedrock (ip, port, discovered, lastSeen, education, version, protocol, description, rawDescription, description2, rawDescription2, playerCount, playerLimit, gameMode, modeId, org, country, city, lat, lon)
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
    .catch(err => console.error('Error writing servers to db:', err))
  }
  
  let writeStream = config.saveToFile ? fs.createWriteStream(`results${config.compressed ? '' : '.json'}`) : null;
  let bedrockStream = config.saveToFile ? fs.createWriteStream(`results_b${config.compressed ? '' : '.json'}`) : null;
  if (config.saveToFile && !config.compressed) {
    if (config.java) writeStream.write('[');
    if (config.bedrock) bedrockStream.write('[');
  }

  function getServer(i) {
    let servers = game == 'java' ? serverList : bedrockServers;
    const ip = `${servers[i * 6]}.${servers[(i * 6) + 1]}.${servers[(i * 6) + 2]}.${servers[(i * 6) + 3]}`;
    const port = servers[(i * 6) + 4] * 256 + servers[(i * 6) + 5];

    return { ip, port };
  }

  async function pingServer(server) {
    serversPinged++;
    try {
      let result = {};
      let response = await (game == 'java' ? ping : bedrockPing)(server.ip, server.port, 0, config.pingTimeout);
      let lastSeen = Math.floor(Date.now() / 1000);
      if (typeof response !== 'object') return;
      resultCount++;
      if (config.ping) {
        if (config.postgres || (config.saveToFile && !config.compressed)) {
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

      if (game == 'java' && scanAuth && (config.postgres || (config.saveToFile && !config.compressed))) {
        const auth = await authCheck(server.ip, server.port, (response.version?.protocol == null || minecraftData(response.version.protocol) == null) ? 763 : response.version.protocol, config.pingTimeout);
        if (typeof auth != 'string') result.cracked = auth;
      }

      if (config.postgres) {
        let newIp = server.ip.split('.').reverse().map((a, i) => parseInt(a) * 256**i).reduce((a, b) => a + b, 0) - 2147483648;
        let newPort = server.port - 32768;

        if (game == 'java' && config.ping) {
          if (response.players?.sample != null && Array.isArray(response.players.sample)) {
            for (const player of response.players.sample) {
              if (player.name == null || player.id == null || typeof player.name != 'string' || typeof player.id != 'string') continue;
              playerQueue.push([player.name, player.id]);
              historyQueue.push([newIp, newPort, player.name, player.id, result.lastSeen]);
              if ((playerQueue.length > 0 && playerQueue.length >= 32767 / playerQueue[0].length - 1) || (historyQueue.length > 0 && historyQueue.length >= 32767 / historyQueue[0].length - 1)) writePlayers(playerQueue.splice(0), historyQueue.splice(0));
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
            result.geo?.lon,
            result.cracked,
            result.whitelist,
            result.players?.sample != null
          ]);
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
        if (serverQueue.length > 0 && serverQueue.length >= 32767 / serverQueue[0].length - 1) writeServers(serverQueue.splice(0));
        if (bedrockQueue.length > 0 && bedrockQueue.length >= 32767 / bedrockQueue[0].length - 1) writeBedrock(bedrockQueue.splice(0));
      }
      if (config.saveToFile) {
        let stream = game == 'java' ? writeStream : bedrockStream;
        result.players = response.players;
        if (config.compressed) {
          const splitIP = server.ip.split('.');
          stream.write(Buffer.from([
            parseInt(splitIP[0]),
            parseInt(splitIP[1]),
            parseInt(splitIP[2]),
            parseInt(splitIP[3]),
            Math.floor(server.port / 256),
            server.port % 256
          ]));
        } else {
          stream.write(`${resultCount > 1 ? ',' : ''}\n${JSON.stringify(result)}`);
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  console.log('Starting search...');
  let startTime = Date.now();
  let total = game == 'java' ? totalServers : totalBedrock;
  const progressLog = setInterval(() => {
    const averageRate = Math.floor((Date.now() - startTime) / 1000) / serversPinged;
    let estimatedTime = Math.floor(total - serversPinged) * averageRate;
    const hours = Math.floor(estimatedTime / 3600);
    estimatedTime %= 3600;
    const minutes = Math.floor(estimatedTime / 60);
    estimatedTime %= 60
    const seconds = Math.floor(estimatedTime);
    console.log(`${serversPinged}/${total} (${Math.floor(serversPinged / total * 100)}%)  Results: ${resultCount}  Estimated ${hours > 0 ? `${hours}:${minutes < 10 ? 0 : ''}${minutes}` : minutes}:${seconds < 10 ? 0 : ''}${seconds} remaining.`)
  }, 3000);
  serversPinged = 0;
  var startNum = Math.floor(Math.random() * total) * 6;
  if (config.java) serverList = Buffer.concat([serverList.slice(startNum), serverList.slice(0, startNum)]);
  if (config.bedrock) bedrockServers = Buffer.concat([bedrockServers.slice(startNum), bedrockServers.slice(0, startNum)]);
  for (let j = 0; j < total; j++) {
    pingServer(getServer(j));
    await new Promise(res => setTimeout(res, (1 / config.scanRate) * 1000));
  }
  await new Promise(res => setTimeout(res, config.pingTimeout));
  clearInterval(progressLog);
  console.log(`Finished scanning ${resultCount} servers in ${(Date.now() - startTime) / 1000} seconds at ${new Date().toLocaleString()}.`);
  if (config.saveToFile) {
    let stream = game == 'java' ? writeStream : bedrockStream;
    if (!config.compressed) stream.write('\n]');
    stream.close();
    console.log(`Saved results to ${stream.path}`);
  }
  if (config.repeat) timeout(main, config.repeatDelay);
  else process.exit();
}

(async () => {
  if (config.postgres) {
    await client.connect();
    console.log('Connected to database');
  }
  if (config.java) main('java');
  if (config.bedrock) main('bedrock');
})();