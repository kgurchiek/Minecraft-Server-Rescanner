// Fetches dependencies and inits variables
const config = require('./config.json');
const maxmind = require('maxmind');
const minecraftData = require('minecraft-data');
const { ping, authCheck } = require('./ping.js');
var scannedServers;
var players;
if (config.saveToMongo) {
  const MongoClient = require('mongodb').MongoClient;
  scannedServers = new MongoClient(config.mongoURI).db(config.dbName).collection(config.collectionName);
}
var fs = config.saveToFile || config.customIps ? fs = require('fs') : null;
var serverList;
var totalServers;

function timeout(func, delay, ms) {
  if (ms >= delay) func();
  else setTimeout(() => { timeout(func, delay, ms + 100) }, 100);
}

async function main() {
  const cityLookup = await maxmind.open('./GeoLite2-City.mmdb');
  const asnLookup = await maxmind.open('./GeoLite2-ASN.mmdb');
  serverList = config.customIps ? fs.readFileSync(config.ipsPath) : Buffer.from(await (await fetch('https://github.com/kgurchiek/Minecraft-Server-Scanner/raw/main/ips')).arrayBuffer());
  totalServers = serverList.length / 6;
  console.log(`Total servers: ${totalServers}`);
  var serversPinged = 0;
  var resultCount = 0;
  var startTime = new Date();
  var operations = [];
  var playerOperations = [];
  var writeStream = config.saveToFile ? fs.createWriteStream('./results') : null;
  if (config.saveToFile && !config.compressed) writeStream.write('[')

  // start randomly within the list to vary which servers come first, since packet loss gets worse futher into the scan
  var startNum = Math.floor(Math.random() * Math.floor(totalServers / config.maxPings)) * config.maxPings;
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
      var newObj = {};
      const response = await ping(server.ip, server.port, 0, config.pingTimeout);
      const lastSeen = Math.floor((new Date()).getTime() / 1000);
      const dbValue = await scannedServers.findOne({ ip: server.ip, port: server.port });
      if (typeof response !== 'object') return;
      resultCount++;
      if (config.ping) {
        if (!(!config.saveToMongo && config.saveToFile && config.compressed) && config.ping) {
          newObj = {
            ip: server.ip,
            port: server.port,
            version: response.version,
            description: response.description,
            enforcesSecureChat: response.enforcesSecureChat,
            hasFavicon: response.favicon != null,
            hasForgeData: response.forgeData != null,
            lastSeen: lastSeen
          }
          var location = cityLookup.get(server.ip);
          if (location != null) {
            newObj['geo'] = {};
            if (location.country != null) {
              newObj['geo']['country'] = location.country.iso_code;
            } else {
              newObj['geo']['country'] = location.registered_country.iso_code;
            }
            if (location.city != null) {
              newObj['geo']['city'] = location.city.names.en;
              newObj['geo']['lat'] = location.location.latitude;
              newObj['geo']['lon'] = location.location.longitude;
            }
          }
          var org = asnLookup.get(server.ip);
          if (org != null) newObj['org'] = org.autonomous_system_organization;
        }
      }

      if (config.auth && !(!config.saveToMongo && config.saveToFile && config.compressed)) {
        const auth = await authCheck(server.ip, server.port, minecraftData(response.version.protocol) == null ? 763 : response.version.protocol, config.pingTimeout);
        if (typeof auth != 'string') newObj.cracked = auth;
      }

      //scannedServers.updateOne({ ip: server.ip, port: server.port }, { $set: newObj }, { upsert: true } )
      if (config.saveToMongo) {
        const sample = dbValue == null ? [] : dbValue.players.sample;
        if (config.ping) {
          newObj['players.max'] = response.players.max;
          newObj['players.online'] = response.players.online;

          if (Array.isArray(response.players.sample)) {
            for (const player of response.players.sample) {
              player['lastSeen'] = lastSeen;

              // update the database value or add a new one
              if (sample.length > 0) {
                const index = sample.findIndex(p => p.name === player.name);
                if (index !== -1) {
                  sample[index] = player;
                } else {
                  sample.push(player);
                }
              } else {
                sample.push(player);
              }
            }
          }
        }

        // updates the database document with the new values
        const pipeline = [
          {
            '$match': {
              '$and': [
                {
                  'ip': server.ip
                }, {
                  'port': server.port
                }
              ]
            }
          }, {
            '$set': {
              'players.sample': sample,
            }
          }, {
            '$merge': {
              'into': {
                'db': 'MCSS',
                'coll': 'scannedServers'
              },
              'on': '_id',
              'whenMatched': 'replace',
              'whenNotMatched': 'insert'
            }
          }
        ];

        // batching is no longer necessary and this was not implemented correctly
        // if (operations.length >= (config.ping ? 15000 : 5000)) {

        console.log('Writing to db');
        scannedServers.aggregate(pipeline)
            .catch(err => {
              console.log(err);
            })
        operations = [];
      }
      if (config.saveToFile) {
        newObj.players = response.players;
        if (config.compressed) {
          const splitIP = newObj.ip.split('.');
          writeStream.write(Buffer.from([
            parseInt(splitIP[0]),
            parseInt(splitIP[1]),
            parseInt(splitIP[2]),
            parseInt(splitIP[3]),
            Math.floor(newObj.port / 256),
            newObj.port % 256
          ]));
        } else {
          writeStream.write('\n' + JSON.stringify(newObj));
        }
      }
    } catch (error) {
      //console.log(error)
    }
  }

  function scanBatch(i) {
    if (i >= startNum) {
      if (i + config.maxPings < totalServers) {
        // scan through the end of the server list
        for (var j = i; j < i + config.maxPings; j++) {
          pingServer(getServer(j))
        }
        setTimeout(function() { scanBatch(i + config.maxPings) }, config.pingDelay);
      } else {
        // once the end of the list is reached, restart at the beginning
        for (var j = i; j < totalServers; j++) {
          pingServer(getServer(j))
        }
        setTimeout(function() { scanBatch(0) }, config.pingDelay);
      }
    } else {
      // scan up to the server that was started with (after restarting at the beginning)
      if (i + config.maxPings < startNum) {
        for (var j = i; j < i + config.maxPings; j++) {
          pingServer(getServer(j))
        }
        setTimeout(function() { scanBatch(i + config.maxPings) }, config.pingDelay);
      } else {
        for (var j = i; j < startNum - i; j++) {
          pingServer(getServer(j))
        }

        // finish scan
        if (config.saveToMongo) {
          if (config.ping && operations.length > 0) {
            console.log('Writing to db');
            scannedServers.bulkWrite(operations)
                .catch(err => console.log(err))
            operations = [];
          }

          if (config.players && playerOperations.length > 0) {
            console.log('Writing players to db');
            players.bulkWrite(playerOperations)
                .catch(err => console.log(err))
            playerOperations = [];
          }
        }
        if (config.saveToFile) {
          if (!config.compressed) writeStream.write(']');
          writeStream.end();
        }
        console.log(`Finished scanning ${resultCount} servers in ${(new Date() - startTime) / 1000} seconds at ${new Date().toLocaleString()}.`);
        if (config.repeat) timeout(main, config.repeatDelay, 0);
      }
    }
  }

  console.log('Starting search...');
  scanBatch(startNum);
}

main();