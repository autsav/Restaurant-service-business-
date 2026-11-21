import { readFileSync } from "node:fs";

export type ImageSize = { width: number; height: number };

// Reads the pixel size from a PNG, JPEG or WebP header. Returns null if the
// bytes are not one of those formats. No dependencies, no image decoding.
export const probeImageSize = (file: string): ImageSize | null => {
  const buf = readFileSync(file);
  return probePng(buf) ?? probeJpeg(buf) ?? probeWebp(buf);
};

const probePng = (buf: Buffer): ImageSize | null => {
  const signature = "89504e470d0a1a0a";
  if (buf.length < 24 || buf.toString("hex", 0, 8) !== signature) {
    return null;
  }
  // The IHDR chunk always comes first: width and height at bytes 16 and 20.
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};

const probeJpeg = (buf: Buffer): ImageSize | null => {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    return null;
  }
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      return null;
    }
    const marker = buf[i + 1];
    if (marker === 0xff) {
      i += 1; // Fill byte.
      continue;
    }
    // Standalone markers have no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      i += 2;
      continue;
    }
    // SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC), hold the frame size.
    const isStartOfFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isStartOfFrame) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
};

const probeWebp = (buf: Buffer): ImageSize | null => {
  if (
    buf.length < 30 ||
    buf.toString("ascii", 0, 4) !== "RIFF" ||
    buf.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") {
    // Lossy: 14-bit sizes after the 3-byte start code.
    return {
      width: buf.readUInt16LE(26) & 0x3fff,
      height: buf.readUInt16LE(28) & 0x3fff,
    };
  }
  if (chunk === "VP8L") {
    // Lossless: two 14-bit (size - 1) fields after the 0x2f signature byte.
    const bits = buf.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    // Extended: two 24-bit (size - 1) fields.
    return {
      width: buf.readUIntLE(24, 3) + 1,
      height: buf.readUIntLE(27, 3) + 1,
    };
  }
  return null;
};
