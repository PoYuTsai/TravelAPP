import sharp from 'sharp'
import { readdir, stat } from 'fs/promises'
import { join, parse } from 'path'

const IMAGES_DIR = './public/images'
const QUALITY = 80

async function optimizeImages() {
  console.log('Starting image optimization...\n')

  const files = await readdir(IMAGES_DIR)
  let totalSaved = 0

  for (const file of files) {
    const filePath = join(IMAGES_DIR, file)
    const { name, ext } = parse(file)

    // Skip non-image files and already optimized files
    if (!['.png', '.jpg', '.jpeg'].includes(ext.toLowerCase())) continue
    if (name.includes('-optimized')) continue

    const originalStats = await stat(filePath)
    const originalSize = originalStats.size

    try {
      // For PNG files, convert to WebP
      if (ext.toLowerCase() === '.png') {
        const webpPath = join(IMAGES_DIR, `${name}.webp`)
        await sharp(filePath)
          .webp({ quality: QUALITY })
          .toFile(webpPath)

        const webpStats = await stat(webpPath)
        const saved = originalSize - webpStats.size
        totalSaved += saved

        console.log(`${file} -> ${name}.webp`)
        console.log(`  Original: ${(originalSize / 1024).toFixed(1)}KB`)
        console.log(`  WebP: ${(webpStats.size / 1024).toFixed(1)}KB`)
        console.log(`  Saved: ${(saved / 1024).toFixed(1)}KB (${((saved / originalSize) * 100).toFixed(1)}%)\n`)
      }

      // For JPG files, optimize and keep as JPG
      if (['.jpg', '.jpeg'].includes(ext.toLowerCase())) {
        const optimizedPath = join(IMAGES_DIR, `${name}-optimized${ext}`)
        await sharp(filePath)
          .jpeg({ quality: QUALITY, mozjpeg: true })
          .toFile(optimizedPath)

        const optimizedStats = await stat(optimizedPath)
        const saved = originalSize - optimizedStats.size
        totalSaved += saved

        console.log(`${file} -> ${name}-optimized${ext}`)
        console.log(`  Original: ${(originalSize / 1024).toFixed(1)}KB`)
        console.log(`  Optimized: ${(optimizedStats.size / 1024).toFixed(1)}KB`)
        console.log(`  Saved: ${(saved / 1024).toFixed(1)}KB (${((saved / originalSize) * 100).toFixed(1)}%)\n`)
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error.message)
    }
  }

  console.log(`\nTotal saved: ${(totalSaved / 1024).toFixed(1)}KB`)
}

optimizeImages().catch(console.error)
