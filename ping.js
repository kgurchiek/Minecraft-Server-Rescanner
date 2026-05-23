const dgram = require('dgram');
const varint = require('varint');
const minecraftData = require('minecraft-data');
const send = require('./send.js')

function createHandshake(ip, port, protocol, nextState) {
    let packet = Buffer.concat([
        Buffer.from([0x00]), // packet ID
        Buffer.from(varint.encode(protocol)), //protocol version
        Buffer.from([ip.length]),
        Buffer.from(ip, 'utf-8'), // server address
        Buffer.from(new Uint16Array([port]).buffer).reverse(), // server port
        Buffer.from([nextState])
    ]);
    var packetLength = Buffer.alloc(1);
    packetLength.writeUInt8(packet.length);
    return Buffer.concat([packetLength, packet]);
}


const magic = Buffer.from('00ffff00fefefefefdfdfdfd12345678', 'hex');
const timeBuffer = Buffer.allocUnsafe(8);
timeBuffer.writeBigInt64BE(BigInt(Date.now()), 0);
const clientGUID = Buffer.allocUnsafe(8);
for (let i = 0; i < 8; i++) clientGUID.writeUInt8(Math.floor(Math.random() * 256), i);
const bedrockPacket = Buffer.concat([Buffer.from([0x01]), timeBuffer, magic, clientGUID]);

module.exports = {
    ping: async (ip, port, protocol, timeout) => {
        try {
            let packet = Buffer.concat([
                createHandshake(ip, port, protocol, 1),
                Buffer.from([0x01]), // second packet length
                Buffer.from([0x00]) // status request
            ]);
            let response = await send(ip, port, packet, timeout);
            if (typeof response == 'string') {
                return response;
            }
            if (response[0] != 0) {
                return 'not minecraft';
            }
            response = response.subarray(1);
            const fieldLength = varint.decode(response);
            response = response.subarray(varint.decode.bytes, fieldLength + varint.decode.bytes).toString();
            try {
                return JSON.parse(response);
            } catch (error) {
                //console.log(error.toString(), response)
                return 'error';
            }
        } catch (error) {
            return 'error';
        }
    },
    bedrockPing: (ip, port, protocol, timeout) => {
        return new Promise((resolve, reject) => {
            const timeoutCheck = setTimeout(() => {
                client.close();
                resolve('timeout');
            }, timeout);
            const magic = Buffer.from('00ffff00fefefefefdfdfdfd12345678', 'hex');
            const timeBuffer = Buffer.allocUnsafe(8);
            timeBuffer.writeBigInt64BE(BigInt(Date.now()), 0);
            const clientGUID = Buffer.allocUnsafe(8);
            for (let i = 0; i < 8; i++) clientGUID.writeUInt8(Math.floor(Math.random() * 256), i);
            const packet = Buffer.concat([Buffer.from([0x01]), timeBuffer, magic, clientGUID]);
            const client = dgram.createSocket('udp4');
            client.on('error', (err) => {
                console.log(`Error: ${err}`);
                client.close();
                clearTimeout(timeoutCheck);
                resolve('error');
            });
            client.send(packet, port, ip, (err) => {
                if (err) {
                    console.log('Error sending packet:', err);
                    client.close();
                    clearTimeout(timeoutCheck);
                    resolve('error');
                }
            });
            client.on('message', (message, remote) => {
                client.close();
                clearTimeout(timeoutCheck);
                try {
                    if (message[0] != 0x1c || message.length < 35) return resolve('invalid');
                    message = message.slice(33);
                    let len = message.slice(0, 2).readUint16BE();
                    if (message.length < len + 2) resolve('invalid');
                    message = message.slice(2, len + 2).toString();
                    let [edition, description, protocol, version, playerCount, maxPlayers, id, description2, gamemode, modeId, ipv4Port, ipv6Port] = message.split(';').map(a => a || null);
                    resolve({
                        edition,
                        version: {
                            name: version,
                            protocol
                        },
                        description,
                        description2,
                        players: {
                            online: playerCount,
                            max: maxPlayers
                        },
                        gamemode: {
                            name: gamemode,
                            id: modeId
                        },
                        port: {
                            ipv4: ipv4Port,
                            ipv6: ipv6Port
                        }
                    });
                } catch (err) {
                    console.log(err)
                    resolve('error');
                }
            });
        })
    },
    authCheck: async (ip, port, protocol, timeout) => {
        try {
            const mcData = minecraftData(protocol);
            const username = 'Cornbread2100_';
            
            const packetFormat = mcData.protocol.login.toServer.types.packet_login_start[1];
            var buffers = [createHandshake(ip, port, protocol, 2), Buffer.from([0x00])];
            for (var i = 0; i < packetFormat.length; i++) {
                if (packetFormat[i].type.includes('option')) {
                    buffers.push(Buffer.from([0x00]));
                } else {
                    switch (packetFormat[i].name) {
                        case 'username':
                            buffers.push(Buffer.from([username.length]));
                            buffers.push(Buffer.from(username, 'utf-8')); // username
                            break;
                        case 'playerUUID':
                            buffers.push(Buffer.alloc(16));
                            break;
                        default:
                            break;
                    }
                }
            }

            const startLoginPacket = Buffer.concat(buffers);
            packetLength = Buffer.alloc(1);
            packetLength.writeUInt8(startLoginPacket.length);
            const response = await send(ip, port, Buffer.concat([buffer, packetLength, startLoginPacket]), 6000);
            if (typeof response == 'string') return `Error: ${response}`;
            else return response[0] == 0 ? 'unknown' : (response[0] != 1);
        } catch (error) { return `Error: ${error}`; }
    }
}

