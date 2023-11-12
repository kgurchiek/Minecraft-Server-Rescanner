# Minecraft Server Rescanner
Used to gather updated info from https://github.com/kgurchiek/Minecraft-Server-Scanner

## Usage
First, set up a Mongo database. You can have one hosted for free at https://www.mongodb.com/cloud/atlas. Then put its URI into config.json.

Install the required npm packages with the following command: `npm install minecraft-status, mongodb`.

The script will write all ping results to the collection specified in the config file.

## Configs
- **saveToMongo:** Whether or not to write results to a mongodb
- **mongoURI:** The URI used to connect to your Mongo database \(only used if `saveToMongo` is set to `true`\)
- **collectionName:** The name of the collection you want to save the results in \(only used if `saveToMongo` is set to `true`\)
- **saveToFile:** Whether or not to save results to a local file \(saved to the name `results`\)
- **compressed:** If `false`, ping results are stored as a json. If `true`, only the ips and ports of confirmed Minecraft servers are stored in the compressed format used by [Minecraft-Server-Scanner](https://github.com/kgurchiek/Minecraft-Server-Scanner) \(4 bytes for the ip, 2 for the port\).
- **repeat:** Whether or not to automatically scan again after the scan is finished
- **repeatDelay:** How long to wait between automated rescans
- **maxPings:** The maximum number of pings sent at once
- **pingTimeout:** How long to wait for a response before deciding a server is offline
- **pingDelay:** How long to wait between ping "chunks"
- **customIps:** Whether or not you want to use your own list of ips rather than fetching from my scan
- **ipsPath:** The relative file path to the list of ips to rescan \(only used if `customIps` is set to `true`\)

## How It Works
The code from https://github.com/kgurchiek/Minecraft-Server-Scanner is being constantly run, updating the ips file. This code gets the file from github and rescans those ips to get updated information.

# Information
This product includes GeoLite2 data created by MaxMind, available from https://www.maxmind.com.
