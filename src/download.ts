import net from "node:net";
import {
  buildHandshake,
  buildInterested,
  buildRequest,
  parseMessage,
  type Payload,
} from "./message.ts";
import getPeers, { type Peer } from "./tracker.ts";
import { PieceManager } from "./pieces.ts";
import { BlockQueue } from "./queue.ts";

export default async (torrent: any) => {
  const peers = await getPeers(torrent);
  const pieces = new PieceManager(torrent);
  peers.forEach((peer) => download(peer, torrent, pieces));
};

function download(
  peer: Peer,
  torrent: Buffer<ArrayBufferLike>,
  pieces: PieceManager,
) {
  const socket = new net.Socket();

  socket.on("error", console.error);

  socket.connect(peer.port, peer.ip, () => {
    socket.write(buildHandshake(torrent));
  });

  const queue = new BlockQueue(torrent);
  onWholeMessage(socket, (msg) => msgHandler(msg, socket, pieces, queue));
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

function msgHandler(
  msg: Buffer<ArrayBuffer>,
  socket: net.Socket,
  pieces: PieceManager,
  queue: BlockQueue,
) {
  if (isHandshake(msg)) {
    socket.write(buildInterested());
  } else {
    const message = parseMessage(msg);

    if (message.id === 0) chokeHandler(socket);
    if (message.id === 1) unchokeHandler(socket, pieces, queue);
    if (message.id === 4) haveHandler();
    if (message.id === 5) bitfieldHandler();
    if (message.id === 7) pieceHandler();
  }
}

function chokeHandler(socket: net.Socket) {
  socket.end();
}
function unchokeHandler(
  socket: net.Socket,
  pieces: PieceManager,
  queue: BlockQueue,
) {
  queue.choked = false;
  requestPiece(socket, pieces, queue);
}
function haveHandler() {}
function bitfieldHandler() {}
function pieceHandler() {}

function isHandshake(msg: Buffer<ArrayBuffer>) {
  return (
    msg.length === msg.readUint8(0) + 49 &&
    msg.toString("utf8", 1) === "BitTorrent protocol"
  );
}
function requestPiece(
  socket: net.Socket,
  pieces: PieceManager,
  blockQueue: BlockQueue,
) {
  if (blockQueue.choked) {
    return null;
  }

  while (blockQueue.length()) {
    const pieceBlock = blockQueue.deque() as Payload;
    if (!pieces.isBlockComplete(pieceBlock)) {
      socket.write(buildRequest(pieceBlock));
      pieces.add(pieceBlock.index);
      break;
    }
  }
}
