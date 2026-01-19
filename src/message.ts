import * as utils from "./utils.ts";
import { infoHash } from "./torrent-parser.ts";
import { type PieceBlock } from "./queue.ts";

interface BaseMessage<T extends string> {
  id: number;
  size: number;
  type: T;
}
export type ChokeMessage = BaseMessage<"choke">;
export type UnchokeMessage = BaseMessage<"unchoke">;
export interface HaveMessage extends BaseMessage<"have"> {
  pieceIndex: number;
}
export interface BitfieldMessage extends BaseMessage<"bitfield"> {
  bitfield: Buffer<ArrayBuffer>;
}
export interface PieceMessage extends BaseMessage<"piece"> {
  index: number;
  begin: number;
  block: Buffer<ArrayBuffer>;
}

export type KnownMessage =
  | PieceMessage
  | BitfieldMessage
  | HaveMessage
  | ChokeMessage
  | UnchokeMessage;

interface UnknownMessage extends BaseMessage<"unknown"> {
  buffer: Buffer<ArrayBuffer>;
}

export type Message = KnownMessage | UnknownMessage;

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
export function buildRequest(payload: PieceBlock) {
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
export function buildPiece(payload: PieceMessage) {
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
export function buildCancel(payload: PieceBlock) {
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
export function buildPort(payload: number) {
  const buf = Buffer.alloc(7);
  // length
  buf.writeUInt32BE(3, 0);
  // id
  buf.writeUInt8(9, 4);
  // listen port
  buf.writeUInt16BE(payload, 5);

  return buf;
}

export function parseMessage(msg: Buffer<ArrayBuffer>): Message {
  const id = msg.length > 4 ? msg.readUInt8(4) : -1;
  const size = msg.length > 4 ? msg.readUint32BE(0) : 0;
  let payloadBuffer = msg.length > 5 ? msg.subarray(5) : Buffer.alloc(0);

  let baseMessage = { id, size };

  if (id === 0) {
    return { ...baseMessage, type: "choke" };
  } else if (id === 1) {
    return { ...baseMessage, type: "unchoke" };
  } else if (id === 4) {
    return {
      ...baseMessage,
      type: "have",
      pieceIndex: payloadBuffer.readUint32BE(0),
    };
  } else if (id === 5) {
    return {
      ...baseMessage,
      type: "bitfield",
      bitfield: payloadBuffer,
    };
  } else if (id === 7) {
    return {
      ...baseMessage,
      type: "piece",
      index: payloadBuffer.readUint32BE(0),
      begin: payloadBuffer.readUint32BE(4),
      block: payloadBuffer.subarray(8),
    };
  } else {
    return {
      ...baseMessage,
      type: "unknown",
      buffer: payloadBuffer,
    };
  }
}
