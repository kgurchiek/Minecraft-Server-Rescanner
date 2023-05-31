# Minecraft Server Rescanner
Used to gather updated info from https://github.com/kgurchiek/Minecraft-Server-Scanner

## Usage
First, set up a Mongo database. You can have one hosted for free at https://www.mongodb.com/cloud/atlas. Then put its URI into config.json.

Install the required npm packages with the following command: `npm install minecraft-status, mongodb`.

The script will write all ping results to the collection specified in the config file.

## Configs
- **mongoURI:** The URI used to connect to your Mongo database
- **collectionName:** The name of the collection you want to save the results in
- **scanDelay:** How long to wait between automated rescans
- **maxPings:** The maximum number of pings sent at once
- **pingTimeout:** How long to wait for a response before deciding a server is offline
- **pingDelay:** How long to wait between ping "chunks"

## How It Works
The code from https://github.com/kgurchiek/Minecraft-Server-Scanner is being constantly run, updating the ips file. This code gets the file from github and rescans those ips to get updated information.
