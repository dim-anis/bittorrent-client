import dgram from "dgram";
import crypto from "node:crypto";
import * as util from "./utils.ts";

export default function getPeers(tracker: Uint8Array<ArrayBufferLike>) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const url = new URL(new TextDecoder().decode(tracker));
    socket.send(buildConnReq(), Number(url.port), url.host, () => {});

    socket.on("error", (err) => {
      socket.close();
      reject(err);
    });

    socket.on("message", (res) => {
      try {
        if (respType(res) === "connect") {
          const connResp = parseConnResp(res);

          const announceReq = buildAnnounceReq(connResp.connectionId, tracker);

          socket.send(announceReq, Number(url.port), url.host, () => {});
        } else if (respType(res) === "announce") {
          const announceResp = parseAnnounceResp(res);

          socket.close();

          resolve(announceResp.peers);
        }
      } catch (err) {
        socket.close();
        reject(err);
      }
    });
  });
}

function buildConnReq() {
  const buf = Buffer.alloc(16);

  // connectionId
  const connId = (0x417n << 32n) | 0x27101980n;
  buf.writeBigUint64BE(connId, 0);
  // action
  buf.writeUInt32BE(0, 8);
  // transaction id
  crypto.randomBytes(4).copy(buf, 12);

  return buf;
}

function parseConnResp(res: Buffer<ArrayBuffer>) {
  return {
    action: res.readUInt32BE(0),
    transactionId: res.readUInt32BE(4),
    connectionId: res.readBigUInt64BE(8),
  };
}

function parseAnnounceResp(res: Buffer<ArrayBuffer>) {
  function group(iterable: Buffer<ArrayBuffer>, groupSize: number) {
    let groups: Buffer<ArrayBuffer>[] = [];
    for (let i = 0; i < iterable.length; i += groupSize) {
      groups.push(iterable.subarray(i, i + groupSize));
    }
    return groups;
  }

  return {
    action: res.readUInt32BE(0),
    transactionId: res.readUInt32BE(4),
    leechers: res.readUInt32BE(8),
    seeders: res.readUInt32BE(12),
    peers: group(res.subarray(20), 6).map((address) => {
      return {
        ip: address.subarray(0, 4).join("."),
        port: address.readUInt16BE(4),
      };
    }),
  };
}

function buildAnnounceReq(
  connId: bigint,
  torrent: Uint8Array<ArrayBuffer>,
  port = 6881,
) {
  const buf = Buffer.allocUnsafe(98);

  // connectionId
  buf.writeBigUint64BE(connId, 0);
  // action
  buf.writeUInt32BE(1, 8);
  // transactionId
  crypto.randomBytes(4).copy(buf, 12);
  // TODO: info hash
  torrentParser.infoHash(torrent).copy(buf, 16);
  // peerId
  util.genId().copy(buf, 36);
  // downloaded
  Buffer.alloc(8).copy(buf, 56);
  // TODO: left
  torrentParser.size(torrent).copy(buf, 64);
  // uploaded
  Buffer.alloc(8).copy(buf, 72);
  // event
  buf.writeUInt32BE(0, 80);
  // ip address
  buf.writeUInt32BE(0, 80);
  // key
  crypto.randomBytes(4).copy(buf, 88);
  // num want
  buf.writeInt32BE(-1, 92);
  // port
  buf.writeUInt16BE(port, 96);

  return buf;
}

function respType(res: Buffer<ArrayBufferLike>) {}
