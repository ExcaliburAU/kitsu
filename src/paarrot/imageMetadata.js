/**
 * Lean multi-format Paarrot avatar metadata extract.
 * PNG keeps full metadata; JPEG/WebP/GIF extract accent color from XMP / text.
 */
const {
  extractMetadataFromPNG,
  embedMetadataInPNG,
  isPng,
} = require('./pngMetadata');

const XMP_HEADER = Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'binary');
const COLOR_TAG = Buffer.from('<paarrot:color>', 'ascii');
const COLOR_TAG_END = Buffer.from('</paarrot:color>', 'ascii');
const COLOR_PLAIN = Buffer.from('paarrot:color', 'ascii');

function asBuffer(imageData) {
  return Buffer.isBuffer(imageData) ? imageData : Buffer.from(imageData);
}

function isJpeg(data) {
  return data.length >= 2 && data[0] === 0xff && data[1] === 0xd8;
}

function isWebp(data) {
  return (
    data.length >= 12 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP'
  );
}

function isGif(data) {
  if (data.length < 6) return false;
  const sig = data.toString('ascii', 0, 6);
  return sig === 'GIF87a' || sig === 'GIF89a';
}

function colorFromBufferSlice(buf, start = 0, end = buf.length) {
  const from = Math.max(0, start);
  const to = Math.min(buf.length, end);
  if (to <= from) return null;
  const idx = buf.indexOf(COLOR_TAG, from);
  if (idx < 0 || idx >= to) return null;
  const valueStart = idx + COLOR_TAG.length;
  const valueEnd = buf.indexOf(COLOR_TAG_END, valueStart);
  if (valueEnd < 0 || valueEnd > to) return null;
  return buf.slice(valueStart, valueEnd).toString('utf8').trim() || null;
}

function extractColorFromJpeg(imageData) {
  const data = asBuffer(imageData);
  if (!isJpeg(data)) return null;

  let offset = 2;
  while (offset + 4 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1];
    if (marker === 0xff || marker === 0x00) {
      offset += 1;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break;
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segmentLength = data.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > data.length) break;
    if (marker === 0xe1) {
      const segStart = offset + 4;
      const segEnd = offset + 2 + segmentLength;
      if (
        segEnd - segStart > XMP_HEADER.length &&
        data.compare(XMP_HEADER, 0, XMP_HEADER.length, segStart, segStart + XMP_HEADER.length) === 0
      ) {
        const color = colorFromBufferSlice(data, segStart + XMP_HEADER.length, segEnd);
        if (color) return color;
      }
    }
    offset += 2 + segmentLength;
  }
  return null;
}

/** Scan only chunk headers / first 256KB — avoid latin1 of whole image. */
function extractColorFromWebp(imageData) {
  const data = asBuffer(imageData);
  if (!isWebp(data)) return null;
  const limit = Math.min(data.length, 256 * 1024);
  const color = colorFromBufferSlice(data, 0, limit);
  if (color) return color;
  // Fallback: locate "XMP " chunk then search nearby.
  const xmpFourcc = Buffer.from('XMP ');
  const at = data.indexOf(xmpFourcc);
  if (at >= 0 && at + 8 < data.length) {
    const size = data.readUInt32LE(at + 4);
    return colorFromBufferSlice(data, at + 8, Math.min(data.length, at + 8 + size + 1));
  }
  return null;
}

function extractColorFromGif(imageData) {
  const data = asBuffer(imageData);
  if (!isGif(data)) return null;
  // GIF app extensions are near the start; don't stringify the whole frame data.
  const limit = Math.min(data.length, 64 * 1024);
  const color = colorFromBufferSlice(data, 0, limit);
  if (color) return color;
  const plainAt = data.indexOf(COLOR_PLAIN);
  if (plainAt >= 0 && plainAt < limit) {
    const slice = data.slice(plainAt, Math.min(limit, plainAt + 48)).toString('latin1');
    const match = slice.match(/paarrot:color[=:]([#A-Fa-f0-9]+)/);
    return match ? match[1] : null;
  }
  return null;
}

function extractMetadataFromImage(imageData) {
  const data = asBuffer(imageData);
  if (isPng(data)) return extractMetadataFromPNG(data);
  if (isJpeg(data)) {
    const color = extractColorFromJpeg(data);
    return color ? { color } : {};
  }
  if (isWebp(data)) {
    const color = extractColorFromWebp(data);
    return color ? { color } : {};
  }
  if (isGif(data)) {
    const color = extractColorFromGif(data);
    return color ? { color } : {};
  }
  return {};
}

module.exports = {
  extractMetadataFromImage,
  extractMetadataFromPNG,
  embedMetadataInPNG,
  extractColorFromJpeg,
  extractColorFromWebp,
  extractColorFromGif,
  isPng,
  isJpeg,
  isWebp,
  isGif,
};
