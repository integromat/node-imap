// Minimal TLS ClientHello reader used by the SNI tests. Working on the raw
// handshake bytes keeps the tests independent of the TLS/OpenSSL version the
// running node happens to be linked against: the server_name extension is sent
// in the clear by every TLS version, so a plain TCP server can observe it.
//
// Returns the requested host name, or null when the client sent no
// server_name extension at all.
function parseSNI(buf) {
  // TLSPlaintext: type(1) version(2) length(2), then Handshake: type(1) len(3)
  if (buf.length < 45 || buf[0] !== 0x16 || buf[5] !== 0x01)
    return null;

  let p = 5 + 4 + 2 + 32; // handshake header + client_version + random
  p += 1 + buf[p];                      // legacy_session_id
  p += 2 + buf.readUInt16BE(p);         // cipher_suites
  p += 1 + buf[p];                      // legacy_compression_methods
  if (p + 2 > buf.length)
    return null;

  const end = p + 2 + buf.readUInt16BE(p);
  p += 2;
  while (p + 4 <= end && p + 4 <= buf.length) {
    const type = buf.readUInt16BE(p);
    const len = buf.readUInt16BE(p + 2);
    if (type === 0x0000) { // server_name
      // ServerNameList: list length(2), then name_type(1) + length(2) + name
      const q = p + 4 + 2;
      if (buf[q] !== 0x00) // not a host_name entry
        return null;
      const nlen = buf.readUInt16BE(q + 1);
      return buf.toString('ascii', q + 3, q + 3 + nlen);
    }
    p += 4 + len;
  }
  return null;
}

module.exports = { parseSNI };
