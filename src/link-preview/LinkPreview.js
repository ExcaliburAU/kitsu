const { URL } = require('url');

const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 200;
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 512 * 1024;

const cache = new Map();

const URL_RE = /https?:\/\/[^\s<>"'\u00A0]+/gi;

function repairEmoticonBrokenUrls(text) {
  return String(text || '')
    .replace(/https?\p{Extended_Pictographic}\uFE0F?\/+/gu, 'https://')
    .replace(/https?:\/(?!\/)/g, 'https://');
}

function extractUrls(text, { limit = 3 } = {}) {
  if (!text || typeof text !== 'string') return [];
  const repaired = repairEmoticonBrokenUrls(text);
  const found = [];
  const seen = new Set();
  let match;
  const re = new RegExp(URL_RE.source, 'gi');
  while ((match = re.exec(repaired)) && found.length < limit) {
    let url = match[0].replace(/[),.;:!?\]]+$/g, '');
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
      if (seen.has(parsed.href)) continue;
      seen.add(parsed.href);
      found.push(parsed.href);
    } catch {
      // ignore invalid
    }
  }
  return found;
}

function isBlockedHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '0.0.0.0' || host === '::1' || host === '[::1]') return true;

  const ip4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ip4) {
    const a = Number(ip4[1]);
    const b = Number(ip4[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(Number(num)));
}

function metaContent(html, property) {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["'][^>]*>`,
      'i',
    ),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]).trim();
  }
  return null;
}

function parseHtmlPreview(html, pageUrl) {
  const title =
    metaContent(html, 'og:title') ||
    metaContent(html, 'twitter:title') ||
    (() => {
      const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      return match ? decodeEntities(match[1]).trim() : null;
    })();

  const description =
    metaContent(html, 'og:description') ||
    metaContent(html, 'twitter:description') ||
    metaContent(html, 'description');

  let image =
    metaContent(html, 'og:image') ||
    metaContent(html, 'og:image:url') ||
    metaContent(html, 'twitter:image') ||
    metaContent(html, 'twitter:image:src');

  if (image) {
    try {
      image = new URL(image, pageUrl).href;
    } catch {
      image = null;
    }
  }

  let siteName = metaContent(html, 'og:site_name');
  let displayUrl = pageUrl;
  try {
    const parsed = new URL(pageUrl);
    displayUrl = parsed.href;
    if (!siteName) siteName = parsed.hostname.replace(/^www\./, '');
  } catch {
    // ignore
  }

  return {
    url: pageUrl,
    displayUrl,
    title: title || siteName || displayUrl,
    description: description || null,
    image,
    siteName: siteName || null,
  };
}

function cacheGet(url) {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(url);
    return null;
  }
  return entry.value;
}

function cacheSet(url, value) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(url, { value, expires: Date.now() + CACHE_TTL_MS });
}

function parseYoutubeVideoId(rawUrl) {
  try {
    const parsed = new URL(String(rawUrl || '').trim());
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      return parsed.pathname.split('/').filter(Boolean)[0] || null;
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const fromQuery = parsed.searchParams.get('v');
      if (fromQuery) return fromQuery;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
        return parts[1] || null;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function fetchYoutubeOEmbed(pageUrl) {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(pageUrl)}&format=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ConduitLinkPreview/0.1 (+https://github.com/ExcaliburAU; Matrix client)',
      },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const videoId = parseYoutubeVideoId(pageUrl);
    return {
      url: pageUrl,
      displayUrl: pageUrl,
      title: typeof data.title === 'string' ? data.title : 'YouTube',
      description: typeof data.author_name === 'string' ? data.author_name : null,
      image: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : null,
      siteName: 'YouTube',
      mediaType: 'youtube',
      youtubeId: videoId,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchLinkPreview(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are supported');
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error('URL host is not allowed');
  }

  const href = parsed.href;
  const cached = cacheGet(href);
  if (cached) return { ...cached, cached: true };

  const youtubeId = parseYoutubeVideoId(href);
  if (youtubeId) {
    const oembed = await fetchYoutubeOEmbed(href);
    const preview = oembed || {
      url: href,
      displayUrl: href,
      title: 'YouTube',
      description: null,
      image: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
      siteName: 'YouTube',
      mediaType: 'youtube',
      youtubeId,
    };
    if (!preview.youtubeId) preview.youtubeId = youtubeId;
    preview.mediaType = 'youtube';
    cacheSet(href, preview);
    return { ...preview, cached: false };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(href, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'ConduitLinkPreview/0.1 (+https://github.com/ExcaliburAU; Matrix client)',
      },
    });

    const finalUrl = response.url || href;
    let finalParsed;
    try {
      finalParsed = new URL(finalUrl);
      if (isBlockedHost(finalParsed.hostname)) {
        throw new Error('Redirected to blocked host');
      }
    } catch (error) {
      if (error.message === 'Redirected to blocked host') throw error;
    }

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      const basic = {
        url: finalUrl,
        displayUrl: finalUrl,
        title: finalParsed?.hostname?.replace(/^www\./, '') || finalUrl,
        description: null,
        image: contentType.startsWith('image/') ? finalUrl : null,
        siteName: finalParsed?.hostname?.replace(/^www\./, '') || null,
      };
      cacheSet(href, basic);
      return { ...basic, cached: false };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const html = buffer.subarray(0, MAX_HTML_BYTES).toString('utf8');
    const preview = parseHtmlPreview(html, finalUrl);
    cacheSet(href, preview);
    return { ...preview, cached: false };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  extractUrls,
  fetchLinkPreview,
  parseYoutubeVideoId,
  repairEmoticonBrokenUrls,
};
