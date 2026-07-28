/**
 * Klipy GIF search + resolve helpers.
 * Adapted from https://github.com/litruv/paarrot-klipy-plugin
 */

const BASE_URL = 'https://api.klipy.com';
const DEFAULT_API_KEY =
  process.env.RELAY_KLIPY_KEY ||
  process.env.KLIPY_API_KEY ||
  'Qn0Whvr0vXSySgxfQRr28Vnlv0hQVvMEfXL1hiBvCV7demCrrCdALvnI1aUU4QO4';

function getApiKey() {
  return String(DEFAULT_API_KEY || '').trim();
}

function getShareUrl(gifData) {
  if (typeof gifData?.itemurl === 'string' && gifData.itemurl.startsWith('http')) {
    return gifData.itemurl;
  }
  if (typeof gifData?.slug === 'string' && gifData.slug) {
    return `https://klipy.com/gifs/${gifData.slug}`;
  }
  const title = String(gifData?.title ?? 'gif')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (title) return `https://klipy.com/gifs/${title}`;
  return null;
}

function getPreviewUrl(gifData) {
  const formats = gifData?.media_formats;
  if (formats) {
    // Prefer mid-size animated thumbs for the picker (nano/tiny look blurry when scaled up).
    return (
      formats.mediumgif?.url ||
      formats.tinygif?.url ||
      formats.gif?.url ||
      formats.gifpreview?.url ||
      formats.tinygifpreview?.url ||
      formats.nanogif?.url ||
      formats.nanogifpreview?.url ||
      formats.preview?.url ||
      null
    );
  }
  const file = gifData?.file;
  if (file) {
    return (
      file.md?.gif?.url ||
      file.sm?.gif?.url ||
      file.md?.webp?.url ||
      file.sm?.webp?.url ||
      file.hd?.gif?.url ||
      file.sm?.jpg?.url ||
      file.xs?.jpg?.url ||
      null
    );
  }
  return null;
}

function getMediaUrl(gifData) {
  const formats = gifData?.media_formats;
  if (formats) {
    return (
      formats.mediumgif?.url ||
      formats.gif?.url ||
      formats.tinygif?.url ||
      formats.nanogif?.url ||
      null
    );
  }
  const file = gifData?.file;
  if (file) {
    return file.md?.gif?.url || file.hd?.gif?.url || file.sm?.gif?.url || null;
  }
  return null;
}

function normalizeResult(item) {
  const mediaUrl = getMediaUrl(item);
  const preview = getPreviewUrl(item) || mediaUrl;
  const shareUrl = getShareUrl(item);
  if (!mediaUrl && !preview && !shareUrl) return null;
  return {
    id: item.id || item.slug || shareUrl || mediaUrl,
    title: item.title || item.content_description || 'GIF',
    url: mediaUrl || preview,
    preview,
    shareUrl: shareUrl || mediaUrl || preview,
    source: 'klipy',
  };
}

function parseKlipyLink(body) {
  const trimmed = String(body ?? '').trim();
  if (!trimmed) return null;

  const pageMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?klipy\.com\/gifs\/([a-zA-Z0-9-]+)\/?$/i,
  );
  if (pageMatch) {
    return {
      kind: 'page',
      slug: pageMatch[1],
      shareUrl: trimmed,
    };
  }

  const staticMatch = trimmed.match(
    /^https?:\/\/static\.klipy\.com\/.+\.(gif|webp|jpg|jpeg|png|mp4|webm)(\?.*)?$/i,
  );
  if (staticMatch) {
    return {
      kind: 'static',
      mediaUrl: trimmed,
      shareUrl: trimmed,
      title: 'GIF',
    };
  }

  return null;
}

async function searchGifs(query, { limit = 24 } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Klipy API key is not configured');
  const q = String(query || '').trim();
  if (!q) return getFeaturedGifs({ limit });

  const params = new URLSearchParams({
    key: apiKey,
    q,
    limit: String(Math.max(1, Math.min(48, Number(limit) || 24))),
    media_filter: 'gif,tinygif,mediumgif,nanogif,gifpreview,tinygifpreview,nanogifpreview',
  });
  const response = await fetch(`${BASE_URL}/v2/search?${params.toString()}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Klipy API error: ${response.status} - ${errorText.slice(0, 180)}`);
  }
  const data = await response.json();
  return (data.results || []).map(normalizeResult).filter(Boolean);
}

async function getFeaturedGifs({ limit = 24 } = {}) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Klipy API key is not configured');
  const size = Math.max(1, Math.min(48, Number(limit) || 24));

  // Tenor-compatible featured feed (best shape for our normalizer).
  try {
    const params = new URLSearchParams({
      key: apiKey,
      limit: String(size),
      media_filter: 'gif,tinygif,mediumgif,nanogif,gifpreview,tinygifpreview,nanogifpreview',
    });
    const response = await fetch(`${BASE_URL}/v2/featured?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      const gifs = (data.results || []).map(normalizeResult).filter(Boolean);
      if (gifs.length) return gifs;
    }
  } catch {
    // fall through to v1 trending
  }

  const trendingUrl = `${BASE_URL}/api/v1/${encodeURIComponent(apiKey)}/gifs/trending?per_page=${size}&page=1`;
  const trendingResponse = await fetch(trendingUrl);
  if (!trendingResponse.ok) {
    const errorText = await trendingResponse.text();
    throw new Error(`Klipy trending error: ${trendingResponse.status} - ${errorText.slice(0, 180)}`);
  }
  const trendingData = await trendingResponse.json();
  const items = trendingData?.data?.data || trendingData?.data || [];
  return (Array.isArray(items) ? items : []).map(normalizeResult).filter(Boolean);
}

async function resolveKlipyLink(rawUrl) {
  const link = parseKlipyLink(rawUrl);
  if (!link) throw new Error('Not a Klipy GIF link');

  if (link.kind === 'static') {
    return {
      title: link.title || 'GIF',
      mediaUrl: link.mediaUrl,
      shareUrl: link.shareUrl,
    };
  }

  const apiKey = getApiKey();
  const itemsUrl = `${BASE_URL}/api/v1/${encodeURIComponent(apiKey)}/gifs/items?slugs=${encodeURIComponent(link.slug)}`;
  const itemsResponse = await fetch(itemsUrl);
  if (itemsResponse.ok) {
    const itemsData = await itemsResponse.json();
    const item = itemsData?.data?.data?.[0];
    const gif =
      item?.file?.md?.gif ||
      item?.file?.hd?.gif ||
      item?.file?.sm?.gif ||
      item?.media_formats?.mediumgif ||
      item?.media_formats?.gif;
    if (gif?.url) {
      return {
        title: item.title || link.slug,
        mediaUrl: gif.url,
        shareUrl: item.slug ? `https://klipy.com/gifs/${item.slug}` : link.shareUrl,
      };
    }
  }

  const results = await searchGifs(link.slug, { limit: 1 });
  const first = results[0];
  if (!first?.url) throw new Error('GIF not found');
  return {
    title: first.title || link.slug,
    mediaUrl: first.url,
    shareUrl: first.shareUrl || link.shareUrl,
  };
}

module.exports = {
  searchGifs,
  getFeaturedGifs,
  resolveKlipyLink,
  parseKlipyLink,
  getApiKey,
};
