/**
 * Paarrot avatar metadata in PNG tEXt chunks (compatible with Paarrot/cinny).
 * Keys: paarrot:color | paarrot:banner | paarrot:borderColor | paarrot:gradient
 */

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const PAARROT_COLOR_KEY = 'paarrot:color';
const PAARROT_BANNER_KEY = 'paarrot:banner';
const PAARROT_BORDER_COLOR_KEY = 'paarrot:borderColor';
const PAARROT_GRADIENT_KEY = 'paarrot:gradient';
const PAARROT_KEYS = [
  PAARROT_COLOR_KEY,
  PAARROT_BANNER_KEY,
  PAARROT_BORDER_COLOR_KEY,
  PAARROT_GRADIENT_KEY,
];

let crc32Table = null;
function getCRC32Table() {
  if (crc32Table) return crc32Table;
  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
    crc32Table[i] = c >>> 0;
  }
  return crc32Table;
}

function crc32(data) {
  let crc = 0xffffffff;
  const table = getCRC32Table();
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ table[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32BE(value) {
  return Buffer.from([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function isPng(data) {
  if (!data || data.length < 8) return false;
  for (let i = 0; i < 8; i += 1) {
    if (data[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

function parseChunks(data) {
  const chunks = [];
  let offset = 8;
  while (offset + 8 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.slice(offset + 4, offset + 8).toString('ascii');
    const chunkData = data.slice(offset + 8, offset + 8 + length);
    chunks.push({
      type,
      data: chunkData,
      offset,
      length: 12 + length,
    });
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return chunks;
}

function parseTextChunk(data) {
  const nullIndex = data.indexOf(0);
  if (nullIndex === -1) return null;
  return {
    key: data.slice(0, nullIndex).toString('utf8'),
    value: data.slice(nullIndex + 1).toString('utf8'),
  };
}

function createTextChunk(key, value) {
  const keyBytes = Buffer.from(key, 'utf8');
  const valueBytes = Buffer.from(value, 'utf8');
  const chunkData = Buffer.concat([keyBytes, Buffer.from([0]), valueBytes]);
  const chunkType = Buffer.from('tEXt');
  const crc = writeUint32BE(crc32(Buffer.concat([chunkType, chunkData])));
  return Buffer.concat([writeUint32BE(chunkData.length), chunkType, chunkData, crc]);
}

/**
 * @returns {{ color?: string, banner?: string, avatarBorderColor?: string, gradient?: { direction: string, startColor: string, stopColor: string } }}
 */
function extractMetadataFromPNG(imageData) {
  const data = Buffer.isBuffer(imageData) ? imageData : Buffer.from(imageData);
  const metadata = {};
  if (!isPng(data)) return metadata;

  for (const chunk of parseChunks(data)) {
    if (chunk.type !== 'tEXt') continue;
    const text = parseTextChunk(chunk.data);
    if (!text) continue;
    if (text.key === PAARROT_COLOR_KEY) metadata.color = text.value;
    else if (text.key === PAARROT_BANNER_KEY) metadata.banner = text.value;
    else if (text.key === PAARROT_BORDER_COLOR_KEY) metadata.avatarBorderColor = text.value;
    else if (text.key === PAARROT_GRADIENT_KEY) {
      try {
        metadata.gradient = JSON.parse(text.value);
      } catch {
        /* ignore */
      }
    }
  }
  return metadata;
}

function embedMetadataInPNG(imageData, metadata = {}) {
  const data = Buffer.isBuffer(imageData) ? imageData : Buffer.from(imageData);
  if (!isPng(data)) return null;

  const existing = extractMetadataFromPNG(data);
  const finalMetadata = {
    color: metadata.color !== undefined ? metadata.color : existing.color,
    banner: metadata.banner !== undefined ? metadata.banner : existing.banner,
    avatarBorderColor:
      metadata.avatarBorderColor !== undefined
        ? metadata.avatarBorderColor
        : existing.avatarBorderColor,
    gradient: metadata.gradient !== undefined ? metadata.gradient : existing.gradient,
  };

  const chunks = parseChunks(data);
  let insertOffset = 8;
  const existingChunks = [];
  for (const chunk of chunks) {
    if (chunk.type === 'IHDR') insertOffset = chunk.offset + chunk.length;
    else if (chunk.type === 'tEXt') {
      const text = parseTextChunk(chunk.data);
      if (text && PAARROT_KEYS.includes(text.key)) {
        existingChunks.push({ offset: chunk.offset, length: chunk.length });
      }
    }
  }

  const newChunks = [];
  if (finalMetadata.color) newChunks.push(createTextChunk(PAARROT_COLOR_KEY, finalMetadata.color));
  if (finalMetadata.banner) newChunks.push(createTextChunk(PAARROT_BANNER_KEY, finalMetadata.banner));
  if (finalMetadata.avatarBorderColor) {
    newChunks.push(createTextChunk(PAARROT_BORDER_COLOR_KEY, finalMetadata.avatarBorderColor));
  }
  if (finalMetadata.gradient) {
    newChunks.push(createTextChunk(PAARROT_GRADIENT_KEY, JSON.stringify(finalMetadata.gradient)));
  }

  existingChunks.sort((a, b) => a.offset - b.offset);
  const parts = [];
  let readOffset = 0;
  for (const old of existingChunks) {
    parts.push(data.slice(readOffset, old.offset));
    readOffset = old.offset + old.length;
  }
  parts.push(data.slice(readOffset));
  const stripped = Buffer.concat(parts);

  if (existingChunks.length === 0) {
    return Buffer.concat([data.slice(0, insertOffset), ...newChunks, data.slice(insertOffset)]);
  }

  const strippedChunks = parseChunks(stripped);
  const ihdr = strippedChunks.find((c) => c.type === 'IHDR');
  const ins = ihdr ? ihdr.offset + ihdr.length : 8;
  return Buffer.concat([stripped.slice(0, ins), ...newChunks, stripped.slice(ins)]);
}

module.exports = {
  PAARROT_COLOR_KEY,
  PAARROT_BANNER_KEY,
  PAARROT_BORDER_COLOR_KEY,
  PAARROT_GRADIENT_KEY,
  extractMetadataFromPNG,
  embedMetadataInPNG,
  isPng,
};
