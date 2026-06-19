import { GoogleGenAI } from '@google/genai'
import type { RhymeData, RhymeScore, Storyboard, StoryboardShot, VideoScore, SocialCaptions, ContentType, CreativeBrief } from '@/types'

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
  const MAX_RETRIES = 4
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const isTransient = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('overloaded')
      if (isTransient && attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 4000 * (attempt + 1)))
        continue
      }
      throw err
    }
  }
  return ''
}

// ── Long-form video config ────────────────────────────────────────────────
export const CLIP_DURATION_SEC = Number(process.env.VIDEO_CLIP_DURATION_SEC || 5)
export const TARGET_DURATION_SEC = Number(process.env.VIDEO_TARGET_DURATION_SEC || 60)
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

// ── Per-content-type configuration ───────────────────────────────────────
type ContentConfig = {
  contentLabel: string
  generatorSystem: string
  generatorUser: (brief?: string) => string
  reviewerSystem: string
  storyboardStyle: string
  storyboardAudience: string
  videoMetaTone: string
  socialCreator: string
}

const CONTENT_CONFIG: Record<ContentType, ContentConfig> = {
  kids_rhyme: {
    contentLabel: 'rhyme',
    generatorSystem: `You are a kids rhyme generator for toddlers aged 2-5.
Return ONLY valid JSON with exactly this shape:
{"rhyme":"...","topic":"...","learningConcept":"..."}
Rules:
- 6-10 lines, simple words only (max 2 syllables each)
- Must teach ONE concept from: colors, animals, numbers, nature, shapes, manners
- Rhythmic, repetitive, positive messaging. No complex vocabulary`,
    generatorUser: (brief) => brief
      ? `Generate a delightful educational rhyme about: "${brief}". Make it fun, rhythmic and repetitive.`
      : `Generate a delightful educational rhyme about animals or counting or colors. Very fun, rhythmic and repetitive.`,
    reviewerSystem: `You are a children's content quality reviewer. Return ONLY valid JSON.
Scoring: entertainment 25%, educational 25%, ageAppropriate 20%, rhythm 10%, simplicity 10%, positiveMessage 10%.
Set approved=true if total > 7.
Return: {"entertainment":0,"educational":0,"ageAppropriate":0,"rhythm":0,"simplicity":0,"positiveMessage":0,"total":0,"approved":false,"feedback":[]}`,
    storyboardStyle: '9:16 vertical animated kids video, vibrant cartoon style, toddler-friendly bright colors',
    storyboardAudience: 'toddlers aged 2-5',
    videoMetaTone: 'playful, educational, upbeat, kid-friendly',
    socialCreator: '@KiddieRhymeStudio',
  },

  poem: {
    contentLabel: 'poem',
    generatorSystem: `You are a poet and creative writer. Write an evocative, lyrical poem with rich imagery.
Return ONLY valid JSON:
{"rhyme":"...","topic":"...","learningConcept":"..."}
Rules:
- 10-16 lines, rich imagery and metaphor, emotional resonance
- Use learningConcept for the emotional theme (e.g. "wonder", "loss", "hope")
- Vivid language, not necessarily strict rhyme scheme`,
    generatorUser: (brief) => brief
      ? `Write an evocative poem about: "${brief}". Make it emotionally resonant and visually rich.`
      : `Write an evocative poem about nature, wonder, or the passage of time. Emotionally resonant and visually rich.`,
    reviewerSystem: `You are a literary critic reviewing a poem for video production. Return ONLY valid JSON.
Score: entertainment=imagery, educational=emotional depth, ageAppropriate=originality, rhythm=musicality, simplicity=clarity, positiveMessage=resonance.
Weights: entertainment 30%, educational 30%, ageAppropriate 20%, rhythm 10%, simplicity 5%, positiveMessage 5%.
Set approved=true if total > 7.
Return: {"entertainment":0,"educational":0,"ageAppropriate":0,"rhythm":0,"simplicity":0,"positiveMessage":0,"total":0,"approved":false,"feedback":[]}`,
    storyboardStyle: '9:16 vertical cinematic video, artful composition, moody atmospheric lighting, artistic and evocative',
    storyboardAudience: 'general audience, poetry lovers',
    videoMetaTone: 'cinematic, reflective, artistic, emotionally charged',
    socialCreator: '@VerseAndVision',
  },

  short_film: {
    contentLabel: 'script',
    generatorSystem: `You are a short film screenwriter. Write a compelling 2-3 act micro-narrative.
Return ONLY valid JSON:
{"rhyme":"...","topic":"...","learningConcept":"..."}
Rules:
- "rhyme" = full script 200-250 words with scene direction and dialogue cues
- topic = genre/logline (e.g. "drama: stranger finds a mysterious letter")
- learningConcept = core theme (e.g. "trust", "courage", "identity")
- Clear setup, confrontation, resolution arc`,
    generatorUser: (brief) => brief
      ? `Write a compelling short film script about: "${brief}". Include scene directions and dialogue.`
      : `Write a compelling short film script about a chance encounter that changes someone's life.`,
    reviewerSystem: `You are a script editor reviewing for production viability. Return ONLY valid JSON.
Score: entertainment=hook strength, educational=story structure, ageAppropriate=character depth, rhythm=pacing, simplicity=dialogue clarity, positiveMessage=thematic resonance.
Weights: entertainment 30%, educational 25%, ageAppropriate 25%, rhythm 15%, simplicity 3%, positiveMessage 2%.
Set approved=true if total > 7.
Return: {"entertainment":0,"educational":0,"ageAppropriate":0,"rhythm":0,"simplicity":0,"positiveMessage":0,"total":0,"approved":false,"feedback":[]}`,
    storyboardStyle: '9:16 vertical cinematic format, realistic mise-en-scene, dramatic lighting, film-quality composition',
    storyboardAudience: 'general audience, film enthusiasts',
    videoMetaTone: 'cinematic, dramatic, narrative-driven',
    socialCreator: '@ReelStoriesAI',
  },

  advertisement: {
    contentLabel: 'ad script',
    generatorSystem: `You are an expert advertising copywriter. Write a punchy 15-30 second video ad.
Return ONLY valid JSON:
{"rhyme":"...","topic":"...","learningConcept":"..."}
Rules:
- "rhyme" = full ad script with VO lines and visual directions
- Structure: Hook (3s) → Problem (5s) → Solution (10s) → CTA (5s)
- topic = product/service being promoted
- learningConcept = core value proposition (e.g. "saves time", "eco-friendly")`,
    generatorUser: (brief) => brief
      ? `Write a punchy video ad script for: "${brief}". Follow Hook→Problem→Solution→CTA structure.`
      : `Write a punchy video ad for a premium productivity app. Follow Hook→Problem→Solution→CTA structure.`,
    reviewerSystem: `You are an ad effectiveness reviewer. Return ONLY valid JSON.
Score: entertainment=hook strength, educational=value clarity, ageAppropriate=brand safety, rhythm=pacing, simplicity=message clarity, positiveMessage=CTA effectiveness.
Weights: entertainment 30%, educational 25%, ageAppropriate 20%, rhythm 10%, simplicity 10%, positiveMessage 5%.
Set approved=true if total > 7.
Return: {"entertainment":0,"educational":0,"ageAppropriate":0,"rhythm":0,"simplicity":0,"positiveMessage":0,"total":0,"approved":false,"feedback":[]}`,
    storyboardStyle: '9:16 vertical commercial format, clean modern aesthetic, lifestyle product shots, professional high-end lighting',
    storyboardAudience: 'target consumers, adults',
    videoMetaTone: 'professional, persuasive, aspirational, high-energy',
    socialCreator: '@AIAdCreative',
  },

  educational: {
    contentLabel: 'explainer script',
    generatorSystem: `You are an educational content creator. Write an engaging explainer using the Feynman technique.
Return ONLY valid JSON:
{"rhyme":"...","topic":"...","learningConcept":"..."}
Rules:
- "rhyme" = full explainer script 150-200 words
- Use simple language, concrete examples, memorable analogies
- topic = subject being explained
- learningConcept = the single key takeaway
- Structure: hook question → explanation → example → memorable summary`,
    generatorUser: (brief) => brief
      ? `Write a clear, engaging educational explainer about: "${brief}". Use the Feynman technique.`
      : `Write a clear educational explainer about how the internet works. Use the Feynman technique.`,
    reviewerSystem: `You are an educational content quality reviewer. Return ONLY valid JSON.
Score: entertainment=engagement, educational=accuracy, ageAppropriate=accessibility, rhythm=pacing, simplicity=vocabulary level, positiveMessage=key takeaway strength.
Weights: entertainment 20%, educational 35%, ageAppropriate 20%, rhythm 10%, simplicity 10%, positiveMessage 5%.
Set approved=true if total > 7.
Return: {"entertainment":0,"educational":0,"ageAppropriate":0,"rhythm":0,"simplicity":0,"positiveMessage":0,"total":0,"approved":false,"feedback":[]}`,
    storyboardStyle: '9:16 vertical explainer format, clean infographic style, bright educational aesthetic, clear visual hierarchy',
    storyboardAudience: 'learners of all ages, curious minds',
    videoMetaTone: 'clear, informative, engaging, accessible',
    socialCreator: '@LearnWithAI',
  },

  music_video: {
    contentLabel: 'lyrics',
    generatorSystem: `You are a songwriter and music video director. Write song lyrics with a visual treatment.
Return ONLY valid JSON:
{"rhyme":"...","topic":"...","learningConcept":"..."}
Rules:
- "rhyme" = full lyrics (2 verses + chorus + optional bridge) with mood board hints in [brackets]
- topic = genre and vibe (e.g. "upbeat pop about summer")
- learningConcept = the song's core feeling or message
- Memorable, singable lyrics with strong hooks`,
    generatorUser: (brief) => brief
      ? `Write song lyrics and visual treatment for: "${brief}". Include mood board hints in [brackets].`
      : `Write upbeat pop lyrics about finding your place in the world. Include mood board hints in [brackets].`,
    reviewerSystem: `You are a music and video production reviewer. Return ONLY valid JSON.
Score: entertainment=hook strength, educational=lyrical depth, ageAppropriate=originality, rhythm=musicality and flow, simplicity=memorability, positiveMessage=emotional impact.
Weights: entertainment 30%, educational 20%, ageAppropriate 20%, rhythm 20%, simplicity 5%, positiveMessage 5%.
Set approved=true if total > 7.
Return: {"entertainment":0,"educational":0,"ageAppropriate":0,"rhythm":0,"simplicity":0,"positiveMessage":0,"total":0,"approved":false,"feedback":[]}`,
    storyboardStyle: '9:16 vertical music video, dynamic editing, performance and narrative intercutting, stylized vibrant lighting',
    storyboardAudience: 'music fans, general audience',
    videoMetaTone: 'energetic, stylized, emotionally charged, music-driven',
    socialCreator: '@AIMusicVids',
  },

  custom: {
    contentLabel: 'content',
    generatorSystem: `You are a versatile AI creative director. Execute creative briefs with precision and artistry.
Return ONLY valid JSON:
{"rhyme":"...","topic":"...","learningConcept":"..."}
Rules:
- "rhyme" = complete script/content 150-250 words
- topic = identify the genre and format
- learningConcept = the core message or theme
- Match the tone, style, and intent of the user's brief exactly`,
    generatorUser: (brief) => brief
      ? `Create compelling video content for this brief: "${brief}". Be creative and bold.`
      : `Create a compelling, visually interesting short video script that showcases AI creativity.`,
    reviewerSystem: `You are a creative director reviewing content for video production. Return ONLY valid JSON.
Score: entertainment=engagement, educational=creative quality, ageAppropriate=originality, rhythm=pacing, simplicity=clarity, positiveMessage=impact.
All dimensions weighted equally.
Set approved=true if total > 7.
Return: {"entertainment":0,"educational":0,"ageAppropriate":0,"rhythm":0,"simplicity":0,"positiveMessage":0,"total":0,"approved":false,"feedback":[]}`,
    storyboardStyle: '9:16 vertical cinematic video, style adapted to creative brief, high production value',
    storyboardAudience: 'general audience',
    videoMetaTone: 'professional, creative, compelling',
    socialCreator: '@AICreativeStudio',
  },
}

