"use strict";

import fs from "node:fs";
import bencode from "bencode";

export function open(filepath: string) {
  return bencode.decode(fs.readFileSync(filepath))["announce-list"];
}

export function size() {}
export function infofHash() {}
