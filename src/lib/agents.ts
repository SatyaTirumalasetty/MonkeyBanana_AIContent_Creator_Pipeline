import { GoogleGenAI } from '@google/genai'
import type { RhymeData, RhymeScore, Storyboard, StoryboardShot, VideoScore, SocialCaptions } from '@/types'

const genai = new GoogleGenAI({ apiKey: (process.env.GOOGLE_API_KEY ?? '').replace(/\u{FEFF}/u, '') })

function safeJSON<T>(text: string): T {
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const start = clean.indexOf('{')
  if (start === -1) throw new Error('No JSON found in response')
  let depth = 0, end = -1
  for (let i = start; i < clean.length; i++) {
    if (clean[i] === '{') depth++
    else if (clean[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  if (end === -1) throw new Error('No JSON found in response')
  return JSON.parse(clean.slice(start, end + 1)) as T
}

async function callGemini(system: string, user: string, maxOutputTokens = 4096): Promise<string> {
  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: [{ role: 'user', parts: [{ text: user }] }],
    config: {
      systemInstruction: system,
      maxOutputTokens,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  })
  return response.text ?? ''
}

// ── Long-form video config ────────────────────────────────────────────────
// Veo generates one clip at a time (max ~8s each). A long video is assembled
// from many clips stitched together. Tune via env vars — more clips = more
// Veo API cost and total generation time (each clip can take 1-6 min).
export const CLIP_DURATION_SEC = Number(process.env.VIDEO_CLIP_DURATION_SEC || 8)
export const TARGET_DURATION_SEC = Number(process.env.VIDEO_TARGET_DURATION_SEC || 300)
export const NUM_CLIPS = Math.max(1, Math.ceil(TARGET_DURATION_SEC / CLIP_DURATION_SEC))

const BG_PALETTE = [
  'linear-gradient(135deg,#1a0a2e,#2d1b4e)',
  'linear-gradient(135deg,#0a1a2e,#0a2e1a)',
  'linear-gradient(135deg,#1a2e0a,#2e1a0a)',
  'linear-gradient(135deg,#2e0a1a,#0a2e2e)',
  'linear-gradient(135deg,#2e1a0a,#1a0a2e)',
  'linear-gradient(135deg,#0a2e2e,#2e0a2e)',
]

function formatTimestamp(startSec: number, endSec: number): string {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  return `${fmt(startSec)}-${fmt(endSec)}`
}

// â”€â”€ Agent 1: Rhyme Generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generateRhyme(feedback = '', version = 1): Promise<RhymeData> {
  const system = `You are a kids rhyme generator for toddlers aged 2-5.
Return ONLY valid JSON with exactly this shape:
{"rhyme":"...","topic":"...","learningConcept":"..."}

Rules:
- 6-10 lines, simple words only (max 2 syllables each)
- Must teach ONE concept from: colors, animals, numbers, nature, shapes, manners
- Rhythmic, repetitive, positive messaging
- Fun and entertaining
- No complex vocabulary`

  const user = feedback
    ? `Refine this rhyme based on feedback: "${feedback}". Create a completely new improved version. Version ${version}.`
    : `Generate a delightful educational rhyme about animals or counting or colors. Make it very fun, rhythmic and repetitive.`

  const raw = await callGemini(system, user)
  const data = safeJSON<{ rhyme: string; topic: string; learningConcept: string }>(raw)
  return { ...data, version, timestamp: new Date().toISOString() }
}

// â”€â”€ Agent 2: Rhyme Reviewer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function reviewRhyme(rhyme: string): Promise<RhymeScore> {
  const system = `You are a children's content quality reviewer. Review the rhyme and return ONLY valid JSON.
Scoring weights: entertainment 25%, educational 25%, ageAppropriate 20%, rhythm 10%, simplicity 10%, positiveMessage 10%.
Calculate total as weighted sum. Set approved=true if total > 7.

Return exactly:
{"entertainment":0,"educational":0,"ageAppropriate":0,"rhythm":0,"simplicity":0,"positiveMessage":0,"total":0,"approved":false,"feedback":[]}`

  const raw = await callGemini(system, `Review this rhyme for children aged 2-5:\n\n${rhyme}`)
  const data = safeJSON<RhymeScore>(raw)
  // Recalculate total to ensure accuracy
  const total = +(
    (data.entertainment || 0) * 0.25 +
    (data.educational || 0) * 0.25 +
    (data.ageAppropriate || 0) * 0.20 +
    (data.rhythm || 0) * 0.10 +
    (data.simplicity || 0) * 0.10 +
    (data.positiveMessage || 0) * 0.10
  ).toFixed(2)
  return { ...data, total, approved: total > 7 }
}

