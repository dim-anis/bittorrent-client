import crypto from "node:crypto";

// id is generated once
let id: Buffer<ArrayBuffer> | null = null;

export function genId() {
  if (!id) {
    id = crypto.randomBytes(20);
    Buffer.from("-DA0001-").copy(id, 0);
  }

  return id;
}
