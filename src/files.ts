import path from "node:path";
import fs from "node:fs";
import { showProgressBar } from "./progressBar.ts";

type File = {
  fd: number;
  size: number;
  sizeWritten: number;
  byteRange: [number, number];
};

export class FileHandler {
  pieceLength: number;
  files: File[] = [];

  constructor(torrentInfo: any, downloadDir = "downloads") {
    this.pieceLength = torrentInfo["piece length"];

    const torrentRootDir = new TextDecoder().decode(torrentInfo.name);
    let currentOffset = 0;

    for (let i = 0; i < torrentInfo.files.length; i++) {
      const joinPath = torrentInfo.files[i].path
        .map((segment: Buffer<ArrayBuffer>) =>
          new TextDecoder().decode(segment),
        )
        .join("/");

      const { dir, base } = path.parse(joinPath);
      const fullDirPath = `${downloadDir}/${torrentRootDir}${dir ? `/${dir}` : ""}`;
      const filePath = `${fullDirPath}/${base}`;

      fs.mkdirSync(fullDirPath, {
        recursive: true,
      });

      const fd = fs.openSync(filePath, "w");
      const fileLength = torrentInfo.files[i].length;
      const startIndex = currentOffset;
      const endIndex = currentOffset + fileLength;

      this.files.push({
        fd,
        size: endIndex - startIndex,
        sizeWritten: 0,
        byteRange: [startIndex, endIndex],
      });

      currentOffset += fileLength;
    }
  }

  writePieceToDisk(pieceIndex: number, verifiedBuffer: Buffer<ArrayBuffer>) {
    const pieceStart = pieceIndex * this.pieceLength;
    const pieceEnd = pieceStart + verifiedBuffer.length;

    for (const file of this.files) {
      const [fileStart, fileEnd] = file.byteRange;

      if (pieceStart < fileEnd && pieceEnd > fileStart) {
        const overlapStart = Math.max(pieceStart, fileStart);
        const overlapEnd = Math.min(pieceEnd, fileEnd);

        const bufferOffset = overlapStart - pieceStart;
        const writeLength = overlapEnd - overlapStart;
        const fileOffset = overlapStart - fileStart;

        file.sizeWritten += writeLength;

        fs.writeSync(
          file.fd,
          verifiedBuffer,
          bufferOffset,
          writeLength,
          fileOffset,
        );

        this.logProgress();
      }
    }
  }

  closeDescriptors() {
    for (const file of this.files) {
      try {
        fs.closeSync(file.fd);
      } catch (error) {}
    }
  }

  logProgress() {
    const totalBytes = this.files.reduce(
      (total, curr) => (total += curr.size),
      0,
    );
    const downloadedBytes = this.files.reduce(
      (total, curr) => (total += curr.sizeWritten),
      0,
    );

    showProgressBar(totalBytes, downloadedBytes);
  }
}
