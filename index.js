import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Route prefix served by the DSH web carrier for the glass plugin. */
const ROUTE = '/dsh-desktop-glass'
/**
 * The desktop shell runs this Host through the Electron binary in Node mode, so
 * `process.versions.electron` identifies it even when the profile name is not in
 * the environment.
 */
const IS_DESKTOP = Boolean(process.versions.electron) || process.env.DSH_PROFILE === 'desktop'

export const inject = ['webServer']

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return undefined
  }
}

function ownerOnly(peer) {
  return peer === undefined || peer?.principal?.kind === 'owner'
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

export function apply(ctx) {
  const packageDir = path.dirname(fileURLToPath(import.meta.url))
  const helperScript = path.join(packageDir, 'helper', 'glass-helper.ps1')
  const probeScript = path.join(packageDir, 'native', 'probe-window.ps1')
  const markerPath = path.join(packageDir, 'native', 'patch-state.json')
  const outDir = path.join(tmpdir(), `dsh-desktop-glass-${process.pid}`)
  const controlPath = path.join(outDir, 'control.json')
  const statePath = path.join(outDir, 'state.json')
  let helper
  let helperRestarts = 0
  let restartTimer
  let probeChild
  let probeTimer
  let probeRetryTimer
  let disposed = false
  const native = { checked: false, native: false, patchPresent: false, info: undefined }

  const control = {
    enabled: true,
    adaptive: true,
    intervalMs: 42,
    stop: false,
  }

  function patchMarkerPresent() {
    const marker = readJson(markerPath)
    if (marker === undefined || typeof marker.appAsar !== 'string') return false
    try {
      // The Host runs under Electron's Node mode, where fs treats any *.asar
      // path as an archive root. Stat the real file briefly with asar support
      // disabled so the patch marker can be validated.
      const previous = process.noAsar
      process.noAsar = true
      let stat
      try {
        stat = statSync(marker.appAsar)
      } finally {
        process.noAsar = previous
      }
      return stat.size === marker.size && Math.abs(stat.mtimeMs - marker.mtimeMs) < 3000
    } catch {
      return false
    }
  }

  function parseProbeOutput(text) {
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('{'))
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        if (parsed !== null && typeof parsed === 'object' && typeof parsed.native === 'boolean') return parsed
      } catch {
        // keep scanning
      }
    }
    return undefined
  }

  function probeNativeWindow() {
    if (!IS_DESKTOP || disposed) {
      native.checked = true
      if (IS_DESKTOP) startHelper()
      return
    }
    if (!existsSync(probeScript)) {
      native.checked = true
      startHelper()
      return
    }
    runProbeAttempt(0)
  }

  function runProbeAttempt(attempt) {
    if (disposed || native.checked) return
    native.patchPresent = patchMarkerPresent()
    if (!native.patchPresent) {
      native.checked = true
      startHelper()
      return
    }
    let output = ''
    try {
      probeChild = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', probeScript, '-OwnerPid', String(process.ppid ?? 0)],
        { cwd: packageDir, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
      )
    } catch {
      if (attempt >= 19) {
        native.checked = true
        startHelper()
      } else {
        probeRetryTimer = setTimeout(() => runProbeAttempt(attempt + 1), 700)
        probeRetryTimer.unref?.()
      }
      return
    }
    probeChild.stdout?.setEncoding('utf8')
    probeChild.stdout?.on('data', (chunk) => {
      output += chunk
      if (output.length > 65536) output = output.slice(-65536)
    })
    let finished = false
    const settle = (text) => {
      if (finished || disposed || native.checked) return
      finished = true
      if (probeTimer !== undefined) {
        clearTimeout(probeTimer)
        probeTimer = undefined
      }
      const parsed = parseProbeOutput(text)
      native.info = parsed
      if (parsed?.found === true) {
        if (parsed.native === true) {
          native.checked = true
          native.native = true
          stopHelper()
          return
        }
        // A freshly created transparent window can briefly report no DWM
        // backdrop while the material is applied, so retry a few times.
        if (attempt < 3) {
          probeRetryTimer = setTimeout(() => runProbeAttempt(attempt + 1), 700)
          probeRetryTimer.unref?.()
          return
        }
        native.checked = true
        native.native = false
        startHelper()
        return
      }
      if (attempt >= 19) {
        native.checked = true
        native.native = false
        startHelper()
        return
      }
      probeRetryTimer = setTimeout(() => runProbeAttempt(attempt + 1), 700)
      probeRetryTimer.unref?.()
    }
    probeChild.once('close', () => settle(output))
    probeChild.once('error', () => settle(''))
    probeTimer = setTimeout(() => {
      try { probeChild?.kill() } catch { /* ignore */ }
      settle(output)
    }, 8000)
    probeTimer.unref?.()
  }

  function publishControl(patch) {
    if (patch.enabled !== undefined) control.enabled = patch.enabled === true
    if (patch.adaptive !== undefined) control.adaptive = patch.adaptive === true
    if (patch.intervalMs !== undefined) {
      const value = Number(patch.intervalMs)
      if (Number.isFinite(value)) control.intervalMs = Math.min(2000, Math.max(8, Math.round(value)))
    }
    try {
      writeFileSync(controlPath, JSON.stringify(control), 'utf8')
    } catch {
      // The next helper start recreates the directory and control file.
    }
  }

  function startHelper() {
    if (!IS_DESKTOP || disposed || helper !== undefined || native.native) return
    if (!existsSync(helperScript)) {
      ctx.logger?.warn?.('dsh-desktop-glass: helper script is missing')
      return
    }
    mkdirSync(outDir, { recursive: true })
    writeFileSync(controlPath, JSON.stringify(control), 'utf8')
    try {
      helper = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy',
          'Bypass',
          '-File',
          helperScript,
          '-OwnerPid',
          String(process.ppid ?? 0),
          '-HostPid',
          String(process.pid),
          '-OutDir',
          outDir,
          '-IntervalMs',
          String(control.intervalMs),
          '-Scale',
          '0',
          '-MaxLayers',
          '4',
          '-Quality',
          '78',
        ],
        { cwd: packageDir, windowsHide: true, stdio: 'ignore' },
      )
      helper.once('exit', () => {
        helper = undefined
        if (disposed || !IS_DESKTOP) return
        helperRestarts += 1
        if (helperRestarts > 8) return
        const delay = Math.min(8000, 600 * helperRestarts)
        restartTimer = setTimeout(startHelper, delay)
        restartTimer.unref?.()
      })
      helper.once('error', () => {
        helper = undefined
      })
    } catch (error) {
      ctx.logger?.warn?.(`dsh-desktop-glass: helper could not start: ${String(error)}`)
      helper = undefined
    }
  }

  function stopHelper() {
    if (restartTimer !== undefined) {
      clearTimeout(restartTimer)
      restartTimer = undefined
    }
    if (helper !== undefined) {
      const child = helper
      helper = undefined
      try {
        writeFileSync(controlPath, JSON.stringify({ ...control, stop: true }), 'utf8')
      } catch {
        // ignore
      }
      try {
        child.kill()
      } catch {
        // ignore
      }
    }
  }

  const readState = () => {
    const base = {
      desktop: IS_DESKTOP,
      native: native.native,
      nativeChecked: native.checked,
      nativePatch: native.patchPresent,
      probe: native.info,
    }
    if (native.checked && native.native) {
      return { ...base, status: 'native', ok: true, rev: 0 }
    }
    if (!native.checked) {
      return { ...base, status: IS_DESKTOP ? 'starting' : 'unsupported', ok: false, rev: 0 }
    }
    const state = readJson(statePath)
    if (state === undefined) {
      return {
        ...base,
        status: IS_DESKTOP ? 'starting' : 'unsupported',
        ok: false,
        rev: 0,
      }
    }
    return { ...base, ...state }
  }

  ctx.effect(() => {
    probeNativeWindow()
    return () => {
      disposed = true
      if (probeTimer !== undefined) clearTimeout(probeTimer)
      if (probeRetryTimer !== undefined) clearTimeout(probeRetryTimer)
      try { probeChild?.kill() } catch { /* ignore */ }
      stopHelper()
      rmSync(outDir, { recursive: true, force: true })
    }
  })

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE}/state`,
    resource: async (_request, peer) => {
      if (!ownerOnly(peer)) return jsonResponse({ ok: false, status: 'forbidden' }, 403)
      return jsonResponse(readState())
    },
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE}/frame.jpg`,
    resource: async (_request, peer) => {
      if (!ownerOnly(peer)) return new Response('', { status: 403 })
      const state = readState()
      if (state.status !== 'live' || typeof state.file !== 'string' || !/^frame-\d+\.jpg$/.test(state.file)) {
        return new Response('', { status: 404 })
      }
      try {
        const bytes = readFileSync(path.join(outDir, state.file))
        return new Response(new Uint8Array(bytes), {
          headers: {
            'content-type': 'image/jpeg',
            'cache-control': 'no-store, max-age=0',
          },
        })
      } catch {
        return new Response('', { status: 404 })
      }
    },
  }))

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: `${ROUTE}/control`,
    handler: async (request, response) => {
      const origin = request.headers.origin
      const allowedOrigin = ctx.webServer.getOrigin()
      if (origin !== undefined && origin !== 'dsh-app://app' && origin !== allowedOrigin) {
        response.writeHead(403, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: false, status: 'forbidden' }))
        return
      }
      if (request.method !== 'POST') {
        response.writeHead(405, { 'content-type': 'application/json', allow: 'POST' })
        response.end(JSON.stringify({ ok: false, status: 'method' }))
        return
      }
      const chunks = []
      let size = 0
      request.on('data', (chunk) => {
        size += chunk.length
        if (size > 65536) request.destroy()
        else chunks.push(chunk)
      })
      await new Promise((resolve) => {
        request.on('end', resolve)
        request.on('error', resolve)
      })
      let body
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      } catch {
        response.writeHead(400, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ ok: false, status: 'invalid-json' }))
        return
      }
      const patch = {}
      if (typeof body?.enabled === 'boolean') patch.enabled = body.enabled
      if (typeof body?.adaptive === 'boolean') patch.adaptive = body.adaptive
      if (typeof body?.fps === 'number') patch.intervalMs = 1000 / Math.min(120, Math.max(1, body.fps))
      publishControl(patch)
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      response.end(JSON.stringify({ ok: true, control }))
    },
  }))
}
