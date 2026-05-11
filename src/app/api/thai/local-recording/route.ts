import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'
import { resolveThaiAudioTarget, type ThaiAudioSpeed } from '@/lib/thai/audio-storage'
import { canUseThaiRecorder } from '@/lib/thai/recorder-access'

export const runtime = 'nodejs'

type ActiveRecording = {
  key: string
  process: ChildProcessWithoutNullStreams
  publicPath: string
  tempPath: string
  targetPath: string
  draftId: string
  phraseId: string
  speed: ThaiAudioSpeed
}

type DraftRecording = {
  draftId: string
  key: string
  tempPath: string
  targetPath: string
  publicPath: string
  draftPublicPath: string
}

const execFileAsync = promisify(execFile)

const audioDevice =
  process.env.THAI_RECORDER_AUDIO_DEVICE || '麥克風排列 (適用於數位麥克風的 Intel® 智慧型音效技術)'

const ffmpegPath =
  process.env.FFMPEG_PATH ||
  path.join(process.env.LOCALAPPDATA || '', 'Temp', 'codex-ffmpeg-static', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe')

const globalState = globalThis as typeof globalThis & {
  __thaiActiveRecording?: ActiveRecording
  __thaiDraftRecordings?: Map<string, DraftRecording>
}

if (!globalState.__thaiDraftRecordings) {
  globalState.__thaiDraftRecordings = new Map()
}

function recordingKey(phraseId: string, speed: ThaiAudioSpeed) {
  return `${phraseId}-${speed}`
}

function trimFilter(trimStart: number, trimEnd: number) {
  return `atrim=start=${trimStart},asetpts=PTS-STARTPTS,areverse,atrim=start=${trimEnd},asetpts=PTS-STARTPTS,areverse`
}

async function convertRecording(tempPath: string, targetPath: string, trimStart = 0, trimEnd = 0) {
  await execFileAsync(ffmpegPath, [
    '-y',
    '-i',
    tempPath,
    '-af',
    trimFilter(trimStart, trimEnd),
    '-vn',
    '-ac',
    '1',
    '-ar',
    '44100',
    '-b:a',
    '96k',
    targetPath,
  ])
}

async function stopActiveRecording() {
  const active = globalState.__thaiActiveRecording

  if (!active) {
    return null
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      active.process.kill('SIGTERM')
      resolve()
    }, 2500)

    active.process.once('exit', () => {
      clearTimeout(timeout)
      resolve()
    })

    active.process.stdin.write('q')
  })

  globalState.__thaiActiveRecording = undefined
  const draftDir = path.join(process.cwd(), 'public', 'audio', 'thai-drafts')
  await mkdir(draftDir, { recursive: true })
  const draftFileName = `${active.key}-${active.draftId}.mp3`
  const draftPath = path.join(draftDir, draftFileName)
  const draftPublicPath = `/audio/thai-drafts/${draftFileName}`

  await convertRecording(active.tempPath, draftPath)
  globalState.__thaiDraftRecordings?.set(active.draftId, {
    draftId: active.draftId,
    key: active.key,
    tempPath: active.tempPath,
    targetPath: active.targetPath,
    publicPath: active.publicPath,
    draftPublicPath,
  })

  return active
}

function readTrimSeconds(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(value, 30))
}

export async function POST(request: Request) {
  if (!canUseThaiRecorder()) {
    return NextResponse.json({ error: 'Thai recorder is disabled in production.' }, { status: 403 })
  }

  const body = await request.json()
  const action = body.action

  if (action === 'stop') {
    const stopped = await stopActiveRecording()

    if (!stopped) {
      return NextResponse.json({ error: 'No active local recording.' }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      key: stopped.key,
      publicPath: stopped.publicPath,
      draftId: stopped.draftId,
      draftPath: globalState.__thaiDraftRecordings?.get(stopped.draftId)?.draftPublicPath,
      savedAt: new Date().toISOString(),
    })
  }

  if (action === 'preview' || action === 'finalize') {
    const draftId = body.draftId
    const draft = typeof draftId === 'string' ? globalState.__thaiDraftRecordings?.get(draftId) : undefined

    if (!draft) {
      return NextResponse.json({ error: 'Draft recording not found. Please record this phrase again.' }, { status: 404 })
    }

    const trimStart = readTrimSeconds(body.trimStart)
    const trimEnd = readTrimSeconds(body.trimEnd)

    if (action === 'preview') {
      const previewDir = path.join(process.cwd(), 'public', 'audio', 'thai-drafts')
      await mkdir(previewDir, { recursive: true })
      const previewFileName = `${draft.key}-${draft.draftId}-preview-${Date.now()}.mp3`
      const previewPath = path.join(previewDir, previewFileName)
      const previewPublicPath = `/audio/thai-drafts/${previewFileName}`
      await convertRecording(draft.tempPath, previewPath, trimStart, trimEnd)

      return NextResponse.json({
        ok: true,
        previewPath: previewPublicPath,
      })
    }

    await convertRecording(draft.tempPath, draft.targetPath, trimStart, trimEnd)

    return NextResponse.json({
      ok: true,
      key: draft.key,
      publicPath: draft.publicPath,
      savedAt: new Date().toISOString(),
    })
  }

  if (action !== 'start') {
    return NextResponse.json({ error: 'Invalid recording action.' }, { status: 400 })
  }

  const phraseId = body.phraseId
  const speed = body.speed

  if (typeof phraseId !== 'string' || (speed !== 'natural' && speed !== 'slow')) {
    return NextResponse.json({ error: 'Missing phraseId or speed.' }, { status: 400 })
  }

  if (globalState.__thaiActiveRecording) {
    return NextResponse.json({ error: 'Another local recording is already active.' }, { status: 409 })
  }

  const target = resolveThaiAudioTarget({ phraseId, speed })
  const draftId = randomUUID()
  const tempDir = path.join(os.tmpdir(), 'chiangway-thai-local-recording')
  await mkdir(tempDir, { recursive: true })
  const tempPath = path.join(tempDir, `${recordingKey(phraseId, speed)}-${randomUUID()}.wav`)
  const child = spawn(ffmpegPath, [
    '-y',
    '-f',
    'dshow',
    '-i',
    `audio=${audioDevice}`,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '44100',
    tempPath,
  ])

  let stderr = ''
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString()
  })

  child.once('exit', (code) => {
    if (globalState.__thaiActiveRecording?.process === child) {
      globalState.__thaiActiveRecording = undefined
    }

    if (code && code !== 0 && code !== 255) {
      console.error(`Thai local recorder exited with ${code}: ${stderr}`)
    }
  })

  globalState.__thaiActiveRecording = {
    key: recordingKey(phraseId, speed),
    process: child,
    publicPath: target.publicPath,
    tempPath,
    targetPath: target.filePath,
    draftId,
    phraseId,
    speed,
  }

  return NextResponse.json({
    ok: true,
    key: recordingKey(phraseId, speed),
    draftId,
    publicPath: target.publicPath,
    device: audioDevice,
  })
}
