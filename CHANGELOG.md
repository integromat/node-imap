# Changelog

Changes made in this fork. Versions up to and including 0.8.19 come from
upstream [mscdex/node-imap](https://github.com/mscdex/node-imap) and are not
listed here.

## 0.8.24

Merged upstream [mscdex/node-imap](https://github.com/mscdex/node-imap) up to
`9918f08`, which is the last commit there (February 2022), and followed up on
the two gaps it left behind.

- Fixed TLS connections not sending SNI at all. `tls.connect()` sends the
  `server_name` extension only when `servername` is set explicitly — node never
  derives it from `host`, which is used just to dial the connection and to check
  the certificate identity. Servers that serve several domains from one address
  (Gmail, Exchange Online, anything behind a load balancer) therefore answered
  with a default certificate that does not match the requested host, surfacing as
  `Error: self signed certificate` / `DEPTH_ZERO_SELF_SIGNED_CERT` and forcing
  callers to pass `tlsOptions.servername` by hand.

  Imported from upstream `9918f08` for `connect()` (implicit TLS) and extended to
  `_starttls()`, which builds its own `tlsOptions` and stayed uncovered upstream.
  In both paths the assignment happens before the caller's `tlsOptions` are
  copied over, so an explicit `tlsOptions.servername` still wins.

  The default is only derived from `host` when `host` is a name.
  [RFC 6066 §3](https://www.rfc-editor.org/rfc/rfc6066#section-3) does not permit
  IP addresses in `server_name`, and node warns about them (`DEP0123`, "This will
  be ignored in a future version"), so defaulting one in would only trade a
  missing extension for a deprecated one. An explicit `tlsOptions.servername` is
  still passed through unchanged even when it is an IP — that call belongs to the
  caller, not to this library.

  References:
  - [mscdex/node-imap#724](https://github.com/mscdex/node-imap/issues/724) —
    "Servername option is mandatory with gmail and Openssl 1.1.1", reporting
    `Error: self signed certificate` against `imap.gmail.com` and the manual
    `servername` workaround.
  - [mscdex/node-imap#866](https://github.com/mscdex/node-imap/issues/866) — the
    same `DEPTH_ZERO_SELF_SIGNED_CERT` symptom, misattributed to a MITM in the
    upstream discussion.
  - [RFC 6066 §3](https://www.rfc-editor.org/rfc/rfc6066#section-3) — defines
    `server_name` and restricts it to host names, which is why the connection
    host must be a name and not an IP for SNI to be meaningful.

- Removed the dead `require('readable-stream')` fallback in `Parser.js`. Upstream
  `7dbc664` dropped `readable-stream` from the dependencies but left the
  `require('stream').Readable || require('readable-stream').Readable` fallback in
  place. At runtime the `||` short-circuits, but bundlers (webpack, esbuild, ncc)
  resolve `require()` statically and fail on the missing module.

- Replaced the deprecated `Buffer` constructor with `Buffer.from()` /
  `Buffer.allocUnsafe()` and the `'binary'` encoding alias with `'latin1'`
  (upstream `7dbc664`). Both `allocUnsafe()` call sites overwrite the whole
  buffer with `copy()` before reading it. The same commit dropped the
  `readable-stream` dependency and raised `engines.node` to `>=10.0.0`.

- Added regression tests that read the TLS handshake off the wire and assert the
  client really announces the configured host, independent of the TLS version and
  without certificate fixtures. They cover both the implicit TLS and the STARTTLS
  path, and pin the IP behaviour down as well: no default for an IP host, but an
  explicitly configured IP `servername` is still sent.

## 0.8.23

- Fixed `_login()` aborting with `Logging in is disabled on this server` whenever
  the server advertised `LOGINDISABLED`, even when an XOAUTH/XOAUTH2 token was
  configured. Per RFC 3501, `LOGINDISABLED` only forbids the `LOGIN` command, so
  the check now runs in the `LOGIN` branch only and the XOAUTH/XOAUTH2
  `AUTHENTICATE` branches are attempted first. This unblocks Exchange Online
  mailboxes, which advertise `LOGINDISABLED` together with `AUTH=XOAUTH2` once
  basic auth is disabled.

  References:
  - [RFC 3501 §6.2.3](https://www.rfc-editor.org/rfc/rfc3501#section-6.2.3) —
    "A client implementation MUST NOT send a LOGIN command if the LOGINDISABLED
    capability is advertised." The restriction is scoped to `LOGIN`; nothing in
    it applies to `AUTHENTICATE`.
  - [Deprecation of Basic authentication in Exchange Online](https://learn.microsoft.com/en-us/exchange/clients-and-mobile-in-exchange-online/deprecation-of-basic-authentication-exchange-online)
    — Microsoft "removed the ability to use Basic authentication in Exchange
    Online for […] POP, IMAP […]" and it "is now disabled in all tenants",
    with no way for admins or support to re-enable it. Such mailboxes answer
    `CAPABILITY` with `LOGINDISABLED` and without `AUTH=PLAIN`, leaving
    `AUTH=XOAUTH2` as the only usable mechanism.
  - [Authenticate an IMAP, POP, or SMTP connection using OAuth](https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth)
    — the XOAUTH2 flow Exchange Online expects instead.
  - [mscdex/node-imap#685](https://github.com/mscdex/node-imap/issues/685) —
    the same symptom reported upstream against Microsoft Exchange IMAP4.

## 0.8.22

- Fixed `TypeError: list[i].toLowerCase is not a function` in `parseFetch()` when
  a server emitted an integer-shaped token in a key position. Numeric values
  (`RFC822.SIZE`, `MODSEQ`, `UIDNEXT`, …) are still parsed as numbers.

## 0.8.21

- Published the fork as the scoped npm package `@integromat/imap`.

## 0.8.20

- Added UTF-7 decoding of Gmail labels (`X-GM-LABELS`).
