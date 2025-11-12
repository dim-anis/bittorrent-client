"use strict";

import fs from "node:fs";
import bencode from "bencode";
import crypto from "node:crypto";

export function open(filepath: string) {
  return bencode.decode(fs.readFileSync(filepath));
}

export function size(torrent: any) {
  const size = torrent.info.files
    ? torrent.info.files.map((file) => file.length).reduce((a, b) => a + b)
    : torrent.info.length;

  const buf = Buffer.alloc(8);
  buf.writeBigUint64BE(BigInt(size));

  return buf;
}
export function infoHash(torrent: any) {
  const info = bencode.encode(torrent["info"]);
  return crypto.createHash("sha1").update(info).digest();
}
