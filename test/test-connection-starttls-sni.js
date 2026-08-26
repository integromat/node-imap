const assert = require('node:assert');

const { captureSNI } = require('./sni-harness');

// Same as test-connection-tls-sni.js, but for the upgrade performed by
// _starttls(): it builds its own tlsOptions, so it needs `servername` of its
// own.

const HOST = 'localhost';

const EXPECTED = ['A0 CAPABILITY', 'A1 STARTTLS'];

const results = {};

(async () => {
  const { sni, cmds } = await captureSNI({
    host: HOST,
    starttls: true,
    imapOptions: { tls: false, autotls: 'always' }
  });
  results.sni = sni;
  results.cmds = cmds;
})().catch((err) => {
  results.error = err;
});

process.once('exit', () => {
  assert.ifError(results.error);
  assert.deepStrictEqual(results.cmds, EXPECTED,
                         `Unexpected command sequence: ${results.cmds}`);
  assert.strictEqual(
    results.sni,
    HOST,
    `Expected the ClientHello to request SNI for ${HOST}, got: ${JSON.stringify(results.sni)}`
  );
});
