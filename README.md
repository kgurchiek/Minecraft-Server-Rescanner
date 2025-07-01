# Minecraft Server Rescanner
Used to gather updated info from https://github.com/kgurchiek/Minecraft-Server-Scanner

## Usage
- Set up a Postgres database and fill in the "`postgres`" settings in `config.json`.
- Install the required npm packages with the following command: `npm install`.
- If you wish to use your own list of ips

## Configs
- **java**
  - **scan:** Whether or not to scan Java Edition servers
  - **ping:** Whether or not to save status ping results from the server
  - **rate:** How many pings to send per second
  - **timeout:** How many milliseconds to wait until deciding that a server is offline
  - **auth:** Whether or not to check for the authentication mode (online or cracked) of the server
  - **authScanDelay:** How long to wait between auth scans
  - **saveToFile:** Whether or not to save results to a local file \(saved to "`results.json`", or "`results`" if compressed\)
  - **compressed:** If `false`, ping results are stored as a json. If `true`, only the ips and ports of confirmed Minecraft servers are stored in the compressed format used by [Minecraft-Server-Scanner](https://github.com/kgurchiek/Minecraft-Server-Scanner) \(4 bytes for the ip, 2 for the port\)
  - **postgres:** Whether or not to write results to a PostgreSQL database
  - **customIps:** If `true`, ips are taken from the file specified in `java.ipsPath`. Otherwise, they're pulled from [my public scans](https://github.com/kgurchiek/Minecraft-Server-Scanner)
  - **ipsPath:** Path to custom ips list \(only used if `java.customIps` is set to `true`\)

- **bedrock**
  - **scan:** Whether or not to scan Java Edition servers
  - **ping:** Whether or not to save status ping results from the server
  - **rate:** How many pings to send per second
  - **timeout:** How many milliseconds to wait until deciding that a server is offline
  - **saveToFile:** Whether or not to save results to a local file \(saved to "`results_b.json`", or "`results_b`" if compressed\)
  - **compressed:** If `false`, ping results are stored as a json. If `true`, only the ips and ports of confirmed Minecraft servers are stored in the compressed format used by [Minecraft-Server-Scanner](https://github.com/kgurchiek/Minecraft-Server-Scanner) \(4 bytes for the ip, 2 for the port\)
  - **postgres:** Whether or not to write results to a PostgreSQL database
  - **customIps:** If `true`, ips are taken from the file specified in `bedrock.ipsPath`. Otherwise, they're pulled from [my public scans](https://github.com/kgurchiek/Minecraft-Server-Scanner)
  - **ipsPath:** Path to custom ips list \(only used if `bedrock.customIps` is set to `true`\) 
- **postgres:** Info required to connect to your PostgreSQL sever \(only used if `java.postgres` or `bedrock.postgres` are set to `true`\)
    - **host**
    - **port**
    - **user**
    - **password**
    - **database**
- **repeat:** Whether or not to automatically scan again after the scan is finished
- **repeatDelay:** How long to wait between automated rescans

## How It Works
The code from https://github.com/kgurchiek/Minecraft-Server-Scanner is being constantly run, updating the `ips` and `ibs_b` files. This script gets the file from github and scans those ips again to get updated information.

# Information
This product includes GeoLite2 data created by MaxMind, available from https://www.maxmind.com.
