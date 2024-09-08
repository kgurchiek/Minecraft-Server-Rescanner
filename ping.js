const varint = require('varint');
const minecraftData = require('minecraft-data');
const send = require('./send.js')

module.exports = {
  ping: (ip, port, protocol, timeout) => {
    return new Promise(async (resolve, reject) => {
      try {
        const handshakePacket = Buffer.concat([
          Buffer.from([0x00]), // packet ID
          Buffer.from(varint.encode(protocol)), //protocol version
          Buffer.from([ip.length]),
          Buffer.from(ip, 'utf-8'), // server address
          Buffer.from(new Uint16Array([port]).buffer).reverse(), // server port
          Buffer.from([0x01]), // next state (2)
          Buffer.from([0x01]), // second packet length
          Buffer.from([0x00]) // status request
        ]);
        var packetLength = Buffer.alloc(1);
        packetLength.writeUInt8(handshakePacket.length - 2);
        var buffer = Buffer.concat([packetLength, handshakePacket]);
        var response = await send(ip, port, buffer, timeout);
        if (typeof response == 'string') {
          resolve(response);
          return;
        }
        if (response[0] != 0) {
          resolve('not minecraft');
          return;
        }
        response = response.subarray(1);
        const fieldLength = varint.decode(response);
        response = response.subarray(varint.decode.bytes, fieldLength + varint.decode.bytes).toString();
        try {
          resolve(JSON.parse(response));
        } catch (error) {
          //console.log(error.toString(), response)
          resolve('error');
        }
      } catch (error) {
        resolve('error');
      }
    })
  },
  authCheck: async (ip, port, protocol, timeout) => {
    try {
      const mcData = minecraftData(protocol);
      const username = 'Cornbread2100_`;
      var hasResponded = false;

      const handshakePacket = Buffer.concat([
        Buffer.from([0x00]), // packet ID
        Buffer.from(varint.encode(protocol)), //protocol version
        Buffer.from([ip.length]),
        Buffer.from(ip, 'utf-8'), // server address
        Buffer.from(new Uint16Array([port]).buffer).reverse(), // server port
        Buffer.from([0x02]) // next state (2)
      ]);
      var packetLength = Buffer.alloc(1);
      packetLength.writeUInt8(handshakePacket.length);
      var buffer = Buffer.concat([packetLength, handshakePacket]);

      const packetFormat = mcData.protocol.login.toServer.types.packet_login_start[1];
      var buffers = [Buffer.from([0x00])];
      for (var i = 0; i < packetFormat.length; i++) {
        if (packetFormat[i].type.includes('option')) {
          buffers.push(Buffer.from([0x00]));
        } else {
          switch (packetFormat[i].name) {
            case 'username':
              buffers.push(Buffer.from([username.length])); // length of username
              buffers.push(Buffer.from(username, 'utf-8')); // username
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
