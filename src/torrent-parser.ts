import fs from "node:fs";
import bencode from "bencode";
import crypto from "node:crypto";

export const BLOCK_LEN = Math.pow(2, 14);

function pieceLength(torrent: any, pieceIndex: number) {
  const totalLength = Number(BigInt(size(torrent)));
  const pieceLength = torrent.info["piece length"];

  const lastPieceLength = totalLength % pieceLength;
  const lastPieceIndex = Math.floor(totalLength / pieceLength);

  return pieceIndex === lastPieceIndex ? lastPieceLength : pieceLength;
}

export function blocksPerPiece(torrent: any, pieceIndex: number) {
  const pLength = pieceLength(torrent, pieceIndex);
  return Math.ceil(pLength / BLOCK_LEN);
}

export function blockLength(
  torrent: any,
  pieceIndex: number,
  blockIndex: number,
) {
  const pLength = Number(BigInt(pieceLength(torrent, pieceIndex)));

  const lastBlockLength = pLength % BLOCK_LEN;
  const lastBlockIndex = Math.floor(pLength / BLOCK_LEN);

  return blockIndex === lastBlockIndex ? lastBlockLength : BLOCK_LEN;
}

export function open(filepath: string) {
  return bencode.decode(fs.readFileSync(filepath));
}

export function size(torrent: any): number {
  const size = torrent.info.files
    ? torrent.info.files.map((file) => file.length).reduce((a, b) => a + b)
    : torrent.info.length;

  return size;
}
export function infoHash(torrent: any) {
  const info = bencode.encode(torrent["info"]);
  return crypto.createHash("sha1").update(info).digest();
}
