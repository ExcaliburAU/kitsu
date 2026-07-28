/**
 * Minimal BlurHash encode/decode (port of https://github.com/woltapp/blurhash).
 */
(() => {
  const digitChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';
  const digitMap = new Map([...digitChars].map((c, i) => [c, i]));

  function encode83(value, length) {
    let result = '';
    for (let i = 1; i <= length; i += 1) {
      const digit = Math.floor(value / 83 ** (length - i)) % 83;
      result += digitChars[digit];
    }
    return result;
  }

  function decode83(str) {
    let value = 0;
    for (const char of str) {
      const digit = digitMap.get(char);
      if (digit == null) return null;
      value = value * 83 + digit;
    }
    return value;
  }

  function srgbToLinear(value) {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }

  function linearToSrgb(value) {
    const v = Math.max(0, Math.min(1, value));
    return v <= 0.0031308
      ? Math.round(v * 12.92 * 255)
      : Math.round((1.055 * v ** (1 / 2.4) - 0.055) * 255);
  }

  function signPow(val, exp) {
    return Math.sign(val) * Math.abs(val) ** exp;
  }

  function decodeDC(value) {
    return [srgbToLinear(value >> 16), srgbToLinear((value >> 8) & 255), srgbToLinear(value & 255)];
  }

  function encodeDC(value) {
    const roundedR = linearToSrgb(value[0]);
    const roundedG = linearToSrgb(value[1]);
    const roundedB = linearToSrgb(value[2]);
    return (roundedR << 16) + (roundedG << 8) + roundedB;
  }

  function decodeAC(value, maxValue) {
    const quantR = Math.floor(value / (19 * 19));
    const quantG = Math.floor(value / 19) % 19;
    const quantB = value % 19;
    return [
      signPow((quantR - 9) / 9, 2) * maxValue,
      signPow((quantG - 9) / 9, 2) * maxValue,
      signPow((quantB - 9) / 9, 2) * maxValue,
    ];
  }

  function encodeAC(value, maximumValue) {
    const quantR = Math.floor(Math.max(0, Math.min(18, Math.floor(signPow(value[0] / maximumValue, 0.5) * 9 + 9.5))));
    const quantG = Math.floor(Math.max(0, Math.min(18, Math.floor(signPow(value[1] / maximumValue, 0.5) * 9 + 9.5))));
    const quantB = Math.floor(Math.max(0, Math.min(18, Math.floor(signPow(value[2] / maximumValue, 0.5) * 9 + 9.5))));
    return quantR * 19 * 19 + quantG * 19 + quantB;
  }

  function decode(blurhash, width, height, punch = 1) {
    if (!blurhash || blurhash.length < 6) return null;
    const sizeFlag = decode83(blurhash[0]);
    if (sizeFlag == null) return null;
    const numY = Math.floor(sizeFlag / 9) + 1;
    const numX = (sizeFlag % 9) + 1;
    const quantMax = decode83(blurhash[1]);
    if (quantMax == null) return null;
    const maxValue = ((quantMax + 1) / 166) * punch;
    const colors = [];
    const dc = decode83(blurhash.slice(2, 6));
    if (dc == null) return null;
    colors.push(decodeDC(dc));
    for (let i = 1; i < numX * numY; i += 1) {
      const start = 4 + i * 2;
      const value = decode83(blurhash.slice(start, start + 2));
      if (value == null) return null;
      colors.push(decodeAC(value, maxValue));
    }

    const bytes = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let j = 0; j < numY; j += 1) {
          for (let i = 0; i < numX; i += 1) {
            const basis =
              Math.cos((Math.PI * x * i) / width) * Math.cos((Math.PI * y * j) / height);
            const color = colors[i + j * numX];
            r += color[0] * basis;
            g += color[1] * basis;
            b += color[2] * basis;
          }
        }
        const offset = 4 * (x + y * width);
        bytes[offset] = linearToSrgb(r);
        bytes[offset + 1] = linearToSrgb(g);
        bytes[offset + 2] = linearToSrgb(b);
        bytes[offset + 3] = 255;
      }
    }
    return bytes;
  }

  function encode(pixels, width, height, componentX = 4, componentY = 3) {
    if (!pixels || width < 1 || height < 1) return null;
    componentX = Math.max(1, Math.min(9, componentX | 0));
    componentY = Math.max(1, Math.min(9, componentY | 0));

    const factors = [];
    for (let y = 0; y < componentY; y += 1) {
      for (let x = 0; x < componentX; x += 1) {
        const normalisation = x === 0 && y === 0 ? 1 : 2;
        let r = 0;
        let g = 0;
        let b = 0;
        for (let j = 0; j < height; j += 1) {
          for (let i = 0; i < width; i += 1) {
            const basis =
              normalisation *
              Math.cos((Math.PI * x * i) / width) *
              Math.cos((Math.PI * y * j) / height);
            const idx = 4 * (i + j * width);
            r += basis * srgbToLinear(pixels[idx]);
            g += basis * srgbToLinear(pixels[idx + 1]);
            b += basis * srgbToLinear(pixels[idx + 2]);
          }
        }
        const scale = 1 / (width * height);
        factors.push([r * scale, g * scale, b * scale]);
      }
    }

    const dc = factors[0];
    const ac = factors.slice(1);
    let hash = '';
    const sizeFlag = componentX - 1 + (componentY - 1) * 9;
    hash += encode83(sizeFlag, 1);

    let maximumValue;
    if (ac.length > 0) {
      const actualMax = Math.max(...ac.map((f) => Math.max(Math.abs(f[0]), Math.abs(f[1]), Math.abs(f[2]))));
      const quantisedMax = Math.floor(Math.max(0, Math.min(82, Math.floor(actualMax * 166 - 0.5))));
      maximumValue = (quantisedMax + 1) / 166;
      hash += encode83(quantisedMax, 1);
    } else {
      maximumValue = 1;
      hash += encode83(0, 1);
    }

    hash += encode83(encodeDC(dc), 4);
    for (const factor of ac) {
      hash += encode83(encodeAC(factor, maximumValue), 2);
    }
    return hash;
  }

  function toDataUrl(blurhash, width = 32, height = 32) {
    try {
      const pixels = decode(blurhash, width, height);
      if (!pixels) return null;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
      return canvas.toDataURL();
    } catch {
      return null;
    }
  }

  async function encodeFromBlob(blob, componentX = 4, componentY = 3) {
    if (!blob) return null;
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
    } catch {
      return null;
    }
    const maxSide = 64;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      bitmap.close?.();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const blurhash = encode(imageData.data, width, height, componentX, componentY);
    const result = {
      blurhash,
      width: bitmap.width,
      height: bitmap.height,
    };
    bitmap.close?.();
    return blurhash ? result : null;
  }

  window.RelayBlurhash = { decode, encode, toDataUrl, encodeFromBlob };
})();
