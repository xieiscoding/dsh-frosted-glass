#!/usr/bin/env node
/**
 * Native acrylic adaptation for the DSH desktop window.
 *
 * AutoInterview-style frosted glass needs the Electron main window to be created
 * as a transparent window with the Windows acrylic backdrop material. A page
 * plugin cannot change BrowserWindow options, so this installer patches the
 * packaged `resources/app.asar` in place:
 *
 *   - `lib/main.js` gets `transparent: true` and `backgroundMaterial: "acrylic"`
 *     on the Windows primary window, and `chromeFallbackFill()` returns a fully
 *     transparent color so the runtime background updates keep the window clear.
 *   - the file keeps its exact byte length, so every other asar entry offset is
 *     untouched; the header integrity hash for `lib/main.js` is recomputed.
 *
 * Usage:
 *   node native/install-glass.mjs [--app-dir <dir>] [--asar <app.asar>] [--dry-run]
 *   node native/install-glass.mjs --restore [--asar <app.asar>]
 *
 * The installer always writes a backup next to the archive before changing it.
 */
process.noAsar = true

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PLUGIN_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const MARKER_NAME = 'patch-state.json'
const BACKUP_SUFFIX = '.dsh-desktop-glass.bak'
const PATCHED_OPTIONS = Buffer.from('\t\t\ttransparent: true,\n\t\t\tbackgroundMaterial: "acrylic",\n\t\t\ttitleBarStyle: "hidden",')

function parseArgs(argv) {
  const options = { restore: false, dryRun: false, asar: undefined, marker: undefined, appDir: undefined }
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--restore') options.restore = true
    else if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--asar') options.asar = argv[++index]
    else if (arg === '--marker') options.marker = argv[++index]
    else if (arg === '--app-dir') options.appDir = argv[++index]
    else if (arg === '--help' || arg === '-h') options.help = true
    else throw new Error(`unknown argument: ${arg}`)
  }
  return options
}

function detectAppDir(explicit) {
  if (explicit !== undefined) return path.resolve(explicit)
  const install = process.env.DSH_INSTALL_DIR
  if (install !== undefined && install !== '') {
    const markerIndex = install.toLowerCase().indexOf('app.asar')
    if (markerIndex > 0) return path.dirname(path.dirname(install.slice(0, markerIndex)))
    if (looksLikeInstall(install)) return path.resolve(install)
  }
  const candidates = [
    process.env.LOCALAPPDATA !== undefined && path.join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness'),
    process.env.ProgramFiles !== undefined && path.join(process.env.ProgramFiles, 'DeepSeek Harness'),
    process.env['ProgramFiles(x86)'] !== undefined && path.join(process.env['ProgramFiles(x86)'], 'DeepSeek Harness'),
    process.env.USERPROFILE !== undefined && path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Programs', 'DeepSeek Harness'),
  ]
  for (const candidate of candidates) {
    if (candidate !== false && looksLikeInstall(candidate)) return candidate
  }
  throw new Error('DeepSeek Harness installation not found. Pass --app-dir <path-to-install-dir>.')
}

function looksLikeInstall(directory) {
  try {
    return statSync(path.join(directory, 'resources', 'app.asar')).isFile()
  } catch {
    return false
  }
}

function installedMarkerPath() {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME.trim() !== ''
    ? process.env.DSH_HOME.trim()
    : path.join(homedir(), '.dsh')
  return path.join(home, 'profiles', 'desktop', 'node_modules', 'dsh-desktop-glass', 'native', MARKER_NAME)
}

function sameFile(left, right) {
  if (path.resolve(left) === path.resolve(right)) return true
  try {
    return realpathSync(left) === realpathSync(right)
  } catch {
    return false
  }
}

function markerTargets(primaryMarker) {
  const targets = [primaryMarker]
  const installed = installedMarkerPath()
  if (existsSync(path.dirname(installed)) && !targets.some((target) => sameFile(target, installed))) {
    targets.push(installed)
  }
  return targets
}

function writeMarkers(primaryMarker, payload) {
  const written = []
  for (const target of markerTargets(primaryMarker)) {
    try {
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, JSON.stringify(payload, null, 2) + '\n')
      written.push(target)
    } catch (error) {
      console.warn(`install-glass: could not write marker ${target}: ${String(error)}`)
    }
  }
  return written
}

