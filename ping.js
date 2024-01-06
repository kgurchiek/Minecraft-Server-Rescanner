const net = require('net');
const varint = require('varint');
const minecraftData = require('minecraft-data');

module.exports = {
  ping: (ip, port, protocol, timeout) => {
    return new Promise((resolve, reject) => {
      var jsonLength = 0;

      setTimeout(function() {
        if (!hasResponded) {
          resolve('timeout');
          client.destroy();
        }
      }, timeout);

      var hasResponded = false;
      var response = '';

      const client = new net.Socket();
      client.connect(port, ip, () => {
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
        client.write(buffer);
      });

      client.on('data', (data) => {
        if (jsonLength == 0) {
          try {
            varint.decode(data);
          } catch (error) {
            //console.log(`varint error on ${ip}:${port} - ${error}`);
            resolve('error');
          }
          const varint1Length = varint.decode.bytes;
          try {
            jsonLength = varint.decode(data.subarray(varint1Length + 1));
          } catch (error) {
            //console.log(`varint error on ${ip}:${port} - ${error}`);
            resolve('error');
          }
          const varint2Length = varint.decode.bytes;
          data = data.subarray(varint1Length + 1 + varint2Length);
        }
        response += data.toString();

        if (Buffer.byteLength(response) >= jsonLength) {
          client.destroy();
          try {
           resolve(JSON.parse(response));
          } catch (error) {
            //console.log(`Error on ${ip}:${port} - ${error}`);
            resolve('error');
          }
          hasResponded = true;
        }
      });

      client.on('error', (err) => {
        //console.error(`Error: ${err}`);
      });

      client.on('close', () => {
        //console.log('Connection closed');
      });
    })
  },
  authCheck: (ip, port, protocol, timeout) => {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      setTimeout(function() {
        if (!hasResponded) resolve('timeout');
        client.destroy();
      }, timeout);
      
      const mcData = minecraftData(protocol);
      const username = `CrackedTest${Math.round(Math.random() * 1000)}`;
      var hasResponded = false;
    
      client.connect(port, ip, () => {
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
        client.write(buffer);
    
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
        buffer = Buffer.concat([packetLength, startLoginPacket]);
    
        client.write(buffer);
      });
    
      client.on('data', async (data) => {
        client.destroy(); // kill client after server's response
        resolve(data[1] != 1);
        hasResponded = true;
      });
    
      client.on('error', (err) => {
        //console.error(`Error: ${err}`);
      });
    
      client.on('close', () => {
        //console.log('Connection closed');
      });
    });
  }
}