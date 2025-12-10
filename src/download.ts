import fs from "node:fs";
import net from "node:net";
import {
  buildHandshake,
  buildInterested,
  buildRequest,
  parseMessage,
  type PieceResponse,
  type Payload,
} from "./message.ts";
import getPeers, { type Peer } from "./tracker.ts";
import { PieceManager } from "./pieces.ts";
import { BlockQueue } from "./queue.ts";
import { showEmptyProgressBar } from "./progressBar.ts";

export default async (torrent: any, path: string) => {
  const peers = await getPeers(torrent);
  const pieces = new PieceManager(torrent);
  const file = fs.openSync(path, "w");
  showEmptyProgressBar();
  peers.forEach((peer) => download(peer, torrent, pieces, file));
};

function download(
  peer: Peer,
  torrent: Buffer<ArrayBufferLike>,
  pieces: PieceManager,
  fileDescriptor: number,
) {
  const socket = new net.Socket();

  socket.on("error", console.error);

  socket.connect(peer.port, peer.ip, () => {
    socket.write(buildHandshake(torrent));
  });

  const queue = new BlockQueue(torrent);
  onWholeMessage(socket, (msg) =>
    msgHandler(msg, socket, pieces, queue, torrent, fileDescriptor),
  );
}

function onWholeMessage(
  socket: net.Socket,
  cb: (data: Buffer<ArrayBuffer>) => void,
) {
  let savedBuf = Buffer.alloc(0);
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
  torrent: any,
  fileDescriptor: number,
) {
  if (isHandshake(msg)) {
    socket.write(buildInterested());
  } else {
    const message = parseMessage(msg);

    if (message.id === 0) chokeHandler(socket);
    if (message.id === 1) unchokeHandler(socket, pieces, queue);
    if (message.id === 4) haveHandler(socket, pieces, queue, msg);
    if (message.id === 5) bitfieldHandler(socket, pieces, queue, msg);
    if (message.id === 7)
      pieceHandler(
        socket,
        pieces,
        queue,
        torrent,
        fileDescriptor,
        message.payload,
      );
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
function haveHandler(
  socket: net.Socket,
  pieces: PieceManager,
  blockQueue: BlockQueue,
  payload: Buffer<ArrayBuffer>,
) {
  const pieceIndex = payload.readUint32BE(0);
  const queueEmpty = blockQueue.length() === 0;
  blockQueue.queue(pieceIndex);
  if (queueEmpty) {
    requestPiece(socket, pieces, blockQueue);
  }
}
function bitfieldHandler(
  socket: net.Socket,
  pieces: PieceManager,
  blockQueue: BlockQueue,
  payload: Buffer<ArrayBuffer>,
) {
  const queueEmpty = blockQueue.length() === 0;

  payload.forEach((byte, i) => {
    for (let j = 0; j < 8; j++) {
      if (byte % 2) {
        blockQueue.queue(i * 8 + 7 - j);
      }
      byte = Math.floor(byte / 2);
    }
  });

  if (queueEmpty) {
    requestPiece(socket, pieces, blockQueue);
  }
}
function pieceHandler(
  socket: net.Socket,
  pieces: PieceManager,
  blockQueue: BlockQueue,
  torrent: any,
  fileDescriptor: number,
  pieceResp: PieceResponse,
) {
  pieces.markBlockFinished(pieceResp);

  const offset =
    pieceResp.index * torrent.info["piece length"] + pieceResp.begin;
  fs.write(
    fileDescriptor,
    pieceResp.block,
    0,
    pieceResp.block.length,
    offset,
    () => {},
  );

  if (pieces.isComplete()) {
    socket.end();
    console.log("Download finished");
    try {
      fs.closeSync(fileDescriptor);
    } catch (error) {}
  } else {
    requestPiece(socket, pieces, blockQueue);
  }
}

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
      pieces.markBlockRequested(pieceBlock);
      break;
    }
  }
}
