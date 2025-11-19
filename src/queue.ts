import { type Payload } from "./message.ts";
import { BLOCK_LEN, blocksPerPiece, blockLength } from "./torrent-parser.ts";

export class BlockQueue {
  #torrent: any;
  #queue: Payload[];
  choked: boolean;

  constructor(torrent: any) {
    this.#torrent = torrent;
    this.#queue = [];
    this.choked = true;
  }

  queue(pieceIndex: number) {
    const nBlocks = blocksPerPiece(this.#torrent, pieceIndex);
    for (let i = 0; i < nBlocks; i++) {
      const pieceBlock: Payload = {
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
