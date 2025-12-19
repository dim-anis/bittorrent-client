import dgram from "dgram";
import crypto from "node:crypto";
import * as util from "./utils.ts";
import * as torrentParser from "./torrent-parser.ts";
import { size } from "./torrent-parser.ts";

export type Peer = {
  ip: string;
  port: number;
};

class TrackerClient {
  socket: dgram.Socket;
  pendingRequests: Map<number, { resolve: Function; reject: Function }>;

  constructor(socket: dgram.Socket) {
    this.socket = socket;
    this.pendingRequests = new Map();
  }

  setupSocketListeners() {
    this.socket.on("message", (msg, _) => {
      const transactionId = msg.readUint32BE(4);
      const handler = this.pendingRequests.get(transactionId);
      if (!handler) return;

      const type = respType(msg);

      try {
        if (type === "connect") {
          handler.resolve(msg);
        } else if (type === "announce") {
          handler.resolve(msg);
        }
      } catch (e) {
        this.socket.close();
        handler.reject(e);
      } finally {
        this.pendingRequests.delete(transactionId);
      }
    });

    this.socket.on("error", (err) => {
      for (const { reject } of this.pendingRequests.values()) {
        reject(err);
      }
      this.pendingRequests.clear();
    });
  }

  async getPeers(url: URL, torrent: Buffer<ArrayBuffer>) {
    const connectResponse = await this.connect(url);
    let { connectionId } = parseConnResp(connectResponse);
    const announceResp = await this.announce(connectionId, url, torrent);
    return parseAnnounceResp(announceResp);
  }

  sendRequest(
    url: URL,
    requestBuffer: Buffer<ArrayBuffer>,
    transactionId: number,
    timeoutMs = 15000,
  ): Promise<Buffer<ArrayBuffer>> {
    const { port = "6881", hostname } = url;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(transactionId, {
        resolve,
        reject,
      });

      this.socket.send(requestBuffer, Number(port), hostname);

      setTimeout(() => {
        if (this.pendingRequests.has(transactionId)) {
          this.pendingRequests
            .get(transactionId)
            ?.reject(new Error("connect timeout"));
          this.pendingRequests.delete(transactionId);
        }
      }, timeoutMs);
    });
  }

  connect(url: URL): Promise<Buffer<ArrayBuffer>> {
    const { buf: connReq, transactionId } = buildConnReq();
    return this.sendRequest(url, connReq, transactionId);
  }

  announce(
    connectionId: bigint,
    url: URL,
    torrent: Buffer<ArrayBuffer>,
  ): Promise<Buffer<ArrayBuffer>> {
    const { buf: announceReq, transactionId: annReqId } = buildAnnounceReq(
      connectionId,
      torrent,
    );
    return this.sendRequest(url, announceReq, annReqId);
  }
}

export default async function getPeers(
  torrent: Buffer<ArrayBufferLike>,
): Promise<
  {
    status: "fulfilled" | "rejected";
    value: { peers: { ip: string; port: number }[] };
  }[]
> {
  const socket = dgram.createSocket("udp4");
  const client = new TrackerClient(socket);

  client.setupSocketListeners();

  const decoder = new TextDecoder();
  const urls = torrent["announce-list"]
    .map(([tracker]) => new URL(decoder.decode(tracker)))
    // only handle udp trackers for now
    .filter((url) => url.protocol === "udp:");
  const promises = urls.map((url) => client.getPeers(url, torrent));

  return Promise.allSettled(promises).finally(() => socket.close());
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
  buf.writeBigUint64BE(BigInt(size(torrent)), 64);
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
