# Minecraft Server Rescanner
Used to gather updated info from https://github.com/kgurchiek/Minecraft-Server-Scanner

## Usage
- Set up a Postgres database and fill in the "`postgres`" settings in `config.json`.
- Install the required npm packages with the following command: `npm install`.
- If you wish to use your own list of ips

## Configs
- **java:** Whether or not to scan Java Edition servers
- **bedrock:** Whether or not to scan Bedrock Edition servers
- **ping:** Whether or not to save status ping results from the server
- **auth:** Whether or not to check for the authentication mode (online or cracked) of the server (java only)
- **postgres:** Whether or not to write results to a PostgreSQL database
    - **host**
    - **port**
    - **user**
    - **password**
    - **database**
- **saveToFile:** Whether or not to save results to a local file \(saved to the name `results`\)
- **compressed:** If `false`, ping results are stored as a json. If `true`, only the ips and ports of confirmed Minecraft servers are stored in the compressed format used by [Minecraft-Server-Scanner](https://github.com/kgurchiek/Minecraft-Server-Scanner) \(4 bytes for the ip, 2 for the port\).
- **repeat:** Whether or not to automatically scan again after the scan is finished
- **repeatDelay:** How long to wait between automated rescans
- **authRepeatDelay:** How long to wait between auth scans
- **scanRate:** How many pings are sent per second
- **pingTimeout:** How long to wait for a response before deciding a server is offline
- **customIps:** Whether or not you want to use your own list of ips rather than fetching from my scan
- **javaIps:** The relative file path to the list of ips to scan for Java Edition servers \(only used if `java` and `customIps` are set to `true`\)
- **bedrockIps:** The relative file path to the list of ips to scan for Bedrock Edition servers \(only used if `bedrock` and `customIps` are set to `true`\)

## How It Works
The code from https://github.com/kgurchiek/Minecraft-Server-Scanner is being constantly run, updating the `ips` and `ibs_b` files. This script gets the file from github and scans those ips again to get updated information.

# Information
This product includes GeoLite2 data created by MaxMind, available from https://www.maxmind.com.
