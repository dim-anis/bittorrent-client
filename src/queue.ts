import { BLOCK_LEN, blocksPerPiece, blockLength } from "./torrent-parser.ts";

export type PieceBlock = {
  index: number;
  begin: number;
  length: number;
};

export class BlockQueue {
  #torrent: any;
  #queue: PieceBlock[];
  choked: boolean;
  requestCount: number;

  constructor(torrent: any) {
    this.#torrent = torrent;
    this.#queue = [];
    this.choked = true;
    this.requestCount = 0;
  }

  queue(pieceIndex: number) {
    const nBlocks = blocksPerPiece(this.#torrent, pieceIndex);
    for (let i = 0; i < nBlocks; i++) {
      const pieceBlock: PieceBlock = {
        index: pieceIndex,
        begin: i * BLOCK_LEN,
        length: blockLength(this.#torrent, pieceIndex, i),
      };

      this.#queue.push(pieceBlock);
    }
  }

  deque() {
    return this.#queue.shift();
  }

  peek() {
    return this.#queue[0];
  }

  length() {
    return this.#queue.length;
  }
}
