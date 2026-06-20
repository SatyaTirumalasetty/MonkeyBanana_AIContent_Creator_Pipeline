import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { join } from 'path'

const SHOTS_DIR = 'C:\\My_World\\Projects\\kids-studio\\verify-shots'
mkdirSync(SHOTS_DIR, { recursive: true })

const shot = async (page, name) => {
  const p = join(SHOTS_DIR, `${name}.png`)
  await page.screenshot({ path: p, fullPage: false })
  console.log(`[shot] ${name}.png`)
  return p
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.setViewportSize({ width: 1280, height: 900 })

console.log('--- Opening https://kids-studio-beta.vercel.app ...')
await page.goto('https://kids-studio-beta.vercel.app', { waitUntil: 'networkidle' })
await shot(page, '01-initial-load')

const title = await page.title()
console.log('[title]', title)

const h1 = await page.locator('h1, h2').first().textContent().catch(() => 'n/a')
console.log('[heading]', h1)

// Check if a cached result is already shown (localStorage)
const hasCached = await page.evaluate(() => !!localStorage.getItem('ai_studio_result_v2'))
console.log('[cache]', hasCached ? 'cached result present' : 'no cache')

// If cached, clear it so we test a fresh run
if (hasCached) {
  await page.evaluate(() => localStorage.removeItem('ai_studio_result_v2'))
  await page.reload({ waitUntil: 'networkidle' })
  console.log('[cache] cleared, reloaded')
}

// Find and click the Generate button
const btn = page.locator('button', { hasText: /generate/i }).first()
const btnText = await btn.textContent().catch(() => 'not found')
console.log('[button]', btnText)
await shot(page, '02-before-generate')

await btn.click()
console.log('[click] Generate clicked')
await shot(page, '03-pipeline-started')

// Wait for first log lines to appear (pipeline started)
await page.waitForSelector('text=pipeline started', { timeout: 15000 }).catch(() => null)
await shot(page, '04-pipeline-running')

// Wait for rhyme to appear
console.log('Waiting for rhyme...')
const rhymeEl = await page.waitForSelector('text=Rhyme generated', { timeout: 30000 }).catch(() => null)
if (rhymeEl) console.log('[rhyme] Rhyme generated event received')
await shot(page, '05-rhyme-done')

// Wait for storyboard
console.log('Waiting for storyboard...')
await page.waitForSelector('text=Storyboard complete', { timeout: 30000 }).catch(() => null)
await shot(page, '06-storyboard-done')

// Wait for video metadata
console.log('Waiting for video metadata...')
await page.waitForSelector('text=Video prompt generated', { timeout: 30000 }).catch(() => null)
await shot(page, '07-video-meta-done')

// Wait for pipeline to complete (social assets) — Flux generates 12 images so allow 5 min
console.log('Waiting for pipeline completion...')
await page.waitForSelector('text=Pipeline complete', { timeout: 300000 }).catch(() => {
  console.log('[warn] Pipeline complete not seen within 5 min')
})
await shot(page, '08-pipeline-complete')

// Check for animated preview (VideoPreview)
const preview = await page.locator('[data-testid="video-preview"], .video-preview, canvas, video').first()
const previewVisible = await preview.isVisible().catch(() => false)
console.log('[preview] animated preview visible:', previewVisible)

// Look for emoji in the preview area
const emojiSpan = await page.locator('text=/[🦆🐻🦁🐸🌟⭐🎵🌅]/u').first()
const emojiVisible = await emojiSpan.isVisible().catch(() => false)
console.log('[preview] emoji visible:', emojiVisible)

await shot(page, '09-preview-area')

// Look for fullscreen button
const fullscreenBtn = page.locator('button', { hasText: /fullscreen|maximize|⛶|⤢/i }).first()
const fsVisible = await fullscreenBtn.isVisible().catch(() => false)
console.log('[fullscreen] button visible:', fsVisible)
if (fsVisible) {
  console.log('[fullscreen] button text:', await fullscreenBtn.textContent())
}

// Check for social media section
const socialSection = await page.locator('text=/YouTube|Instagram|TikTok|Facebook/i').first()
const socialVisible = await socialSection.isVisible().catch(() => false)
console.log('[social] social section visible:', socialVisible)
await shot(page, '10-social-section')

// Check for publish buttons
const publishBtns = page.locator('button', { hasText: /upload|post|publish/i })
const publishCount = await publishBtns.count()
console.log('[publish] publish buttons found:', publishCount)

// Expand social section if needed and click first publish button
if (publishCount > 0) {
  await publishBtns.first().scrollIntoViewIfNeeded()
  await shot(page, '11-publish-buttons')
}

// Check log panel for errors
const errorLogs = await page.locator('text=/error|Error/').count()
console.log('[errors] error mentions in page:', errorLogs)

await shot(page, '12-final-state')
console.log('[done] All shots saved to', SHOTS_DIR)

await browser.close()
