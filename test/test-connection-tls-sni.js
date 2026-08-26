const assert = require('node:assert');

const { captureSNI } = require('./sni-harness');

// tls.connect() only sends the SNI extension when `servername` is set
// explicitly -- node never derives it from `host`. Without it, servers that
// serve several domains from one address (gmail, Exchange Online, anything
// behind a load balancer) answer with a default certificate that does not match
// the requested host, which surfaces as a "self signed certificate" error.
// See mscdex/node-imap#724.

const HOST = 'localhost';

const results = {};

(async () => {
  results.sni = (await captureSNI({
    host: HOST,
    imapOptions: { tls: true }
  })).sni;

  // The default is assigned before the caller's tlsOptions are copied over it,
  // so a configured servername has to win. Consumers that already pass one
  // (and point it somewhere other than `host`) depend on that.
  results.override = (await captureSNI({
    host: HOST,
    imapOptions: { tls: true, tlsOptions: { servername: 'imap.example.com' } }
  })).sni;
})().catch((err) => {
  results.error = err;
});

process.once('exit', () => {
  assert.ifError(results.error);
  assert.strictEqual(
    results.sni,
    HOST,
    `Expected the ClientHello to request SNI for ${HOST}, got: ${JSON.stringify(results.sni)}`
  );
  assert.strictEqual(
    results.override,
    'imap.example.com',
    'Expected the configured servername to override the default, got: '
    + JSON.stringify(results.override)
  );
});
