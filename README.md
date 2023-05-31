# Minecraft-Server-Rescanner
Used to gather updated info from https://github.com/kgurchiek/Minecraft-Server-Scanner

## Usage
First, set up a mongo database. You can have one hosted for free at https://www.mongodb.com/cloud/atlas. Then put its URI into config.json.

Install the required npm packages with the following command: `npm install minecraft-status, mongodb`.

The script will write all ping results to the collection specified in the config file.

## How It Works
The code from https://github.com/kgurchiek/Minecraft-Server-Scanner is being constantly run, updating the ips file. This code gets the file from github and rescans those ips to get updated information.
