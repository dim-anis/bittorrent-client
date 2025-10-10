"use strict";

import getPeers from "./tracker.ts";
import * as torrentParser from "./torrent-parser.ts";

const torrent = torrentParser.open("./file.torrent");

async function main() {
  for (const [tracker] of torrent["announce-list"]) {
    const peers = await getPeers(tracker);
  }
}

main();
