import * as fs from "node:fs";
import bencode from "bencode";
import getPeers from "./tracker";

const torrent = fs.readFileSync("./file.torrent");
const announceList: Uint8Array[][] = bencode.decode(torrent)["announce-list"];

for (const [tracker] of announceList) {
  const peers = getPeers(tracker);
  console.log(peers);
}
