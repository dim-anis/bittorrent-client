import net from "node:net";
import getPeers, { Peer } from "./tracker.ts";

export default async (torrent: Buffer<ArrayBufferLike>) => {
  const peers = await getPeers(torrent);
  peers.forEach((peer) => download(peer));
};

function download(peer: Peer) {
  const socket = new net.Socket();

  socket.on("error", console.error);

  socket.connect(peer.port, peer.ip, () => {
    // socket.write()
  });

  socket.on("data", () => {
    // handle response
  });
}
