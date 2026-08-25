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

## 0.8.22

- Fixed `TypeError: list[i].toLowerCase is not a function` in `parseFetch()` when
  a server emitted an integer-shaped token in a key position. Numeric values
  (`RFC822.SIZE`, `MODSEQ`, `UIDNEXT`, …) are still parsed as numbers.

## 0.8.21

- Published the fork as the scoped npm package `@integromat/imap`.

## 0.8.20

- Added UTF-7 decoding of Gmail labels (`X-GM-LABELS`).
