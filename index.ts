import * as fs from "node:fs";

const torrent = fs.readFileSync("./file.torrent");
console.log(torrent);
