// The portrait comes into focus inside its viewfinder once the photograph
// has loaded; the handheld drift and grain after that are pure CSS.

;(() => {
  const fig = document.querySelector('.portrait')
  if (!fig) return
  const img = fig.querySelector('img')
  const lock = () => fig.classList.add('is-locked')
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) lock()
  else if (img.complete && img.naturalWidth) setTimeout(lock, 200)
  else {
    img.addEventListener('load', () => setTimeout(lock, 120), { once: true })
    img.addEventListener('error', lock, { once: true })
  }
})()

// The CarryOn card's Hugging Face chip shows the paper's live upvote count.
// If the request fails the chip stays as a plain link.

;(() => {
  const n = document.querySelector('[data-hf-upvotes]')
  if (!n) return
  fetch('https://huggingface.co/api/papers/2610.18784')
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((d) => {
      if (typeof d.upvotes !== 'number') return
      n.textContent = d.upvotes
      n.parentElement.title = `${d.upvotes} upvotes on Hugging Face`
      n.parentElement.hidden = false
    })
    .catch(() => {})
})()

// Contact sheet: every frame is cut to its photograph's proportions. The
// frames are split, in order, into strips of even height that each run the
// full width, and the perforations are lined up along each strip so it reads
// as one piece of film. Held under the cursor, a picture drifts in slowly,
// each frame its own way.

;(() => {
  const sheet = document.querySelector('.contact-sheet')
  if (!sheet) return
  const frames = Array.from(sheet.querySelectorAll('.frame'))
  const ratios = frames.map((f) => {
    const img = f.querySelector('img')
    return Number(img.getAttribute('width')) / Number(img.getAttribute('height'))
  })
  const total = ratios.reduce((a, b) => a + b, 0)

  // a small seeded generator so every visit drifts the same way
  let seed = 11
  const rnd = (a, b) => {
    seed = (seed * 16807) % 2147483647
    return a + ((seed - 1) / 2147483646) * (b - a)
  }
  frames.forEach((f) => {
    const img = f.querySelector('img')
    img.style.setProperty('--dx', rnd(-2.2, 2.2).toFixed(2) + '%')
    img.style.setProperty('--dy', rnd(-1.6, 1.6).toFixed(2) + '%')
  })

  // split the frames, keeping their order, into k strips whose widths at a
  // common height are as even as possible
  const partition = (k) => {
    const n = ratios.length
    const pre = [0]
    ratios.forEach((r, i) => pre.push(pre[i] + r))
    const mean = pre[n] / k
    const best = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(Infinity))
    const cut = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(0))
    best[0][0] = 0
    for (let m = 1; m <= k; m++)
      for (let j = m; j <= n; j++)
        for (let i = m - 1; i < j; i++) {
          const c = best[m - 1][i] + (pre[j] - pre[i] - mean) ** 2
          if (c < best[m][j]) {
            best[m][j] = c
            cut[m][j] = i
          }
        }
    const strips = []
    for (let m = k, j = n; m > 0; m--) {
      strips.unshift([cut[m][j], j])
      j = cut[m][j]
    }
    return strips
  }

  let laidOut = 0
  const layout = () => {
    const cs = getComputedStyle(sheet)
    const W = sheet.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    if (W <= 0 || W === laidOut) return
    laidOut = W
    const fs = getComputedStyle(frames[0])
    const padX = parseFloat(fs.paddingLeft) + parseFloat(fs.paddingRight)
    const aim = W < 600 ? 104 : W < 1000 ? 124 : 165 // picture height to aim for, px
    const k = Math.max(1, Math.min(frames.length, Math.round((total * aim) / W)))
    partition(k).forEach(([i, j]) => {
      let sum = 0
      for (let t = i; t < j; t++) sum += ratios[t]
      const h = (W - (j - i) * padX) / sum
      let x = 0
      for (let t = i; t < j; t++) {
        const w = ratios[t] * h + padX
        // a hair under the exact share, so rounding never pushes a frame
        // onto the next strip; flex-grow takes the hair back
        frames[t].style.flex = `1 0 calc(${((w / W) * 100).toFixed(4)}% - 0.5px)`
        frames[t].style.setProperty('--perf-x', `${(-x).toFixed(2)}px`)
        x += w
      }
    })
  }
  layout()
  new ResizeObserver(layout).observe(sheet)
})()

