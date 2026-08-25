var assert = require('assert'),
    net = require('net'),
    Imap = require('../lib/Connection');

// Servers that disable basic auth (e.g. Exchange Online) advertise
// LOGINDISABLED together with AUTH=XOAUTH2. LOGINDISABLED only forbids the
// LOGIN command (RFC 3501), so SASL authentication must still be attempted.

var ready = false;

var CRLF = '\r\n';

var XOAUTH2 = 'dXNlcj1mb29AZXhhbXBsZS5jb20BYXV0aD1CZWFyZXIgdG9rZW4BAQ==';

var CAPS = '* CAPABILITY IMAP4 IMAP4rev1 AUTH=XOAUTH2 LOGINDISABLED SASL-IR '
           + 'UIDPLUS MOVE ID UNSELECT CHILDREN IDLE NAMESPACE LITERAL+';

var RESPONSES = [
  [CAPS,
   'A0 OK CAPABILITY completed.',
   ''
  ].join(CRLF),
  // Exchange sends no untagged CAPABILITY after AUTHENTICATE, which forces the
  // client to re-fetch the capabilities before continuing.
  ['A1 OK AUTHENTICATE completed.',
   ''
  ].join(CRLF),
  [CAPS,
   'A2 OK CAPABILITY completed.',
   ''
  ].join(CRLF),
  ['* NAMESPACE (("" "/")) NIL NIL',
   'A3 OK NAMESPACE completed.',
   ''
  ].join(CRLF),
  ['* LIST (\\Noselect) "/" ""',
   'A4 OK LIST completed.',
   ''
  ].join(CRLF),
  ['* BYE Microsoft Exchange Server IMAP4 server signing off.',
   'A5 OK LOGOUT completed.',
   ''
  ].join(CRLF)
];
var EXPECTED = [
  'A0 CAPABILITY',
  'A1 AUTHENTICATE XOAUTH2 ' + XOAUTH2,
  'A2 CAPABILITY',
  'A3 NAMESPACE',
  'A4 LIST "" ""',
  'A5 LOGOUT'
];

var exp = -1,
    res = -1;

var srv = net.createServer(function(sock) {
  sock.write('* OK Microsoft Exchange IMAP4 service ready.\r\n');
  var buf = '', lines;
  sock.on('data', function(data) {
    buf += data.toString('utf8');
    if (buf.indexOf(CRLF) > -1) {
      lines = buf.split(CRLF);
      buf = lines.pop();
      lines.forEach(function(l) {
        assert(l === EXPECTED[++exp], 'Unexpected client request: ' + l);
        assert(RESPONSES[++res], 'No response for client request: ' + l);
        sock.write(RESPONSES[res]);
      });
    }
  });
});
srv.listen(0, '127.0.0.1', function() {
  var port = srv.address().port;
  var imap = new Imap({
    xoauth2: XOAUTH2,
    host: '127.0.0.1',
    port: port
  });
  var timeout = setTimeout(function() {
    assert(false, 'Timed out waiting for ready');
  }, 2000);
  imap.on('error', function(err) {
    clearTimeout(timeout);
    assert(false, 'Unexpected error: ' + err.message);
  });
  imap.once('ready', function() {
    clearTimeout(timeout);
    ready = true;
    srv.close();
    imap.end();
  });
  imap.connect();
});

process.once('exit', function() {
  assert(ready, 'Connection was not authenticated via XOAUTH2');
  assert.equal(exp, EXPECTED.length - 1, 'Not all expected commands were sent');
});
