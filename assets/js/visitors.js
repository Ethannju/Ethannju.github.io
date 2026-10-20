// Visitors: a dotted world map at the foot of the page. Places that visits
// have come from light up in the site's gold, sweeping in from west to east
// the first time the map comes into view. Counts come from a small
// Cloudflare Worker (stats-worker/), which stores no IP addresses.
//
// Opening the site once with ?me stops that browser's visits being counted.

;(() => {
  const section = document.querySelector('.visitors')
  if (!section) return
  const params = new URLSearchParams(location.search)
  // the live site counts; a local preview only counts when given ?stats=<worker url>
  const API = location.hostname === 'ethannju.github.io' ? 'https://stats.yuchenlu.me' : params.get('stats')
  if (!API) return

  const store = (kind, key, value) => {
    try {
      const s = kind === 'local' ? localStorage : sessionStorage
      if (value === undefined) return s.getItem(key)
      s.setItem(key, value)
    } catch {
      return null
    }
  }
  if (params.has('me')) store('local', 'stats:me', '1')
  const quiet = store('local', 'stats:me') === '1' || store('session', 'stats:counted') === '1'

  const request = quiet
    ? fetch(`${API}/stats`, { credentials: 'omit' })
    : fetch(`${API}/hit`, { method: 'POST', credentials: 'omit', keepalive: true })
  request
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data) => {
      if (!quiet) store('session', 'stats:counted', '1')
      if (data && data.visits > 0) show(data)
    })
    .catch(() => {})

  // land, as one bit per cell of a 2° grid from 80°N to 56°S
  const GRID = { step: 2, top: 80, cols: 180, rows: 68 }
  const LAND = 'AAAAAO7+/////wGAfwAAAAF/AAAAAAAAAAD+3n38//8fAGADAMABgH8AAAAAAAAA8P/3A+D//wEAAADgA+D/B+AXAAAAAID/+/8B/P8PAAAAAAf///9/eAAAAf4AtH/v/8D/fwAAwAM4+P//////Axj8////99sf/P8DAOD/0f//////////n///////+4//QwIA///////////////9/////59/+Ad8APj9////////////kP////+f7wM/AAHg/////////////w/4////f4AH4AEAAH/+/////////98fAF7w//8P+AcAAMDx7/////////9/DgDAAvz//4N/AAAAGPz/////////D/AAAAKA/////R8AAODD/f///////38ABwAAAPj/////AwAAdv//////////PzAQAAAA/P///z8AAKD///////////8DAQAAAMD///9/DwAA+P//////////PwAAAAAA8P///88AAAD///////////8CAAAAAAD/////AAAA4P/fvv//////pwAAAAAA+P//fwIAAOC//cH7/////z8HAAAAAAD///8HAAAA/vT/f/////9/EAAAAAAA8P//HwAAAOBLtP/3/////4cBAAAAAAD///8BAAAA/j/7//////9nHAAAAAAA4P//DwAAAMD/QPz/////P/4BAAAAAAD4/38AAAAA/j+D//////+HAwAAAAAAgP//AwAAAOD/////////fwgAAAAAAADw/zEAAAAg//////////9HAAAAAAAAAP8DAwAAAPj////3////fwAAAAAAAADAPyAAAADA//////7///8HAAAAAAAAAPgBBwAAAP7/////8P//XwAAAAAAAAAAPscBAADg/////w/+8y8AAAAAABAAAOA/+AEAAPz//99/wB9+AwAAAAAAAAAA+AcAAADg////+wP84A8EAAAAAAAAAAD4AQAAAP7///8PgAP4QQAAAAAAAAAAAB4EAADg////PwE4gB8cAAAAAAAAAACA8QUAAPz///8PgAPogQEAAAAAAAAAAPj/AACA/////wBwgAwaAAAAAAAAAAAA+j8AAPj///8HAAQYkAMAAAAAAAAAAID/DwAAPv//fwAAYIMDAAAAAAAAAAAA/P8BAACA//8DAAA8HgQAAAAAAAAAAMD/HwAAAPz/HwAAgPNtAAAAAAAAAAAQ/v8PAADA//8AAAB4f1oAAAAAAAAAAOD//wcAAPj/BwAAAOfnPwQAAAAAAAAA/v//AQAA/z8AAABg4OA3AAAAAAAAAOD//x8AAPD/AwAAAHiA+hgAAAAAAAAA/P//AQAA/z8AAAAA/AEbBwAAAAAAAID//w8AAPD/BwAAAACAIEYACAAAAAAA+P9/AAAA/38EAAAAAHgDAAAAAAAAAAD//wcAAPD/5wAAAADwcwACAIAAAAAA4P9/AAAA/z8HAAAAgP8HYAwAAAAAAAD4/wMAAPD/cQAAAAD8/wAAAAAAAAAAgP8/AAAA/49HAAAA+P8fEAAAAAAAAAD8/wEAAOD/OAAAAID//wMAAAAAAAAAwP8HAAAA/g8DAAAA/P9/AAAAAAAAAAD8PwAAAOB/AAAAAID//wcAAAAAAAAAwP8DAAAA/AcAAAAA+P9/AAAAAAAAAAD8HwAAAMA/AAAAAID//wcAAAAAAAAAwP8AAAAA+AEAAAAA+OF/AAAAAAAAAAD+BwAAAIABAAAAAIAD/gMwAAAAAAAA4D8AAAAAAAAAAAAAAAAfAAIAAAAAAAD+AQAAAAAAAAAAAAAA4ABgAAAAAAAA4AcAAAAAAAAAAAAAAAAcAAcAAAAAAAB+AAAAAAAAAAAAAAAAwAAYAAAAAAAA8AMAAAAAAAAAAAAAAAAA4AAAAAAAAAAfAAAAAAAAAAAAAAAAAAAEAAAAAAAA8AEAAAAAAAAAEAAAAAAAAAAAAAAAAAAOAQAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAcAAgAAAAAAAAAAAAAAAAA'

  function show(data) {
    const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
    section.querySelector('[data-visits]').textContent = plural(data.visits, 'visit', 'visits')
    section.querySelector('[data-countries]').textContent = plural(data.countries, 'country', 'countries')
    section.hidden = false

    const { step, top, cols, rows } = GRID
    const bytes = Uint8Array.from(atob(LAND), (ch) => ch.charCodeAt(0))
    const isLand = (i) => (bytes[i >> 3] >> (i & 7)) & 1

    // visits per grid cell (the Worker reports 1° cells; the map's are coarser)
    const cells = new Map()
    for (const [lat, lon, n] of data.places || []) {
      if (lat > top || lat < top - rows * step) continue
      const r = Math.min(rows - 1, Math.floor((top - lat) / step))
      const c = Math.min(cols - 1, Math.floor((lon + 180) / step))
      cells.set(r * cols + c, (cells.get(r * cols + c) || 0) + n)
    }
    const lit = [...cells].map(([i, n]) => {
      const c = i % cols
      // west to east, with a little scatter so neighbours don't land together
      return { r: Math.floor(i / cols), c, n, delay: (c / cols) * 1100 + ((i * 7919) % 160) }
    })
    lit.sort((a, b) => a.n - b.n)

    const canvas = section.querySelector('canvas')
    const ctx = canvas.getContext('2d')
    const land = document.createElement('canvas')
    let s = 0
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.round(canvas.clientWidth * dpr)
      if (!w) return false
      canvas.width = land.width = w
      canvas.height = land.height = Math.round((w * rows) / cols)
      s = w / cols
      const lctx = land.getContext('2d')
      lctx.fillStyle = '#d3d4cf'
      const rad = Math.max(0.6 * dpr, s * 0.27)
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          if (!isLand(r * cols + c)) continue
          lctx.beginPath()
          lctx.arc((c + 0.5) * s, (r + 0.5) * s, rad, 0, Math.PI * 2)
          lctx.fill()
        }
      return true
    }

    const ease = (x) => 1 - (1 - x) ** 3
    let started = null // when the sweep began; null until the map is seen
    const draw = (now) => {
      const t = started === null ? 0 : now - started
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(land, 0, 0)
      for (const p of lit) {
        const k = started === null ? 0 : ease(Math.min(1, Math.max(0, (t - p.delay) / 700)))
        if (k <= 0) continue
        const x = (p.c + 0.5) * s
        const y = (p.r + 0.5) * s
        const halo = s * (2 + 1.5 * Math.log10(p.n)) * k
        const g = ctx.createRadialGradient(x, y, 0, x, y, halo)
        g.addColorStop(0, 'rgba(250, 201, 56, 0.5)')
        g.addColorStop(1, 'rgba(250, 201, 56, 0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(x, y, halo, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgb(179, 113, 15)'
        ctx.beginPath()
        ctx.arc(x, y, Math.max(1, s * 0.42) * (0.5 + 0.5 * k), 0, Math.PI * 2)
        ctx.fill()
      }
      return t < 1900
    }
    const play = (now) => {
      if (draw(now)) requestAnimationFrame(play)
    }

    if (!size()) return
    draw(0)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        if (reduce) {
          started = -1e9 // everything already lit
          draw(0)
        } else {
          started = performance.now()
          requestAnimationFrame(play)
        }
      },
      { threshold: 0.35 },
    )
    io.observe(canvas)
    let lastW = canvas.clientWidth
    new ResizeObserver(() => {
      if (canvas.clientWidth === lastW) return
      lastW = canvas.clientWidth
      if (size()) draw(performance.now())
    }).observe(canvas)
  }
})()
