import crypto from "node:crypto";
import { type Payload } from "./message.ts";
import { showProgressBar } from "./progressBar.ts";
import { BLOCK_LEN, blocksPerPiece } from "./torrent-parser.ts";

const BlockState = {
  idle: 0,
  inProgress: 1,
  finished: 2,
} as const;
type BlockState = (typeof BlockState)[keyof typeof BlockState];

class Piece {
  requested: boolean;
  finished: boolean;
  blocks: BlockState[];
  buffer: Buffer<ArrayBuffer>;

  constructor(blocks: BlockState[], pieceLength: number) {
    this.requested = false;
    this.finished = false;
    this.blocks = blocks ? blocks : [];
    this.buffer = Buffer.alloc(pieceLength);
  }
}

export class PieceManager {
  #pieces: Piece[];
  #torrent: any;

  constructor(torrent: any) {
    this.#torrent = torrent;
    this.#pieces = [];
    const nPieces = torrent.info.pieces.length / 20;
    const pieceLength = torrent.info["piece length"];
    for (let i = 0; i < nPieces; i++) {
      this.#pieces.push(
        new Piece(new Array(blocksPerPiece(torrent, i)).fill(0), pieceLength),
      );
    }
  }

  markBlockRequested(pieceBlock: Payload): void {
    const blockIndex = pieceBlock.begin / BLOCK_LEN;
    this.#pieces[pieceBlock.index].blocks[blockIndex] = BlockState.inProgress;
  }

  markBlockFinished(pieceBlock: Payload): void {
    const blockIndex = pieceBlock.begin / BLOCK_LEN;
    this.#pieces[pieceBlock.index].blocks[blockIndex] = BlockState.finished;
    const blockLen = pieceBlock.block?.length;

    const pieceBuffer = this.#pieces[pieceBlock.index].buffer;
    pieceBlock.block!.copy(pieceBuffer, pieceBlock.begin, 0, blockLen);

    if (this.isPieceComplete(pieceBlock.index)) {
      if (!this.isHashValid(pieceBlock.index)) {
        pieceBuffer.fill(0);
        return;
      }

      this.#pieces[pieceBlock.index].finished = true;
      this.logProgress();
    }
  }

  isBlockComplete(pieceBlock: Payload) {
    const blockIndex = pieceBlock.begin / BLOCK_LEN;
    return (
      this.#pieces[pieceBlock.index].blocks[blockIndex] === BlockState.finished
    );
  }

  isTorrentComplete(): boolean {
    return this.#pieces.every((piece) => piece.finished);
  }

  isPieceComplete(pieceIndex: number) {
    return this.#pieces[pieceIndex].blocks.every(
      (block) => block === BlockState.finished,
    );
  }

  isHashValid(pieceIndex: number): boolean {
    const hash = crypto.createHash("sha1");
    const pieceBuffer = this.#pieces[pieceIndex].buffer;
    hash.update(pieceBuffer);
    const targetHash = this.getPieceHash(pieceIndex);
    const calculatedHash = hash.digest();

    if (calculatedHash.equals(targetHash)) {
      return true;
    } else {
      return false;
    }
  }

  logProgress() {
    const totalPieces = this.#pieces.length;
    const donwloadedPieces = this.#pieces.filter((p) => p.finished).length;

    showProgressBar(totalPieces, donwloadedPieces);
  }

  getPieceHash(pieceIndex: number) {
    const hashLength = 20;
    const startIndex = pieceIndex * hashLength;
    const endIndex = startIndex + hashLength;
    return this.#torrent.info.pieces.subarray(startIndex, endIndex);
  }
}
