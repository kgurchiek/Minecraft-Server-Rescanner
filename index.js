// Fetches dependencies and inits variables
const config = require('./config.json');
const { MinecraftServerListPing } = require("minecraft-status");
var maxmind = require('maxmind');
var scannedServers;
if (config.saveToMongo) {
  const MongoClient = require('mongodb').MongoClient;
  const client = new MongoClient(config.mongoURI);
  scannedServers = client.db("MCSS").collection(config.dbName);
}
var fs = config.writeToFile || config.customIps ? fs = require('fs') : null;
var serverList;
var totalServers;

async function main() {
  const cityLookup = await maxmind.open('./GeoLite2-City.mmdb');
  const asnLookup = await maxmind.open('./GeoLite2-ASN.mmdb');
  if (config.customIps) {
    serverList = fs.readFileSync(config.ipsPath);
  } else {
    serverList = Buffer.from(await (await fetch('https://github.com/kgurchiek/Minecraft-Server-Scanner/raw/main/ips')).arrayBuffer());
  }
  totalServers = serverList.length / 6;
  console.log(`Total servers: ${totalServers}`);
  var serversPinged = 0;
  var startTime = new Date();
  var operations = [];
  var writeStream = config.writeToFile ? fs.createWriteStream('./results') : null;
  if (config.writeToFile) writeStream.write('[')
  
  // start randomly within the list to vary which servers come first, since packet loss gets worse futher into the scan
  var startNum = Math.round(Math.random() * Math.floor(totalServers / config.maxPings)) * config.maxPings;
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
      const response = await MinecraftServerListPing.ping(0, server.ip, server.port, config.pingTimeout);
      if (typeof response === 'object') {
        const lastSeen = Math.floor((new Date()).getTime() / 1000);
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
        var location = await cityLookup.get(server.ip);
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
        var org = await asnLookup.get(server.ip);
        if (org != null) newObj['org'] = org.autonomous_system_organization;

        //scannedServers.updateOne({ ip: server.ip, port: server.port }, { $set: newObj }, { upsert: true } )
        if (config.saveToMongo) {
          newObj['players.max'] = response.players.max, 
          newObj['players.online'] = response.players.online,
          operations.push({
            updateOne: {
              filter: { ip: server.ip, port: server.port },
              update: { $set: newObj },
              upsert: true
            }
          });
          if (Array.isArray(response.players.sample)) {
            for (const player of response.players.sample) {
              player['lastSeen'] = lastSeen;
              operations.push({
                updateOne: { 
                  filter: { ip: server.ip, "port": server.port }, 
                  update: { "$pull": { "players.sample": { name: player.name, id: player.id } } }
                }
              });
              operations.push({
                updateOne: { 
                  filter: { ip: server.ip, "port": server.port }, 
                  update: { "$push": { "players.sample": player } }
                }
              });
            }
          }

          if (operations.length >= 3000) {
            console.log('Writing to db');
            scannedServers.bulkWrite(operations)
            .catch(err => {
              console.log(err);
            })
            operations = [];
          }
        } else if (config.writeToFile) {
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
          console.log('Writing to db');
          scannedServers.bulkWrite(operations)
          .catch(err => {
            console.log(err);
          })
          operations = [];
        }
        if (config.writeToFile) {
          if (!config.compressed) writeStream.write(']');
          writeStream.end();
        }
        console.log(`Finished scanning in ${(new Date() - startTime) / 1000} seconds at ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}.`);
        if (config.repeat) setTimeout(function(){ main() }, config.repeatDelay)
      }
    }
  }

  console.log("Starting search...");
  scanBatch(startNum);
}

main();
