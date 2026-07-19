import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { RICH_MENU_SPEC } from '../../src/lib/artifacts/productionArtwork'
import {
  renderLinePricingArtworkPng,
  renderPricingArtworkPng,
  renderRichMenuPng,
  type LinePricingSheet,
} from '../../src/lib/artifacts/productionArtworkRenderer'

const ROOT = process.cwd()
const VERSION = '2026-07-10'
const LINE_PRICE_VERSION = '2026-07-11-v2'
const PRICING_DIR = path.join(ROOT, 'public', 'images', 'pricing')
const LINE_DIR = path.join(ROOT, 'public', 'images', 'line')
const LINE_PRICE_DIR = path.join(ROOT, 'artifacts', 'internal', 'pricing-matrices')
const LINE_SCRIPT_DIR = path.join(ROOT, 'scripts', 'line')
const BACKGROUND_PATH = path.join(
  PRICING_DIR,
  `day-tour-price-bg-v${VERSION}.png`,
)
const LOGO_PATH = path.join(ROOT, 'public', 'images', 'logo.png')
const ARTWORK_FONT_PATHS = ['Regular', 'Bold', 'Black'].map((weight) =>
  path.join(
    ROOT,
    'public',
    'fonts',
    `ChiangwayArtworkSans-${weight}-subset.ttf`,
  ),
)
const LINE_PRICE_SHEETS: Array<{ sheet: LinePricingSheet; stem: string }> = [
  { sheet: 'chiang-mai', stem: 'charter-price-chiang-mai' },
  { sheet: 'chiang-rai', stem: 'charter-price-chiang-rai' },
]

interface ArtifactRecord {
  path: string
  bytes: number
  sha256: string
  width?: number
  height?: number
}

async function artifactRecord(filePath: string): Promise<ArtifactRecord> {
  const file = await stat(filePath)
  const contents = await readFile(filePath)
  const dimensions: { width?: number; height?: number } = await sharp(contents)
    .metadata()
    .then(({ width, height }) => ({ width, height }))
    .catch(() => ({}))

  return {
    path: path.relative(ROOT, filePath).replaceAll('\\', '/'),
    bytes: file.size,
    sha256: createHash('sha256').update(contents).digest('hex'),
    width: dimensions.width,
    height: dimensions.height,
  }
}

async function writeLineArtifacts(fontPaths: readonly string[]): Promise<ArtifactRecord[]> {
  await Promise.all([mkdir(LINE_DIR, { recursive: true }), mkdir(LINE_SCRIPT_DIR, { recursive: true })])

  const masterPath = path.join(LINE_DIR, `rich-menu-main-v${VERSION}.png`)
  const previewPath = path.join(LINE_DIR, `rich-menu-main-v${VERSION}-preview.png`)
  const jsonPath = path.join(LINE_SCRIPT_DIR, `rich-menu-main-v${VERSION}.json`)
  const master = await renderRichMenuPng(fontPaths)

  if (master.byteLength >= 1_000_000) {
    throw new Error(`LINE rich-menu PNG is ${master.byteLength} bytes; it must be under 1,000,000`)
  }

  const preview = await sharp(master)
    .resize(1250, 843, { fit: 'fill' })
    .png({ compressionLevel: 9, palette: true, colours: 128 })
    .toBuffer()

  await Promise.all([
    writeFile(masterPath, master),
    writeFile(previewPath, preview),
    writeFile(jsonPath, `${JSON.stringify(RICH_MENU_SPEC, null, 2)}\n`, 'utf8'),
  ])

  return Promise.all([artifactRecord(masterPath), artifactRecord(previewPath)])
}

async function writeLinePricingArtwork(
  fontPaths: readonly string[],
): Promise<ArtifactRecord[]> {
  await mkdir(LINE_PRICE_DIR, { recursive: true })

  const outputPaths = await Promise.all(
    LINE_PRICE_SHEETS.map(async ({ sheet, stem }) => {
      const masterPath = path.join(
        LINE_PRICE_DIR,
        `${stem}-v${LINE_PRICE_VERSION}.png`,
      )
      const previewPath = path.join(
        LINE_PRICE_DIR,
        `${stem}-v${LINE_PRICE_VERSION}-preview.png`,
      )
      const master = await renderLinePricingArtworkPng(sheet, fontPaths)
      const preview = await sharp(master)
        .resize(375, 469, { fit: 'fill' })
        .png({ compressionLevel: 9 })
        .toBuffer()

      await Promise.all([
        writeFile(masterPath, master),
        writeFile(previewPath, preview),
      ])
      return [masterPath, previewPath]
    }),
  )

  return Promise.all(outputPaths.flat().map(artifactRecord))
}

