import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas'
import path from 'path'
import type { StoryboardShot, VideoMeta } from '@/types'

const WIDTH = 1080
const HEIGHT = 1920
const FONT_FAMILY = 'KidsCaption'

let fontRegistered = false
function ensureFont() {
  if (fontRegistered) return
  GlobalFonts.registerFromPath(path.join(process.cwd(), 'src/assets/fonts/ComicNeue-Bold.ttf'), FONT_FAMILY)
  fontRegistered = true
}

function parseGradient(bg: string | undefined): { angle: number; colors: string[] } {
  const fallback = { angle: 135, colors: ['#1a0a2e', '#2d1b4e'] }
  if (!bg) return fallback
  const match = bg.match(/linear-gradient\(\s*([\d.]+)deg\s*,(.+)\)/)
  if (!match) return fallback
  const colors = match[2].split(',').map(c => c.trim()).filter(Boolean)
  return colors.length >= 2 ? { angle: Number(match[1]), colors } : fallback
}

function timeToSec(t: string): number {
  const [m, s] = t.split(':').map(Number)
  return m * 60 + (s || 0)
}

// Picks the subtitle lines whose timestamp falls within this shot's time range.
export function captionForShot(shot: StoryboardShot, videoMeta: VideoMeta): string {
  const [startStr, endStr] = shot.timestamp.split('-')
  const start = timeToSec(startStr)
  const end = timeToSec(endStr)
  return videoMeta.subtitles
    .filter(s => { const t = timeToSec(s.time); return t >= start && t < end })
    .map(s => s.text)
    .join(' ')
}

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

// Deterministic PRNG so each shot gets a stable but varied decoration pattern.
function mulberry32(seed: number) {
  let s = seed
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Renders a single 9:16 still frame for a storyboard shot: gradient
// background (matching the shot's `bg`), soft floating circles for visual
// interest, and a caption box with the shot's subtitle text.
export function renderShotFrame(shot: StoryboardShot, caption: string, seed: number): Buffer {
  ensureFont()
  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')

  const { angle, colors } = parseGradient(shot.bg)
  const rad = (angle * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = -Math.cos(rad)
  const len = Math.max(WIDTH, HEIGHT)
  const cx = WIDTH / 2
  const cy = HEIGHT / 2
  const gradient = ctx.createLinearGradient(
    cx - (dx * len) / 2, cy - (dy * len) / 2,
    cx + (dx * len) / 2, cy + (dy * len) / 2
  )
  colors.forEach((c, i) => gradient.addColorStop(i / (colors.length - 1), c))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  const rand = mulberry32(seed + 1)
  for (let i = 0; i < 8; i++) {
    const r = 40 + rand() * 160
    ctx.beginPath()
    ctx.arc(rand() * WIDTH, rand() * HEIGHT, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255,255,255,${0.04 + rand() * 0.08})`
    ctx.fill()
  }

  if (caption) {
    ctx.font = `64px ${FONT_FAMILY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const lines = wrapText(ctx, caption, WIDTH - 140)
    const lineHeight = 84
    const boxHeight = lines.length * lineHeight + 60
    const boxY = HEIGHT - boxHeight - 140

    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    roundRect(ctx, 50, boxY, WIDTH - 100, boxHeight, 28)
    ctx.fill()

    ctx.fillStyle = '#ffffff'
    lines.forEach((line, i) => {
      ctx.fillText(line, WIDTH / 2, boxY + 30 + lineHeight * i + lineHeight / 2)
    })
  }

  return canvas.toBuffer('image/png')
}