// ── Agent 1: Content Creator ──────────────────────────────────────────────────
export async function generateContent(
  feedback = '',
  version = 1,
  brief: CreativeBrief = { contentType: 'kids_rhyme' }
): Promise<RhymeData> {
  const cfg = CONTENT_CONFIG[brief.contentType]
  const user = feedback
    ? `Refine this ${cfg.contentLabel} based on feedback: "${feedback}". Create a completely new improved version. Version ${version}.`
    : cfg.generatorUser(brief.userBrief)

  const raw = await callGemini(cfg.generatorSystem, user)
  const data = safeJSON<{ rhyme: string; topic: string; learningConcept: string }>(raw)
  return { ...data, version, timestamp: new Date().toISOString() }
}

// Backward-compat alias used by older imports
export const generateRhyme = generateContent

// ── Agent 2: Content Reviewer ─────────────────────────────────────────────────
export async function reviewRhyme(
  rhyme: string,
  brief: CreativeBrief = { contentType: 'kids_rhyme' }
): Promise<RhymeScore> {
  const cfg = CONTENT_CONFIG[brief.contentType]
  const raw = await callGemini(cfg.reviewerSystem, `Review this ${cfg.contentLabel}:\n\n${rhyme}`)
  const data = safeJSON<RhymeScore>(raw)
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

// ── Agent 3: Storyboard Planner ───────────────────────────────────────────────
export async function planStoryboard(
  rhyme: string,
  numShots = NUM_CLIPS,
  clipDurationSec = CLIP_DURATION_SEC,
  brief: CreativeBrief = { contentType: 'kids_rhyme' }
): Promise<Storyboard> {
  const totalSec = numShots * clipDurationSec
  const cfg = CONTENT_CONFIG[brief.contentType]
  const system = `You are a storyboard planner for a ${cfg.storyboardStyle} (~${totalSec}s total, ${numShots} shots of ${clipDurationSec}s each). Target audience: ${cfg.storyboardAudience}.
Return ONLY valid JSON:
{
  "shots":[{"emoji":"...","description":"...","camera":"..."}],
  "musicStyle":"...","voiceStyle":"...","characters":["..."],"mood":"...","backgroundStyle":"...","narratorTiming":"..."
}
Rules:
- Return EXACTLY ${numShots} shots in narrative order.
- Each shot: clear ACTION sentence (max 15 words), what is visually happening.
- First shot: strong hook showing the main subject in an exciting moment.
- Vary emoji and camera angles (close-up, wide shot, medium, overhead, tracking shot).
- mood = single adjective like "joyful", "cinematic", "mysterious", "energetic".
- backgroundStyle = setting description.`

  const raw = await callGemini(
    system,
    `Create a ${numShots}-shot storyboard (9:16 vertical) for this ${cfg.contentLabel}:\n\n${rhyme}`,
    8192
  )
  const data = safeJSON<{
    shots: { emoji: string; description: string; camera: string }[]
    musicStyle: string; voiceStyle: string; characters: string[]
    mood: string; backgroundStyle: string; narratorTiming: string
  }>(raw)

  const rawShots = data.shots ?? []
  const shots: StoryboardShot[] = []
  for (let i = 0; i < numShots; i++) {
    const s = rawShots[i] ?? rawShots[rawShots.length - 1] ?? {
      emoji: '⭐', description: 'A compelling continuation of the story', camera: 'medium shot',
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

// ── Agent 4: Video Generator (metadata + prompt) ──────────────────────────────
export async function generateVideoMetadata(
  rhyme: string,
  storyboard: Storyboard,
  brief: CreativeBrief = { contentType: 'kids_rhyme' }
): Promise<{
  videoPrompt: string
  audioScript: string
  subtitles: { time: string; text: string }[]
  lipSyncMap: { word: string; startMs: number; endMs: number }[]
}> {
  const cfg = CONTENT_CONFIG[brief.contentType]
  const system = `You are a video production director. Tone: ${cfg.videoMetaTone}.
Generate detailed production metadata. Return ONLY valid JSON:
{
  "videoPrompt":"detailed AI video generation prompt...",
  "audioScript":"full narration script with tone directions...",
  "subtitles":[{"time":"0:00","text":"..."}],
  "lipSyncMap":[{"word":"...","startMs":0,"endMs":300}]
}`

  const raw = await callGemini(system,
    `Generate video production metadata for this ${cfg.contentLabel}:\n${rhyme}\n\nStoryboard mood: ${storyboard.mood}\nCharacters: ${storyboard.characters.join(', ')}\nMusic: ${storyboard.musicStyle}`)
  return safeJSON(raw)
}

// ── Agent 5: Video Reviewer ───────────────────────────────────────────────────
export async function reviewVideo(
  storyboard: Storyboard,
  rhyme: string,
  videoMeta: { videoPrompt: string; audioScript: string; subtitles: { time: string; text: string }[]; lipSyncMap: { word: string; startMs: number; endMs: number }[] },
  brief: CreativeBrief = { contentType: 'kids_rhyme' }
): Promise<VideoScore> {
  const cfg = CONTENT_CONFIG[brief.contentType]
  const system = `You are a video production plan reviewer for ${cfg.contentLabel} content. Audience: ${cfg.storyboardAudience}.
Score each dimension 0-10 based on the production plan's detail, clarity, and suitability:
- videoQuality (20%): visual/animation direction quality
- audioQuality (15%): audio script quality and mood alignment
- audioSync (20%): subtitle timing alignment with storyboard
- lipSync (15%): lip sync map completeness
- characterMood (15%): character emotions clarity across shots
- sceneConsistency (10%): visual style and palette consistency
- engagement (5%): overall entertainment and engagement
Set approved=true if total > 7. Return ONLY valid JSON:
{"videoQuality":0,"audioQuality":0,"audioSync":0,"lipSync":0,"characterMood":0,"sceneConsistency":0,"engagement":0,"total":0,"approved":false,"feedback":[]}`

  const shotsDetail = storyboard.shots.map((s, i) =>
    `Shot ${i + 1} [${s.timestamp}]: ${s.description} | Camera: ${s.camera}`
  ).join('\n')

  const raw = await callGemini(system,
    `Review this ${cfg.contentLabel} video production plan:\n\nCONTENT:\n${rhyme}\n\nSTORYBOARD (${storyboard.shots.length} shots, mood: ${storyboard.mood}):\n${shotsDetail}\nMusic: ${storyboard.musicStyle} | Voice: ${storyboard.voiceStyle}\nCharacters: ${storyboard.characters.join(', ')}\n\nANIMATION PROMPT:\n${videoMeta.videoPrompt}\n\nAUDIO SCRIPT:\n${videoMeta.audioScript}\n\nSUBTITLES (${videoMeta.subtitles.length} cues):\n${videoMeta.subtitles.map(s => `${s.time}: "${s.text}"`).join(' | ')}\n\nLIP SYNC MAP (${videoMeta.lipSyncMap.length} words):\n${videoMeta.lipSyncMap.slice(0, 10).map(l => `${l.word}: ${l.startMs}-${l.endMs}ms`).join(', ')}...`)
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

// ── Agent 6: Social Publisher ─────────────────────────────────────────────────
export async function generateSocialAssets(
  rhyme: string,
  storyboard: Storyboard,
  videoScore: VideoScore,
  brief: CreativeBrief = { contentType: 'kids_rhyme' }
): Promise<SocialCaptions> {
  const cfg = CONTENT_CONFIG[brief.contentType]
  const creator = cfg.socialCreator
  const system = `You are a social media manager creating platform-optimized captions for ${cfg.contentLabel} video content.
Return ONLY valid JSON:
{
  "youtube":{"creator":"${creator}","title":"...","caption":"...","hashtags":["tag1","tag2","tag3","tag4","tag5"],"cta":"...","thumbnailDesc":"..."},
  "instagram":{"creator":"${creator}","title":"...","caption":"...","hashtags":["tag1","tag2","tag3","tag4","tag5","tag6","tag7","tag8"],"cta":"...","thumbnailDesc":"..."},
  "facebook":{"creator":"${creator}","title":"...","caption":"...","hashtags":["tag1","tag2","tag3","tag4"],"cta":"...","thumbnailDesc":"..."},
  "tiktok":{"creator":"${creator}","title":"...","caption":"...","hashtags":["tag1","tag2","tag3","tag4","tag5","tag6"],"cta":"...","thumbnailDesc":"..."}
}`

  const raw = await callGemini(system,
    `Create social media captions for this ${cfg.contentLabel} video:\nTopic/mood: ${storyboard.mood}\nCharacters: ${storyboard.characters.join(', ')}\nVideo score: ${videoScore.total.toFixed(1)}/10\nFirst line: ${rhyme.split('\n')[0]}`)
  return safeJSON<SocialCaptions>(raw)
}
