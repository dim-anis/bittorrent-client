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

  constructor(blocks?: BlockState[]) {
    this.requested = false;
    this.finished = false;
    this.blocks = blocks ? blocks : [];
  }
}

export class PieceManager {
  #pieces: Piece[];

  constructor(torrent: any) {
    this.#pieces = [];
    const nPieces = torrent.info.pieces.length / 20;
    for (let i = 0; i < nPieces; i++) {
      this.#pieces.push(
        new Piece(new Array(blocksPerPiece(torrent, i)).fill(0)),
      );
    }
  }

  markBlockRequested(pieceBlock: Payload): void {
    const blockIndex = pieceBlock.begin / BLOCK_LEN;
    this.#pieces[pieceBlock.index][blockIndex].requested =
      BlockState.inProgress;
  }
  markBlockFinished(pieceBlock: Payload): void {
    const blockIndex = pieceBlock.begin / BLOCK_LEN;
    this.#pieces[pieceBlock.index].blocks[blockIndex] = BlockState.finished;

    if (this.isPieceComplete(pieceBlock.index)) {
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
  isComplete(): boolean {
    return this.#pieces.every((piece) => piece.finished);
  }
  isPieceComplete(pieceIndex: number) {
    return this.#pieces[pieceIndex].blocks.every(
      (block) => block === BlockState.finished,
    );
  }
}
