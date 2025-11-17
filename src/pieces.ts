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
  private pieces: Piece[];

  constructor(size: number) {
    this.pieces = new Array(size).fill(new Piece());
  }

  add(pieceIndex: number): void {
    this.pieces[pieceIndex].requested = true;
  }
  markBlockFinished(pieceIndex: number, blockIndex: number): void {
    this.pieces[pieceIndex].blocks[blockIndex] = BlockState.finished;

    if (this.isPieceComplete(pieceIndex)) {
      this.pieces[pieceIndex].finished = true;
    }
  }
  isComplete(): boolean {
    return this.pieces.every((piece) => piece.finished);
  }
  isPieceComplete(pieceIndex: number) {
    return this.pieces[pieceIndex].blocks.every(
      (block) => block === BlockState.finished,
    );
  }
  // getNextBlock(peer): BlockRequest | null {  }
}
