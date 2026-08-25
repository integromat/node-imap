# Changelog

Changes made in this fork. Versions up to and including 0.8.19 come from
upstream [mscdex/node-imap](https://github.com/mscdex/node-imap) and are not
listed here.

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
