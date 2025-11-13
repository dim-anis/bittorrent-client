"use strict";

import * as torrentParser from "./src/torrent-parser.ts";
import download from "./src/download.ts";

const torrent = torrentParser.open(process.argv[2]);

async function main() {
  download(torrent);
}

main();
