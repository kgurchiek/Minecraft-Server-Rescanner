const net = require('net');
const varint = require('varint');

module.exports = (ip, port, packet, timeout = 5000) => {
  return new Promise(async (resolve, reject) => {
    var data = Buffer.alloc(0);
    var length;
    var hasResponded = false;

    setTimeout(() => {
      if (!hasResponded) {
        client.destroy();
        resolve('timeout');
      }
    }, timeout)

    const client = new net.Socket();
    client.connect(port, ip, () => client.write(packet));
    client.on('error', err => {
      client.destroy();
      resolve(err.toString());
    });
    client.on('data', newData => {
      if (data.length == 0) {
        try {
          length = varint.decode(newData);
          newData = newData.subarray(varint.decode.bytes);
        } else {
          length = 0;
          newData = Buffer.alloc(0);
          client.destroy();
        }
      }
      data = Buffer.concat([data, newData]);
      if (data.length >= length) {
        data = data.subarray(0, length);
        hasResponded = true;
        client.destroy();
        resolve(data);
      }
    })
  })
}