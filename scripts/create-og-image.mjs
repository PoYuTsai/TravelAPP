import sharp from 'sharp'

// Create optimized PNG for OG images (social platforms need PNG/JPG)
async function createOgImage() {
  await sharp('./public/images/hero-bg.webp')
    .resize(1200, 630, { fit: 'cover' })
    .png({ quality: 80, compressionLevel: 9 })
    .toFile('./public/images/og-image.png')

  console.log('Created og-image.png (1200x630) for social sharing')
}

createOgImage().catch(console.error)
