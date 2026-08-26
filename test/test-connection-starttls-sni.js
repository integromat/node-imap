const assert = require('node:assert');
const net = require('node:net');

const { parseSNI } = require('./clienthello');
const Imap = require('../lib/Connection');

// Same as test-connection-tls-sni.js, but for the upgrade performed by
// _starttls(): it builds its own tlsOptions, so it needs `servername` of its
// own.

const HOST = 'localhost';

const CRLF = '\r\n';

const CAPS = '* CAPABILITY IMAP4rev1 STARTTLS';

const EXPECTED = ['A0 CAPABILITY', 'A1 STARTTLS'];

const cmds = [];
let sni;
let imap;
let timeout;

const srv = net.createServer((sock) => {
  let buf = '';
  let upgrading = false;

  sock.write(`* OK IMAP4rev1 service ready.${CRLF}`);

  sock.on('data', (data) => {
    if (upgrading) {
      // everything after our STARTTLS response is handshake data
      sni = parseSNI(data);
      sock.destroy();
      srv.close();
      clearTimeout(timeout);
      imap.destroy();
      return;
    }

    buf += data.toString('latin1');
    let idx;
    while ((idx = buf.indexOf(CRLF)) > -1) {
      const line = buf.substring(0, idx);
      const tag = line.substring(0, line.indexOf(' '));
      buf = buf.substring(idx + 2);
      cmds.push(line);
      if (/ CAPABILITY$/.test(line)) {
        sock.write(`${CAPS}${CRLF}${tag} OK CAPABILITY completed.${CRLF}`);
      } else if (/ STARTTLS$/.test(line)) {
        upgrading = true;
        sock.write(`${tag} OK Begin TLS negotiation now.${CRLF}`);
        return;
      } else {
        assert(false, `Unexpected command: ${line}`);
      }
    }
  });
});

srv.listen(0, HOST, () => {
  imap = new Imap({
    host: HOST,
    port: srv.address().port,
    tls: false,
    autotls: 'always',
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
  assert.deepStrictEqual(cmds, EXPECTED, `Unexpected command sequence: ${cmds}`);
  assert.strictEqual(
    sni,
    HOST,
    `Expected the ClientHello to request SNI for ${HOST}, got: ${JSON.stringify(sni)}`
  );
});
