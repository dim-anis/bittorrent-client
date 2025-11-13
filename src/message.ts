import * as utils from "./utils.ts";
import { infoHash } from "./torrent-parser.ts";

export function buildHandshake(torrent: Buffer<ArrayBufferLike>) {
  const buf = Buffer.alloc(68);
  // pstr length
  buf.writeUInt8(19, 0);
  // pstr
  buf.write("BitTorrent protocol", 1);
  // reserved
  buf.writeUInt32BE(0, 20);
  buf.writeUInt32BE(0, 24);
  // info hash
  infoHash(torrent).copy(buf, 28);
  // peer id
  utils.genId().copy(buf, 48);

  return buf;
}

export function buildKeepAlive() {
  return Buffer.alloc(4);
}

export function buildChoke() {
  const buf = Buffer.alloc(5);
  // length
  buf.writeUInt32BE(1, 0);
  // id
  buf.writeUInt8(0, 4);

  return buf;
}

export function buildUnChoke() {
  const buf = Buffer.alloc(5);
  // length
  buf.writeUInt32BE(1, 0);
  // id
  buf.writeUInt8(1, 4);

  return buf;
}
export function buildInterested() {
  const buf = Buffer.alloc(5);
  // length
  buf.writeUInt32BE(1, 0);
  // id
  buf.writeUInt8(2, 4);

  return buf;
}
export function buildUnInterested() {
  const buf = Buffer.alloc(5);
  // length
  buf.writeUInt32BE(1, 0);
  // id
  buf.writeUInt8(3, 4);

  return buf;
}
export function buildHave(payload: number) {
  const buf = Buffer.alloc(9);
  // length
  buf.writeUInt32BE(5, 0);
  // id
  buf.writeUInt8(4, 4);
  // piece index
  buf.writeUInt32BE(payload, 5);

  return buf;
}
export function buildBitfield(
  bitfield: Buffer<ArrayBufferLike>,
  // payload will be a struct
  payload: Buffer<ArrayBufferLike>,
) {
  const buf = Buffer.alloc(14);
  // length
  buf.writeUInt32BE(payload.length + 1, 0);
  // id
  buf.writeUInt8(5, 4);
  // piece index
  bitfield.copy(buf, 5);

  return buf;
}
export function buildRequest(
  // payload will be a struct
  payload: Buffer<ArrayBufferLike>,
) {
  const buf = Buffer.alloc(17);
  // length
  buf.writeUInt32BE(13, 0);
  // id
  buf.writeUInt8(6, 4);
  // piece index
  buf.writeUInt32BE(payload.index, 5);
  // begin
  buf.writeUInt32BE(payload.begin, 9);
  // length
  buf.writeUInt32BE(payload.length, 13);

  return buf;
}
export function buildPiece(
  // payload will be a struct
  payload: Buffer<ArrayBufferLike>,
) {
  const buf = Buffer.alloc(payload.block.length + 13);
  // length
  buf.writeUInt32BE(payload.block.length + 9, 0);
  // id
  buf.writeUInt8(7, 4);
  // piece index
  buf.writeUInt32BE(payload.index, 5);
  // begin
  buf.writeUInt32BE(payload.begin, 9);
  // block
  payload.block.copy(buf, 13);

  return buf;
}
export function buildCancel(
  // payload will be a struct
  payload: Buffer<ArrayBufferLike>,
) {
  const buf = Buffer.alloc(17);
  // length
  buf.writeUInt32BE(13, 0);
  // id
  buf.writeUInt8(8, 4);
  // piece index
  buf.writeUInt32BE(payload.index, 5);
  // begin
  buf.writeUInt32BE(payload.begin, 9);
  // length
  buf.writeUInt32BE(payload.length, 13);

  return buf;
}
export function buildPort(
  // payload will be a struct
  payload: Buffer<ArrayBufferLike>,
) {
  const buf = Buffer.alloc(7);
  // length
  buf.writeUInt32BE(3, 0);
  // id
  buf.writeUInt8(9, 4);
  // listen port
  buf.writeUInt16BE(payload, 5);

  return buf;
}
