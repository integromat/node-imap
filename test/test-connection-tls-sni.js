const assert = require('node:assert');
const net = require('node:net');

const { parseSNI } = require('./clienthello');
const Imap = require('../lib/Connection');

// tls.connect() only sends the SNI extension when `servername` is set
// explicitly -- node never derives it from `host`. Without it, servers that
// serve several domains from one address (gmail, Exchange Online, anything
// behind a load balancer) answer with a default certificate that does not match
// the requested host, which surfaces as a "self signed certificate" error.
// See mscdex/node-imap#724.

const HOST = 'localhost';

let sni;
let imap;
let timeout;

const srv = net.createServer((sock) => {
  // A bare TCP server is enough: we only need to look at what the client
  // offered, so the handshake is never completed.
  sock.once('data', (buf) => {
    sni = parseSNI(buf);
    sock.destroy();
    srv.close();
    clearTimeout(timeout);
    imap.destroy();
  });
});

srv.listen(0, HOST, () => {
  imap = new Imap({
    host: HOST,
    port: srv.address().port,
    tls: true,
    user: 'foo',
    password: 'bar'
  });
  timeout = setTimeout(() => {
    assert(false, 'Timed out waiting for the TLS ClientHello');
  }, 2000);
  // the aborted handshake surfaces as a socket error -- expected here
  imap.on('error', () => {});
  imap.connect();
});

process.once('exit', () => {
  assert.strictEqual(
    sni,
    HOST,
    `Expected the ClientHello to request SNI for ${HOST}, got: ${JSON.stringify(sni)}`
  );
});
