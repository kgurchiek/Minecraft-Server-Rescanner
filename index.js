// Fetches dependencies and inits variables
const config = require('./config.json');
const { MinecraftServerListPing } = require("minecraft-status");
var maxmind = require('maxmind');
const { MongoClient } = require('mongodb');
const client = new MongoClient(config.mongoURI);
const scannedServers = client.db("MCSS").collection(config.dbName);
const scanDelay = config.scanDelay;
const maxPings = config.maxPings;
const pingTimeout = config.pingTimeout;
const pingDelay = config.pingDelay;
var serverList;
var totalServers;

async function main() {
  const cityLookup = await maxmind.open('./GeoLite2-City.mmdb');
  const asnLookup = await maxmind.open('./GeoLite2-ASN.mmdb');
  serverList = Buffer.from(await (await fetch('https://github.com/kgurchiek/Minecraft-Server-Scanner/raw/main/ips')).arrayBuffer());
  totalServers = serverList.length / 6;
  console.log(`Total servers: ${totalServers}`);
  var serversPinged = 0;
  var startTime = new Date();
  var operations = [];
  
  // start randomly within the list to vary which servers come first, since packet loss gets worse futher into the scan
  var startNum = Math.round(Math.random() * Math.floor(totalServers / maxPings)) * maxPings;
  if (startNum == 0) startNum = maxPings;

  function getServer(i) {
    const ip = `${serverList[i * 6]}.${serverList[(i * 6) + 1]}.${serverList[(i * 6) + 2]}.${serverList[(i * 6) + 3]}`;
    const port = serverList[(i * 6) + 4] * 256 + serverList[(i * 6) + 5];

    return { ip, port }
  }

  async function pingServer(server) {
    serversPinged++;
    if (serversPinged % 20000 == 0) console.log(serversPinged);
    try {
      const response = await MinecraftServerListPing.ping(0, server.ip, server.port, pingTimeout);
      if (typeof response === 'object') {
        const lastSeen = Math.floor((new Date()).getTime() / 1000);
        newObj = {
          ip: server.ip,
          port: server.port,
          version: response.version,
          players: { max: response.players.max, online: response.players.online },
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
        operations.push({
          updateOne: {
            filter: { ip: server.ip, port: server.port },
            update: { $set: newObj },
            upsert: true
          }
        });
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

        if (operations.length >= 3000) {
          scannedServers.bulkWrite(operations)
          .catch(err => {
            console.log(err);
          })
          operations = [];
        }
      }
    } catch (error) {
      //console.log(error)
    }
  }

  function scanBatch(i) {
    if (i >= startNum) {
      if (i + maxPings < totalServers) {
        // scan through the end of the server list
        for (var j = i; j < i + maxPings; j++) {
          pingServer(getServer(j))
        }
        setTimeout(function() { scanBatch(i + maxPings) }, pingDelay);
      } else {
        // once the end of the list is reached, restart at the beginning
        for (var j = i; j < totalServers; j++) {
          pingServer(getServer(j))
        }
        setTimeout(function() { scanBatch(0) }, pingDelay);
      }
    } else {
      // scan up to the server that was started with (after restarting at the beginning)
      if (i + maxPings < startNum) {
        for (var j = i; j < i + maxPings; j++) {
          pingServer(getServer(j))
        }
        setTimeout(function() { scanBatch(i + maxPings) }, pingDelay);
      } else {
        for (var j = i; j < startNum - i; j++) {
          pingServer(getServer(j))
        }

        // finish scan
        scannedServers.bulkWrite(operations)
        .catch(err => {
          console.log(err);
        })
        operations = [];
        console.log(`Finished scanning in ${(new Date() - startTime) / 1000} seconds at ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}.`);
        setTimeout(function(){ main() }, scanDelay)
      }
    }
  }

  console.log("Starting search...");
  scanBatch(startNum);
}

main();