// â”€â”€ Agent 3: Storyboard Planner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function planStoryboard(
  rhyme: string,
  numShots = NUM_CLIPS,
  clipDurationSec = CLIP_DURATION_SEC
): Promise<Storyboard> {
  const totalSec = numShots * clipDurationSec
  const system = `You are an animation storyboard planner for a 9:16 vertical kids video (~${totalSec} seconds total, made of ${numShots} shots of ${clipDurationSec}s each).
Return ONLY valid JSON with exactly this shape:
{
  "shots":[
    {"emoji":"...","description":"...","camera":"..."}
  ],
  "musicStyle":"...",
  "voiceStyle":"...",
  "characters":["...","..."],
  "mood":"...",
  "backgroundStyle":"...",
  "narratorTiming":"..."
}
Rules:
- Return EXACTLY ${numShots} shots in the "shots" array, in narrative order.
- Each shot description must be SHORT (max 15 words) and describe one continuous animated scene.
- The first shot MUST be a strong hook.
- Build a long visual journey that extends and loops the rhyme's characters, theme and colors across many fun mini-scenes -- keep it cohesive and age-appropriate for toddlers 2-5.
- Vary emoji and camera angles across shots for visual interest.`

  const raw = await callGemini(
    system,
    `Create a ${numShots}-shot storyboard (9:16 vertical) for this kids rhyme:\n\n${rhyme}`,
    8192
  )
  const data = safeJSON<{
    shots: { emoji: string; description: string; camera: string }[]
    musicStyle: string
    voiceStyle: string
    characters: string[]
    mood: string
    backgroundStyle: string
    narratorTiming: string
  }>(raw)

  const rawShots = data.shots ?? []
  const shots: StoryboardShot[] = []
  for (let i = 0; i < numShots; i++) {
    const s = rawShots[i] ?? rawShots[rawShots.length - 1] ?? {
      emoji: '⭐', description: 'A joyful continuation of the story', camera: 'medium shot',
    }
    shots.push({
      timestamp: formatTimestamp(i * clipDurationSec, (i + 1) * clipDurationSec),
      emoji: s.emoji,
      description: s.description,
      camera: s.camera,
      bg: BG_PALETTE[i % BG_PALETTE.length],
    })
  }

  return { ...data, shots }
}

// â”€â”€ Gemini Veo: Actual Video Generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export interface VeoClipResult {
  status: 'done' | 'pending' | 'error'
  bytes?: Buffer
  mimeType?: string
  operationName?: string
  error?: string
}

