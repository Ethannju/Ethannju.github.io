// Visitor counter for ethannju.github.io.
//
// POST /hit   counts one visit and returns the stats
// GET  /stats returns the stats
//
// Stored: a running total, visits per country, and visits per 1° cell of
// latitude/longitude (from Cloudflare's approximate, city-level location).
// No IP address is stored. A salted hash of IP + browser is kept for 30
// minutes so that reloading the page isn't counted as a new visit.

const ORIGINS = ['https://ethannju.github.io', 'http://127.0.0.1:8031', 'http://localhost:8031']
const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|facebookexternalhit|embedly|whatsapp|telegram|curl|wget|python|node-fetch|go-http/i
const REPEAT_MS = 30 * 60 * 1000

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      Vary: 'Origin',
    }
    const { pathname } = new URL(request.url)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (pathname === '/hit' && request.method === 'POST') {
      if (!ORIGINS.includes(origin)) return reply({ error: 'forbidden' }, 403, cors)
      await count(request, env)
      return reply(await stats(env), 200, { ...cors, 'Cache-Control': 'no-store' })
    }
    if (pathname === '/stats' && request.method === 'GET') {
      return reply(await stats(env), 200, { ...cors, 'Cache-Control': 'public, max-age=60' })
    }
    return reply({ error: 'not found' }, 404, cors)
  },
}

async function count(request, env) {
  const ua = request.headers.get('User-Agent') || ''
  if (!ua || BOTS.test(ua)) return
  const now = Date.now()
  const ip = request.headers.get('CF-Connecting-IP') || ''
  const h = await sha256(`${env.SALT || ''}|${ip}|${ua}`)
  const seen = await env.DB.prepare('SELECT at FROM recent WHERE h = ?').bind(h).first()
  const writes = [
    env.DB.prepare('INSERT INTO recent (h, at) VALUES (?, ?) ON CONFLICT(h) DO UPDATE SET at = excluded.at').bind(h, now),
  ]
  if (Math.random() < 0.05) writes.push(env.DB.prepare('DELETE FROM recent WHERE at < ?').bind(now - REPEAT_MS))
  if (!seen || now - seen.at > REPEAT_MS) {
    writes.push(env.DB.prepare("INSERT INTO totals (k, v) VALUES ('visits', 1) ON CONFLICT(k) DO UPDATE SET v = v + 1"))
    const cf = request.cf || {}
    const country = typeof cf.country === 'string' ? cf.country : ''
    if (/^[A-Z]{2}$/.test(country) && country !== 'T1' && country !== 'XX') {
      writes.push(env.DB.prepare('INSERT INTO countries (code, n) VALUES (?, 1) ON CONFLICT(code) DO UPDATE SET n = n + 1').bind(country))
    }
    const lat = Math.round(Number(cf.latitude))
    const lon = Math.round(Number(cf.longitude))
    if (Number.isFinite(lat) && Number.isFinite(lon) && (cf.latitude || cf.longitude)) {
      writes.push(
        env.DB.prepare('INSERT INTO places (lat, lon, n) VALUES (?, ?, 1) ON CONFLICT(lat, lon) DO UPDATE SET n = n + 1').bind(lat, lon),
      )
    }
  }
  await env.DB.batch(writes)
}

async function stats(env) {
  const [total, countries, places] = await env.DB.batch([
    env.DB.prepare("SELECT v FROM totals WHERE k = 'visits'"),
    env.DB.prepare('SELECT COUNT(*) AS n FROM countries'),
    env.DB.prepare('SELECT lat, lon, n FROM places ORDER BY n DESC LIMIT 2000'),
  ])
  return {
    visits: total.results[0]?.v ?? 0,
    countries: countries.results[0]?.n ?? 0,
    places: places.results.map((r) => [r.lat, r.lon, r.n]),
  }
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function reply(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}