function removeMarkers(primaryMarker) {
  for (const target of markerTargets(primaryMarker)) {
    try {
      rmSync(target, { force: true })
    } catch {
      // ignore
    }
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log('node native/install-glass.mjs [--app-dir <dir>] [--asar <app.asar>] [--dry-run]')
    console.log('node native/install-glass.mjs --restore [--asar <app.asar>]')
    return
  }
  const asarPath = options.asar !== undefined
    ? path.resolve(options.asar)
    : path.join(detectAppDir(options.appDir), 'resources', 'app.asar')
  const markerPath = options.marker !== undefined
    ? path.resolve(options.marker)
    : path.join(PLUGIN_DIR, 'native', MARKER_NAME)
  const backupPath = asarPath + BACKUP_SUFFIX

  if (options.restore) {
    restore(asarPath, backupPath, markerPath)
    return
  }
  if (!existsSync(asarPath)) throw new Error(`app.asar not found: ${asarPath}`)
  patch(asarPath, backupPath, markerPath, options.dryRun)
}

function readArchive(asarPath) {
  const archive = readFileSync(asarPath)
  if (archive.length < 16) throw new Error('app.asar is too small to be an asar archive')
  const headerSize = archive.readUInt32LE(4)
  const headerStart = 8
  const headerEnd = headerStart + headerSize
  if (headerEnd > archive.length) throw new Error('app.asar header exceeds the file size')
  const headerBuffer = archive.subarray(headerStart, headerEnd)
  const jsonLength = headerBuffer.readUInt32LE(4)
  const jsonStart = 8
  const jsonEnd = jsonStart + jsonLength
  if (jsonEnd > headerBuffer.length) throw new Error('app.asar header JSON exceeds the header size')
  const headerJsonBuffer = headerBuffer.subarray(jsonStart, jsonEnd)
  let header
  try {
    header = JSON.parse(headerJsonBuffer.toString('utf8'))
  } catch (error) {
    throw new Error(`app.asar header JSON is invalid: ${String(error)}`)
  }
  return { archive, headerSize, headerStart, headerJsonBuffer, header, dataStart: headerEnd }
}

