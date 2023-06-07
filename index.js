// Fetches dependencies and inits variables
const config = require('./config.json');
const { MinecraftServerListPing } = require("minecraft-status");
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
        newObj = {
          ip: server.ip,
          port: server.port,
          version: response.version,
          players: response.players,
          description: response.description,
          enforcesSecureChat: response.enforcesSecureChat,
          hasFavicon: response.favicon != null,
          hasForgeData: response.forgeData != null,
          lastSeen: Math.floor((new Date()).getTime() / 1000)
        }
        //scannedServers.updateOne({ ip: server.ip, port: server.port }, { $set: newObj }, { upsert: true } )
        operations.push({
          updateOne: {
            filter: { ip: server.ip, port: server.port },
            update: { $set: newObj },
            upsert: true
          }
        });

        if (operations.length == 1000) {
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
        console.log(`Finished scanning in ${(new Date() - startTime) / 1000} seconds at ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })}.`);
        setTimeout(function(){ main() }, scanDelay)
      }
    }
  }

  console.log("Starting search...");
  scanBatch(startNum);
}

main();
