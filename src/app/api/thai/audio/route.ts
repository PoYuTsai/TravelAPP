import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { NextResponse } from 'next/server'
import { resolveThaiAudioTarget, type ThaiAudioSpeed } from '@/lib/thai/audio-storage'
import { canUseThaiRecorder } from '@/lib/thai/recorder-access'

export const runtime = 'nodejs'

const execFileAsync = promisify(execFile)

const allowedSpeeds: ThaiAudioSpeed[] = ['natural', 'slow']

function getFfmpegCandidates() {
  return [
    process.env.FFMPEG_PATH,
    path.join(os.tmpdir(), 'codex-ffmpeg-static', 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
    path.join(os.tmpdir(), 'codex-ffmpeg-static', 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    'ffmpeg',
  ].filter(Boolean) as string[]
}

async function convertToMp3(inputPath: string, outputPath: string) {
  const candidates = getFfmpegCandidates()
  let lastError: unknown

  await mkdir(path.dirname(outputPath), { recursive: true })

  for (const ffmpegPath of candidates) {
    try {
      await execFileAsync(ffmpegPath, [
        '-y',
        '-i',
        inputPath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '44100',
        '-b:a',
        '96k',
        outputPath,
      ])
      return
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error('ffmpeg conversion failed')
}

export async function POST(request: Request) {
  if (!canUseThaiRecorder()) {
    return NextResponse.json({ error: 'Thai recorder is disabled in production.' }, { status: 403 })
  }

  const formData = await request.formData()
  const phraseId = formData.get('phraseId')
  const speed = formData.get('speed')
  const audio = formData.get('audio')

  if (typeof phraseId !== 'string' || typeof speed !== 'string' || !(audio instanceof File)) {
    return NextResponse.json({ error: 'Missing phraseId, speed, or audio file.' }, { status: 400 })
  }

  if (!allowedSpeeds.includes(speed as ThaiAudioSpeed)) {
    return NextResponse.json({ error: 'Invalid audio speed.' }, { status: 400 })
  }

  let target

  try {
    target = resolveThaiAudioTarget({ phraseId, speed: speed as ThaiAudioSpeed })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid Thai phrase.'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  const tempDir = path.join(os.tmpdir(), 'chiangway-thai-recorder')
  const tempInput = path.join(tempDir, `${randomUUID()}.webm`)

  try {
    await mkdir(tempDir, { recursive: true })
    await writeFile(tempInput, Buffer.from(await audio.arrayBuffer()))
    await convertToMp3(tempInput, target.filePath)

    return NextResponse.json({
      ok: true,
      phraseId,
      speed,
      publicPath: target.publicPath,
      savedAt: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save audio.'
    return NextResponse.json({ error: message }, { status: 500 })
  } finally {
    await rm(tempInput, { force: true })
  }
}
