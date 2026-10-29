// Public Genshin showcase proxy for the offline Genshin Tool.
// It keeps Enka's required User-Agent on the server and adds browser CORS headers.
// No HoYoverse credentials, cookies, or account data are stored here.

const UPSTREAM = 'https://enka.network/api/uid/';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
};

function reply(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...headers },
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (request.method !== 'GET') return reply({ error: 'Only GET is supported.' }, 405);

    const incoming = new URL(request.url);
    const match = incoming.pathname.match(/^\/api\/uid\/(\d{9,10})\/?$/);
    if (!match) return reply({ error: 'Use /api/uid/{9-10 digit Genshin UID}.' }, 404);

    // Cache by UID. The upstream ttl controls how long a response is retained.
    const cache = caches.default;
    const cacheKey = new Request(incoming.origin + incoming.pathname);
    const hit = await cache.match(cacheKey);
    if (hit) return hit;

    let upstream;
    try {
      upstream = await fetch(UPSTREAM + match[1] + '/', {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'GenshinTool/1.0 (public showcase proxy)',
        },
      });
    } catch {
      return reply({ error: 'The public showcase service is temporarily unavailable.' }, 502);
    }

    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok || !payload) {
      return reply({ error: payload && payload.error || 'The public showcase service returned an error.' }, upstream.status || 502);
    }

    // Honour Enka's dynamic refresh window while keeping a sensible maximum cache age.
    const seconds = Math.max(60, Math.min(Number(payload.ttl) || 300, 1800));
    const response = reply(payload, 200, { 'Cache-Control': 'public, max-age=' + seconds });
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