// Generates (or resumes) a single Veo clip. Bounded to maxWaitMs so it fits
// within a single serverless invocation; if the operation is still running
// when time runs out, returns status 'pending' with an operationName that
// can be passed back in to resume polling on the next call.
export async function generateVeoClip(
  prompt: string,
  opts: {
    durationSeconds?: number
    operationName?: string
    maxWaitMs?: number
    onProgress?: (msg: string) => void
  } = {}
): Promise<VeoClipResult> {
  if (!process.env.GOOGLE_API_KEY) return { status: 'error', error: 'GOOGLE_API_KEY not configured' }

  const { durationSeconds = CLIP_DURATION_SEC, maxWaitMs = 270000, onProgress } = opts

  let operation
  if (opts.operationName) {
    onProgress?.('Resuming Veo operation...')
    operation = await genai.operations.getVideosOperation({
      operation: { name: opts.operationName } as Parameters<typeof genai.operations.getVideosOperation>[0]['operation'],
    })
  } else {
    onProgress?.('Submitting prompt to Gemini Veo...')
    operation = await genai.models.generateVideos({
      model: 'veo-2.0-generate-001',
      prompt,
      config: {
        aspectRatio: '9:16',
        numberOfVideos: 1,
        durationSeconds,
        personGeneration: 'dont_allow',
      },
    })
  }

  const deadline = Date.now() + maxWaitMs
  let elapsed = 0
  while (!operation.done) {
    if (Date.now() >= deadline) {
      onProgress?.('Still generating — will resume on next call')
      return { status: 'pending', operationName: operation.name }
    }
    await new Promise(r => setTimeout(r, 10000))
    elapsed += 10
    onProgress?.(`Veo generating clip... (${elapsed}s elapsed)`)
    operation = await genai.operations.getVideosOperation({ operation })
  }

  const video = operation.response?.generatedVideos?.[0]?.video
  if (!video) {
    const opError = (operation as { error?: { message?: string } }).error
    console.error('Veo operation finished with no video:', JSON.stringify(operation))
    return { status: 'error', error: opError?.message ?? 'Veo returned no video data' }
  }

  if (video.videoBytes) {
    onProgress?.('Clip generated ✓')
    return { status: 'done', bytes: Buffer.from(video.videoBytes, 'base64'), mimeType: 'video/mp4' }
  }

  if (video.uri) {
    onProgress?.('Downloading generated clip...')
    const res = await fetch(video.uri, { headers: { 'x-goog-api-key': process.env.GOOGLE_API_KEY! } })
    if (!res.ok) return { status: 'error', error: `Failed to download Veo clip: ${res.status}` }
    const bytes = Buffer.from(await res.arrayBuffer())
    onProgress?.('Clip generated ✓')
    return { status: 'done', bytes, mimeType: res.headers.get('content-type') || 'video/mp4' }
  }

  return { status: 'error', error: 'Veo returned no video data' }
}

// â”€â”€ Agent 4: Video Generator (metadata + prompt) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generateVideoMetadata(rhyme: string, storyboard: Storyboard): Promise<{
  videoPrompt: string
  audioScript: string
  subtitles: { time: string; text: string }[]
  lipSyncMap: { word: string; startMs: number; endMs: number }[]
}> {
  const system = `You are a video production director for kids animation.
Generate detailed production metadata. Return ONLY valid JSON:
{
  "videoPrompt":"detailed animation prompt for AI video generation...",
  "audioScript":"full narration script with tone directions...",
  "subtitles":[{"time":"0:00","text":"..."},{"time":"0:03","text":"..."}],
  "lipSyncMap":[{"word":"duck","startMs":0,"endMs":300}]
}

IMPORTANT for "videoPrompt": the video generator is configured to NOT depict any
people (no humans, no children, no babies, no human hands/faces/bodies). All
characters MUST be animals, anthropomorphized objects, or fantasy creatures —
never human children or people, even in passing references (e.g. do not write
"a child wearing jeans"; instead describe the object itself, like "a pair of
blue jeans on a clothesline").`

  const raw = await callGemini(system,
    `Generate video production metadata for this kids rhyme:\n${rhyme}\n\nStoryboard mood: ${storyboard.mood}\nCharacters: ${storyboard.characters.join(', ')}\nMusic: ${storyboard.musicStyle}`)
  return safeJSON(raw)
}

// ── Per-clip Veo prompt builder ─────────────────────────────────────────────
export function buildClipPrompt(
  videoPrompt: string,
  storyboard: Storyboard,
  shot: StoryboardShot
): string {
  return `${videoPrompt}\n\nThis clip: ${shot.description}\nCamera: ${shot.camera}\nMood: ${storyboard.mood}\nVisual style: ${storyboard.backgroundStyle}\nCharacters: ${storyboard.characters.join(', ')}\n9:16 vertical kids animation, ${CLIP_DURATION_SEC} seconds, no on-screen text or captions.`
}

