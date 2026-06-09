import { GoogleGenAI } from '@google/genai'
import type { RhymeData, RhymeScore, Storyboard, VideoScore, SocialCaptions, VideoData } from '@/types'

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY })

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

async function callGemini(system: string, user: string): Promise<string> {
  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: [{ role: 'user', parts: [{ text: user }] }],
    config: {
      systemInstruction: system,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  })
  return response.text ?? ''
}

// ── Agent 1: Rhyme Generator ────────────────────────────────────────────────
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

// ── Agent 2: Rhyme Reviewer ─────────────────────────────────────────────────
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

// ── Agent 3: Storyboard Planner ─────────────────────────────────────────────
export async function planStoryboard(rhyme: string): Promise<Storyboard> {
  const system = `You are an animation storyboard planner for a 9:16 vertical kids video (30 seconds).
Return ONLY valid JSON with exactly this shape:
{
  "shots":[
    {"timestamp":"0:00-0:02","emoji":"🦆","description":"...","camera":"...","bg":"linear-gradient(135deg,#1a0a2e,#2d1b4e)"},
    {"timestamp":"0:02-0:12","emoji":"🌅","description":"...","camera":"...","bg":"linear-gradient(135deg,#0a1a2e,#0a2e1a)"},
    {"timestamp":"0:12-0:22","emoji":"🎵","description":"...","camera":"...","bg":"linear-gradient(135deg,#1a2e0a,#2e1a0a)"},
    {"timestamp":"0:22-0:30","emoji":"⭐","description":"...","camera":"...","bg":"linear-gradient(135deg,#2e0a1a,#0a2e2e)"}
  ],
  "musicStyle":"...",
  "voiceStyle":"...",
  "characters":["...","..."],
  "mood":"...",
  "backgroundStyle":"...",
  "narratorTiming":"..."
}
IMPORTANT: First shot MUST be a strong hook within first 2 seconds. Use kid-friendly vivid descriptions.`

  const raw = await callGemini(system, `Create a 4-shot storyboard for this kids rhyme (9:16 vertical format):\n\n${rhyme}`)
  return safeJSON<Storyboard>(raw)
}

// ── Gemini Veo: Actual Video Generation ────────────────────────────────────
export async function generateVideoWithVeo(
  prompt: string,
  onProgress?: (msg: string) => void
): Promise<VideoData | null> {
  if (!process.env.GOOGLE_API_KEY) return null

  onProgress?.('Submitting prompt to Gemini Veo...')

  let operation = await genai.models.generateVideos({
    model: 'veo-2.0-generate-001',
    prompt,
    config: {
      aspectRatio: '9:16',
      numberOfVideos: 1,
      durationSeconds: 8,
      personGeneration: 'dont_allow',
    },
  })

  // Poll every 10 seconds for up to ~4 minutes
  let elapsed = 0
  while (!operation.done) {
    await new Promise(r => setTimeout(r, 10000))
    elapsed += 10
    onProgress?.(`Veo generating video... (${elapsed}s elapsed)`)
    operation = await genai.operations.getVideosOperation({ operation })
  }

  const videoBytes = operation.response?.generatedVideos?.[0]?.video?.videoBytes
  if (!videoBytes) throw new Error('Veo returned no video data')

  onProgress?.('Video generated successfully ✓')
  return { base64: videoBytes, mimeType: 'video/mp4' }
}

// ── Agent 4: Video Generator (metadata + prompt) ────────────────────────────
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
}`

  const raw = await callGemini(system,
    `Generate video production metadata for this kids rhyme:\n${rhyme}\n\nStoryboard mood: ${storyboard.mood}\nCharacters: ${storyboard.characters.join(', ')}\nMusic: ${storyboard.musicStyle}`)
  return safeJSON(raw)
}

// ── Agent 5: Video Reviewer ──────────────────────────────────────────────────
export async function reviewVideo(
  storyboard: Storyboard,
  rhyme: string,
  videoMeta: { videoPrompt: string; audioScript: string; subtitles: { time: string; text: string }[]; lipSyncMap: { word: string; startMs: number; endMs: number }[] }
): Promise<VideoScore> {
  const system = `You are a kids video production plan reviewer. You evaluate the quality of a complete video production plan — NOT rendered video.
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

// ── Agent 6: Social Publisher ────────────────────────────────────────────────
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
