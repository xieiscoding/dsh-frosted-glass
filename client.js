window.__ModuleLoader__.load({
  id: 'dsh-desktop-glass',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'dsh-desktop-glass'
    const ROUTE = '/dsh-desktop-glass'
    const STORAGE_KEY = 'dsh-desktop-glass:settings:v1'
    const IS_DESKTOP_PAGE = window.location.protocol === 'dsh-app:'

    const DEFAULTS = {
      enabled: IS_DESKTOP_PAGE,
      followTheme: true,
      scheme: 'white',
      blur: 24,
      strength: 48,
      fps: 24,
      adaptive: true,
      floatBlur: 42,
      floatStrength: 72,
    }

    const GLASS_CSS = [
      'html[data-dsh-glass="on"],',
      'html[data-dsh-glass="on"] body { background: transparent !important; background-color: transparent !important; }',
      'html[data-dsh-glass="on"]:not([data-dsh-glass-native="on"]) body::before {',
      '  content: ""; position: fixed; inset: 0; z-index: -2; pointer-events: none;',
      '  background-image: var(--dsh-glass-image, linear-gradient(135deg, #e7edf5 0%, #f8fafc 100%));',
      '  background-size: 100% 100%; background-position: center; background-repeat: no-repeat;',
      '}',
      'html[data-dsh-glass="on"]:not([data-dsh-glass-native="on"]) body::after {',
      '  content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;',
      '  -webkit-backdrop-filter: blur(var(--dsh-glass-blur, 24px)) saturate(1.18);',
      '  backdrop-filter: blur(var(--dsh-glass-blur, 24px)) saturate(1.18);',
      '}',
      'html[data-dsh-glass-tint="theme"] body:not([data-ds-dark-theme]) {',
      '  --dsh-glass-base-color: var(--dsw-static-neutral-bluish-55);',
      '  --dsh-glass-side-color: var(--dsw-static-neutral-bluish-50);',
      '  --dsh-glass-deep-color: var(--dsw-static-neutral-bluish-00);',
      '}',
      'html[data-dsh-glass-tint="theme"] body[data-ds-dark-theme] {',
      '  --dsh-glass-base-color: var(--dsw-static-neutral-bluish-950);',
      '  --dsh-glass-side-color: var(--dsw-static-neutral-bluish-900);',
      '  --dsh-glass-deep-color: var(--dsw-static-neutral-bluish-875);',
      '}',
      'html[data-dsh-glass-tint="white"] body {',
      '  --dsh-glass-base-color: #ffffff;',
      '  --dsh-glass-side-color: #fafbfd;',
      '  --dsh-glass-deep-color: #ffffff;',
      '}',
      'html[data-dsh-glass-tint="black"] body {',
      '  --dsh-glass-base-color: #131316;',
      '  --dsh-glass-side-color: #17181c;',
      '  --dsh-glass-deep-color: #1d1e23;',
      '}',
      'html[data-dsh-glass="on"] body {',
      '  --dsw-alias-bg-base: color-mix(in srgb, var(--dsh-glass-base-color) var(--dsh-glass-strength, 48%), transparent) !important;',
      '  --dsw-specific-sidebar-fill: color-mix(in srgb, var(--dsh-glass-base-color) var(--dsh-glass-strength, 48%), transparent) !important;',
      '  --dsw-alias-bg-layer-1: color-mix(in srgb, var(--dsh-glass-deep-color) 80%, transparent) !important;',
      '  --dsw-alias-bg-layer-2: color-mix(in srgb, var(--dsh-glass-deep-color) 88%, transparent) !important;',
      '  --dsw-alias-bg-layer-3: color-mix(in srgb, var(--dsh-glass-deep-color) 90%, transparent) !important;',
      '  --dsw-alias-bg-overlay: color-mix(in srgb, var(--dsh-glass-deep-color) 94%, transparent) !important;',
      '  --dsw-alias-card-fill: color-mix(in srgb, var(--dsh-glass-deep-color) 84%, transparent) !important;',
      '  --dsw-alias-card-fill-hover: color-mix(in srgb, var(--dsh-glass-deep-color) 90%, transparent) !important;',
      '  --dsw-alias-button-elevated-fill: color-mix(in srgb, var(--dsh-glass-deep-color) 76%, transparent) !important;',
      '  --dsw-alias-button-floating-fill: color-mix(in srgb, var(--dsh-glass-deep-color) 84%, transparent) !important;',
      '  --dsw-alias-bg-document-preview: color-mix(in srgb, var(--dsh-glass-base-color) 72%, transparent) !important;',
      '}',
      'html[data-dsh-glass="on"] [data-windows-titlebar] .mP3x-q_frame:before { background: color-mix(in srgb, var(--dsh-glass-base-color) var(--dsh-glass-strength, 48%), transparent) !important; }',
      'html[data-dsh-glass="on"] div[class*="_frame"]:has(> div[class*="_centerCol"]) { background: transparent !important; }',
      'html[data-dsh-glass="on"] div[class*="_root"][data-phase] { background: transparent !important; }',
      'html[data-dsh-glass="on"] div[class*="_sidebarCol"] { background: transparent !important; border-right: 0 !important; }',
      'html[data-dsh-glass="on"] [class*="_scrollFade"] { background: none !important; background-image: none !important; }',
      'html[data-dsh-glass="on"] [class*="_composerSeat"] { background: none !important; background-image: none !important; }',
      'html[data-dsh-glass="on"][data-windows-titlebar] div[class*="_centerCol"] { border-radius: 0 !important; }',
      'html[data-dsh-glass="on"][data-windows-titlebar] div[class*="_centerCol"]:before { display: none !important; }',
      'html[data-dsh-glass="on"] [class*="composerSeat"] [class*="_card"] {',
      '  background-color: color-mix(in srgb, var(--dsh-glass-deep-color) var(--dsh-glass-float-strength, 72%), transparent) !important;',
      '  -webkit-backdrop-filter: blur(var(--dsh-glass-float-blur, 42px)) saturate(1.25);',
      '  backdrop-filter: blur(var(--dsh-glass-float-blur, 42px)) saturate(1.25);',
      '  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-border-l2) 65%, transparent) !important;',
      '  box-shadow: 0 12px 44px rgba(9, 18, 33, 0.14);',
      '}',
      'html[data-dsh-glass="on"] div[class*="_bubble_"] {',
      '  background-color: color-mix(in srgb, var(--dsh-glass-deep-color) var(--dsh-glass-float-strength, 72%), transparent) !important;',
      '  -webkit-backdrop-filter: blur(var(--dsh-glass-float-blur, 42px)) saturate(1.22);',
      '  backdrop-filter: blur(var(--dsh-glass-float-blur, 42px)) saturate(1.22);',
      '  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-border-l2) 55%, transparent);',
      '  box-shadow: 0 10px 34px rgba(9, 18, 33, 0.12);',
      '}',
    ].join('\n')

    const UI_CSS = [
      '.dsh-glass-panel-desc { margin: 2px 0 14px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; }',
      '.dsh-glass-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 9px 0; }',
      '.dsh-glass-row + .dsh-glass-row { border-top: 0.5px solid var(--dsw-alias-border-l1); }',
      '.dsh-glass-row-text { min-width: 0; }',
      '.dsh-glass-row-label { display: block; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 18px; }',
      '.dsh-glass-row-hint { display: block; margin-top: 2px; color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 16px; }',
      '.dsh-glass-switch { position: relative; flex: none; width: 36px; height: 20px; border: none; border-radius: 999px; background: var(--dsw-alias-border-l4); cursor: pointer; padding: 0; transition: background 0.16s ease; }',
      '.dsh-glass-switch[aria-checked="true"] { background: var(--dsw-alias-brand-primary); }',
      '.dsh-glass-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.22); transition: transform 0.16s ease; }',
      '.dsh-glass-switch[aria-checked="true"]::after { transform: translateX(16px); }',
      '.dsh-glass-segmented { display: inline-flex; flex: none; padding: 2px; gap: 2px; border-radius: 8px; background: var(--dsw-alias-bg-layer-1); }',
      '.dsh-glass-segmented button { border: none; border-radius: 6px; padding: 3px 10px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 18px; cursor: pointer; }',
      '.dsh-glass-segmented button[aria-pressed="true"] { background: var(--dsw-alias-button-elevated-fill); color: var(--dsw-alias-label-primary); box-shadow: var(--dsw-shadow-lv1); }',
      '.dsh-glass-slider-row { padding: 10px 0; }',
      '.dsh-glass-slider-row + .dsh-glass-slider-row { border-top: 0.5px solid var(--dsw-alias-border-l1); }',
      '.dsh-glass-slider-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }',
      '.dsh-glass-slider-head output { color: var(--dsw-alias-label-secondary); font-size: 12px; font-variant-numeric: tabular-nums; }',
      '.dsh-glass-slider { width: 100%; margin: 0; accent-color: var(--dsw-alias-brand-primary); }',
      '.dsh-glass-status { margin-top: 12px; padding: 10px 12px; border-radius: 10px; background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 18px; word-break: break-word; }',
      '.dsh-glass-status[data-tone="error"] { color: var(--dsw-alias-state-error-primary); }',
      '.dsh-glass-footer { display: flex; justify-content: space-between; gap: 10px; margin-top: 12px; }',
      '.dsh-glass-text-button { border: none; border-radius: 7px; padding: 4px 8px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit; font-size: 12px; line-height: 18px; cursor: pointer; }',
      '.dsh-glass-text-button:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }',
      '.dsh-glass-page { max-width: 680px; padding: 4px 0 24px; }',
      '.dsh-glass-page .dsh-glass-panel-desc { margin-bottom: 6px; }',
      '.dsh-glass-page-card { margin-top: 14px; padding: 2px 16px; border-radius: 12px; border: 0.5px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-1); }',
    ].join('\n')

    function createStore(initial) {
      let value = initial
      const listeners = new Set()
      return {
        get: () => value,
        getSnapshot: () => value,
        set(next) {
          const resolved = typeof next === 'function' ? next(value) : next
          if (resolved === value) return
          value = resolved
          for (const listener of [...listeners]) listener()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
      }
    }

    function clampNumber(value, min, max, fallback) {
      const number = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(number)) return fallback
      return Math.min(max, Math.max(min, Math.round(number)))
    }

    function normalizeSettings(raw) {
      const settings = { ...DEFAULTS }
      if (raw === null || typeof raw !== 'object') return settings
      if (typeof raw.enabled === 'boolean') settings.enabled = raw.enabled
      if (typeof raw.followTheme === 'boolean') settings.followTheme = raw.followTheme
      if (raw.scheme === 'white' || raw.scheme === 'black') settings.scheme = raw.scheme
      settings.blur = clampNumber(raw.blur, 0, 80, DEFAULTS.blur)
      settings.strength = clampNumber(raw.strength, 25, 85, DEFAULTS.strength)
      settings.fps = clampNumber(raw.fps, 1, 120, DEFAULTS.fps)
      settings.floatBlur = clampNumber(raw.floatBlur, 0, 80, DEFAULTS.floatBlur)
      settings.floatStrength = clampNumber(raw.floatStrength, 40, 95, DEFAULTS.floatStrength)
      if (typeof raw.adaptive === 'boolean') settings.adaptive = raw.adaptive
      return settings
    }

    function loadSettings() {
      try {
        return normalizeSettings(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null'))
      } catch {
        return { ...DEFAULTS }
      }
    }

    function saveSettings(settings) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      } catch {
        // A private or full storage still keeps the in-memory setting.
      }
    }

    function createController() {
      const settings = createStore(loadSettings())
      const status = createStore({ desktop: false, status: 'starting', ok: false, rev: 0 })
      const root = document.documentElement
      let disposed = false
      let started = false
      let pollTimer
      let frameRev = -1
      let frameReady = false
      let lastControlKey = ''
      let loadingRev = null
      let pendingRev = null
      let captionProbe
      let captionCanvas
      let captionContext
      let lastCaptionSync = 0
      let tintCache = { key: '', rgb: [255, 255, 255] }
      let nativeMode = false
      let modeKnown = false

      function nativeCaption() {
        try {
          if (captionProbe === undefined || !captionProbe.isConnected) captionProbe = findCaptionProbe()
          if (captionProbe === undefined) return
          captionProbe.style.setProperty('background-color', 'transparent', 'important')
          captionProbe.style.setProperty('color', 'var(--dsw-alias-label-primary)')
          document.body.style.setProperty('--dsh-glass-caption', 'native')
        } catch {
          // The native window keeps the transparent caption even without the probe.
        }
      }

      function enterNativeMode() {
        if (nativeMode) return
        nativeMode = true
        modeKnown = true
        frameReady = true
        root.dataset.dshGlassNative = 'on'
        root.style.removeProperty('--dsh-glass-image')
        nativeCaption()
        refreshAttribute()
      }

      function leaveNativeMode() {
        nativeMode = false
        modeKnown = true
        delete root.dataset.dshGlassNative
        frameReady = false
        refreshAttribute()
      }

      function resolvedBaseColor() {
        const current = settings.get()
        const dark = document.body.hasAttribute('data-ds-dark-theme')
        const key = `${current.followTheme}|${current.scheme}|${dark}`
        if (tintCache.key === key) return tintCache.rgb
        try {
          const probe = document.createElement('span')
          probe.style.color = 'var(--dsh-glass-base-color)'
          probe.style.position = 'fixed'
          probe.style.visibility = 'hidden'
          probe.style.pointerEvents = 'none'
          document.body.append(probe)
          const value = getComputedStyle(probe).color
          probe.remove()
          const match = value.match(/rgba?\((\d+),?\s*(\d+),?\s*(\d+)/)
          if (match !== null) {
            tintCache = { key, rgb: [Number(match[1]), Number(match[2]), Number(match[3])] }
          }
        } catch {
          // Keep the previous tint when the probe cannot be resolved.
        }
        return tintCache.rgb
      }

      function findCaptionProbe() {
        const nodes = document.querySelectorAll('body > span')
        for (const node of nodes) {
          if (node.style.visibility === 'hidden' && node.style.position === 'fixed') return node
        }
        return undefined
      }

      // The native caption buttons area is painted with the color the preload
      // reads from its hidden probe. Electron ignores alpha outside a transparent
      // window, so blend the sampled backdrop with the page tint and paint that
      // opaque average there; it visually merges with the glass strip.
      function syncCaption(image) {
        const now = Date.now()
        if (now - lastCaptionSync < 150) return
        lastCaptionSync = now
        try {
          if (captionProbe === undefined || !captionProbe.isConnected) captionProbe = findCaptionProbe()
          if (captionProbe === undefined) return
          if (captionCanvas === undefined) {
            captionCanvas = document.createElement('canvas')
            captionCanvas.width = 8
            captionCanvas.height = 4
            captionContext = captionCanvas.getContext('2d', { willReadFrequently: true })
            if (captionContext === null) return
          }
          const width = image.naturalWidth || image.width
          const height = image.naturalHeight || image.height
          if (width <= 0 || height <= 0) return
          const sampleWidth = Math.max(2, Math.round(width * 0.055))
          const sampleHeight = Math.max(1, Math.round(height * 0.035))
          captionContext.clearRect(0, 0, 8, 4)
          captionContext.drawImage(image, width - sampleWidth, 0, sampleWidth, sampleHeight, 0, 0, 8, 4)
          const pixels = captionContext.getImageData(0, 0, 8, 4).data
          let red = 0
          let green = 0
          let blue = 0
          let count = 0
          for (let index = 0; index < pixels.length; index += 4) {
            red += pixels[index]
            green += pixels[index + 1]
            blue += pixels[index + 2]
            count += 1
          }
          if (count === 0) return
          red /= count
          green /= count
          blue /= count
          const current = settings.get()
          const strength = current.strength / 100
          const tint = resolvedBaseColor()
          red = Math.round(red * (1 - strength) + tint[0] * strength)
          green = Math.round(green * (1 - strength) + tint[1] * strength)
          blue = Math.round(blue * (1 - strength) + tint[2] * strength)
          const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
          captionProbe.style.setProperty('background-color', `rgb(${red}, ${green}, ${blue})`, 'important')
          captionProbe.style.setProperty('color', luminance > 0.56 ? '#0f1115' : '#f4f7fb', 'important')
          document.body.style.setProperty('--dsh-glass-caption', `${red}-${green}-${blue}`)
        } catch {
          // A blocked canvas leaves the native caption on the theme color.
        }
      }

      function restoreCaption() {
        try {
          if (captionProbe === undefined) return
          captionProbe.style.setProperty('background-color', 'var(--dsw-specific-sidebar-fill)')
          captionProbe.style.setProperty('color', 'var(--dsw-alias-label-primary)')
          document.body.style.removeProperty('--dsh-glass-caption')
        } catch {
          // ignore
        }
      }

      function refreshAttribute() {
        if (!settings.get().enabled) {
          root.dataset.dshGlass = 'off'
          return
        }
        root.dataset.dshGlass = nativeMode ? 'on' : frameReady ? 'on' : 'pending'
      }

      function applySettings(next) {
        settings.set(next)
        const current = settings.get()
        root.dataset.dshGlassTint = current.followTheme ? 'theme' : current.scheme
        root.style.setProperty('--dsh-glass-blur', `${current.blur}px`)
        root.style.setProperty('--dsh-glass-strength', `${current.strength}%`)
        root.style.setProperty('--dsh-glass-float-blur', `${current.floatBlur}px`)
        root.style.setProperty('--dsh-glass-float-strength', `${current.floatStrength}%`)
        refreshAttribute()
        saveSettings(current)
        pushControl(current)
        if (!current.enabled) restoreCaption()
        else if (nativeMode) nativeCaption()
        if (started) schedule()
      }

      function update(patch) {
        applySettings({ ...settings.get(), ...patch })
      }

      function pushControl(current) {
        const key = `${current.enabled}|${current.fps}|${current.adaptive}`
        if (key === lastControlKey) return
        lastControlKey = key
        try {
          fetch(`${ROUTE}/control`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              enabled: current.enabled,
              fps: current.fps,
              adaptive: current.adaptive,
            }),
          }).catch(() => {})
        } catch {
          // The next poll reports the helper state.
        }
      }

      async function loadFrame(rev) {
        if (disposed || nativeMode) return
        if (loadingRev !== null) {
          pendingRev = rev
          return
        }
        loadingRev = rev
        const url = `${ROUTE}/frame.jpg?rev=${rev}`
        const image = new Image()
        const loaded = await new Promise((resolve) => {
          image.onload = () => resolve(true)
          image.onerror = () => resolve(false)
          image.src = url
        })
        loadingRev = null
        if (loaded && !disposed) {
          root.style.setProperty('--dsh-glass-image', `url("${url}")`)
          frameRev = rev
          syncCaption(image)
          if (!frameReady) {
            frameReady = true
            refreshAttribute()
          }
        } else if (!disposed) {
          window.console?.warn?.('[dsh-desktop-glass] background frame could not be decoded')
        }
        const next = pendingRev
        pendingRev = null
        if (next !== null && next !== rev) void loadFrame(next)
      }

      async function poll() {
        if (disposed) return
        try {
          const response = await fetch(`${ROUTE}/state?_=${Date.now()}`, { cache: 'no-store' })
          if (response.ok) {
            const next = await response.json()
            status.set(next)
            if (next.nativeChecked === true) {
              if (next.native === true) enterNativeMode()
              else if (nativeMode) leaveNativeMode()
            }
            if (!nativeMode && next.status === 'live' && typeof next.rev === 'number' && next.rev !== frameRev) {
              void loadFrame(next.rev)
            }
          } else {
            status.set({ ...status.getSnapshot(), status: 'error', ok: false, message: `HTTP ${response.status}` })
          }
        } catch (error) {
          status.set({ ...status.getSnapshot(), status: 'error', ok: false, message: String(error) })
        }
        schedule()
      }

      function pollDelay() {
        if (document.visibilityState === 'hidden') return 1500
        if (nativeMode) return 2000
        const current = settings.get()
        if (!current.enabled) return 900
        if (current.fps >= 90) return 20
        if (current.fps >= 45) return 30
        if (current.fps >= 20) return 45
        if (current.fps >= 8) return 90
        return 250
      }

      function schedule() {
        if (disposed) return
        if (pollTimer !== undefined) window.clearTimeout(pollTimer)
        pollTimer = window.setTimeout(poll, pollDelay())
      }

      function onVisibility() {
        if (document.visibilityState === 'visible') schedule()
      }

      function start() {
        applySettings(settings.get())
        started = true
        document.addEventListener('visibilitychange', onVisibility)
        schedule()
      }

      function dispose() {
        disposed = true
        started = false
        if (pollTimer !== undefined) window.clearTimeout(pollTimer)
        document.removeEventListener('visibilitychange', onVisibility)
        restoreCaption()
        delete root.dataset.dshGlass
        delete root.dataset.dshGlassTint
        delete root.dataset.dshGlassNative
        root.style.removeProperty('--dsh-glass-blur')
        root.style.removeProperty('--dsh-glass-strength')
        root.style.removeProperty('--dsh-glass-float-blur')
        root.style.removeProperty('--dsh-glass-float-strength')
        root.style.removeProperty('--dsh-glass-image')
      }

      return {
        settings,
        status,
        update,
        start,
        dispose,
        reset() {
          applySettings({ ...DEFAULTS, enabled: IS_DESKTOP_PAGE })
        },
      }
    }

    function GlassSwitch(props) {
      return h('button', {
        type: 'button',
        role: 'switch',
        className: 'dsh-glass-switch',
        'aria-checked': props.checked ? 'true' : 'false',
        'aria-label': props.label,
        onClick: () => props.onChange(!props.checked),
      })
    }

    function SliderRow(props) {
      return h(
        'div',
        { className: 'dsh-glass-slider-row' },
        h(
          'div',
          { className: 'dsh-glass-slider-head' },
          h('span', { className: 'dsh-glass-row-label' }, props.label),
          h('output', null, props.format ? props.format(props.value) : String(props.value)),
        ),
        props.hint ? h('span', { className: 'dsh-glass-row-hint' }, props.hint) : null,
        h('input', {
          className: 'dsh-glass-slider',
          type: 'range',
          min: props.min,
          max: props.max,
          step: props.step ?? 1,
          value: props.value,
          'aria-label': props.label,
          onChange: (event) => props.onChange(Number(event.currentTarget.value)),
        }),
      )
    }

    function StatusText(props) {
      const state = props.status
      const t = props.t
      if (state.desktop === false) return h('span', null, t('status.unsupported'))
      if (state.native === true) return h('span', null, t('status.native'))
      if (state.status === 'live') {
        const layers = Array.isArray(state.layers) ? state.layers : []
        const behind = layers.length === 0
          ? t('status.wallpaper')
          : layers
              .map((layer) => layer.title || layer.class || '')
              .filter((value) => value !== '')
              .slice(0, 2)
              .join(' / ')
        const fps = typeof state.fps === 'number' && state.fps > 0 ? ` · ~${Math.round(state.fps)}fps` : ''
        const scale = typeof state.scale === 'number' && state.scale < 1 ? ` · ${Math.round(state.scale * 100)}%` : ''
        const timing = layers.length > 0 ? `${state.captureMs ? ` · ${state.captureMs}ms` : ''}${fps}${scale}` : ''
        return h('span', null, `${t('status.live')} · ${behind}${layers.length > 2 ? ` +${layers.length - 2}` : ''}${timing}`)
      }
      if (state.status === 'occluded') return h('span', null, t('status.occluded'))
      if (state.status === 'minimized') return h('span', null, t('status.minimized'))
      if (state.status === 'window-missing') return h('span', null, t('status.window-missing'))
      if (state.status === 'disabled') return h('span', null, t('status.disabled'))
      if (state.status === 'starting') return h('span', null, t('status.starting'))
      if (state.status === 'error') return h('span', null, `${t('status.error')}${state.message || state.error ? `: ${state.message || state.error}` : ''}`)
      return h('span', null, t('status.starting'))
    }

    function GlassControls(props) {
      const t = props.t
      const settings = props.useSettings((value) => value)
      const status = props.useStatus((value) => value)
      const onUpdate = props.onUpdate
      const native = status.native === true
      const patchWaiting = !native && status.nativePatch === true
      return h(
        'div',
        null,
        native ? h('div', { className: 'dsh-glass-status' }, t('native.note')) : null,
        patchWaiting ? h('div', { className: 'dsh-glass-status' }, t('native.restart')) : null,
        h(
          'div',
          { className: 'dsh-glass-row' },
          h(
            'span',
            { className: 'dsh-glass-row-text' },
            h('span', { className: 'dsh-glass-row-label' }, t('enable')),
            h('span', { className: 'dsh-glass-row-hint' }, t('enable.hint')),
          ),
          h(GlassSwitch, { checked: settings.enabled, label: t('enable'), onChange: (value) => onUpdate({ enabled: value }) }),
        ),
        h(
          'div',
          { className: 'dsh-glass-row' },
          h(
            'span',
            { className: 'dsh-glass-row-text' },
            h('span', { className: 'dsh-glass-row-label' }, t('followTheme')),
            h('span', { className: 'dsh-glass-row-hint' }, t('followTheme.hint')),
          ),
          h(GlassSwitch, { checked: settings.followTheme, label: t('followTheme'), onChange: (value) => onUpdate({ followTheme: value }) }),
        ),
        !settings.followTheme &&
          h(
            'div',
            { className: 'dsh-glass-row' },
            h('span', { className: 'dsh-glass-row-text' }, h('span', { className: 'dsh-glass-row-label' }, t('scheme'))),
            h(
              'div',
              { className: 'dsh-glass-segmented', role: 'group', 'aria-label': t('scheme') },
              h('button', { type: 'button', 'aria-pressed': settings.scheme === 'white' ? 'true' : 'false', onClick: () => onUpdate({ scheme: 'white' }) }, t('scheme.white')),
              h('button', { type: 'button', 'aria-pressed': settings.scheme === 'black' ? 'true' : 'false', onClick: () => onUpdate({ scheme: 'black' }) }, t('scheme.black')),
            ),
          ),
        native
          ? null
          : h(SliderRow, {
              label: t('blur'),
              value: settings.blur,
              min: 0,
              max: 80,
              onChange: (value) => onUpdate({ blur: value }),
              format: (value) => `${value}px`,
            }),
        h(SliderRow, {
          label: t('strength'),
          value: settings.strength,
          min: 25,
          max: 85,
          onChange: (value) => onUpdate({ strength: value }),
          format: (value) => `${value}%`,
        }),
        h(SliderRow, {
          label: t('floating.blur'),
          hint: t('floating.hint'),
          value: settings.floatBlur,
          min: 0,
          max: 80,
          onChange: (value) => onUpdate({ floatBlur: value }),
          format: (value) => `${value}px`,
        }),
        h(SliderRow, {
          label: t('floating.strength'),
          value: settings.floatStrength,
          min: 40,
          max: 95,
          onChange: (value) => onUpdate({ floatStrength: value }),
          format: (value) => `${value}%`,
        }),
        native
          ? null
          : h(SliderRow, {
              label: t('fps'),
              hint: t('fps.hint'),
              value: settings.fps,
              min: 1,
              max: 120,
              onChange: (value) => onUpdate({ fps: value }),
              format: (value) => `${value} fps`,
            }),
        native
          ? null
          : h(
              'div',
              { className: 'dsh-glass-row' },
              h(
                'span',
                { className: 'dsh-glass-row-text' },
                h('span', { className: 'dsh-glass-row-label' }, t('adaptive')),
                h('span', { className: 'dsh-glass-row-hint' }, t('adaptive.hint')),
              ),
              h(GlassSwitch, { checked: settings.adaptive, label: t('adaptive'), onChange: (value) => onUpdate({ adaptive: value }) }),
            ),
        h(
          'div',
          { className: 'dsh-glass-status', 'data-tone': status.status === 'error' ? 'error' : 'normal' },
          h(StatusText, { status, t }),
        ),
        h(
          'div',
          { className: 'dsh-glass-footer' },
          h('span', { className: 'dsh-glass-row-hint' }, t('footer.note')),
          h('button', { type: 'button', className: 'dsh-glass-text-button', onClick: props.onReset }, t('reset')),
        ),
      )
    }

    function GlassSettingsPage(props) {
      const t = props.t
      return h(
        'div',
        { className: 'dsh-glass-page' },
        h('p', { className: 'dsh-glass-panel-desc' }, t('description')),
        h('div', { className: 'dsh-glass-page-card' }, h(GlassControls, props)),
      )
    }

    const ZH = {
      'title': '桌面磨砂玻璃',
      'description': '让 Harness 窗口整体变成一块连贯的磨砂玻璃：白色或黑色的页面背景透出窗口后方的实时画面，输入框与已发送消息以更高模糊度悬浮在页面上。仅 Windows 桌面版生效。',
      'enable': '启用磨砂玻璃背景',
      'enable.hint': '关闭后立即恢复原界面；背景采集器也会暂停以节省资源。',
      'followTheme': '关联页面内置外观颜色',
      'followTheme.hint': '开启时跟随浅色 / 深色外观自动使用白色或黑色磨砂。',
      'scheme': '玻璃颜色',
      'scheme.white': '白色磨砂',
      'scheme.black': '黑色磨砂',
      'blur': '页面高斯模糊程度',
      'strength': '页面玻璃浓度',
      'floating.blur': '悬浮层高斯模糊程度',
      'floating.strength': '悬浮层玻璃浓度',
      'floating.hint': '作用于输入框与已发送消息；默认高于页面玻璃，可单独调整。',
      'fps': '背景采样帧率',
      'fps.hint': '旧版采集模式的帧率上限；原生亚克力模式下由 Windows 负责合成，不显示此设置。',
      'adaptive': '自动节能',
      'adaptive.hint': '旧版采集模式的节能开关；原生亚克力模式下不需要。',
      'native.note': '原生亚克力已启用：窗口由 Windows 11 合成，桌面背景实时模糊，没有采样帧率限制。模糊强度由系统材质固定，页面玻璃浓度仍可调整。',
      'native.restart': '原生亚克力适配已安装，完全退出并重新打开 DeepSeek Harness 后生效。',
      'footer.note': '桌面版专用',
      'reset': '恢复默认',
      'status.live': '正在透出后方画面',
      'status.native': '原生亚克力已启用（Windows 11）',
      'status.wallpaper': '后方为桌面壁纸',
      'status.occluded': '窗口被其他应用完全遮挡，采集已暂停',
      'status.minimized': '窗口已最小化',
      'status.window-missing': '未找到 Harness 桌面窗口',
      'status.disabled': '已暂停',
      'status.starting': '正在检测窗口材质…',
      'status.error': '采集失败',
      'status.unsupported': '仅 DeepSeek Harness Windows 桌面版可用',
    }

    const EN = {
      'title': 'Desktop frosted glass',
      'description': 'Turns the Harness window into one continuous frosted pane: white or black page backgrounds reveal the live content behind the window, and the composer plus sent messages float above it with a stronger blur. Windows desktop only.',
      'enable': 'Enable frosted glass background',
      'enable.hint': 'Turning it off restores the original UI and pauses the background sampler.',
      'followTheme': 'Follow the page appearance',
      'followTheme.hint': 'Uses white frost in the light appearance and black frost in the dark one.',
      'scheme': 'Glass color',
      'scheme.white': 'White frost',
      'scheme.black': 'Black frost',
      'blur': 'Page blur',
      'strength': 'Page glass density',
      'floating.blur': 'Floating layer blur',
      'floating.strength': 'Floating layer density',
      'floating.hint': 'Applies to the composer and sent messages; defaults are stronger than the page glass.',
      'fps': 'Background sampling rate',
      'fps.hint': 'Frame-cap for the legacy sampler; the native acrylic mode is composited by Windows and hides this setting.',
      'adaptive': 'Adaptive power saving',
      'adaptive.hint': 'Legacy sampler option; not needed in the native acrylic mode.',
      'native.note': 'Native acrylic is active: Windows 11 composites the window and blurs the desktop in real time with no sampling frame limit. The system material fixes the blur radius; page glass density is still adjustable.',
      'native.restart': 'The native acrylic adaptation is installed. Fully quit and reopen DeepSeek Harness to activate it.',
      'footer.note': 'Windows desktop only',
      'reset': 'Reset',
      'status.live': 'Showing the content behind the window',
      'status.native': 'Native acrylic active (Windows 11)',
      'status.wallpaper': 'Desktop wallpaper behind the window',
      'status.occluded': 'Covered by another app; sampling paused',
      'status.minimized': 'Window minimized',
      'status.window-missing': 'Harness desktop window not found',
      'status.disabled': 'Paused',
      'status.starting': 'Detecting the window material…',
      'status.error': 'Sampling failed',
      'status.unsupported': 'Available in the Windows desktop app only',
    }

    function apply(ctx) {
      try {
        const style = document.createElement('style')
        style.dataset.dshDesktopGlass = 'effect'
        style.textContent = `${GLASS_CSS}\n${UI_CSS}`
        document.head.append(style)
        ctx.effect(() => () => style.remove())

        ctx.effect(() => ctx.locale.register(NS, { zh: ZH, en: EN }))
        const t = ctx.locale.bind(NS)
        const controller = createController()
        controller.start()
        ctx.effect(() => () => controller.dispose())

        const injectFace = () => ({
          hooks: {
            settings: controller.settings,
            status: controller.status,
          },
          onUpdate: (patch) => controller.update(patch),
          onReset: () => controller.reset(),
        })

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'dsh-desktop-glass',
              order: 82,
              locale: NS,
              label: () => t('title'),
              inject: injectFace,
            },
            GlassSettingsPage,
          ),
        )
      } catch (error) {
        window.console?.error?.('[dsh-desktop-glass] activation failed', error)
        throw error
      }
    }

    return { inject: ['slots', 'locale'], apply }
  },
})