// â”€â”€ Agent 5: Video Reviewer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function reviewVideo(
  storyboard: Storyboard,
  rhyme: string,
  videoMeta: { videoPrompt: string; audioScript: string; subtitles: { time: string; text: string }[]; lipSyncMap: { word: string; startMs: number; endMs: number }[] }
): Promise<VideoScore> {
  const system = `You are a kids video production plan reviewer. You evaluate the quality of a complete video production plan â€” NOT rendered video.
Score each dimension 0-10 based on the plan's detail, clarity, and suitability for a kids animation:
- videoQuality (20%): How detailed and clear is the visual/animation direction? Will it produce compelling visuals?
- audioQuality (15%): How well-written is the audio script? Does it match the rhyme and mood?
- audioSync (20%): How well do the subtitle timings align with the storyboard shots?
- lipSync (15%): How complete and accurate is the lip sync map? Are key words covered with realistic timings?
- characterMood (15%): Are character emotions clearly defined in each shot? Do they suit the rhyme?
- sceneConsistency (10%): Are visual style, characters, and color palette consistent across all shots?
- engagement (5%): How entertaining and engaging is the overall plan for toddlers aged 2-5?
Set approved=true if total > 7. Return ONLY valid JSON:
{"videoQuality":0,"audioQuality":0,"audioSync":0,"lipSync":0,"characterMood":0,"sceneConsistency":0,"engagement":0,"total":0,"approved":false,"feedback":[]}`

  const shotsDetail = storyboard.shots.map((s, i) =>
    `Shot ${i + 1} [${s.timestamp}]: ${s.description} | Camera: ${s.camera}`
  ).join('\n')

  const raw = await callGemini(system,
    `Review this kids video production plan:\n\nRHYME:\n${rhyme}\n\nSTORYBOARD (${storyboard.shots.length} shots, mood: ${storyboard.mood}):\n${shotsDetail}\nMusic: ${storyboard.musicStyle} | Voice: ${storyboard.voiceStyle}\nCharacters: ${storyboard.characters.join(', ')}\n\nANIMATION PROMPT:\n${videoMeta.videoPrompt}\n\nAUDIO SCRIPT:\n${videoMeta.audioScript}\n\nSUBTITLES (${videoMeta.subtitles.length} cues):\n${videoMeta.subtitles.map(s => `${s.time}: "${s.text}"`).join(' | ')}\n\nLIP SYNC MAP (${videoMeta.lipSyncMap.length} words mapped):\n${videoMeta.lipSyncMap.slice(0, 10).map(l => `${l.word}: ${l.startMs}-${l.endMs}ms`).join(', ')}...`)
  const data = safeJSON<VideoScore>(raw)
  const total = +(
    (data.videoQuality || 0) * 0.20 +
    (data.audioQuality || 0) * 0.15 +
    (data.audioSync || 0) * 0.20 +
    (data.lipSync || 0) * 0.15 +
    (data.characterMood || 0) * 0.15 +
    (data.sceneConsistency || 0) * 0.10 +
    (data.engagement || 0) * 0.05
  ).toFixed(2)
  return { ...data, total, approved: total > 7 }
}

// â”€â”€ Agent 6: Social Publisher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function generateSocialAssets(rhyme: string, storyboard: Storyboard, videoScore: VideoScore): Promise<SocialCaptions> {
  const system = `You are a social media manager for a kids content channel. Create platform-optimized captions.
Return ONLY valid JSON with exactly this structure:
{
  "youtube":{"creator":"@KiddieRhymeStudio","title":"...","caption":"...","hashtags":["tag1","tag2","tag3","tag4","tag5"],"cta":"...","thumbnailDesc":"..."},
  "instagram":{"creator":"@kiddieverse","title":"...","caption":"...","hashtags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8"],"cta":"...","thumbnailDesc":"..."},
  "facebook":{"creator":"Kiddie Rhyme Studio","title":"...","caption":"...","hashtags":["tag1","tag2","tag3","tag4"],"cta":"...","thumbnailDesc":"..."},
  "tiktok":{"creator":"@kiddieverse","title":"...","caption":"...","hashtags":["tag1","tag2","tag3","tag4","tag5","tag6"],"cta":"...","thumbnailDesc":"..."}
}`

  const raw = await callGemini(system,
    `Create social media captions for this kids video:\nRhyme topic: ${storyboard.mood}\nCharacters: ${storyboard.characters.join(', ')}\nMood: ${storyboard.mood}\nVideo score: ${videoScore.total.toFixed(1)}/10\nFirst line of rhyme: ${rhyme.split('\n')[0]}`)
  return safeJSON<SocialCaptions>(raw)
}