async function writePricingArtifacts(fontPaths: readonly string[]): Promise<ArtifactRecord[]> {
  if (!existsSync(BACKGROUND_PATH)) {
    throw new Error(
      `Missing imagegen background: ${path.relative(ROOT, BACKGROUND_PATH)}. ` +
        'Generate and inspect the no-text background before rendering final pricing artwork.',
    )
  }

  await mkdir(PRICING_DIR, { recursive: true })
  const masterPath = path.join(PRICING_DIR, `day-tour-price-v${VERSION}.png`)
  const sharePath = path.join(PRICING_DIR, `day-tour-price-v${VERSION}-1080x1350.png`)
  const master = await renderPricingArtworkPng({
    backgroundPath: BACKGROUND_PATH,
    logoPath: LOGO_PATH,
    fontPaths,
  })
  const share = await sharp(master)
    .resize(1080, 1350, { fit: 'fill' })
    .png({ compressionLevel: 9, palette: true, colours: 256, dither: 0.8 })
    .toBuffer()

  await Promise.all([writeFile(masterPath, master), writeFile(sharePath, share)])
  return Promise.all([artifactRecord(masterPath), artifactRecord(sharePath)])
}

async function writePricingLayoutPreview(fontPaths: readonly string[]): Promise<ArtifactRecord[]> {
  const previewDir = path.join(ROOT, 'tmp', 'artifacts')
  const previewPath = path.join(previewDir, `day-tour-price-layout-preview-v${VERSION}.png`)
  const mobilePath = path.join(previewDir, `day-tour-price-layout-preview-v${VERSION}-375px.png`)
  await mkdir(previewDir, { recursive: true })
  const preview = await renderPricingArtworkPng({ logoPath: LOGO_PATH, fontPaths })
  const mobile = await sharp(preview)
    .resize(375, 469, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer()
  await Promise.all([writeFile(previewPath, preview), writeFile(mobilePath, mobile)])
  return Promise.all([artifactRecord(previewPath), artifactRecord(mobilePath)])
}

async function main() {
  const lineOnly = process.argv.includes('--line-only')
  const layoutPreview = process.argv.includes('--layout-preview')
  const missingFont = ARTWORK_FONT_PATHS.find((fontPath) => !existsSync(fontPath))
  if (missingFont) {
    throw new Error(`Missing artwork font: ${path.relative(ROOT, missingFont)}`)
  }
  const fontData = await Promise.all(ARTWORK_FONT_PATHS.map((fontPath) => readFile(fontPath)))
  const records = [
    ...(await writeLineArtifacts(ARTWORK_FONT_PATHS)),
    ...(await writeLinePricingArtwork(ARTWORK_FONT_PATHS)),
  ]

  if (layoutPreview) {
    records.push(...(await writePricingLayoutPreview(ARTWORK_FONT_PATHS)))
  } else if (!lineOnly) {
    records.push(...(await writePricingArtifacts(ARTWORK_FONT_PATHS)))
  }

  if (!lineOnly && !layoutPreview) {
    const manifestPath = path.join(
      ROOT,
      'scripts',
      'artifacts',
      `production-assets-v${VERSION}.manifest.json`,
    )
    await writeFile(
      manifestPath,
      `${JSON.stringify({
        version: VERSION,
        generatedAt: new Date().toISOString(),
        fonts: ARTWORK_FONT_PATHS.map((fontPath, index) => ({
          path: path.relative(ROOT, fontPath).replaceAll('\\', '/'),
          sha256: createHash('sha256').update(fontData[index]).digest('hex'),
        })),
        artifacts: records,
      }, null, 2)}\n`,
      'utf8',
    )
  }

  records.forEach((record) => {
    process.stdout.write(
      `${record.path} ${record.width ?? '-'}x${record.height ?? '-'} ${record.bytes} bytes sha256=${record.sha256}\n`,
    )
  })
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