// Projects: the ASCII portrait plays live in its preview, but its viewer and
// the 2 MB frozen preset only load once the section comes near the screen.

;(() => {
  const box = document.querySelector('[data-ascii-portrait]')
  if (!box) return
  const mount = () => {
    const script = document.createElement('script')
    script.src = 'assets/ascii-portrait/ascii-portrait.js'
    script.onload = () => {
      const el = document.createElement('ascii-portrait')
      el.setAttribute('title', 'ASCII Portrait preview')
      el.setAttribute('loading', 'eager')
      box.appendChild(el)
      // a picture, not a control: keep it out of the tab order
      customElements.whenDefined('ascii-portrait').then(() => {
        const frame = el.shadowRoot && el.shadowRoot.querySelector('iframe')
        if (frame) frame.tabIndex = -1
      })
    }
    document.head.appendChild(script)
  }
  if (!('IntersectionObserver' in window)) return mount()
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      mount()
    },
    { rootMargin: '400px 0px' },
  )
  io.observe(box)
})()

// Albums on a phone: the crate becomes a shelf you swipe along. The record
// that comes to rest at the left margin is drawn out and turns; tapping a
// neighbour brings it over rather than opening anything. When the shelf
// leaves the screen every record goes back in its sleeve.

;(() => {
  const crate = document.querySelector('.crate')
  if (!crate) return
  const phone = window.matchMedia('(max-width: 640px)')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const items = Array.from(crate.querySelectorAll('.lp'))
  const index = document.querySelector('.crate-index b')
  const cursor = document.querySelector('.crate-track span')
  let active = 0
  let inView = false
  let raf = 0

  const paint = () => {
    items.forEach((li, i) => li.classList.toggle('is-lit', phone.matches && inView && i === active))
    if (index) index.textContent = String(active + 1).padStart(2, '0')
    if (cursor) cursor.style.transform = `translateX(${active * 100}%)`
  }
  const read = () => {
    raf = 0
    const step = items[1].offsetLeft - items[0].offsetLeft || 1
    active = Math.max(0, Math.min(items.length - 1, Math.round(crate.scrollLeft / step)))
    paint()
  }

  crate.addEventListener(
    'scroll',
    () => {
      if (!raf) raf = requestAnimationFrame(read)
    },
    { passive: true },
  )
  new IntersectionObserver(
    ([e]) => {
      inView = e.isIntersecting
      paint()
    },
    { threshold: 0.5 },
  ).observe(crate)
  items.forEach((li, i) =>
    li.addEventListener('click', () => {
      if (!phone.matches || i === active) return
      crate.scrollTo({
        left: items[i].offsetLeft - items[0].offsetLeft,
        behavior: reduce.matches ? 'auto' : 'smooth',
      })
    }),
  )
  phone.addEventListener('change', paint)
})()

// The screening room: opening a frame from the contact sheet dims the page to
// black and carries the photograph from its place on the sheet to the centre
// of the screen. Arrow keys, the side buttons or a swipe move between frames;
// Escape, the Close button or a click on the dark returns it to the sheet.

