const assert = require('node:assert');

const { captureSNI } = require('./sni-harness');

// RFC 6066 does not permit IP addresses in the server_name extension, and node
// warns about them (DEP0123: "Setting the TLS ServerName to an IP address is
// not permitted by RFC 6066. This will be ignored in a future version."), so
// the default is only derived from `host` when it is a name.
//
// An explicit tlsOptions.servername is passed through untouched even when it is
// an IP -- that is the caller's decision to make, not ours.

const HOST = '127.0.0.1';

const results = {};

(async () => {
  results.tls = (await captureSNI({
    host: HOST,
    imapOptions: { tls: true }
  })).sni;

  results.starttls = (await captureSNI({
    host: HOST,
    starttls: true,
    imapOptions: { tls: false, autotls: 'always' }
  })).sni;

  // This asserts what node currently does with an IP servername. Once DEP0123
  // turns into an actual ignore, this one has to be relaxed -- the pass-through
  // is what we promise, not what node makes of it.
  results.ipOverride = (await captureSNI({
    host: HOST,
    imapOptions: { tls: true, tlsOptions: { servername: HOST } }
  })).sni;
})().catch((err) => {
  results.error = err;
});

process.once('exit', () => {
  assert.ifError(results.error);
  assert.strictEqual(results.tls, null,
                     'Expected no SNI for an IP host over implicit TLS, got: '
                     + JSON.stringify(results.tls));
  assert.strictEqual(results.starttls, null,
                     'Expected no SNI for an IP host over STARTTLS, got: '
                     + JSON.stringify(results.starttls));
  assert.strictEqual(results.ipOverride, HOST,
                     'Expected an explicit IP servername to be sent anyway, got: '
                     + JSON.stringify(results.ipOverride));
});
