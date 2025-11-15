import net from "node:net";
import { buildHandshake, buildInterested } from "./message.ts";
import getPeers, { Peer } from "./tracker.ts";

export default async (torrent: Buffer<ArrayBufferLike>) => {
  const peers = await getPeers(torrent);
  peers.forEach((peer) => download(peer, torrent));
};

function download(peer: Peer, torrent: Buffer<ArrayBufferLike>) {
  const socket = new net.Socket();

  socket.on("error", console.error);

  socket.connect(peer.port, peer.ip, () => {
    socket.write(buildHandshake(torrent));
  });

  onWholeMessage(socket, (msg) => msgHandler(msg, socket));
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

function msgHandler(msg: Buffer<ArrayBuffer>, socket: net.Socket) {
  if (isHandshake(msg)) {
    socket.write(buildInterested());
  }
}

function isHandshake(msg: Buffer<ArrayBuffer>) {
  return (
    msg.length === msg.readUint8(0) + 49 &&
    msg.toString("utf8", 1) === "BitTorrent protocol"
  );
}