function getEntry(header, relativePath) {
  let node = header
  for (const part of relativePath.split('/')) {
    node = node?.files?.[part]
    if (node === undefined) return undefined
  }
  return node
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function buildIntegrity(mainBuffer, integrity) {
  const algorithm = integrity?.algorithm ?? 'SHA256'
  if (algorithm !== 'SHA256') throw new Error(`unsupported asar integrity algorithm: ${algorithm}`)
  const blockSize = Number(integrity?.blockSize) || 4194304
  const blocks = []
  for (let offset = 0; offset < mainBuffer.length; offset += blockSize) {
    blocks.push(sha256(mainBuffer.subarray(offset, Math.min(mainBuffer.length, offset + blockSize))))
  }
  if (blocks.length === 0) blocks.push(sha256(mainBuffer))
  return { algorithm: 'SHA256', hash: sha256(mainBuffer), blockSize, blocks }
}

function patchedMain(originalMain) {
  const optionsNeedle = Buffer.from('\t\t\tbackgroundColor: chromeFallbackFill(),\n\t\t\ttitleBarStyle: "hidden",')
  const optionsReplacement = Buffer.from(
    '\t\t\tbackgroundColor: chromeFallbackFill(),\n' +
    '\t\t\ttransparent: true,\n' +
    '\t\t\tbackgroundMaterial: "acrylic",\n' +
    '\t\t\ttitleBarStyle: "hidden",',
  )
  const fallbackNeedle = Buffer.from('\treturn nativeTheme.shouldUseDarkColors ? "#1b1b1c" : "#f9fafb";')
  const fallbackReplacement = Buffer.from('\treturn "#00000000";')

  function replaceOnce(buffer, needle, replacement, label) {
    const index = buffer.indexOf(needle)
    if (index < 0) throw new Error(`${label} anchor not found; this DSH build is not compatible`)
    if (buffer.indexOf(needle, index + 1) >= 0) throw new Error(`${label} anchor is not unique`)
    return Buffer.concat([buffer.subarray(0, index), replacement, buffer.subarray(index + needle.length)])
  }

  let work = Buffer.from(originalMain)
  work = replaceOnce(work, optionsNeedle, optionsReplacement, 'Windows primary BrowserWindow options')
  work = replaceOnce(work, fallbackNeedle, fallbackReplacement, 'chromeFallbackFill return')

  const commentStart = work.indexOf(Buffer.from('/**\n* Opaque chrome fallback'))
  const commentEnd = work.indexOf(Buffer.from('*/\nfunction chromeFallbackFill()'), commentStart)
  if (commentStart < 0 || commentEnd < 0) throw new Error('chromeFallbackFill comment anchor not found')
  const delta = work.length - originalMain.length
  if (delta > 0) {
    const available = commentEnd - commentStart - 12
    if (delta > available) throw new Error('not enough nearby comment bytes to keep lib/main.js size stable')
    const cut = commentStart + 10
    work = Buffer.concat([work.subarray(0, cut), work.subarray(cut + delta)])
  } else if (delta < 0) {
    const padding = Buffer.alloc(-delta, 0x20)
    work = Buffer.concat([work.subarray(0, commentStart + 4), padding, work.subarray(commentStart + 4)])
  }
  if (work.length !== originalMain.length) throw new Error('patched lib/main.js changed size')
  const text = work.toString('utf8')
  if (!text.includes('transparent: true,') || !text.includes('backgroundMaterial: "acrylic",')) {
    throw new Error('patched lib/main.js is missing the native acrylic options')
  }
  if (!text.includes('return "#00000000";')) throw new Error('patched lib/main.js is missing the transparent fallback')
  return work
}

function verifySyntax(buffer) {
  const temp = path.join(tmpdir(), `dsh-glass-main-${process.pid}.mjs`)
  writeFileSync(temp, buffer)
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  const result = spawnSync(process.execPath, ['--check', temp], { env, encoding: 'utf8', windowsHide: true })
  rmSync(temp, { force: true })
  if (result.status !== 0) {
    throw new Error(`patched lib/main.js failed the syntax check:\n${result.stderr || result.stdout}`)
  }
}

function replaceHeaderHashes(header, headerJsonBuffer, newIntegrity, entryPath) {
  const entry = getEntry(header, entryPath)
  const oldIntegrity = entry?.integrity
  if (oldIntegrity === undefined || oldIntegrity === null) return Buffer.from(headerJsonBuffer)
  let work = Buffer.from(headerJsonBuffer)
  const replacements = []
  const seen = new Set()
  const addReplacement = (oldHash, newHash) => {
    if (typeof oldHash !== 'string' || typeof newHash !== 'string') return
    if (oldHash.length !== newHash.length) throw new Error('integrity hash length changed')
    if (seen.has(oldHash)) return
    seen.add(oldHash)
    replacements.push([oldHash, newHash])
  }
  addReplacement(oldIntegrity.hash, newIntegrity.hash)
  const oldBlocks = Array.isArray(oldIntegrity.blocks) ? oldIntegrity.blocks : []
  for (let index = 0; index < Math.max(oldBlocks.length, newIntegrity.blocks.length); index++) {
    addReplacement(oldBlocks[index], newIntegrity.blocks[index])
  }
  for (const [oldHash, newHash] of replacements) {
    const oldBuffer = Buffer.from(oldHash, 'utf8')
    const newBuffer = Buffer.from(newHash, 'utf8')
    let index = 0
    let count = 0
    while (true) {
      const found = work.indexOf(oldBuffer, index)
      if (found < 0) break
      newBuffer.copy(work, found)
      index = found + newBuffer.length
      count++
    }
    if (count === 0) throw new Error(`asar integrity hash ${oldHash.slice(0, 12)}… not found in header`)
  }
  const updated = JSON.parse(work.toString('utf8'))
  const updatedEntry = getEntry(updated, entryPath)
  if (updatedEntry?.integrity?.hash !== newIntegrity.hash) throw new Error('asar integrity header was not updated')
  return work
}

function patch(asarPath, backupPath, markerPath, dryRun) {
  const archiveInfo = readArchive(asarPath)
  const { archive, header, headerJsonBuffer, headerStart, dataStart } = archiveInfo
  const entry = getEntry(header, 'lib/main.js')
  if (entry === undefined) throw new Error('lib/main.js is not present in app.asar')
  if (entry.unpacked === true) throw new Error('lib/main.js is stored unpacked; this installer cannot patch it')
  const offset = Number(entry.offset)
  const size = Number(entry.size)
  const absolute = dataStart + offset
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || absolute + size > archive.length) {
    throw new Error('lib/main.js asar entry points outside the archive')
  }
  const originalMain = archive.subarray(absolute, absolute + size)
  if (originalMain.includes(PATCHED_OPTIONS)) {
    console.log('already patched: lib/main.js contains the native acrylic window options')
    return
  }
  const nextMain = patchedMain(originalMain)
  verifySyntax(nextMain)
  const mainIntegrity = buildIntegrity(nextMain, entry.integrity)
  const nextHeaderJson = replaceHeaderHashes(header, headerJsonBuffer, mainIntegrity, 'lib/main.js')
  if (nextHeaderJson.length !== headerJsonBuffer.length) throw new Error('asar header JSON changed size')

  // Build the complete patched archive in memory for the dry run and for the
  // final verification; the real write only touches the two changed ranges.
  const dryBytes = Buffer.from(archive)
  nextMain.copy(dryBytes, absolute)
  nextHeaderJson.copy(dryBytes, headerStart + 8)
  const dryMtime = Date.now()
  const verify = readArchiveBuffer(dryBytes)
  const verifyEntry = getEntry(verify.header, 'lib/main.js')
  if (verifyEntry?.integrity?.hash !== mainIntegrity.hash) throw new Error('patched archive integrity verification failed')
  const verifyMain = dryBytes.subarray(verify.dataStart + Number(verifyEntry.offset), verify.dataStart + Number(verifyEntry.offset) + Number(verifyEntry.size))
  if (sha256(verifyMain) !== mainIntegrity.hash) throw new Error('patched main.js hash verification failed')
  if (verifyMain.length !== size || nextMain.length !== size) throw new Error('patched main.js size changed')

  if (dryRun) {
    const preview = path.join(path.dirname(asarPath), 'main.patched.mjs')
    writeFileSync(preview, nextMain)
    console.log(`dry run: would patch ${asarPath}`)
    console.log(`dry run: patched main.js written to ${preview}`)
    console.log(`dry run: main.js ${size} bytes, new sha256 ${mainIntegrity.hash}`)
    return
  }

  if (!existsSync(backupPath)) {
    copyFileSync(asarPath, backupPath)
    const backupHash = createHash('sha256').update(readFileSync(backupPath)).digest('hex')
    const originalHash = createHash('sha256').update(archive).digest('hex')
    if (backupHash !== originalHash) throw new Error('backup verification failed')
    console.log(`backup written: ${backupPath}`)
  } else {
    console.log(`backup already exists: ${backupPath}`)
  }

  const fd = openSync(asarPath, 'r+')
  try {
    writeSync(fd, nextMain, 0, nextMain.length, absolute)
    writeSync(fd, nextHeaderJson, 0, nextHeaderJson.length, headerStart + 8)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }

  const reread = readArchive(asarPath)
  const rereadEntry = getEntry(reread.header, 'lib/main.js')
  if (rereadEntry?.integrity?.hash !== mainIntegrity.hash) throw new Error('on-disk archive integrity verification failed')
  const stat = statSync(asarPath)
  const writtenMarkers = writeMarkers(markerPath, {
    schema: 'dsh-desktop-glass/native-patch/v1',
    appAsar: asarPath,
    backup: backupPath,
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    mainSha256: mainIntegrity.hash,
    patchedAt: new Date().toISOString(),
  })
  console.log(`patched ${asarPath}`)
  for (const written of writtenMarkers) console.log(`marker written: ${written}`)
  console.log('fully quit and reopen DeepSeek Harness to activate the native acrylic window.')
}

