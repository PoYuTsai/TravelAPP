const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const phraseSource = fs.readFileSync(path.join(root, 'src/lib/thai/phrases.ts'), 'utf8')

const ffmpeg =
  process.env.FFMPEG_PATH ||
  (() => {
    try {
      return require(path.join(process.env.TEMP || process.env.TMP, 'codex-ffmpeg-static/node_modules/ffmpeg-static'))
    } catch {
      return 'ffmpeg'
    }
  })()

const batches = [
  { parentId: 'basics', file: 'thai-basics-batch1.m4a', count: 10 },
  { parentId: 'food', file: 'thai-food-batch2.m4a', count: 14 },
  { parentId: 'transport', file: 'thai-transport-batch3.m4a', count: 14 },
  { parentId: 'family', file: 'thai-family-batch4.m4a', count: 10 },
  { parentId: 'massage', file: 'thai-massage-batch5.m4a', count: 8 },
  { parentId: 'hotel-airport', file: 'thai-hotel-airport-batch6.m4a', count: 7 },
  { parentId: 'shopping', file: 'thai-shopping-batch7.m4a', count: 6 },
  { parentId: 'emergency', file: 'thai-emergency-batch8.m4a', count: 6 },
]

function extractPhrases() {
  const matches = [
    ...phraseSource.matchAll(
      /withAudio\(\{\s*id: '([^']+)', parentId: '([^']+)', childId: '([^']+)'.*?priority: ([0-9]+)/gs
    ),
  ]

  return matches
    .map((match) => ({
      id: match[1],
      parentId: match[2],
      childId: match[3],
      priority: Number(match[4]),
    }))
    .sort((a, b) => a.priority - b.priority)
}

function runFfmpeg(args, options = {}) {
  const result = spawnSync(ffmpeg, args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  })

  if (result.error) {
    throw result.error
  }

  return result
}

function getDuration(file) {
  const result = runFfmpeg(['-hide_banner', '-i', file, '-f', 'null', '-'])
  const output = `${result.stdout}\n${result.stderr}`
  const match = output.match(/Duration: ([0-9]{2}):([0-9]{2}):([0-9.]+)/)

  if (!match) {
    throw new Error(`Unable to read duration for ${file}`)
  }

  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
}

function detectSilences(file) {
  const result = runFfmpeg([
    '-hide_banner',
    '-i',
    file,
    '-af',
    'silencedetect=noise=-35dB:d=0.25',
    '-f',
    'null',
    '-',
  ])
  const output = `${result.stdout}\n${result.stderr}`
  const starts = [...output.matchAll(/silence_start: ([0-9.]+)/g)].map((match) => Number(match[1]))
  const ends = [...output.matchAll(/silence_end: ([0-9.]+) \| silence_duration: ([0-9.]+)/g)].map((match) => ({
    end: Number(match[1]),
    duration: Number(match[2]),
  }))

  return starts.slice(0, ends.length).map((start, index) => ({
    start,
    end: ends[index].end,
    duration: ends[index].duration,
  }))
}

function selectPhraseBoundaries(silences, duration, phraseCount) {
  const boundaries = []
  const used = new Set()

  for (let i = 1; i < phraseCount; i += 1) {
    const target = (duration * i) / phraseCount
    const candidates = silences
      .map((silence, index) => ({
        index,
        silence,
        score: Math.abs((silence.start + silence.end) / 2 - target) - Math.min(silence.duration, 2) * 0.45,
      }))
      .filter((candidate) => !used.has(candidate.index))
      .filter((candidate) => candidate.silence.start > 1 && candidate.silence.end < duration - 0.2)
      .sort((a, b) => a.score - b.score)

    if (!candidates[0]) {
      throw new Error(`Unable to find boundary ${i}/${phraseCount}`)
    }

    used.add(candidates[0].index)
    boundaries.push(candidates[0].silence)
  }

  return boundaries.sort((a, b) => a.start - b.start)
}

