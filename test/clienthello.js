// Minimal TLS ClientHello reader used by the SNI tests. Working on the raw
// handshake bytes keeps the tests independent of the TLS/OpenSSL version the
// running node happens to be linked against: the server_name extension is sent
// in the clear by every TLS version, so a plain TCP server can observe it.
//
// Returns the requested host name, or null when the buffer holds no readable
// server_name extension -- including when it is truncated or malformed, which a
// reader of network data has to survive without throwing.

// Bounds-checked reads. Both yield -1 instead of reading past the end, so a
// short buffer ends the walk instead of raising RangeError.
function u8(buf, p) {
  return (p >= 0 && p < buf.length) ? buf[p] : -1;
}

function u16(buf, p) {
  return (p >= 0 && p + 2 <= buf.length) ? buf.readUInt16BE(p) : -1;
}

function parseSNI(buf) {
  // TLSPlaintext: type(1) version(2) length(2), then Handshake: type(1) len(3)
  if (buf.length < 45 || buf[0] !== 0x16 || buf[5] !== 0x01)
    return null;

  let p = 5 + 4 + 2 + 32; // handshake header + client_version + random

  const sessionId = u8(buf, p); // legacy_session_id
  if (sessionId < 0)
    return null;
  p += 1 + sessionId;

  const ciphers = u16(buf, p); // cipher_suites
  if (ciphers < 0)
    return null;
  p += 2 + ciphers;

  const compression = u8(buf, p); // legacy_compression_methods
  if (compression < 0)
    return null;
  p += 1 + compression;

  const extensions = u16(buf, p);
  if (extensions < 0)
    return null;
  const end = Math.min(p + 2 + extensions, buf.length);
  p += 2;

  while (p + 4 <= end) {
    const type = buf.readUInt16BE(p);
    const len = buf.readUInt16BE(p + 2);
    if (type === 0x0000) { // server_name
      // ServerNameList: list length(2), then name_type(1) + length(2) + name
      const q = p + 4 + 2;
      if (u8(buf, q) !== 0x00) // not a host_name entry, or out of bounds
        return null;
      const nlen = u16(buf, q + 1);
      if (nlen < 0 || q + 3 + nlen > buf.length)
        return null;
      return buf.toString('ascii', q + 3, q + 3 + nlen);
    }
    p += 4 + len;
  }
  return null;
}

module.exports = { parseSNI };