function readArchiveBuffer(buffer) {
  const headerSize = buffer.readUInt32LE(4)
  const headerEnd = 8 + headerSize
  const headerBuffer = buffer.subarray(8, headerEnd)
  const jsonLength = headerBuffer.readUInt32LE(4)
  const header = JSON.parse(headerBuffer.toString('utf8', 8, 8 + jsonLength))
  return { header, dataStart: headerEnd }
}

function restore(asarPath, backupPath, markerPath) {
  if (!existsSync(backupPath)) throw new Error(`no backup found at ${backupPath}`)
  let marker
  for (const target of markerTargets(markerPath)) {
    try {
      marker = JSON.parse(readFileSync(target, 'utf8'))
      break
    } catch {
      // try the next marker location
    }
  }
  copyFileSync(backupPath, asarPath)
  const restored = readArchive(asarPath)
  const entry = getEntry(restored.header, 'lib/main.js')
  if (entry === undefined) throw new Error('restored archive is missing lib/main.js')
  const main = readFileSync(asarPath).subarray(restored.dataStart + Number(entry.offset), restored.dataStart + Number(entry.offset) + Number(entry.size))
  if (main.includes(PATCHED_OPTIONS)) throw new Error('restored archive still contains the glass patch')
  removeMarkers(markerPath)
  console.log(`restored ${asarPath} from ${backupPath}`)
  if (marker?.patchedAt) console.log(`removed marker for patch from ${marker.patchedAt}`)
}

try {
  main()
} catch (error) {
  console.error(`install-glass: ${error?.stack || error}`)
  process.exitCode = 1
}