function getClipPlan(silences, duration, phraseCount) {
  const boundaries = selectPhraseBoundaries(silences, duration, phraseCount)
  const phraseWindows = []
  let cursor = 0

  boundaries.forEach((boundary) => {
    phraseWindows.push({ start: cursor, end: boundary.start })
    cursor = boundary.end
  })
  phraseWindows.push({ start: cursor, end: duration })

  return phraseWindows.map((window, index) => {
    const internal = silences
      .filter((silence) => silence.start > window.start + 0.15 && silence.end < window.end - 0.15)
      .sort((a, b) => a.start - b.start)

    let natural
    let slow
    let method = 'silence'

    if (internal.length >= 2) {
      const span = window.end - window.start
      const targetAfterCue = window.start + span * 0.32
      const targetAfterNatural = window.start + span * 0.62
      let bestPair = null
      let bestScore = Number.POSITIVE_INFINITY

      for (let i = 0; i < internal.length - 1; i += 1) {
        for (let j = i + 1; j < internal.length; j += 1) {
          const afterCue = internal[i]
          const afterNatural = internal[j]
          const naturalSeconds = afterNatural.start - afterCue.end
          const slowSeconds = window.end - afterNatural.end

          if (naturalSeconds < 0.35 || slowSeconds < 0.35) {
            continue
          }

          const afterCueMid = (afterCue.start + afterCue.end) / 2
          const afterNaturalMid = (afterNatural.start + afterNatural.end) / 2
          const score =
            Math.abs(afterCueMid - targetAfterCue) +
            Math.abs(afterNaturalMid - targetAfterNatural) -
            Math.min(afterCue.duration, 1.5) * 0.2 -
            Math.min(afterNatural.duration, 1.5) * 0.2

          if (score < bestScore) {
            bestScore = score
            bestPair = [afterCue, afterNatural]
          }
        }
      }

      if (!bestPair) {
        method = 'fallback-thirds'
        natural = {
          start: window.start + span * 0.34,
          end: window.start + span * 0.62,
        }
        slow = {
          start: window.start + span * 0.64,
          end: window.end - 0.08,
        }
      } else {
        const [afterCue, afterNatural] = bestPair
      natural = {
        start: Math.max(window.start, afterCue.end + 0.03),
        end: Math.max(afterCue.end + 0.08, afterNatural.start - 0.03),
      }
      slow = {
        start: Math.max(afterNatural.end + 0.03, natural.end + 0.03),
        end: Math.max(afterNatural.end + 0.08, window.end - 0.08),
      }

      if (
        natural.end - natural.start < 0.5 ||
        slow.end - slow.start < 0.5 ||
        slow.end - slow.start > 8
      ) {
        method = 'fallback-thirds'
        natural = {
          start: window.start + span * 0.34,
          end: window.start + span * 0.62,
        }
        slow = {
          start: window.start + span * 0.64,
          end: window.end - 0.08,
        }
      }
      }
    } else {
      method = 'fallback-thirds'
      const span = window.end - window.start
      natural = {
        start: window.start + span * 0.34,
        end: window.start + span * 0.62,
      }
      slow = {
        start: window.start + span * 0.64,
        end: window.end - 0.08,
      }
    }

    return {
      index,
      window,
      natural,
      slow,
      internalSilences: internal.length,
      method,
    }
  })
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
}

function exportClip(inputFile, outputFile, clip) {
  ensureDir(outputFile)

  const start = Math.max(0, clip.start)
  const duration = Math.max(0.2, clip.end - clip.start)

  runFfmpeg([
    '-hide_banner',
    '-y',
    '-ss',
    start.toFixed(3),
    '-t',
    duration.toFixed(3),
    '-i',
    inputFile,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '44100',
    '-b:a',
    '96k',
    outputFile,
  ])
}

function main() {
  const phrases = extractPhrases()
  const report = []

  batches.forEach((batch) => {
    const batchPhrases = phrases.filter((phrase) => phrase.parentId === batch.parentId)
    if (batchPhrases.length !== batch.count) {
      throw new Error(`${batch.parentId} expected ${batch.count} phrases, got ${batchPhrases.length}`)
    }

    const inputFile = path.join(root, 'docs/assets/thai-audio-source', batch.file)
    const duration = getDuration(inputFile)
    const silences = detectSilences(inputFile)
    const clipPlan = getClipPlan(silences, duration, batch.count)

    batchPhrases.forEach((phrase, index) => {
      const plan = clipPlan[index]
      const basePath = path.join(root, 'public/audio/thai', phrase.parentId, phrase.childId)
      const naturalFile = path.join(basePath, `${phrase.id}-natural.mp3`)
      const slowFile = path.join(basePath, `${phrase.id}-slow.mp3`)

      exportClip(inputFile, naturalFile, plan.natural)
      exportClip(inputFile, slowFile, plan.slow)

      report.push({
        batch: batch.parentId,
        phrase: phrase.id,
        method: plan.method,
        internalSilences: plan.internalSilences,
        naturalSeconds: Number((plan.natural.end - plan.natural.start).toFixed(2)),
        slowSeconds: Number((plan.slow.end - plan.slow.start).toFixed(2)),
      })
    })
  })

  const reportFile = path.join(root, 'docs/assets/thai-audio-source/split-report.json')
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`Generated ${report.length * 2} mp3 files`)
  console.log(`Report: ${reportFile}`)
  const fallbackCount = report.filter((item) => item.method !== 'silence').length
  console.log(`Fallback clips needing review: ${fallbackCount}`)
}

main()
