"use strict";

import getPeers from "./tracker.ts";
import * as torrentParser from "./torrent-parser.ts";

const torrent = torrentParser.open("./file.torrent");

async function main() {
  const peers = await getPeers(torrent);
  console.log({ peers });
}

main();
