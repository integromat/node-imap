var assert = require('assert'),
    net = require('net'),
    Imap = require('../lib/Connection');

// When LOGIN is the only method the client can use, LOGINDISABLED must still
// abort the login sequence before any credentials are sent.

var error;

var CRLF = '\r\n';

var RESPONSES = [
  ['* CAPABILITY IMAP4rev1 LOGINDISABLED AUTH=XOAUTH2 NAMESPACE',
   'A0 OK CAPABILITY completed.',
   ''
  ].join(CRLF)
];
var EXPECTED = [
  'A0 CAPABILITY'
];

var exp = -1,
    res = -1;

var srv = net.createServer(function(sock) {
  sock.write('* OK asdf\r\n');
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
    user: 'foo',
    password: 'bar',
    host: '127.0.0.1',
    port: port
  });
  var timeout = setTimeout(function() {
    assert(false, 'Timed out waiting for error');
  }, 2000);
  imap.once('ready', function() {
    clearTimeout(timeout);
    assert(false, 'Unexpected successful login');
  });
  imap.once('error', function(err) {
    clearTimeout(timeout);
    error = err;
    srv.close();
  });
  imap.connect();
});

process.once('exit', function() {
  assert(error, 'Expected an authentication error');
  assert.equal(error.message, 'Logging in is disabled on this server');
  assert.equal(error.source, 'authentication');
  assert.equal(exp, EXPECTED.length - 1, 'Credentials were sent to the server');
});