;(() => {
  const sheet = document.querySelector('.contact-sheet')
  const room = document.querySelector('.screening')
  if (!sheet || !room) return

  const windows = Array.from(sheet.querySelectorAll('.frame-window'))
  const sources = windows.map((w) => w.querySelector('img'))
  const img = room.querySelector('.screening-frame img')
  const count = room.querySelector('.screening-count')
  const prev = room.querySelector('.screening-prev')
  const next = room.querySelector('.screening-next')
  const close = room.querySelector('.screening-close')
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const total = windows.length
  const pad = (n) => String(n).padStart(2, '0')
  const EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)'

  let index = -1
  let opener = null
  let busy = false

  /** Where the picture actually sits inside a 3:2 gate (object-fit: contain). */
  const pictureRect = (i) => {
    const box = windows[i].getBoundingClientRect()
    const src = sources[i]
    const s = Math.min(box.width / src.naturalWidth, box.height / src.naturalHeight)
    const w = src.naturalWidth * s
    const h = src.naturalHeight * s
    return { left: box.left + (box.width - w) / 2, top: box.top + (box.height - h) / 2, width: w, height: h }
  }

  /** Transform that makes the centred image sit exactly over rect r. */
  const fromRect = (r) => {
    const f = img.getBoundingClientRect()
    const sx = r.width / f.width
    const sy = r.height / f.height
    const dx = r.left + r.width / 2 - (f.left + f.width / 2)
    const dy = r.top + r.height / 2 - (f.top + f.height / 2)
    return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
  }

  const show = (i) => {
    index = (i + total) % total
    const src = sources[index]
    img.src = src.currentSrc || src.src
    img.alt = src.alt
    count.textContent = `${pad(index + 1)} / ${pad(total)}`
    // warm the neighbours so stepping through feels instant
    ;[index + 1, index - 1].forEach((k) => {
      const n = sources[(k + total) % total]
      const pre = new Image()
      pre.src = n.currentSrc || n.src
    })
  }

  const open = async (i) => {
    if (busy) return
    busy = true
    opener = document.activeElement
    show(i)
    room.hidden = false
    document.documentElement.style.overflow = 'hidden'
    try {
      await img.decode()
    } catch {}
    if (!reduce.matches) {
      room.animate([{ backgroundColor: 'rgb(6 6 6 / 0)' }, { backgroundColor: 'rgb(6 6 6 / 1)' }], {
        duration: 420,
        easing: 'ease-out',
      })
      img.animate([{ transform: fromRect(pictureRect(index)) }, { transform: 'none' }], {
        duration: 560,
        easing: EASE,
      })
      count.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 380, fill: 'backwards' })
    }
    close.focus({ preventScroll: true })
    busy = false
  }

  const shut = async () => {
    if (busy || room.hidden) return
    queued = 0
    busy = true
    if (!reduce.matches) {
      const back = img.animate([{ transform: 'none' }, { transform: fromRect(pictureRect(index)) }], {
        duration: 380,
        easing: EASE,
      })
      room.animate([{ backgroundColor: 'rgb(6 6 6 / 1)' }, { backgroundColor: 'rgb(6 6 6 / 0)' }], {
        duration: 380,
        easing: 'ease-in',
      })
      await back.finished.catch(() => {})
    }
    room.hidden = true
    document.documentElement.style.overflow = ''
    ;(opener || windows[index]).focus({ preventScroll: true })
    busy = false
  }

  // presses that arrive mid-transition are kept and applied right after,
  // so holding or tapping an arrow key never drops a frame
  let queued = 0
  const step = async (d) => {
    if (room.hidden) return
    if (busy) {
      queued += d
      return
    }
    busy = true
    if (!reduce.matches) {
      await img.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease-in' }).finished.catch(() => {})
    }
    show(index + d)
    try {
      await img.decode()
    } catch {}
    if (!reduce.matches) img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' })
    busy = false
    if (queued) {
      const q = queued
      queued = 0
      step(q)
    }
  }

  windows.forEach((w, i) => w.addEventListener('click', () => open(i)))
  prev.addEventListener('click', () => step(-1))
  next.addEventListener('click', () => step(1))
  close.addEventListener('click', shut)
  room.addEventListener('click', (e) => {
    if (e.target === room) shut()
  })

  document.addEventListener('keydown', (e) => {
    if (room.hidden) return
    if (e.key === 'Escape') {
      e.preventDefault()
      shut()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      step(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      step(-1)
    } else if (e.key === 'Tab') {
      // keep focus inside the viewer
      const items = [close, prev, next]
      const at = items.indexOf(document.activeElement)
      e.preventDefault()
      items[(at + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus()
    }
  })

  // swipe between frames on touch screens
  let x0 = null
  room.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') x0 = e.clientX
  })
  room.addEventListener('pointerup', (e) => {
    if (x0 === null) return
    const dx = e.clientX - x0
    x0 = null
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1)
  })
})()
