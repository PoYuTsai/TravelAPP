'use client'

/**
 * PopupHybrid — 真·立體書 混搭定案版 (Center 折法 × Theater 質感, 黃昏黏金時刻).
 *
 * 骨架沿用 PopupCenterFold：開書 → 城市從書脊折立 → 折紙路 + 每日 pop-up →
 * 紙車沿路行駛、相機 day-to-day dolly → 最後一頁向上展開的估價信。
 *
 * 三個質感 graft（移植自 PopupTheater）：
 *   ① grain canvas 當 bumpMap 掛到所有 MeshStandardMaterial（最大質感提升）。
 *   ② Theater 的 Shape+bevel 剪影（lannaTemple / palmTree / archGate /
 *      mountainRange / cityRoofs）取代 Center 用 box 疊出的城市元件；鉸鏈折疊邏輯不變。
 *   ③ 估價維持 Center「最後一頁展開 + DOM 釘 camera.project()」，紙做成金標頭 +
 *      金外框 + 蠟封的精裝信。
 *
 * 世界 = C 黃昏黏金時刻：暖低 ambient + 暖斜 key + 暖橘 rim + 暖橘 SpotLight +
 * 黃昏天空漸層。報價頁要同時兼顧質感與數字可讀性，所以不走 Theater 全黑舞台，
 * 也不走 Center 白天；劇場框不要，只留 CSS vignette/glow overlay。
 *
 * 設計文件：docs/plans/2026-05-31-quote-3d-hybrid-design.md
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import * as THREE from 'three'
import { motion } from 'framer-motion'
import { CalendarDays, ReceiptText } from 'lucide-react'
import { QuoteFooter } from '@/components/quote/QuoteFooter'
import { QuoteItinerary } from '@/components/quote/QuoteItinerary'
import { QuoteCostDashboard } from '@/components/quote/QuoteCostDashboard'
import { scrollToSection } from '@/lib/quote/scrollToSection'
import type { QuoteData } from '@/lib/quote/types'

const ease = [0.22, 1, 0.36, 1] as const

function parseQuoteName(name: string): { client: string | null; trip: string } {
  const sep = name.indexOf('-')
  if (sep > 0 && sep < name.length - 1) {
    return { client: name.slice(0, sep).trim(), trip: name.slice(sep + 1).trim() }
  }
  return { client: null, trip: name }
}

// ---- dusk Lanna palette (premium cardstock at golden hour) -------------------
const PAL = {
  ivory: 0xf2e4c8,
  cream: 0xe4d2af,
  paper: 0xf7efde,
  sand: 0xd6bd91,
  gold: 0xc9a14a,
  goldHi: 0xe6c879,
  teal: 0x436f63,
  terracotta: 0xc06a45,
  brick: 0xc89060,
  shadow: 0x6b5a44,
  ink: 0x4a3c2a,
}
const GOLD = 0xc9a14a

const KIND_ACCENT: Record<string, number> = {
  transport: 0x4f7d72,
  meal: 0xc06a45,
  snack: 0xd99a4e,
  activity: GOLD,
  stop: 0x7d6b8f,
}

const REALISTIC_CITY_SCENE = '/images/quote-3d/chiangmai-thaphae-book-wide-hires.png'
const MOBILE_CITY_SCENE = '/images/quote-3d/chiangmai-thaphae-book-mobile-hires.png'
const REALISTIC_VAN = '/images/quote-3d/chiangmai-real-van.png'
const ELEPHANT_CUTOUT = '/images/quote-3d/chiangmai-elephant-tight-mobile.png'
const DAY_DIORAMA_TEXTURES = [
  '/images/quote-3d/day-realistic/day-1.png',
  '/images/quote-3d/day-realistic/day-2.png',
  '/images/quote-3d/day-realistic/day-3.png',
  '/images/quote-3d/day-realistic/day-4.png',
  '/images/quote-3d/day-realistic/day-5.png',
]

const PIGEON_FLOCK = [
  { mx: '17%', my: '50%', dx: '17%', dy: '54%', size: 24, delay: '-0.2s', duration: '8.4s', travelX: '8vw', travelY: '-4vh' },
  { mx: '24%', my: '47%', dx: '22%', dy: '51%', size: 17, delay: '-1.4s', duration: '7.6s', travelX: '6vw', travelY: '-5vh' },
  { mx: '31%', my: '45%', dx: '27%', dy: '48%', size: 20, delay: '-2.6s', duration: '9.2s', travelX: '10vw', travelY: '-3vh' },
  { mx: '38%', my: '43%', dx: '32%', dy: '52%', size: 14, delay: '-3.1s', duration: '8.8s', travelX: '7vw', travelY: '-6vh' },
  { mx: '20%', my: '56%', dx: '13%', dy: '59%', size: 15, delay: '-4.5s', duration: '10s', travelX: '9vw', travelY: '-4vh' },
  { mx: '43%', my: '48%', dx: '37%', dy: '55%', size: 18, delay: '-5.3s', duration: '8.2s', travelX: '5vw', travelY: '-5vh' },
]

export function PopupHybrid({ quote }: { quote: QuoteData }) {
  const stageRef = useRef<HTMLDivElement | null>(null)
  const mountRef = useRef<HTMLDivElement | null>(null)
  const [ready, setReady] = useState(false)

  const days = quote.itinerary.slice(0, 6)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let disposed = false
    const disposables: { dispose: () => void }[] = []
    const track = <T extends { dispose: () => void }>(o: T): T => {
      disposables.push(o)
      return o
    }

    // ---- renderer ----
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.06
    const canvas = renderer.domElement
    canvas.setAttribute('data-testid', 'quote-3d-canvas')
    canvas.setAttribute('data-scene-ready', 'false')
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    mount.appendChild(canvas)

    // ---- scene + warm dusk fog ----
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0xc99a62, 30, 80)

    // === GRAFT ① — paper-grain bump (Theater) shared by ALL standard mats =====
    const grain = (() => {
      const c = document.createElement('canvas')
      c.width = c.height = 256
      const g = c.getContext('2d')!
      g.fillStyle = '#808080'
      g.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 9000; i++) {
        const v = 120 + Math.random() * 30
        g.fillStyle = `rgb(${v},${v},${v})`
        g.fillRect(Math.random() * 256, Math.random() * 256, 1, 1)
      }
      const t = new THREE.CanvasTexture(c)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(3, 3)
      return track(t)
    })()

    // dusk sky gradient backdrop (big plane far behind)
    const skyGeo = track(new THREE.PlaneGeometry(170, 100))
    const skyCanvas = document.createElement('canvas')
    skyCanvas.width = 16
    skyCanvas.height = 256
    const sctx = skyCanvas.getContext('2d')!
    const grad = sctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#241a10') // deep dusk crown
    grad.addColorStop(0.4, '#7d4f27')
    grad.addColorStop(0.62, '#c98a4a')
    grad.addColorStop(0.82, '#e9b56a')
    grad.addColorStop(1, '#f3c980') // horizon glow
    sctx.fillStyle = grad
    sctx.fillRect(0, 0, 16, 256)
    const skyTex = track(new THREE.CanvasTexture(skyCanvas))
    skyTex.colorSpace = THREE.SRGBColorSpace
    const skyMat = track(new THREE.MeshBasicMaterial({ map: skyTex, fog: false, depthWrite: false }))
    const sky = new THREE.Mesh(skyGeo, skyMat)
    sky.position.set(0, 10, -36)
    scene.add(sky)

    // low sun-glow disc near the horizon, behind the folded city
    const glowGeo = track(new THREE.CircleGeometry(8, 48))
    const glowMat = track(
      new THREE.MeshBasicMaterial({ color: 0xf7d68f, transparent: true, opacity: 0.5, fog: false, depthWrite: false }),
    )
    const glow = new THREE.Mesh(glowGeo, glowMat)
    glow.position.set(-1.5, 5.5, -33)
    scene.add(glow)

    // ---- camera ----
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)

    // ---- lights: dusk golden-hour (warm, low ambient + warm key/rim/spot) ----
    const ambient = new THREE.AmbientLight(0xffe6c4, 0.32)
    scene.add(ambient)

    const hemi = new THREE.HemisphereLight(0xffdcab, 0x3a2a18, 0.38)
    scene.add(hemi)

    const key = new THREE.DirectionalLight(0xffdca6, 1.42)
    key.position.set(-11, 12, 9) // lower, golden-hour rake
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 1
    key.shadow.camera.far = 60
    key.shadow.camera.left = -22
    key.shadow.camera.right = 22
    key.shadow.camera.top = 22
    key.shadow.camera.bottom = -22
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.02
    key.shadow.radius = 5
    scene.add(key)

    // warm orange rim / back light to pop the vertical silhouettes at dusk
    const rim = new THREE.DirectionalLight(0xffb866, 1.15)
    rim.position.set(8, 7, -12)
    scene.add(rim)

    // gentle warm fill (replaces Center's cool fill so nothing goes muddy)
    const fill = new THREE.DirectionalLight(0xd9b98a, 0.26)
    fill.position.set(12, 6, 8)
    scene.add(fill)

    // warm orange SpotLight — rakes the book, keeps the DOM-overlay zone readable
    const spot = new THREE.SpotLight(0xffae5a, 2.2, 64, Math.PI / 5, 0.5, 1.1)
    spot.position.set(-3, 20, 16)
    spot.target.position.set(0, 3, 1)
    spot.castShadow = true
    spot.shadow.mapSize.set(1024, 1024)
    spot.shadow.bias = -0.0005
    scene.add(spot)
    scene.add(spot.target)

    // ---- shared paper materials (all carry the grain bump) ----
    const withGrain = <M extends THREE.MeshStandardMaterial>(m: M, scale = 0.04): M => {
      m.bumpMap = grain
      m.bumpScale = scale
      return m
    }
    const matPaper = track(
      withGrain(new THREE.MeshStandardMaterial({ color: PAL.paper, roughness: 0.92, metalness: 0.0 })),
    )
    const matIvory = track(
      withGrain(new THREE.MeshStandardMaterial({ color: PAL.ivory, roughness: 0.95, metalness: 0.0 })),
    )
    const matCream = track(
      withGrain(new THREE.MeshStandardMaterial({ color: PAL.cream, roughness: 0.95, metalness: 0.0 })),
    )
    const matGold = track(
      withGrain(
        new THREE.MeshStandardMaterial({
          color: GOLD,
          roughness: 0.42,
          metalness: 0.55,
          emissive: 0x4a3306,
          emissiveIntensity: 0.22,
        }),
        0.02,
      ),
    )
    const matCover = track(
      withGrain(new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.8, metalness: 0.05 }), 0.06),
    )

    const paperMat = (color: number, rough = 0.94, bump = 0.04) =>
      track(withGrain(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.0 }), bump))

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy()
    const dayDioramaTextures = DAY_DIORAMA_TEXTURES.map((url) => {
      const texture = track(new THREE.TextureLoader().load(url))
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.generateMipmaps = true
      texture.anisotropy = Math.min(8, maxAnisotropy)
      return texture
    })

    const realisticCityTexture = track(new THREE.TextureLoader().load(REALISTIC_CITY_SCENE))
    realisticCityTexture.colorSpace = THREE.SRGBColorSpace
    realisticCityTexture.wrapS = THREE.ClampToEdgeWrapping
    realisticCityTexture.wrapT = THREE.ClampToEdgeWrapping
    realisticCityTexture.minFilter = THREE.LinearMipmapLinearFilter
    realisticCityTexture.magFilter = THREE.LinearFilter
    realisticCityTexture.anisotropy = Math.min(8, maxAnisotropy)
    // This generated round keeps the front page intentionally wide and clean:
    // no baked-in van, so the animated van can follow the page-road without a
    // patch or a second static vehicle.

    const cityVanTexture = track(new THREE.TextureLoader().load(REALISTIC_VAN))
    cityVanTexture.colorSpace = THREE.SRGBColorSpace
    cityVanTexture.wrapS = THREE.ClampToEdgeWrapping
    cityVanTexture.wrapT = THREE.ClampToEdgeWrapping
    cityVanTexture.minFilter = THREE.LinearMipmapLinearFilter
    cityVanTexture.magFilter = THREE.LinearFilter
    cityVanTexture.anisotropy = Math.min(8, maxAnisotropy)

    const elephantTexture = track(new THREE.TextureLoader().load(ELEPHANT_CUTOUT))
    elephantTexture.colorSpace = THREE.SRGBColorSpace
    elephantTexture.wrapS = THREE.ClampToEdgeWrapping
    elephantTexture.wrapT = THREE.ClampToEdgeWrapping
    elephantTexture.minFilter = THREE.LinearMipmapLinearFilter
    elephantTexture.magFilter = THREE.LinearFilter
    elephantTexture.anisotropy = Math.min(8, maxAnisotropy)

    const vanTexture = track(new THREE.TextureLoader().load(REALISTIC_VAN))
    vanTexture.colorSpace = THREE.SRGBColorSpace
    vanTexture.wrapS = THREE.ClampToEdgeWrapping
    vanTexture.wrapT = THREE.ClampToEdgeWrapping
    vanTexture.minFilter = THREE.LinearMipmapLinearFilter
    vanTexture.magFilter = THREE.LinearFilter
    vanTexture.anisotropy = Math.min(8, maxAnisotropy)

    const createDayDioramaTexture = (index: number) => {
      return dayDioramaTextures[index % dayDioramaTextures.length]
    }

    const makeSoftBlobTexture = (kind: 'cloud' | 'mist' | 'sun') => {
      const c = document.createElement('canvas')
      c.width = 256
      c.height = 128
      const ctx = c.getContext('2d')!
      ctx.clearRect(0, 0, c.width, c.height)

      if (kind === 'sun') {
        const glow = ctx.createRadialGradient(128, 64, 4, 128, 64, 110)
        glow.addColorStop(0, 'rgba(255, 231, 150, 0.95)')
        glow.addColorStop(0.35, 'rgba(248, 179, 82, 0.42)')
        glow.addColorStop(1, 'rgba(248, 179, 82, 0)')
        ctx.fillStyle = glow
        ctx.fillRect(0, 0, c.width, c.height)
      } else {
        const alpha = kind === 'cloud' ? 0.58 : 0.34
        const blobs = kind === 'cloud'
          ? [
              [78, 70, 42],
              [118, 52, 54],
              [164, 64, 44],
              [194, 76, 30],
            ]
          : [
              [82, 70, 34],
              [124, 62, 42],
              [164, 70, 32],
            ]
        blobs.forEach(([x, y, r]) => {
          const g = ctx.createRadialGradient(x, y, 2, x, y, r)
          g.addColorStop(0, `rgba(255, 239, 204, ${alpha})`)
          g.addColorStop(0.55, `rgba(255, 219, 168, ${alpha * 0.44})`)
          g.addColorStop(1, 'rgba(255, 219, 168, 0)')
          ctx.fillStyle = g
          ctx.fillRect(0, 0, c.width, c.height)
        })
      }

      const texture = track(new THREE.CanvasTexture(c))
      texture.colorSpace = THREE.SRGBColorSpace
      return texture
    }

    const makeLeafTexture = () => {
      const c = document.createElement('canvas')
      c.width = c.height = 256
      const ctx = c.getContext('2d')!
      ctx.clearRect(0, 0, c.width, c.height)

      for (let i = 0; i < 70; i++) {
        const x = 30 + Math.random() * 196
        const y = 28 + Math.random() * 190
        const r = 10 + Math.random() * 22
        const alpha = 0.12 + Math.random() * 0.18
        const g = ctx.createRadialGradient(x, y, 2, x, y, r)
        g.addColorStop(0, `rgba(130, 158, 70, ${alpha})`)
        g.addColorStop(0.55, `rgba(76, 111, 61, ${alpha * 0.65})`)
        g.addColorStop(1, 'rgba(76, 111, 61, 0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.ellipse(x, y, r * 1.2, r * 0.7, Math.random() * Math.PI, 0, Math.PI * 2)
        ctx.fill()
      }

      const texture = track(new THREE.CanvasTexture(c))
      texture.colorSpace = THREE.SRGBColorSpace
      return texture
    }

    const cloudTexture = makeSoftBlobTexture('cloud')
    const mistTexture = makeSoftBlobTexture('mist')
    const sunGlowTexture = makeSoftBlobTexture('sun')
    const leafTexture = makeLeafTexture()

    // helper: a thin extruded cut-paper "card" (slight thickness => crisp folded edge look)
    const makeCard = (w: number, h: number, mat: THREE.Material, thick = 0.06) => {
      const g = track(new THREE.BoxGeometry(w, h, thick))
      const m = new THREE.Mesh(g, mat)
      m.castShadow = true
      m.receiveShadow = true
      return m
    }

    // === GRAFT ② — Theater cut-paper Shape+bevel silhouette builders ==========
    const lannaTemple = () => {
      const s = new THREE.Shape()
      s.moveTo(-2.4, 0)
      s.lineTo(2.4, 0)
      s.lineTo(2.4, 2.2)
      s.lineTo(1.9, 2.2)
      s.lineTo(2.3, 3.0)
      s.lineTo(1.4, 3.0)
      s.lineTo(1.7, 3.7)
      s.lineTo(0.7, 3.7)
      s.lineTo(1.0, 4.4)
      s.lineTo(0.18, 4.4)
      s.lineTo(0.18, 6.0)
      s.lineTo(-0.18, 6.0)
      s.lineTo(-0.18, 4.4)
      s.lineTo(-1.0, 4.4)
      s.lineTo(-0.7, 3.7)
      s.lineTo(-1.7, 3.7)
      s.lineTo(-1.4, 3.0)
      s.lineTo(-2.3, 3.0)
      s.lineTo(-1.9, 2.2)
      s.lineTo(-2.4, 2.2)
      s.closePath()
      return track(
        new THREE.ExtrudeGeometry(s, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1 }),
      )
    }
    const palmTree = () => {
      const s = new THREE.Shape()
      s.moveTo(-0.18, 0)
      s.lineTo(0.18, 0)
      s.lineTo(0.32, 3.4)
      s.lineTo(1.7, 3.0)
      s.lineTo(0.5, 3.8)
      s.lineTo(2.0, 4.4)
      s.lineTo(0.4, 4.2)
      s.lineTo(1.2, 5.4)
      s.lineTo(0.1, 4.4)
      s.lineTo(-0.1, 4.4)
      s.lineTo(-1.2, 5.4)
      s.lineTo(-0.4, 4.2)
      s.lineTo(-2.0, 4.4)
      s.lineTo(-0.5, 3.8)
      s.lineTo(-1.7, 3.0)
      s.lineTo(-0.32, 3.4)
      s.closePath()
      return track(
        new THREE.ExtrudeGeometry(s, { depth: 0.32, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 }),
      )
    }
    const mountainRange = () => {
      const s = new THREE.Shape()
      s.moveTo(-5, 0)
      s.lineTo(-3.2, 3.6)
      s.lineTo(-1.6, 1.6)
      s.lineTo(0.2, 4.6)
      s.lineTo(2.0, 2.0)
      s.lineTo(3.4, 4.0)
      s.lineTo(5, 0)
      s.closePath()
      return track(new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false }))
    }
    const cityRoofs = () => {
      const s = new THREE.Shape()
      s.moveTo(-3.6, 0)
      let x = -3.6
      while (x < 3.6) {
        const h = 1.4 + Math.random() * 1.6
        const w = 0.7 + Math.random() * 0.6
        s.lineTo(x, h)
        s.lineTo(x + w, h)
        x += w
      }
      s.lineTo(3.6, 0)
      s.closePath()
      return track(
        new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 }),
      )
    }
    const archGate = () => {
      const s = new THREE.Shape()
      s.moveTo(-2.4, 0)
      s.lineTo(-2.4, 2.4)
      s.absarc(0, 2.4, 2.4, Math.PI, 0, true)
      s.lineTo(2.4, 0)
      s.lineTo(1.5, 0)
      s.lineTo(1.5, 2.4)
      s.absarc(0, 2.4, 1.5, 0, Math.PI, false)
      s.lineTo(-1.5, 0)
      s.closePath()
      return track(
        new THREE.ExtrudeGeometry(s, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 }),
      )
    }

    const mkSilhouette = (geo: THREE.BufferGeometry, mat: THREE.Material, scale = 1) => {
      const m = new THREE.Mesh(geo, mat)
      m.scale.setScalar(scale)
      m.castShadow = true
      m.receiveShadow = true
      return m
    }

    // =====================================================================
    // THE BOOK
    // =====================================================================
    const book = new THREE.Group()
    scene.add(book)

    const SPREAD_W = 22 // full open-book width (two pages)
    const PAGE_W = SPREAD_W / 2
    const PAGE_D = 15 // depth of a page (front-to-back on the table)

    // hardcover base (slightly larger than pages), lying flat
    const coverGeo = track(new THREE.BoxGeometry(SPREAD_W + 1.2, 0.5, PAGE_D + 1.0))
    const cover = new THREE.Mesh(coverGeo, matCover)
    cover.position.y = -0.3
    cover.receiveShadow = true
    cover.castShadow = true
    book.add(cover)

    // gold edge band around cover
    const bandGeo = track(new THREE.BoxGeometry(SPREAD_W + 1.3, 0.12, PAGE_D + 1.1))
    const band = new THREE.Mesh(bandGeo, matGold)
    band.position.y = -0.02
    book.add(band)

    // two flat pages (left + right) forming the open spread
    const leftPage = makeCard(PAGE_W - 0.15, PAGE_D, matIvory, 0.12)
    leftPage.rotation.x = -Math.PI / 2
    leftPage.position.set(-PAGE_W / 2 - 0.08, 0.0, 0)
    book.add(leftPage)

    const rightPage = makeCard(PAGE_W - 0.15, PAGE_D, matPaper, 0.12)
    rightPage.rotation.x = -Math.PI / 2
    rightPage.position.set(PAGE_W / 2 + 0.08, 0.0, 0)
    book.add(rightPage)

    // center crease (darker valley)
    const crease = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.18, 0.04, PAGE_D)),
      paperMat(0xcbb085, 0.98),
    )
    crease.position.y = 0.04
    book.add(crease)

    // =====================================================================
    // BACKDROP CITY THAT FOLDS UP FROM THE CREASE (the STAR — verticality)
    // GRAFT ②: cut-paper Shape silhouettes; hinge fold-up logic unchanged.
    // each layer is a group hinged at the crease that rotates up to vertical.
    // =====================================================================
    const cityLayers: { grp: THREE.Group; targetRot: number; delay: number }[] = []

    const makeFoldLayer = (z: number, delay: number) => {
      const grp = new THREE.Group()
      // hinge at the crease line: layer starts folded flat (rot = -PI/2) -> stands up (0)
      grp.position.set(0, 0.06, z)
      book.add(grp)
      cityLayers.push({ grp, targetRot: 0, delay })
      return grp
    }

    // -- Layer 0 (far): Doi Suthep mountain range, gold chedi on the peak
    {
      const grp = makeFoldLayer(-5.6, 0.0)
      const farMat = paperMat(0x9fae9b, 0.97)
      const midMat = paperMat(0xb7c3bb, 0.97)
      const m1 = mkSilhouette(mountainRange(), farMat, 1.7)
      m1.position.set(0, 0, -0.1)
      grp.add(m1)
      const m2 = mkSilhouette(mountainRange(), midMat, 1.15)
      m2.position.set(-6.5, 0, 0.15)
      grp.add(m2)
      const m3 = mkSilhouette(mountainRange(), paperMat(0x8f9f8c, 0.97), 1.0)
      m3.position.set(6.2, 0, 0.2)
      grp.add(m3)
      // gold chedi (Wat Phra That Doi Suthep) on the tallest peak (x=0.2*1.7)
      const chedi = new THREE.Mesh(track(new THREE.ConeGeometry(0.5, 1.7, 8)), matGold)
      chedi.position.set(0.34, 4.6 * 1.7 + 0.6, -0.1)
      chedi.castShadow = true
      grp.add(chedi)
    }

    // -- Layer 1: layered Lanna temple silhouettes (gold-finialed), mid-back
    {
      const grp = makeFoldLayer(-2.8, 0.12)
      const bodyMat = paperMat(PAL.cream, 0.95)
      const roofMat = paperMat(PAL.terracotta, 0.9)
      const addTemple = (x: number, scale: number) => {
        const t = new THREE.Group()
        const body = mkSilhouette(lannaTemple(), x === 0 ? bodyMat : roofMat, scale)
        t.add(body)
        // gold finial (chofah) at the spire tip (shape spire reaches y=6)
        const fin = new THREE.Mesh(track(new THREE.ConeGeometry(0.16 * scale, 0.9 * scale, 6)), matGold)
        fin.position.set(0, 6.0 * scale + 0.35 * scale, 0.24 * scale)
        fin.castShadow = true
        t.add(fin)
        t.position.set(x, 0, 0)
        grp.add(t)
      }
      addTemple(-4.6, 0.92)
      addTemple(0, 1.18)
      addTemple(4.7, 0.85)
    }

    // -- Layer 2 (front): Tha Phae arch gate + old-city roofline, gold-trimmed
    {
      const grp = makeFoldLayer(-0.6, 0.24)
      const brickMat = paperMat(PAL.brick, 0.95)
      const sandMat = paperMat(PAL.sand, 0.95)
      // central Tha Phae gate
      const gate = mkSilhouette(archGate(), brickMat, 1.15)
      gate.position.set(0, 0, 0.1)
      grp.add(gate)
      // gold trim bar across the gate base
      const trim = makeCard(5.6, 0.2, matGold, 0.14)
      trim.position.set(0, 0.1, 0.32)
      grp.add(trim)
      // city rooflines flanking the gate
      const leftRoofs = mkSilhouette(cityRoofs(), sandMat, 1.0)
      leftRoofs.position.set(-6.4, 0, -0.05)
      grp.add(leftRoofs)
      const rightRoofs = mkSilhouette(cityRoofs(), sandMat, 0.95)
      rightRoofs.position.set(6.6, 0, -0.05)
      grp.add(rightRoofs)
    }

    // foreground paper palms (stand up too) for depth
    const addPalm = (x: number, z: number, scale: number) => {
      const grp = makeFoldLayer(z, 0.3)
      const palm = mkSilhouette(palmTree(), paperMat(PAL.teal, 0.92), scale)
      grp.add(palm)
      grp.position.x = x
      return grp
    }
    addPalm(-8.8, 1.0, 0.62)
    addPalm(8.9, 1.4, 0.7)
    addPalm(-7.4, 2.6, 0.5)

    // Eric direction: avoid the abstract/blocky city. Keep the fold-up timing
    // but replace the symbolic silhouettes with one realistic miniature Chiang Mai.
    cityLayers.forEach((layer) => {
      layer.grp.visible = false
    })
    const realisticCityLayer = makeFoldLayer(-0.85, 0.02)
    const realisticCity = new THREE.Mesh(
      track(new THREE.PlaneGeometry(24, 13.5)),
      track(
        new THREE.MeshBasicMaterial({
          map: realisticCityTexture,
          transparent: true,
          alphaTest: 0.025,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      ),
    )
    realisticCity.position.set(0, 6.44, 0.08)
    realisticCity.renderOrder = 2
    realisticCityLayer.add(realisticCity)

    const cityVanStartX = -8.05
    const cityVanEndX = 5.85
    const cityVanY = 1.86
    const cityStaticVanY = 2.56
    const cityVanCover = new THREE.Mesh(
      track(new THREE.PlaneGeometry(2.45, 1.02)),
      track(
        new THREE.MeshBasicMaterial({
          color: 0x3a2a1e,
          transparent: true,
          opacity: 0.78,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      ),
    )
    cityVanCover.position.set(cityVanStartX - 0.04, cityStaticVanY - 0.02, 0.115)
    cityVanCover.renderOrder = 5
    realisticCityLayer.add(cityVanCover)

    const cityVanMaterial = track(
      new THREE.MeshBasicMaterial({
        map: cityVanTexture,
        transparent: true,
        alphaTest: 0.025,
        opacity: 0,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      }),
    )
    const cityVan = new THREE.Mesh(track(new THREE.PlaneGeometry(2.74, 1.52)), cityVanMaterial)
    cityVan.position.set(cityVanStartX, cityVanY, 0.14)
    cityVan.renderOrder = 6
    realisticCityLayer.add(cityVan)

    const livingCityGroup = new THREE.Group()
    realisticCityLayer.add(livingCityGroup)

    const makeLivingPlane = (
      texture: THREE.Texture,
      w: number,
      h: number,
      x: number,
      y: number,
      z: number,
      opacity: number,
      blending: THREE.Blending = THREE.NormalBlending,
    ) => {
      const mat = track(
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity,
          depthTest: false,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending,
        }),
      )
      const mesh = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), mat)
      mesh.position.set(x, y, z)
      mesh.renderOrder = 8
      livingCityGroup.add(mesh)
      return { mesh, mat, baseX: x, baseY: y, baseOpacity: opacity }
    }

    const citySunGlow = makeLivingPlane(sunGlowTexture, 4.8, 2.5, 5.15, 7.8, 0.18, 0.5, THREE.AdditiveBlending)
    const cityClouds = [
      makeLivingPlane(cloudTexture, 3.6, 1.35, -6.4, 9.3, 0.21, 0.62),
      makeLivingPlane(cloudTexture, 4.3, 1.55, 0.2, 10.0, 0.22, 0.56),
      makeLivingPlane(cloudTexture, 3.4, 1.25, 6.8, 9.2, 0.21, 0.5),
    ]
    const cityMists = [
      makeLivingPlane(mistTexture, 3.4, 1.45, 7.1, 4.35, 0.24, 0.42, THREE.AdditiveBlending),
      makeLivingPlane(mistTexture, 2.7, 1.15, 8.05, 3.65, 0.25, 0.34, THREE.AdditiveBlending),
    ]
    const cityLeafLayers = [
      makeLivingPlane(leafTexture, 5.2, 2.7, 7.4, 5.5, 0.3, 0.58, THREE.AdditiveBlending),
      makeLivingPlane(leafTexture, 4.2, 2.15, 8.6, 3.55, 0.31, 0.45, THREE.AdditiveBlending),
    ]
    const cityElephant = makeLivingPlane(elephantTexture, 4.8, 2.28, 5.35, 2.2, 0.33, 0.96)
    cityElephant.mesh.renderOrder = 9

    // =====================================================================
    // THE FOLDED PAPER ROAD across the spread + day pop-ups + paper car
    // (structure preserved from Center)
    // =====================================================================
    const roadGroup = new THREE.Group()
    book.add(roadGroup)

    // road: a winding ribbon laid on the page (slight z snaking) made of segments
    const roadPts: THREE.Vector3[] = []
    const segN = 80
    for (let i = 0; i <= segN; i++) {
      const t = i / segN
      const x = THREE.MathUtils.lerp(-9.2, 9.2, t)
      const z = Math.sin(t * Math.PI * 2.15) * 2.15 + 4.35 // keep it on the front half of the page
      roadPts.push(new THREE.Vector3(x, 0.09, z))
    }
    const roadCurve = new THREE.CatmullRomCurve3(roadPts)
    const roadGeo = track(new THREE.TubeGeometry(roadCurve, 120, 0.42, 6, false))
    const road = new THREE.Mesh(roadGeo, paperMat(0xe2cfa9, 0.95))
    road.position.y = 0.02
    road.scale.y = 0.18 // flatten the tube into a ribbon
    road.receiveShadow = true
    road.castShadow = true
    roadGroup.add(road)

    // dashed gold center line
    const dashCount = 26
    for (let i = 0; i < dashCount; i++) {
      const t = (i + 0.5) / dashCount
      const p = roadCurve.getPointAt(t)
      const dash = makeCard(0.32, 0.06, matGold, 0.02)
      dash.rotation.x = -Math.PI / 2
      const tan = roadCurve.getTangentAt(t)
      dash.rotation.z = Math.atan2(tan.z, tan.x)
      dash.position.set(p.x, 0.16, p.z)
      roadGroup.add(dash)
    }

    // day pop-up cards standing along the road
    const dayGroups: {
      grp: THREE.Group
      card: THREE.Mesh
      flag: THREE.Mesh
      diorama: THREE.Mesh
      baseY: number
      t: number
    }[] = []
    const dayCount = Math.max(1, days.length)
    days.forEach((d, i) => {
      const t = days.length === 1 ? 0.5 : (i + 0.5) / dayCount
      const p = roadCurve.getPointAt(Math.min(0.97, Math.max(0.03, t)))
      const grp = new THREE.Group()
      grp.position.set(p.x, 0.05, p.z)
      const accent = KIND_ACCENT[d.items?.[0]?.kind ?? 'activity'] ?? GOLD

      // a little folded "tent" base
      const base = makeCard(1.7, 1.1, matCream, 0.1)
      base.position.set(0, 0.55, 0)
      base.visible = false
      grp.add(base)

      // standing card (the pop-up) — hinged so it can pop higher when active
      const card = makeCard(1.6, 2.2, matPaper, 0.08)
      card.position.set(0, 1.1, -0.05)
      card.visible = false
      grp.add(card)

      // accent band on card
      const accMat = paperMat(accent, 0.6)
      const accBand = makeCard(1.6, 0.4, accMat, 0.09)
      accBand.position.set(0, 2.0, -0.04)
      accBand.visible = false
      grp.add(accBand)

      const diorama = new THREE.Mesh(
        track(new THREE.PlaneGeometry(5.05, 3.38)),
        track(
          new THREE.MeshBasicMaterial({
            map: createDayDioramaTexture(i),
            transparent: true,
            alphaTest: 0.025,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false,
          }),
        ),
      )
      diorama.position.set(0, 1.78, 0.4)
      diorama.renderOrder = 24
      grp.add(diorama)

      // little numbered flag on a pole (gold)
      const pole = makeCard(0.06, 1.2, matGold, 0.06)
      pole.position.set(0.7, 2.4, 0)
      pole.visible = false
      grp.add(pole)
      const flag = new THREE.Mesh(track(new THREE.PlaneGeometry(0.7, 0.45)), accMat)
      flag.position.set(1.05, 2.8, 0)
      flag.castShadow = true
      flag.visible = false
      grp.add(flag)

      roadGroup.add(grp)
      dayGroups.push({ grp, card, flag, diorama, baseY: 0.05, t })
    })

    // paper car that travels the road
    const car = new THREE.Group()
    const vanBodyMat = paperMat(0xf2eee6, 0.58, 0.015)
    const vanWindowMat = paperMat(0x23343a, 0.5, 0.01)
    const carBody = makeCard(1.12, 0.48, vanBodyMat, 0.56)
    carBody.position.y = 0.3
    carBody.visible = false
    car.add(carBody)
    const carTop = makeCard(0.64, 0.28, vanWindowMat, 0.58)
    carTop.position.set(-0.08, 0.62, 0)
    carTop.visible = false
    car.add(carTop)
    const carNose = makeCard(0.28, 0.28, vanBodyMat, 0.5)
    carNose.position.set(0.67, 0.24, 0)
    carNose.visible = false
    car.add(carNose)
    const vanSprite = new THREE.Mesh(
      track(new THREE.PlaneGeometry(2.9, 1.62)),
      track(
        new THREE.MeshBasicMaterial({
          map: vanTexture,
          transparent: true,
          alphaTest: 0.025,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
        }),
      ),
    )
    vanSprite.position.set(0, 0.72, 0.18)
    vanSprite.renderOrder = 28
    car.add(vanSprite)
    const carShadow = new THREE.Mesh(
      track(new THREE.CircleGeometry(0.85, 28)),
      track(new THREE.MeshBasicMaterial({ color: 0x1d140c, transparent: true, opacity: 0.18, depthWrite: false })),
    )
    carShadow.rotation.x = -Math.PI / 2
    carShadow.scale.set(1.55, 0.52, 1)
    carShadow.position.y = 0.03
    car.add(carShadow)
    const wheelGeo = track(new THREE.CylinderGeometry(0.16, 0.16, 0.56, 12))
    const wheelMat = paperMat(0x3a322a, 0.8)
    ;[-0.32, 0.32].forEach((wx) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat)
      w.rotation.x = Math.PI / 2
      w.position.set(wx, 0.16, 0)
      w.castShadow = true
      w.visible = false
      car.add(w)
    })
    // tiny gold roof beacon
    const beacon = new THREE.Mesh(track(new THREE.SphereGeometry(0.1, 8, 8)), matGold)
    beacon.position.set(-0.05, 0.92, 0)
    beacon.visible = false
    car.add(beacon)
    car.scale.setScalar(1.08)
    car.visible = false
    roadGroup.add(car)

    // =====================================================================
    // THE ESTIMATE — final right-hand page that UNFOLDS upright.
    // GRAFT ③: gold-header + gold-frame + wax-seal 精裝信 (hardcover letter).
    // =====================================================================
    const estimateGroup = new THREE.Group()
    // hinge along the right edge of the right page, folds up from flat
    estimateGroup.position.set(PAGE_W - 0.4, 0.12, 4.5)
    book.add(estimateGroup)

    const letter = makeCard(6.4, 8.4, matPaper, 0.14)
    letter.position.set(-3.2, 4.2, 0) // pivot at right edge bottom
    estimateGroup.add(letter)
    // gold header bar
    const letterHead = makeCard(6.4, 0.7, matGold, 0.15)
    letterHead.position.set(-3.2, 7.9, 0.03)
    estimateGroup.add(letterHead)
    // gold frame border (hardcover-letter feel) — four thin bars inset from edges
    const frameBar = (w: number, h: number, x: number, y: number) => {
      const b = makeCard(w, h, matGold, 0.06)
      b.position.set(x, y, 0.05)
      estimateGroup.add(b)
    }
    frameBar(5.8, 0.12, -3.2, 7.0) // under header
    frameBar(5.8, 0.12, -3.2, 0.7) // bottom
    frameBar(0.12, 6.4, -5.9, 3.85) // left
    frameBar(0.12, 6.4, -0.5, 3.85) // right
    // wax-seal style dot
    const seal = new THREE.Mesh(track(new THREE.CircleGeometry(0.5, 24)), paperMat(PAL.terracotta, 0.5, 0.02))
    seal.position.set(-3.2, 1.5, 0.1)
    estimateGroup.add(seal)
    const sealRing = new THREE.Mesh(track(new THREE.RingGeometry(0.5, 0.62, 24)), matGold)
    sealRing.position.set(-3.2, 1.5, 0.09)
    estimateGroup.add(sealRing)
    estimateGroup.rotation.x = -Math.PI / 2 // start folded flat on the page
    // =====================================================================
    // CAMERA RIG — desktop keeps the open-book spread; mobile turns the
    // route into a portrait corridor so the road reads top-to-bottom.
    // =====================================================================
    let portraitLayout = false
    const applySceneLayout = (mobile: boolean) => {
      portraitLayout = mobile
      if (mobile) {
        book.rotation.y = -0.04
        book.position.set(0, -0.45, 0.55)
        book.scale.setScalar(1.08)

        // Rotate the road so Day 1 starts near the thumb and later days recede
        // upward into the city. This removes the empty horizontal spread on phones.
        roadGroup.rotation.y = Math.PI / 2
        roadGroup.position.set(-3.35, 0, 0.4)
        roadGroup.scale.setScalar(0.78)
        car.scale.setScalar(0.78)
        dayGroups.forEach((dg) => {
          dg.grp.rotation.y = -Math.PI / 2
        })

        realisticCityLayer.position.set(0, 0.06, 0.3)
        realisticCityLayer.scale.setScalar(1.14)
        realisticCityLayer.visible = false
        cityVan.visible = false
        cityVanCover.visible = false
        estimateGroup.position.set(4.7, 0.12, -5.2)
      } else {
        book.rotation.y = -0.18
        book.position.set(0, 0, 0)
        book.scale.setScalar(1)

        roadGroup.rotation.y = 0
        roadGroup.position.set(0, 0, 0)
        roadGroup.scale.setScalar(1)
        car.scale.setScalar(1.08)
        dayGroups.forEach((dg) => {
          dg.grp.rotation.y = 0
        })

          realisticCityLayer.position.set(0, 0.06, -0.55)
          realisticCityLayer.scale.setScalar(1)
          realisticCityLayer.visible = true
          cityVan.visible = false
          cityVanCover.visible = false
          estimateGroup.position.set(PAGE_W - 0.4, 0.12, 4.5)
      }
    }
    applySceneLayout(false)

    const camTarget = new THREE.Vector3(0, 3.2, 1)
    const camPos = new THREE.Vector3(-14, 9, 20)
    camera.position.copy(camPos)
    camera.lookAt(camTarget)

    // camera "stations" per day + final estimate station
    const cityOverviewStation = () => {
      return {
        pos: new THREE.Vector3(0, 8.4, 12.4),
        look: new THREE.Vector3(0, 5.4, -0.6),
      }
    }
    const dayStation = (i: number) => {
      const dg = dayGroups[i]
      if (!dg) return { pos: new THREE.Vector3(-13, 9, 19), look: camTarget.clone() }
      const wp = new THREE.Vector3()
      dg.grp.getWorldPosition(wp)
      if (portraitLayout) {
        return {
          pos: new THREE.Vector3(wp.x, 7.2, wp.z + 7.4),
          look: new THREE.Vector3(wp.x, 2.7, wp.z - 1.0),
        }
      }
      return {
        pos: new THREE.Vector3(wp.x - 5.5, 6.8, wp.z + 13.5),
        look: new THREE.Vector3(wp.x, 3.0, wp.z - 2),
      }
    }
    const estimateStation = () => {
      const wp = new THREE.Vector3()
      estimateGroup.getWorldPosition(wp)
      if (portraitLayout) {
        return {
          pos: new THREE.Vector3(wp.x, 7.3, wp.z + 8.2),
          look: new THREE.Vector3(wp.x - 2.8, 4.3, wp.z),
        }
      }
      return {
        pos: new THREE.Vector3(wp.x - 6.5, 6.5, wp.z + 14),
        look: new THREE.Vector3(wp.x - 3.2, 4.5, wp.z),
      }
    }

    // ---- intro + scroll-driven dolly timeline ----
    const clock = new THREE.Clock()
    let firstFrame = true
    const STATIONS = days.length + 1 // +1 estimate
    let dollyT = -1
    let scrollTarget = -1
    let carT = days.length ? dayGroups[0]?.t ?? 0.06 : 0.06
    const tmpPos = new THREE.Vector3()
    const tmpLook = new THREE.Vector3()
    const clampDolly = (value: number) => THREE.MathUtils.clamp(value, -1, STATIONS - 1)

    // ---- responsive ----
    let hasSizedOnce = false
    const applySize = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setSize(w, h, false)
      const mobile = w < 720
      applySceneLayout(mobile)
      camera.fov = mobile ? 48 : 42
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      dollyT = clampDolly(hasSizedOnce ? dollyT : -1)
      scrollTarget = clampDolly(hasSizedOnce ? scrollTarget : dollyT)
      if (!hasSizedOnce) {
        const initial = cityOverviewStation()
        camera.position.copy(initial.pos)
        camera.lookAt(initial.look)
        hasSizedOnce = true
      }
    }
    applySize()
    const ro = new ResizeObserver(applySize)
    ro.observe(mount)

    const animate = () => {
      if (disposed) return
      requestAnimationFrame(animate)
      const elapsed = clock.getElapsedTime()

      // 1) fold-up the city layers (sequential, ease-out)
      cityLayers.forEach((L) => {
        const local = Math.max(0, elapsed - 0.5 - L.delay * 6)
        const k = Math.min(1, local / 2.0)
        const eased = 1 - Math.pow(1 - k, 3)
        // start laid down (-PI/2) -> stand vertical (0)
        L.grp.rotation.x = (-Math.PI / 2) * (1 - eased)
      })

      // 2) day pop-ups rise sequentially after the city
      dayGroups.forEach((dg, i) => {
        const local = Math.max(0, elapsed - 2.4 - i * 0.45)
        const k = Math.min(1, local / 1.1)
        const eased = 1 - Math.pow(1 - k, 3)
        const hasActiveDay = !portraitLayout || dollyT >= -0.12
        const activeCandidate = Math.max(
          0,
          Math.min(days.length - 1, Math.round(dollyT)),
        )
        const isActive = hasActiveDay && i === activeCandidate
        dg.diorama.visible = !portraitLayout || isActive
        const lift = isActive ? 0.9 : 0
        dg.grp.position.y = dg.baseY - 2.4 * (1 - eased) + lift
        dg.grp.scale.setScalar(0.0001 + eased)
        // active day brighter/taller
        const targetScaleY = isActive ? 1.12 : 1.0
        dg.card.scale.y += (targetScaleY - dg.card.scale.y) * 0.12
        const targetDioramaScale = isActive ? (portraitLayout ? 1.32 : 1.08) : 0.86
        dg.diorama.scale.x += (targetDioramaScale - dg.diorama.scale.x) * 0.1
        dg.diorama.scale.y += (targetDioramaScale - dg.diorama.scale.y) * 0.1
        // gentle flag flutter
        dg.flag.rotation.y = Math.sin(elapsed * 3 + i) * 0.3
      })

      // 3) scroll-driven dolly: the scene moves only while the user scrolls.
      dollyT += (scrollTarget - dollyT) * 0.08

      // resolve current + next station for smooth interpolation
      const seg = Math.floor(dollyT)
      const frac = dollyT - seg
      const stationAt = (idx: number) => {
        if (idx < 0) return cityOverviewStation()
        return idx >= days.length ? estimateStation() : dayStation(idx)
      }
      const a = stationAt(Math.min(seg, STATIONS - 1))
      const b = stationAt(Math.min(seg + 1, STATIONS - 1))
      tmpPos.copy(a.pos).lerp(b.pos, frac)
      tmpLook.copy(a.look).lerp(b.look, frac)

      // subtle idle float on top of station
      tmpPos.x += Math.sin(elapsed * 0.4) * 0.6
      tmpPos.y += Math.sin(elapsed * 0.33) * 0.35

      camera.position.lerp(tmpPos, 0.045)
      camera.lookAt(tmpLook)

      // 4) car travels the road, easing toward the active day's t
      {
        // Hero-only motion: the car is just a small sign of life in the city,
        // not the navigation model for the whole quote page.
        const targetT = 0.04 + ((elapsed * 0.035) % 0.88)
        carT = targetT
        const nt = Math.min(0.99, Math.max(0.01, carT))
        car.userData.t = nt
        const cp = roadCurve.getPointAt(nt)
        const ctan = roadCurve.getTangentAt(nt)
        car.position.set(cp.x, 0.34, cp.z)
        if (portraitLayout) {
          car.rotation.y = 0
          vanSprite.lookAt(camera.position)
          vanSprite.scale.x = 1
        } else {
          car.rotation.y = -Math.atan2(ctan.z, ctan.x)
          vanSprite.rotation.set(0, 0, 0)
          vanSprite.scale.x = 1
        }
        if (portraitLayout) {
          car.position.y += 0.08
        }
        car.position.y += Math.abs(Math.sin(elapsed * 6)) * 0.04
      }

      {
        const cycle = (elapsed % 26) / 26
        const forward = cycle < 0.5
        const local = forward ? cycle / 0.48 : (cycle - 0.52) / 0.48
        const eased = 0.5 - Math.cos(THREE.MathUtils.clamp(local, 0, 1) * Math.PI) / 2
        const start = forward ? cityVanStartX : cityVanEndX
        const end = forward ? cityVanEndX : cityVanStartX
        const fadeInEnd = forward ? 0.08 : 0.6
        const fadeOutStart = forward ? 0.42 : 0.92
        const fadeWindowStart = forward ? 0 : 0.52
        const fadeWindowEnd = forward ? 0.48 : 1

        let opacity = 1
        if (cycle < fadeInEnd && cycle >= fadeWindowStart) {
          opacity = (cycle - fadeWindowStart) / (fadeInEnd - fadeWindowStart)
        } else if (cycle > fadeOutStart && cycle <= fadeWindowEnd) {
          opacity = (fadeWindowEnd - cycle) / (fadeWindowEnd - fadeOutStart)
        } else if (cycle >= 0.48 && cycle <= 0.52) {
          opacity = 0
        }

        cityVan.position.x = THREE.MathUtils.lerp(start, end, eased)
        cityVan.scale.x = forward ? 1 : -1
        cityVanMaterial.opacity = THREE.MathUtils.clamp(opacity, 0, 1)
      }

      {
        const sunBreath = 1 + Math.sin(elapsed * 0.65) * 0.055
        citySunGlow.mesh.scale.set(sunBreath, sunBreath, 1)
        citySunGlow.mat.opacity = citySunGlow.baseOpacity + Math.sin(elapsed * 0.65) * 0.08

        cityClouds.forEach((cloud, i) => {
          cloud.mesh.position.x = cloud.baseX + Math.sin(elapsed * (0.3 + i * 0.04) + i * 1.7) * (0.52 + i * 0.12)
          cloud.mesh.position.y = cloud.baseY + Math.sin(elapsed * 0.22 + i) * 0.13
          cloud.mat.opacity = cloud.baseOpacity + Math.sin(elapsed * 0.32 + i) * 0.09
        })

        cityMists.forEach((mist, i) => {
          mist.mesh.position.y = mist.baseY + Math.sin(elapsed * (0.52 + i * 0.1) + i) * 0.28
          mist.mesh.position.x = mist.baseX + Math.sin(elapsed * 0.34 + i * 2) * 0.2
          mist.mat.opacity = mist.baseOpacity + Math.sin(elapsed * 0.7 + i) * 0.12
        })

        cityLeafLayers.forEach((leaf, i) => {
          leaf.mesh.position.x = leaf.baseX + Math.sin(elapsed * (1.15 + i * 0.22) + i) * 0.34
          leaf.mesh.position.y = leaf.baseY + Math.cos(elapsed * (0.9 + i * 0.16) + i) * 0.14
          leaf.mesh.rotation.z = Math.sin(elapsed * (0.9 + i * 0.16) + i) * 0.09
          leaf.mat.opacity = leaf.baseOpacity + Math.sin(elapsed * 1.25 + i) * 0.13
        })

        const elephantBreath = 1 + Math.sin(elapsed * 1.05) * 0.052
        cityElephant.mesh.scale.set(elephantBreath, elephantBreath, 1)
        cityElephant.mesh.position.x = cityElephant.baseX + Math.sin(elapsed * 0.42) * 0.42
        cityElephant.mesh.position.y = cityElephant.baseY + Math.sin(elapsed * 0.82) * 0.13
      }

      // 5) estimate page unfolds when we reach the final station
      {
        const reveal = THREE.MathUtils.clamp((dollyT - (days.length - 0.6)) / 0.8, 0, 1)
        const eased = 1 - Math.pow(1 - reveal, 3)
        estimateGroup.rotation.x = (-Math.PI / 2) * (1 - eased)
        estimateGroup.visible = !portraitLayout || reveal > 0.08
      }

      renderer.render(scene, camera)

      if (firstFrame) {
        firstFrame = false
        canvas.setAttribute('data-scene-ready', 'true')
        setReady(true)
      }
    }
    animate()

    // ---- cleanup ----
    return () => {
      disposed = true
      ro.disconnect()
      disposables.forEach((d) => {
        try {
          d.dispose()
        } catch {
          /* noop */
        }
      })
      scene.traverse((obj) => {
        const m = obj as THREE.Mesh
        if (m.geometry) m.geometry.dispose?.()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose?.())
        else mat?.dispose?.()
      })
      renderer.dispose()
      if (canvas.parentNode === mount) mount.removeChild(canvas)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length])

  const { client, trip } = parseQuoteName(quote.name)
  const title = quote.isSample
    ? `清邁親子\n${quote.tripDays}天${quote.tripNights}夜經典套餐`
    : trip.replace(/(\d+天\d+夜)/, '\n$1')
  const subtitle =
    quote.travelerLabel ||
    (quote.children > 0 ? `${quote.adults}大${quote.children}小` : `${quote.adults} 位貴賓`)
  const clientName = quote.isSample ? null : client

  return (
    <>
      <section
        ref={stageRef}
        data-testid="quote-3d-stage"
        className="relative h-[100svh] min-h-[640px] w-full overflow-hidden bg-[#241a10] font-sans text-[#f6efe2]"
      >
      <style>{`
        @keyframes quoteCityPan {
          0%, 12% {
            transform: translateX(0) scale(1);
            filter: saturate(1.04) brightness(1);
          }
          50% {
            transform: translateX(-23%) scale(1.018);
            filter: saturate(1.12) brightness(1.06);
          }
          88%, 100% {
            transform: translateX(-46%) scale(1);
            filter: saturate(1.05) brightness(1.01);
          }
        }

        @keyframes quoteCityLight {
          0%, 100% {
            opacity: 0.26;
            transform: translateX(-18%) scaleX(0.8);
          }
          50% {
            opacity: 0.42;
            transform: translateX(22%) scaleX(1);
          }
        }

        @keyframes quoteSunBreath {
          0%, 100% {
            opacity: 0.28;
            transform: scale(0.94);
          }
          50% {
            opacity: 0.48;
            transform: scale(1.08);
          }
        }

        @keyframes quoteHeroSunGlow {
          0%, 100% {
            opacity: 0.12;
            transform: translate3d(0, 0, 0) scale(0.96);
          }
          50% {
            opacity: 0.3;
            transform: translate3d(-2vw, 1vh, 0) scale(1.08);
          }
        }

        @keyframes quotePigeonFlight {
          0%, 100% {
            transform: translate3d(0, 0, 0) rotate(-4deg);
            opacity: 0.32;
          }
          18% {
            opacity: 0.62;
          }
          52% {
            transform: translate3d(var(--pigeon-x), var(--pigeon-y), 0) rotate(7deg);
            opacity: 0.72;
          }
          82% {
            opacity: 0.45;
          }
        }

        @keyframes quotePigeonFlap {
          0%, 100% {
            transform: scaleY(0.72);
          }
          50% {
            transform: scaleY(1.08);
          }
        }

        .quote-pigeon {
          left: var(--pigeon-mobile-x);
          top: var(--pigeon-mobile-y);
          width: var(--pigeon-size);
          animation: quotePigeonFlight var(--pigeon-duration) ease-in-out infinite;
          animation-delay: var(--pigeon-delay);
        }

        .quote-pigeon svg {
          display: block;
          width: 100%;
          height: auto;
          transform-origin: 50% 50%;
          animation: quotePigeonFlap 0.72s ease-in-out infinite;
          animation-delay: var(--pigeon-delay);
        }

        @media (min-width: 640px) {
          .quote-pigeon {
            left: var(--pigeon-desktop-x);
            top: var(--pigeon-desktop-y);
          }
        }

        @keyframes quoteCloudDrift {
          0%, 100% {
            transform: translate3d(-4%, 0, 0) scale(0.96);
            opacity: 0.45;
          }
          50% {
            transform: translate3d(8%, -4%, 0) scale(1.04);
            opacity: 0.66;
          }
        }

        @keyframes quoteMistRise {
          0%, 100% {
            transform: translate3d(0, 8%, 0) scale(0.95);
            opacity: 0.18;
          }
          50% {
            transform: translate3d(8%, -8%, 0) scale(1.08);
            opacity: 0.38;
          }
        }

        @keyframes quoteLeafSway {
          0%, 100% {
            transform: translate3d(-1%, 1%, 0) rotate(-1deg) scale(0.98);
            opacity: 0.34;
          }
          45% {
            transform: translate3d(4%, -3%, 0) rotate(2.1deg) scale(1.06);
            opacity: 0.58;
          }
        }

        @keyframes quoteElephantWalk {
          0%, 100% {
            transform: translate3d(-2%, 0, 0) scale(1);
          }
          50% {
            transform: translate3d(4%, -2%, 0) scale(1.045);
          }
        }

        @keyframes quoteElephantTrunk {
          0%, 100% {
            transform: rotate(10deg) translateY(0);
          }
          50% {
            transform: rotate(-8deg) translateY(8%);
          }
        }

        @keyframes quoteBookVanDrive {
          0% {
            opacity: 0;
            transform: translateX(0) scaleX(1);
          }
          8%, 42% {
            opacity: 1;
          }
          48% {
            opacity: 0;
            transform: translateX(var(--drive-distance)) scaleX(1);
          }
          52% {
            opacity: 0;
            transform: translateX(var(--drive-distance)) scaleX(-1);
          }
          60%, 92% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateX(0) scaleX(-1);
          }
        }

      `}</style>

      {/* 3D mount */}
      <div ref={mountRef} className="absolute inset-0 hidden sm:block" aria-hidden />

      {/* Mobile-first hero art: portrait Tha Phae Gate city + open-book foreground. */}
      <div
        data-testid="quote-3d-mobile-city-prologue"
        className="pointer-events-none absolute inset-0 z-[6] overflow-hidden sm:hidden"
        aria-hidden
      >
        <div className="absolute inset-0">
          <Image
            src={MOBILE_CITY_SCENE}
            alt=""
            fill
            priority
            quality={100}
            unoptimized
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#3a210f]/18 via-transparent to-[#160f08]/34" />
          <div className="absolute inset-x-0 top-0 h-[22vh] bg-gradient-to-b from-[#8b551f]/42 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[42vh] bg-gradient-to-b from-transparent via-[#2d1b0b]/8 to-[#160f08]/46" />
          <div className="absolute inset-x-[-12%] bottom-[1vh] z-[6] h-[15vh] rounded-t-[58%] border-t border-[#fff0c7]/35 bg-gradient-to-b from-[#f6dfad]/10 to-transparent mix-blend-screen" />
          <div className="absolute inset-x-[8%] bottom-[14vh] z-[7] h-[2px] bg-gradient-to-r from-transparent via-[#f4d99c]/70 to-transparent opacity-80" />
        </div>
      </div>

      <div
        data-testid="quote-hero-sun-glow"
        className="pointer-events-none absolute right-[-22vw] top-[7vh] z-[9] h-[42vh] w-[42vh] rounded-full sm:right-[4vw] sm:top-[7vh] sm:h-[34vh] sm:w-[34vh]"
        style={{
          background:
            'radial-gradient(circle, rgba(255,241,176,0.48) 0%, rgba(255,194,76,0.22) 34%, rgba(255,178,64,0.08) 54%, transparent 74%)',
          mixBlendMode: 'screen',
          animation: 'quoteHeroSunGlow 8.5s ease-in-out infinite',
        }}
      />

      <div
        data-testid="quote-pigeon-flock"
        className="pointer-events-none absolute inset-0 z-[12]"
        aria-hidden
      >
        {PIGEON_FLOCK.map((pigeon, index) => (
          <span
            key={`${pigeon.mx}-${pigeon.my}`}
            className="quote-pigeon absolute text-[#f4ead8] drop-shadow-[0_2px_4px_rgba(32,19,8,0.45)]"
            style={
              {
                '--pigeon-mobile-x': pigeon.mx,
                '--pigeon-mobile-y': pigeon.my,
                '--pigeon-desktop-x': pigeon.dx,
                '--pigeon-desktop-y': pigeon.dy,
                '--pigeon-size': `${pigeon.size}px`,
                '--pigeon-delay': pigeon.delay,
                '--pigeon-duration': pigeon.duration,
                '--pigeon-x': pigeon.travelX,
                '--pigeon-y': pigeon.travelY,
              } as CSSProperties
            }
          >
            <svg viewBox="0 0 48 22" role="presentation" focusable="false">
              <path
                d={
                  index % 2 === 0
                    ? 'M2 14 C9 6 15 5 22 13 C29 5 37 6 46 14 C37 11 31 13 24 18 C18 13 11 11 2 14 Z'
                    : 'M3 11 C11 2 18 6 23 13 C29 6 38 3 45 12 C36 11 31 15 24 19 C18 15 11 11 3 11 Z'
                }
                fill="currentColor"
                opacity="0.88"
              />
            </svg>
          </span>
        ))}
      </div>

      {/* Production QuoteHero readability layers, now over the 3D city. */}
      <div
        className="pointer-events-none absolute inset-0 z-[5]"
        style={{
          background:
            'linear-gradient(180deg, rgba(11,10,8,0.28) 0%, rgba(11,10,8,0.08) 28%, rgba(11,10,8,0.16) 56%, rgba(11,10,8,0.58) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute -left-20 -top-20 z-[6] h-[520px] w-[520px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,215,0,0.14) 0%, transparent 70%)' }}
      />
        <div
          className="pointer-events-none absolute inset-0 z-[7] mix-blend-overlay"
          style={{
            opacity: 0.12,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '3px 3px',
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[8] hidden h-[14vh] bg-gradient-to-b from-transparent via-[#241a10]/58 to-[#120d08] sm:block" />

      <div className="relative z-20 mx-auto h-full max-w-5xl px-6 md:px-10">
        <div className="absolute inset-x-0 top-[5.2vh] flex flex-col items-center px-6 sm:top-[3.6vh]">
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease }}
        >
          <Image
            src="/images/logo.png"
            alt="清微旅行"
            width={140}
            height={140}
            className="h-[96px] w-[96px] rounded-[23px] object-contain p-2 md:h-[112px] md:w-[112px]"
            style={{
              background: 'transparent',
              filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))',
            }}
          />
        </motion.div>

        <motion.div
          className="mt-2.5 text-center md:mt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
        >
          <div
            className="text-[23px] font-black tracking-[0.1em] md:text-[27px]"
            style={{
              color: '#FDFCF0',
              fontFamily: 'var(--font-display, serif)',
              textShadow: '0 2px 14px rgba(0,0,0,0.55)',
            }}
          >
            清微旅行
          </div>
          <div
            className="mt-1.5 text-[13px] font-bold tracking-[0.15em] md:mt-2 md:text-[15px]"
            style={{ color: '#FFD700' }}
          >
            爸媽開的清邁親子包車
          </div>
        </motion.div>
        </div>

        <div className="absolute inset-x-0 bottom-[max(3.05rem,env(safe-area-inset-bottom))] flex flex-col items-center px-6 sm:bottom-[13vh]">
        <motion.div
          className="mx-auto mb-3 h-[2px] w-14 rounded-full md:mb-8 md:w-16"
          style={{ background: 'rgba(255,215,0,0.5)' }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        />

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.9, ease }}
          className="whitespace-pre-line text-center font-black leading-[1.04]"
          style={{
            fontSize: 'clamp(31px, 8vw, 76px)',
            letterSpacing: '0.04em',
            fontFamily: 'var(--font-display, serif)',
            background: 'linear-gradient(180deg, #FDFCF0 0%, #F7EFD3 55%, #E8D9A7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter:
              'drop-shadow(0 1px 0 rgba(0,0,0,0.35)) drop-shadow(0 6px 18px rgba(0,0,0,0.55))',
          }}
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5, ease }}
          className="mt-1.5 text-center text-[15px] font-medium tracking-[0.05em] md:mt-5 md:text-[18px]"
          style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.75 }}
        >
          {subtitle}
        </motion.p>

        {!quote.isSample && clientName && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.75, duration: 0.5, ease }}
            className="mt-6 inline-flex items-center gap-2.5 rounded-full px-5 py-2.5"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.11), rgba(255,215,0,0.08))',
              backdropFilter: 'blur(20px) saturate(1.4)',
              WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
              border: '1px solid rgba(255,215,0,0.45)',
              boxShadow: '0 8px 26px rgba(0,0,0,0.3)',
            }}
          >
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px]"
              style={{
                background: 'linear-gradient(135deg, #FFE98A, #FFD700, #C9A227)',
                boxShadow: '0 0 14px rgba(255,215,0,0.4)',
              }}
            >
              ✦
            </span>
            <span
              className="text-[15px] font-black tracking-[0.08em]"
              style={{
                fontFamily: 'var(--font-display, serif)',
                background: 'linear-gradient(135deg, #FFF4B8, #FFE07A, #FFD700, #D9A520)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter:
                  'drop-shadow(0 0 6px rgba(255,215,0,0.55)) drop-shadow(0 1px 0 rgba(90,60,10,0.55))',
              }}
            >
              {clientName} 專屬行程
            </span>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5, ease }}
          className="mt-3 flex w-full max-w-[360px] flex-col gap-2.5 sm:mt-7 sm:max-w-none sm:flex-row sm:justify-center"
        >
          <button
            type="button"
            onClick={() => scrollToSection('itinerary')}
              className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-black tracking-[0.08em] transition-transform hover:scale-[1.03] active:scale-95 sm:py-3"
            style={{
              background: 'rgba(253, 251, 244, 0.92)',
              color: '#0F0B05',
              border: '1px solid rgba(255,255,255,0.5)',
              boxShadow: '0 14px 34px rgba(0,0,0,0.28)',
            }}
          >
            <CalendarDays size={17} strokeWidth={2.4} />
            查看行程
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('quote-pricing')}
              className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-[14px] font-black tracking-[0.08em] transition-transform hover:scale-[1.03] active:scale-95 sm:py-3"
            style={{
              background: 'linear-gradient(135deg, #FACC15, #F59E0B)',
              color: '#0F0B05',
              boxShadow: '0 14px 34px rgba(250,204,21,0.34), 0 6px 16px rgba(0,0,0,0.22)',
            }}
          >
            <ReceiptText size={17} strokeWidth={2.4} />
            查看報價
          </button>
        </motion.div>
        </div>
      </div>

      {/* ---- loading veil ---- */}
      {!ready && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#241a10]">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#e6c879] border-t-transparent" />
            <p className="font-serif text-sm tracking-widest text-[#ead3a8]">
              正在翻開清邁立體書…
            </p>
          </div>
        </div>
      )}
      </section>

      <QuoteItinerary quote={quote} />
      <QuoteCostDashboard quote={quote} />
      <QuoteFooter isSample={quote.isSample} />
    </>
  )
}

export default PopupHybrid
