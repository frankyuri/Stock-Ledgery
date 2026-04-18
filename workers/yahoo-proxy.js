// Cloudflare Worker: Yahoo Finance CORS proxy for Stock-Ledgery
// Deploy to Cloudflare Workers (free tier). Frontend sets VITE_YAHOO_PROXY_URL
// to this Worker's URL, e.g. https://stock-ledgery-yahoo-proxy.<account>.workers.dev

const YAHOO_ORIGIN = 'https://query1.finance.yahoo.com';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const ALLOWED_PREFIXES = ['/v8/finance/chart/', '/v1/finance/search'];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') ?? '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: corsHeaders(origin),
      });
    }

    const url = new URL(request.url);
    if (!ALLOWED_PREFIXES.some((p) => url.pathname.startsWith(p))) {
      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders(origin),
      });
    }

    const upstream = new URL(YAHOO_ORIGIN + url.pathname + url.search);
    const upstreamRes = await fetch(upstream.toString(), {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json,text/plain,*/*',
      },
      cf: { cacheTtl: 30, cacheEverything: true },
    });

    const headers = new Headers(upstreamRes.headers);
    for (const [k, v] of Object.entries(corsHeaders(origin))) {
      headers.set(k, v);
    }
    headers.delete('set-cookie');

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers,
    });
  },
};
