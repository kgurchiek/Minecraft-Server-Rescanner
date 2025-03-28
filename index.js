// Fetches dependencies and inits variables
const config = require('./config.json');
const maxmind = require('maxmind');
const minecraftData = require('minecraft-data');
const { ping, authCheck } = require('./ping.js');
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
const fs = (config.saveToFile || config.customIps) ? require('fs') : null;
let serverList;
let totalServers;
let lastAuth = 0;

function timeout(func, delay, ms) {
  if (ms >= delay) func(config.auth && new Date().getTime() >= lastAuth + config.authRepeatDelay);
  else setTimeout(() => { timeout(func, delay, ms + 100) }, 100);
}

function cleanDescription(description) {
  if (description == null) return null;
  if (typeof description == 'string') return description;
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

async function main(scanAuth = false) {
  const startTime = new Date();
  const cityLookup = await maxmind.open('./GeoLite2-City.mmdb');
  const asnLookup = await maxmind.open('./GeoLite2-ASN.mmdb');
  serverList = config.customIps ? fs.readFileSync(config.ipsPath) : Buffer.from(await (await fetch('https://github.com/kgurchiek/Minecraft-Server-Scanner/raw/main/ips')).arrayBuffer());
  totalServers = serverList.length / 6;
  console.log(`Total servers: ${totalServers}`);
  let serversPinged = 0;
  let resultCount = 0;
  let serverQueue = [];
  let playerQueue = [];
  let historyQueue = [];

  function writeServers(servers) {
    // console.log('Writing servers to db');
    let placeholder = 1;
    let rows = new Array(servers.length).fill(null).map(a => `(${new Array(servers[0].length).fill(null).map(a => `$${placeholder++}`).join(', ')})`).join(',');
    let params = servers.reduce((a, b) => a.concat(b), []);
    servers = [];
    client.query(`INSERT INTO servers (ip, port, discovered, lastSeen, version, protocol, description, rawDescription, playerCount, playerLimit, hasFavicon, hasForgeData, enforcesSecureChat, org, country, city, lat, lon, cracked, whitelisted, hasPlayerSample)
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
      hasPlayerSample = excluded.hasPlayerSample;`,
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
  
  let writeStream = config.saveToFile ? fs.createWriteStream('./results') : null;
  if (config.saveToFile && !config.compressed) writeStream.write('[')
  
  // start randomly within the list to vary which servers come first, since packet loss gets worse futher into the scan
  let startNum = Math.floor(Math.random() * Math.floor(totalServers / config.maxPings)) * config.maxPings;
  if (startNum == 0) startNum = config.maxPings;

  function getServer(i) {
    const ip = `${serverList[i * 6]}.${serverList[(i * 6) + 1]}.${serverList[(i * 6) + 2]}.${serverList[(i * 6) + 3]}`;
    const port = serverList[(i * 6) + 4] * 256 + serverList[(i * 6) + 5];

    return { ip, port }
  }

  async function pingServer(server) {
    serversPinged++;
    if (serversPinged % 20000 == 0) console.log(serversPinged);
    try {
      let result = {};
      const response = await ping(server.ip, server.port, 0, config.pingTimeout);
      const lastSeen = Math.floor((new Date()).getTime() / 1000);
      if (typeof response !== 'object') return;
      resultCount++;
      if (config.ping) {
        if (config.postgres || (config.saveToFile && !config.compressed)) {
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

      if (scanAuth && (config.postgres || (config.saveToFile && !config.compressed))) {
        const auth = await authCheck(server.ip, server.port, minecraftData(response.version.protocol) == null ? 763 : response.version.protocol, config.pingTimeout);
        if (typeof auth != 'string') result.cracked = auth;
      }

      if (config.postgres) {
        let newIp = result.ip.split('.').reverse().map((a, i) => parseInt(a) * 256**i).reduce((a, b) => a + b, 0) - 2147483648;
        let newPort = result.port - 32768;

        if (config.ping) {
          if (response.players?.sample != null && Array.isArray(response.players.sample)) {
            for (const player of response.players.sample) {
              if (player.name == null || player.id == null || typeof player.name != 'string' || typeof player.id != 'string') continue;
              playerQueue.push([player.name, player.id]);
              historyQueue.push([newIp, newPort, player.name, player.id, result.lastSeen]);
              if ((playerQueue.length > 0 && playerQueue.length >= 32767 / playerQueue[0].length - 1) || (historyQueue.length > 0 && historyQueue.length >= 32767 / historyQueue[0].length - 1)) writePlayers(playerQueue.splice(0), historyQueue.splice(0));
            }
          }
        }

        serverQueue.push([
          newIp,
          newPort,
          result.lastSeen,
          result.lastSeen,
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
        if (serverQueue.length > 0 && serverQueue.length >= 32767 / serverQueue[0].length - 1) writeServers(serverQueue.splice(0));
      }
      if (config.saveToFile) {
        result.players = response.players;
        if (config.compressed) {
          const splitIP = result.ip.split('.');
          writeStream.write(Buffer.from([
            parseInt(splitIP[0]),
            parseInt(splitIP[1]),
            parseInt(splitIP[2]),
            parseInt(splitIP[3]),
            Math.floor(result.port / 256),
            result.port % 256
          ]));
        } else {
          writeStream.write('\n' + JSON.stringify(result));
        }
      }
    } catch (error) {
      console.log(error)
    }
  }

  function scanBatch(i) {
    if (i >= startNum) {
      if (i + config.maxPings < totalServers) {
        // scan through the end of the server list
        for (let j = i; j < i + config.maxPings; j++) {
          pingServer(getServer(j))
        }
        setTimeout(function() { scanBatch(i + config.maxPings) }, config.pingDelay);
      } else {
        // once the end of the list is reached, restart at the beginning
        for (let j = i; j < totalServers; j++) {
          pingServer(getServer(j))
        }
        setTimeout(function() { scanBatch(0) }, config.pingDelay);
      }
    } else {
      // scan up to the server that was started with (after restarting at the beginning)
      if (i + config.maxPings < startNum) {
        for (let j = i; j < i + config.maxPings; j++) {
          pingServer(getServer(j))
        }
        setTimeout(function() { scanBatch(i + config.maxPings) }, config.pingDelay);
      } else {
        for (let j = i; j < startNum - i; j++) {
          pingServer(getServer(j))
        }

        // finish scan
        if (serverQueue.length > 0) writeServers(serverQueue.splice(0));
        if (playerQueue.length > 0 || historyQueue.length > 0) writePlayers(playerQueue.splice(0), historyQueue.splice(0));

        if (config.saveToFile) {
          if (!config.compressed) writeStream.write(']');
          writeStream.end();
        }
        console.log(`Finished scanning ${resultCount} servers in ${(new Date() - startTime) / 1000} seconds at ${new Date().toLocaleString()}.`);
        lastAuth = new Date().getTime();
        if (config.repeat) timeout(main, config.repeatDelay, 0);
      }
    }
  }

  console.log('Starting search...');
  scanBatch(startNum);
}

(async () => {
  if (config.postgres) {
    await client.connect();
    console.log('Connected to database');
  }
  main(config.auth);
})();