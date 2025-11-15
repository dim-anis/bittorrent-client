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
  onWholeMessage(socket, (data) => {
    // handle data
  });
}

function onWholeMessage(
  socket: net.Socket,
  cb: (data: Buffer<ArrayBuffer>) => void,
) {
  let savedBuf = Buffer.alloc(4);
  let handshake = true;

  socket.on("data", (recvBuf: Buffer<ArrayBufferLike>) => {
    // handle response
    let msgLen = () =>
      handshake ? savedBuf.readUint8(0) + 49 : savedBuf.readUint32BE(0) + 4;
    // write to buf
    savedBuf = Buffer.concat([savedBuf, recvBuf]);

    while (savedBuf.length >= 4 && savedBuf.length >= msgLen()) {
      cb(savedBuf.subarray(0, msgLen()));
      savedBuf = savedBuf.subarray(msgLen());
      handshake = false;
    }
  });
}
