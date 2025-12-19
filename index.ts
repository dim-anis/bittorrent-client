import * as torrentParser from "./src/torrent-parser.ts";
import download from "./src/download.ts";

const torrentPath = process.argv[2];

if (!torrentPath) {
  console.log("argument <torrent-path> is required");
  process.exit(1);
}

const torrent = torrentParser.open(process.argv[2]);

async function main() {
  download(torrent, process.env.DOWNLOAD_DIR);
}

main();
