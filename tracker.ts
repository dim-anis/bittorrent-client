import dgram from "dgram";
import crypto from "node:crypto";
import * as util from "./utils.ts";
import * as torrentParser from "./torrent-parser.ts";

function createTrackerClient() {
  const socket = dgram.createSocket("udp4");
  const pending = new Map<number, { resolve: Function; reject: Function }>();

  socket.on("message", (msg, rinfo) => {
    const transactionId = msg.readUint32BE(4);
    const handler = pending.get(transactionId);
    if (!handler) return;

    const type = respType(msg);

    try {
      if (type === "connect") {
        handler.resolve(msg);
      } else if (type === "announce") {
        console.log("announce");
        handler.resolve(msg);
      }
    } catch (e) {
      socket.close();
      handler.reject(e);
    } finally {
      pending.delete(transactionId);
    }

    // try {
    //   if (respType(msg) === "connect") {
    //     const connResp = parseConnResp(msg);
    //
    //     // const announceReq = buildAnnounceReq(connResp.connectionId, torrent);
    //     //
    //     // socket.send(announceReq, Number(url.port), url.hostname, () => {});
    //   } else if (respType(msg) === "announce") {
    //     const announceResp = parseAnnounceResp(msg);
    //     socket.close();
    //     handler.resolve(announceResp.peers);
    //   }
    // } catch (err) {
    //   socket.close();
    //   handler.reject(rinfo);
    // }
  });

  socket.on("error", (err) => {
    for (const { reject } of pending.values()) {
      reject(err);
    }
    pending.clear();
  });

  function connectToTracker(url: URL, torrent: Uint8Array<ArrayBufferLike>) {
    return new Promise((resolve, reject) => {
      const { buf: connReq, transactionId } = buildConnReq();
      console.log({ transactionId });

      pending.set(transactionId, {
        resolve: (msg) => {
          pending.delete(transactionId);
          onConnect(msg);
        },
        reject: (err) => {
          pending.delete(transactionId);
          reject(err);
        },
      });

      socket.send(connReq, Number(url.port), url.hostname);

      setTimeout(() => {
        if (pending.has(transactionId)) {
          pending.get(transactionId)?.reject(new Error("connect timeout"));
          pending.delete(transactionId);
        }
      }, 15000);

      function onConnect(msg: Buffer<ArrayBufferLike>) {
        try {
          const connResp = parseConnResp(msg);
          console.log({ connResp });
          const { buf: announceReq, transactionId: annReqId } =
            buildAnnounceReq(connResp.connectionId, torrent);

          console.log({ annReqId });

          pending.set(annReqId, {
            resolve: (msg) => {
              const announceResp = parseAnnounceResp(msg);
              resolve(announceResp.peers);
            },
            reject: (err) => {
              pending.delete(annReqId);
              reject(err);
            },
          });

          socket.send(announceReq, Number(url.port), url.hostname);

          // announce timeout
          setTimeout(() => {
            if (pending.has(annReqId)) {
              pending.get(annReqId)?.reject(new Error("announce timeout"));
              pending.delete(annReqId);
            }
          }, 15000);
        } catch (e) {
          reject(e);
        }
      }
    });
  }

  return { connectToTracker, close: () => socket.close() };
}

export default async function getPeers(torrent: Buffer<ArrayBufferLike>) {
  const client = createTrackerClient();

  const promises = torrent["announce-list"]
    .map(([tracker]) => {
      const url = new URL(new TextDecoder().decode(tracker));
      if (url.href !== "udp://torrent.gresille.org:80/announce") {
        return client.connectToTracker(url, torrent);
      }
      return null;
    })
    .filter(Boolean);

  return Promise.any(promises).finally(() => client.close());
}

function buildConnReq() {
  const buf = Buffer.alloc(16);

  // connectionId
  const connId = (0x417n << 32n) | 0x27101980n;
  buf.writeBigUint64BE(connId, 0);
  // action
  buf.writeUInt32BE(0, 8);
  // transaction id
  const transactionId = crypto.randomBytes(4).readUint32BE(0);
  buf.writeUint32BE(transactionId, 12);

  return { transactionId, buf };
}

function parseConnResp(res: Buffer<ArrayBuffer>) {
  return {
    action: res.readUInt32BE(0),
    transactionId: res.readUInt32BE(4),
    connectionId: res.readBigUint64BE(8),
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
    interval: res.readUInt32BE(8),
    leechers: res.readUInt32BE(12),
    seeders: res.readUInt32BE(16),
    peers: group(res.subarray(20), 6).map((address) => {
      return {
        ip: [...address.subarray(0, 4)].join("."),
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
  const transactionId = crypto.randomBytes(4).readUint32BE(0);
  buf.writeUint32BE(transactionId, 12);
  // info hash
  torrentParser.infoHash(torrent).copy(buf, 16);
  // peerId
  util.genId().copy(buf, 36);
  // downloaded
  Buffer.alloc(8).copy(buf, 56);
  // left
  torrentParser.size(torrent).copy(buf, 64);
  // uploaded
  Buffer.alloc(8).copy(buf, 72);
  // event
  buf.writeUInt32BE(0, 80);
  // ip address
  buf.writeUInt32BE(0, 84);
  // key
  crypto.randomBytes(4).copy(buf, 88);
  // num want
  buf.writeInt32BE(-1, 92);
  // port
  buf.writeUInt16BE(port, 96);

  return { buf, transactionId };
}

function respType(res: Buffer<ArrayBufferLike>) {
  const action = res.readUInt32BE(0);
  if (action === 0) return "connect";
  if (action === 1) return "announce";
}
