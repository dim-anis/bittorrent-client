import net from "node:net";
import {
  type PieceMessage,
  buildHandshake,
  buildInterested,
  buildRequest,
  parseMessage,
} from "./message.ts";
import getAllPeers, { type Peer } from "./tracker.ts";
import { PieceManager } from "./pieces.ts";
import { type PieceBlock, BlockQueue } from "./queue.ts";
import { FileHandler } from "./files.ts";
import { infoHash } from "./torrent-parser.ts";

const HANDSHAKE_LENGTH = 68;
const MAX_PIPELINE = 10;

export default async (torrent: any, downloadDir = "downloads") => {
  const peers = await getAllPeers(torrent);
  const availablePeers = peers
    .filter((res) => res.status === "fulfilled")
    .flatMap((peer) => peer.value.peers);
  const pieces = new PieceManager(torrent);
  const fileHandler = new FileHandler(torrent.info, downloadDir);

  availablePeers.forEach((peer) =>
    download(peer, torrent, pieces, fileHandler),
  );
};

function download(
  peer: Peer,
  torrent: Buffer<ArrayBufferLike>,
  pieces: PieceManager,
  fileHandler: FileHandler,
) {
  const socket = new net.Socket();

  socket.on("error", () => {});

  socket.connect(peer.port, peer.ip, () => {
    socket.write(buildHandshake(torrent));
  });

  const queue = new BlockQueue(torrent);
  onWholeMessage(socket, (msg) =>
    msgHandler(msg, socket, pieces, queue, fileHandler, torrent),
  );
}

function onWholeMessage(
  socket: net.Socket,
  cb: (data: Buffer<ArrayBuffer>) => void,
) {
  let savedBuf = Buffer.alloc(0);
  let handshake = true;

  socket.on("data", (recvBuf: Buffer<ArrayBufferLike>) => {
    // write chunk to buf
    savedBuf = Buffer.concat([savedBuf, recvBuf]);

    let msgLength: number;

    while (true) {
      if (handshake) {
        msgLength = HANDSHAKE_LENGTH;
      } else {
        // length prefix is 4 bytes
        if (savedBuf.length < 4) break;

        const payloadSize = savedBuf.readUInt32BE(0);

        // handle Keep-Alive
        if (payloadSize === 0) {
          savedBuf = savedBuf.subarray(4);
          continue;
        }

        msgLength = payloadSize + 4;
      }

      if (savedBuf.length >= msgLength) {
        cb(savedBuf.subarray(0, msgLength));
        savedBuf = savedBuf.subarray(msgLength);
        handshake = false;
      } else {
        break;
      }
    }
  });
}

function msgHandler(
  msg: Buffer<ArrayBuffer>,
  socket: net.Socket,
  pieces: PieceManager,
  queue: BlockQueue,
  fileHandler: FileHandler,
  torrent: any,
) {
  if (isHandshake(msg, torrent)) {
    socket.write(buildInterested());
  } else {
    const message = parseMessage(msg);

    switch (message.type) {
      case "choke":
        chokeHandler(socket);
        break;
      case "unchoke":
        unchokeHandler(socket, pieces, queue);
        break;
      case "have":
        haveHandler(socket, pieces, queue, message.pieceIndex);
        break;
      case "bitfield":
        bitfieldHandler(socket, pieces, queue, message.bitfield);
        break;
      case "piece":
        pieceHandler(socket, pieces, queue, fileHandler, message);
        break;
    }
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
  pieceIndex: number,
) {
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
  bitfield: Buffer<ArrayBuffer>,
) {
  const queueEmpty = blockQueue.length() === 0;

  for (let i = 0; i < bitfield.length; i++) {
    const byte = bitfield[i];
    for (let j = 0; j < 8; j++) {
      const pieceIndex = i * 8 + j;
      if (byte & (1 << (7 - j))) {
        blockQueue.queue(pieceIndex);
      }
    }
  }

  if (queueEmpty) {
    requestPiece(socket, pieces, blockQueue);
  }
}
function pieceHandler(
  socket: net.Socket,
  pieces: PieceManager,
  blockQueue: BlockQueue,
  fileHandler: FileHandler,
  pieceResp: PieceMessage,
) {
  pieces.markBlockFinished(pieceResp, fileHandler);
  blockQueue.requestCount--;

  if (pieces.isTorrentComplete()) {
    fileHandler.closeDescriptors();
    socket.end();
    console.log("Download finished");
  } else {
    requestPiece(socket, pieces, blockQueue);
  }
}

function isHandshake(msg: Buffer<ArrayBuffer>, torrent: any) {
  const isCorrectLength = msg.length === msg.readUint8(0) + 49;
  const isCorrectPstr = msg.toString("utf8", 1, 20) === "BitTorrent protocol";
  const ourInfoHash = infoHash(torrent);
  const theirInfoHash = msg.subarray(28, 48);
  const isInfoHashValid = ourInfoHash.equals(theirInfoHash);

  return isCorrectLength && isCorrectPstr && isInfoHashValid;
}
function requestPiece(
  socket: net.Socket,
  pieces: PieceManager,
  blockQueue: BlockQueue,
) {
  if (blockQueue.choked) {
    return null;
  }

  while (blockQueue.length() && blockQueue.requestCount < MAX_PIPELINE) {
    const pieceBlock = blockQueue.deque() as PieceBlock;
    if (!pieces.isBlockComplete(pieceBlock)) {
      blockQueue.requestCount++;
      socket.write(buildRequest(pieceBlock));
      pieces.markBlockRequested(pieceBlock);
    }
  }
}
