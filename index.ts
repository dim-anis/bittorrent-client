"use strict";

import getPeers from "./tracker.ts";
import * as torrentParser from "./torrent-parser.ts";

const announceList = torrentParser.open("./file.torrent");

async function main() {
  for (const [tracker] of announceList) {
    const peers = await getPeers(tracker);
  }
}

main();
