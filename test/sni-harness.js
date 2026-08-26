const net = require('node:net');

const { parseSNI } = require('./clienthello');
const Imap = require('../lib/Connection');

const CRLF = '\r\n';

const CAPS = '* CAPABILITY IMAP4rev1 STARTTLS';

// Connects one Imap client to a bare TCP server and resolves with what the
// client put on the wire:
//
//   sni  -- host name from the ClientHello server_name extension, or null when
//           the client sent no such extension
//   cmds -- IMAP commands received before the upgrade (STARTTLS runs only)
//
// The handshake is never completed: the server only records the offer, so no
// certificates are involved and the result does not depend on the TLS version.
//
// options.host        host to listen on and to configure the client with
// options.starttls    drive an IMAP session and upgrade via STARTTLS
// options.imapOptions extra Imap() options, merged over the defaults
function captureSNI(options = {}) {
  const host = options.host || 'localhost';
  const cmds = [];

  return new Promise((resolve, reject) => {
    let imap;
    let timeout;

    const srv = net.createServer((sock) => {
      let upgrading = false;

      const finish = (data) => {
        sock.destroy();
        srv.close();
        clearTimeout(timeout);
        imap.destroy();
        resolve({ sni: parseSNI(data), cmds });
      };

      if (!options.starttls) {
        sock.once('data', finish);
        return;
      }

      let buf = '';
      sock.write(`* OK IMAP4rev1 service ready.${CRLF}`);
      sock.on('data', (data) => {
        if (upgrading) {
          // everything after our STARTTLS response is handshake data
          finish(data);
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
            sock.destroy();
            srv.close();
            clearTimeout(timeout);
            imap.destroy();
            reject(new Error(`Unexpected command: ${line}`));
            return;
          }
        }
      });
    });

    srv.listen(0, host, () => {
      imap = new Imap(Object.assign({
        host,
        port: srv.address().port,
        user: 'foo',
        password: 'bar'
      }, options.imapOptions));
      timeout = setTimeout(() => {
        srv.close();
        imap.destroy();
        reject(new Error('Timed out waiting for the TLS ClientHello'));
      }, 2000);
      // the aborted handshake surfaces as a socket error -- expected here
      imap.on('error', () => {});
      imap.connect();
    });
  });
}

module.exports = { captureSNI };
