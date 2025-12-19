import crypto from "node:crypto";
import { type Payload } from "./message.ts";
import { BLOCK_LEN, blocksPerPiece, pieceLength } from "./torrent-parser.ts";
import { FileHandler } from "./files.ts";

const BlockState = {
  idle: 0,
  inProgress: 1,
  finished: 2,
} as const;
type BlockState = (typeof BlockState)[keyof typeof BlockState];

class Piece {
  state: "idle" | "inProgress" | "finished";
  blocks: BlockState[];
  buffer: Buffer<ArrayBuffer>;

  constructor(blocks: BlockState[], pieceLength: number) {
    this.state = "idle";
    this.blocks = blocks ? blocks : [];
    this.buffer = Buffer.alloc(pieceLength);
  }
}

export class PieceManager {
  pieces: Piece[];
  #torrent: any;

  constructor(torrent: any) {
    this.#torrent = torrent;
    this.pieces = [];
    const nPieces = torrent.info.pieces.length / 20;
    for (let i = 0; i < nPieces; i++) {
      const pl = pieceLength(this.#torrent, i);
      this.pieces.push(
        new Piece(new Array(blocksPerPiece(torrent, i)).fill(0), pl),
      );
    }
  }

  markBlockRequested(pieceBlock: Payload): void {
    const blockIndex = pieceBlock.begin / BLOCK_LEN;
    this.pieces[pieceBlock.index].blocks[blockIndex] = BlockState.inProgress;
  }

  markBlockFinished(pieceBlock: Payload, fileHandler: FileHandler): void {
    if (this.pieces[pieceBlock.index].state === "finished") {
      return;
    }

    const blockIndex = pieceBlock.begin / BLOCK_LEN;
    this.pieces[pieceBlock.index].blocks[blockIndex] = BlockState.finished;
    const blockLen = pieceBlock.block?.length;

    const pieceBuffer = this.pieces[pieceBlock.index].buffer;
    pieceBlock.block!.copy(pieceBuffer, pieceBlock.begin, 0, blockLen);

    if (this.isPieceComplete(pieceBlock.index)) {
      if (!this.isHashValid(pieceBlock.index)) {
        this.pieces[pieceBlock.index].state = "idle";
        this.pieces[pieceBlock.index].blocks.fill(BlockState.idle);
        return;
      }

      this.pieces[pieceBlock.index].state = "finished";
      fileHandler.writePieceToDisk(pieceBlock.index, pieceBuffer);

      // clear buffer after writing piece to disk
      this.pieces[pieceBlock.index].buffer = Buffer.alloc(0);
    }
  }

  isBlockComplete(pieceBlock: Payload) {
    const blockIndex = pieceBlock.begin / BLOCK_LEN;
    return (
      this.pieces[pieceBlock.index].blocks[blockIndex] === BlockState.finished
    );
  }

  isTorrentComplete(): boolean {
    return this.pieces.every((piece) => piece.state === "finished");
  }

  isPieceComplete(pieceIndex: number) {
    return this.pieces[pieceIndex].blocks.every(
      (block) => block === BlockState.finished,
    );
  }

  isHashValid(pieceIndex: number): boolean {
    const hash = crypto.createHash("sha1");
    const pieceBuffer = this.pieces[pieceIndex].buffer;
    hash.update(pieceBuffer);
    const targetHash = this.getPieceHash(pieceIndex);
    const calculatedHash = hash.digest();

    return calculatedHash.equals(targetHash);
  }

  getPieceHash(pieceIndex: number) {
    const hashLength = 20;
    const startIndex = pieceIndex * hashLength;
    const endIndex = startIndex + hashLength;
    return this.#torrent.info.pieces.subarray(startIndex, endIndex);
  }
}
