import dgram from "dgram";

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

          const announceReq = buildAnnounceReq(connResp.connectionId);

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
  return "";
}
function parseConnResp(res: Buffer<ArrayBufferLike>) {}
function parseAnnounceResp(res: Buffer<ArrayBufferLike>) {
  return "";
}
function buildAnnounceReq(connId: number) {
  return "";
}
function respType(res: Buffer<ArrayBufferLike>) {}
