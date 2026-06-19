'use client'
import { useState, useRef, useCallback, useEffect, Fragment } from 'react'
import type { LogEntry, RhymeData, RhymeScore, Storyboard, VideoScore, SocialCaptions, VideoMeta, VideoJob, Platform } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────
type StepStatus = 'idle' | 'active' | 'done' | 'failed'
type StepId = 'rhyme' | 'review' | 'storyboard' | 'video' | 'vreview' | 'render' | 'publish'

const STEPS: { id: StepId; icon: string; name: string; sub: string }[] = [
  { id: 'rhyme',      icon: '✍️', name: 'Rhyme Generator',    sub: 'Generating rhyme' },
  { id: 'review',     icon: '🔍', name: 'Rhyme Reviewer',     sub: 'Scoring quality' },
  { id: 'storyboard', icon: '🎨', name: 'Storyboard Planner', sub: 'Planning scenes' },
  { id: 'video',      icon: '🎬', name: 'Video Generator',    sub: 'Building package' },
  { id: 'vreview',    icon: '⭐', name: 'Video Reviewer',     sub: 'Quality check' },
  { id: 'render',     icon: '🎥', name: 'Video Renderer',     sub: 'Rendering clips' },
  { id: 'publish',    icon: '🚀', name: 'Social Publisher',   sub: 'Preparing assets' },
]

const PLATFORM_META = {
  youtube:   { name: 'YouTube Shorts',  icon: '▶️', url: 'https://studio.youtube.com',           color: '#FF0000', desc: 'Upload → Create → Upload video' },
  instagram: { name: 'Instagram Reels', icon: '📸', url: 'https://www.instagram.com',              color: '#E1306C', desc: 'Open app → Reels → +' },
  facebook:  { name: 'Facebook Reels',  icon: '👍', url: 'https://www.facebook.com/reels/create', color: '#1877F2', desc: 'Reels → Create Reel' },
  tiktok:    { name: 'TikTok',          icon: '🎵', url: 'https://www.tiktok.com/upload',         color: '#000000', desc: 'TikTok → + → Upload' },
}

// ── Agent characters ──────────────────────────────────────────────────────────
const AGENT_CHARS: Record<StepId, { char: string; name: string; role: string; color: string; tagline: string }> = {
  rhyme:      { char: '🐝', name: 'Lyra',   role: 'Poet Bee',         color: '#c77dff', tagline: 'Crafts magical rhymes for little ones' },
  review:     { char: '🦉', name: 'Rex',    role: 'Scholar Owl',      color: '#4cc9f0', tagline: 'Checks every word for quality' },
  storyboard: { char: '🦊', name: 'Stormy', role: 'Artist Fox',       color: '#ff9f43', tagline: 'Paints vivid scenes for the story' },
  video:      { char: '🐱', name: 'Vince',  role: 'Director Cat',     color: '#ff6b9d', tagline: 'Builds the full production package' },
  vreview:    { char: '🐰', name: 'Stella', role: 'Critic Rabbit',    color: '#5bea8b', tagline: 'Scores the video before it ships' },
  render:     { char: '🤖', name: 'Robo',   role: 'Engineer Bot',     color: '#f8c537', tagline: 'Renders and stitches every clip' },
  publish:    { char: '🦋', name: 'Pixel',  role: 'Social Butterfly', color: '#56cfb2', tagline: 'Prepares assets for every platform' },
}

// ── Score Bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-[11px] text-slate-400 w-[130px] shrink-0">{label}</span>
      <div className="flex-1 h-[5px] bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(value || 0) * 10}%`, background: color }} />
      </div>
      <span className="text-[11px] font-bold w-7 text-right" style={{ color }}>{(value || 0).toFixed(1)}</span>
    </div>
  )
}

// ── Copy Button ───────────────────────────────────────────────────────────────
function CopyButton({ text, label = 'Copy caption' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch { /* fallback */ }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${copied ? 'bg-emerald-900/30 border-emerald-600 text-emerald-400' : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-violet-500 hover:text-violet-300'}`}>
      {copied ? '✓ Copied!' : `📋 ${label}`}
    </button>
  )
}

// ── Agent Card ────────────────────────────────────────────────────────────────
function AgentCard({ stepId, status, message }: {
  stepId: StepId; status: StepStatus; message: string
}) {
  const a = AGENT_CHARS[stepId]
  const isActive = status === 'active'
  const isDone = status === 'done'
  const isFailed = status === 'failed'

  return (
    <div
      className={`relative flex flex-col items-center px-2 pt-4 pb-3 rounded-2xl border-2 transition-all duration-500 overflow-hidden ${status === 'idle' ? 'opacity-30' : ''}`}
      style={{
        minHeight: 210,
        borderColor: isActive ? a.color : isDone ? '#10b981' : isFailed ? '#f59e0b' : '#1e293b',
        background: isActive ? `${a.color}0a` : 'transparent',
        boxShadow: isActive ? `0 0 28px ${a.color}45` : 'none',
      }}
    >
      {/* Radial glow pulse */}
      {isActive && (
        <div
          className="absolute inset-0 pointer-events-none animate-pulse"
          style={{ background: `radial-gradient(ellipse at 50% 25%, ${a.color}22 0%, transparent 70%)` }}
        />
      )}

      {/* Avatar */}
      <div className="relative mb-2">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl transition-all duration-300 ${isActive ? 'animate-bounce' : ''}`}
          style={{
            background: status === 'idle' ? '#0f172a' : `${a.color}18`,
            border: `2px solid ${status === 'idle' ? '#1e293b' : a.color}55`,
          }}
        >
          {isDone ? '🥳' : isFailed ? '😰' : a.char}
        </div>
        {isActive && (
          <div
            className="absolute -inset-1.5 rounded-full animate-ping opacity-20 pointer-events-none"
            style={{ border: `2px solid ${a.color}` }}
          />
        )}
        {isDone && (
          <div className="absolute -top-1 -right-1 text-sm leading-none">✅</div>
        )}
      </div>

      {/* Name + role */}
      <div className="text-[11px] font-extrabold text-white text-center leading-tight">{a.name}</div>
      <div className="text-[9px] text-slate-400 text-center mb-2">{a.role}</div>

      {/* Status badge */}
      <div
        className="text-[8px] font-bold px-2 py-0.5 rounded-full mb-2 shrink-0"
        style={{
          background: `${isActive ? a.color : isDone ? '#10b981' : isFailed ? '#f59e0b' : '#334155'}22`,
          color: isActive ? a.color : isDone ? '#34d399' : isFailed ? '#fbbf24' : '#475569',
          border: `1px solid ${isActive ? a.color : isDone ? '#10b981' : isFailed ? '#f59e0b' : '#334155'}44`,
        }}
      >
        {isActive ? '⚡ Working' : isDone ? '✓ Done' : isFailed ? '⚠ Retry' : '○ Idle'}
      </div>

      {/* Activity message or tagline */}
      <div
        className="text-[8px] text-center leading-tight px-0.5 line-clamp-3"
        style={{ color: isActive ? `${a.color}cc` : '#334155' }}
      >
        {isActive && message
          ? message.replace(/Error:\s*\{.*\}/s, 'API busy — retrying…').replace(/^(Pipeline error|Error):\s*/i, '⚠ ')
          : a.tagline}
      </div>
    </div>
  )
}

// ── Animated Storyboard Preview ───────────────────────────────────────────────
function VideoPreview({ storyboard, rhyme, videoScore }: {
  storyboard: Storyboard; rhyme: RhymeData; videoScore: VideoScore | null
}) {
  const [shotIdx, setShotIdx] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const lines = rhyme.rhyme.split('\n').filter(Boolean)
  const shot = storyboard.shots[shotIdx]

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setShotIdx(i => (i + 1) % storyboard.shots.length), 7500)
    return () => clearInterval(id)
  }, [playing, storyboard.shots.length])

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = async () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

  const lineIdx = Math.min(
    Math.floor(shotIdx * lines.length / storyboard.shots.length),
    lines.length - 1
  )

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl select-none"
      style={{ aspectRatio: '9/16', background: shot.bg || 'linear-gradient(135deg,#1a0a2e,#2d1b4e)' }}>

      {/* Shot content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        <div className="text-6xl mb-3" style={{ animation: 'bounce 1s infinite' }}>{shot.emoji}</div>
        <div className="text-[10px] font-semibold text-white/60 leading-relaxed line-clamp-3">{shot.description}</div>
      </div>

      {/* Camera label */}
      <div className="absolute top-2 left-2 right-2 flex justify-between items-center">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-0.5 text-[9px] font-bold text-white/80">
          SHOT {shotIdx + 1} / {storyboard.shots.length} · {shot.timestamp}
        </div>
        <div className="bg-violet-900/70 backdrop-blur-sm rounded-lg px-2 py-0.5 text-[9px] font-bold text-violet-200">
          📷 {shot.camera?.split(',')[0]}
        </div>
      </div>

      {/* Subtitle */}
      <div className="absolute bottom-14 left-2 right-2">
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center text-[11px] font-bold text-white leading-snug">
          {lines[lineIdx]}
        </div>
      </div>

      {/* Controls bar */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between bg-black/50 backdrop-blur-sm">
        <div className="flex gap-1">
          {storyboard.shots.map((_, i) => (
            <button key={i} onClick={() => { setShotIdx(i); setPlaying(false) }}
              className="transition-all rounded-full bg-white/40 hover:bg-white/70"
              style={{ width: i === shotIdx ? 14 : 6, height: 6, background: i === shotIdx ? 'white' : 'rgba(255,255,255,0.4)' }} />
          ))}
        </div>
        <div className="flex gap-1.5">
          {videoScore && (
            <div className={`text-[9px] font-bold px-2 py-1 rounded-full ${videoScore.approved ? 'bg-emerald-900/70 text-emerald-300' : 'bg-amber-900/70 text-amber-300'}`}>
              {videoScore.total.toFixed(1)}/10
            </div>
          )}
          <button onClick={() => setPlaying(p => !p)}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-sm text-white transition-all">
            {playing ? '⏸' : '▶'}
          </button>
          <button onClick={toggleFullscreen}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-sm text-white transition-all">
            {isFullscreen ? '✕' : '⛶'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Real Video Player with fullscreen ─────────────────────────────────────────
function VideoPlayer({ videoUrl, videoScore }: { videoUrl: string; videoScore: VideoScore | null }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = async () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

  return (
    <div ref={containerRef} className="relative rounded-xl overflow-hidden bg-black">
      <video controls autoPlay loop playsInline
        src={videoUrl}
        className="w-full"
        style={{ aspectRatio: '9/16', objectFit: 'cover' }}
      />
      <button onClick={toggleFullscreen}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white text-sm transition-all backdrop-blur-sm border border-white/20">
        {isFullscreen ? '✕' : '⛶'}
      </button>
      {videoScore && (
        <div className={`text-center py-1.5 text-xs font-bold ${videoScore.approved ? 'bg-emerald-900/40 text-emerald-400' : 'bg-amber-900/40 text-amber-400'}`}>
          Score: {videoScore.total.toFixed(1)}/10 {videoScore.approved ? '✅' : '⚠️'}
        </div>
      )}
      <div className="px-3 py-2 text-[9px] text-violet-400 font-bold text-center bg-violet-950/30">
        ✨ AI-generated video by Kling AI
      </div>
    </div>
  )
}

const CACHE_KEY = 'kids_studio_result'

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [steps, setSteps] = useState<Record<StepId, StepStatus>>({
    rhyme: 'idle', review: 'idle', storyboard: 'idle', video: 'idle', vreview: 'idle', render: 'idle', publish: 'idle'
  })
  const [logs, setLogs] = useState<LogEntry[]>([{ time: '--:--:--', msg: 'Studio ready. Click Generate Rhyme to start.', type: '' }])
  const [rhyme, setRhyme] = useState<RhymeData | null>(null)
  const [rhymeScore, setRhymeScore] = useState<RhymeScore | null>(null)
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null)
  const [videoScore, setVideoScore] = useState<VideoScore | null>(null)
  const [captions, setCaptions] = useState<SocialCaptions | null>(null)
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null)
  const [job, setJob] = useState<VideoJob | null>(null)
  const [running, setRunning] = useState(false)
  const [complete, setComplete] = useState(false)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [publishedPlatforms, setPublishedPlatforms] = useState<Set<Platform>>(new Set())
  const [capTab, setCapTab] = useState<Platform>('youtube')
  const [showPublish, setShowPublish] = useState(false)
  const [agentMessages, setAgentMessages] = useState<Partial<Record<StepId, string>>>({})
  const logRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const activeStepRef = useRef<StepId | null>(null)

  // Load from cache on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CACHE_KEY)
      if (!saved) return
      const data = JSON.parse(saved)
      if (!data.rhyme || !data.storyboard) return
      setRhyme(data.rhyme)
      setRhymeScore(data.rhymeScore ?? null)
      setStoryboard(data.storyboard)
      setVideoMeta(data.videoMeta ?? null)
      setVideoScore(data.videoScore ?? null)
      setJob(data.job ?? null)
      setCaptions(data.captions ?? null)
      setCachedAt(data.cachedAt ?? null)
      if (data.publishedPlatforms?.length) setPublishedPlatforms(new Set(data.publishedPlatforms as Platform[]))
      setComplete(true)
      setSteps({ rhyme: 'done', review: 'done', storyboard: 'done', video: 'done', vreview: 'done', render: data.job?.finalVideoUrl ? 'done' : 'idle', publish: 'done' })
      setLogs([{ time: '--:--:--', msg: `Loaded previous result from cache (${data.cachedAt ?? 'earlier'})`, type: 'info' }])
    } catch { /* corrupt cache — ignore */ }
  }, [])

  // Save to cache whenever pipeline completes
  useEffect(() => {
    if (!complete || !rhyme || !storyboard) return
    try {
      const ts = new Date().toLocaleString()
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        rhyme, rhymeScore, storyboard, videoMeta, videoScore, job, captions,
        publishedPlatforms: Array.from(publishedPlatforms), cachedAt: ts,
      }))
      setCachedAt(ts)
    } catch { /* storage quota exceeded */ }
  }, [complete])

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const addLog = useCallback((msg: string, type: LogEntry['type'] = '') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLogs(prev => [...prev, { time, msg, type }])
    const stepId = activeStepRef.current
    if (stepId) setAgentMessages(prev => ({ ...prev, [stepId]: msg }))
  }, [])

  const setStep = useCallback((id: StepId, status: StepStatus) => {
    setSteps(prev => ({ ...prev, [id]: status }))
    if (status === 'active') {
      activeStepRef.current = id
    } else if ((status === 'done' || status === 'failed') && activeStepRef.current === id) {
      activeStepRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    localStorage.removeItem(CACHE_KEY)
    setCachedAt(null)
    setPublishedPlatforms(new Set())
    setSteps({ rhyme: 'idle', review: 'idle', storyboard: 'idle', video: 'idle', vreview: 'idle', render: 'idle', publish: 'idle' })
    setLogs([])
    setRhyme(null); setRhymeScore(null); setStoryboard(null)
    setVideoScore(null); setCaptions(null); setVideoMeta(null); setJob(null)
    setComplete(false); setShowPublish(false)
    setAgentMessages({})
    activeStepRef.current = null
  }, [])

  // Renders one slideshow clip via the API, retrying on transient errors
  // until it's done or fails. Returns the updated job.
  const renderClip = useCallback(async (jobId: string, clipIndex: number, signal: AbortSignal): Promise<VideoJob> => {
    const MAX_ATTEMPTS = 12 // ~12 * up to 270s = generous ceiling per clip
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await fetch('/api/pipeline/clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, clipIndex }),
        signal,
      })
      if (!res.ok) throw new Error(`Clip API error: ${res.status}`)
      const data = await res.json() as { job: VideoJob; clip: { status: string; error?: string } }
      setJob(data.job)
      if (data.clip.status === 'done' || data.clip.status === 'error') return data.job
      addLog(`Clip ${clipIndex + 1}/${data.job.clips.length} still rendering — resuming... (attempt ${attempt})`, 'agent')
    }
    throw new Error(`Clip ${clipIndex + 1} did not finish after ${MAX_ATTEMPTS} attempts`)
  }, [addLog])

  // Walks every clip to completion, then stitches the final video.
  const renderVideo = useCallback(async (initialJob: VideoJob, signal: AbortSignal) => {
    setStep('render', 'active')
    addLog(`Rendering ${initialJob.clips.length} video clips (~${initialJob.targetDurationSec}s total)...`, 'agent')

    let currentJob = initialJob
    for (let i = 0; i < currentJob.clips.length; i++) {
      if (currentJob.clips[i].status === 'done') continue
      addLog(`Generating clip ${i + 1}/${currentJob.clips.length}...`, 'agent')
      currentJob = await renderClip(currentJob.id, i, signal)
      if (currentJob.clips[i].status === 'error') {
        addLog(`Clip ${i + 1} failed: ${currentJob.clips[i].error}`, 'error')
        setStep('render', 'failed')
        return
      }
      addLog(`Clip ${i + 1}/${currentJob.clips.length} ready ✓`, 'success')
    }

    addLog('Stitching clips into the final video...', 'agent')
    let data: { job?: VideoJob; error?: string } = {}
    let res: Response | undefined
    for (let attempt = 0; attempt < 5; attempt++) {
      res = await fetch('/api/pipeline/stitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: currentJob.id }),
        signal,
      })
      data = await res.json() as { job?: VideoJob; error?: string }
      if (res.status !== 409) break
      await new Promise(r => setTimeout(r, 2000))
    }
    if (!res || !res.ok || !data.job) {
      addLog(`Stitching failed: ${data.error ?? res?.status}`, 'error')
      setStep('render', 'failed')
      return
    }
    setJob(data.job)
    setStep('render', 'done')
    addLog('Final video ready ✓', 'success')
  }, [renderClip, addLog, setStep])

  const startPipeline = useCallback(async () => {
    if (running) return
    reset()
    setRunning(true)

    abortRef.current = new AbortController()
    let createdJob: VideoJob | null = null
    try {
      const res = await fetch('/api/pipeline/start', { signal: abortRef.current.signal })
      if (!res.ok) throw new Error(`API error: ${res.status}`)
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const chunk = JSON.parse(line.slice(6))
            switch (chunk.type) {
              case 'log':
                setLogs(prev => [...prev, { time: chunk.payload.time, msg: chunk.payload.msg, type: chunk.payload.type }])
                {
                  const stepId = activeStepRef.current
                  if (stepId) setAgentMessages(prev => ({ ...prev, [stepId]: chunk.payload.msg as string }))
                }
                break
              case 'step':
                setStep(chunk.payload.id as StepId, chunk.payload.status as StepStatus)
                break
              case 'rhyme':
                setRhyme(chunk.payload as RhymeData)
                break
              case 'rhyme_score':
                setRhymeScore(chunk.payload as RhymeScore)
                break
              case 'storyboard':
                setStoryboard(chunk.payload as Storyboard)
                break
              case 'video_meta':
                setVideoMeta(chunk.payload as VideoMeta)
                break
              case 'video_score':
                setVideoScore(chunk.payload as VideoScore)
                break
              case 'job':
                createdJob = chunk.payload as VideoJob
                setJob(createdJob)
                break
              case 'captions':
                setCaptions(chunk.payload as SocialCaptions)
                break
              case 'complete':
                setComplete(true)
                break
              case 'error':
                addLog(`Error: ${(chunk.payload as { message: string }).message}`, 'error')
                break
            }
          } catch { /* skip malformed */ }
        }
      }

      if (createdJob) {
        await renderVideo(createdJob, abortRef.current.signal)
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        addLog(`Connection error: ${(err as Error).message}`, 'error')
        addLog('Make sure GOOGLE_API_KEY is set in your .env file', 'warning')
      }
    } finally {
      setRunning(false)
    }
  }, [running, reset, setStep, addLog, renderVideo])

  // Keep publishedPlatforms in sync with cache without overwriting other fields
  useEffect(() => {
    if (!complete || !rhyme) return
    try {
      const saved = localStorage.getItem(CACHE_KEY)
      if (!saved) return
      const data = JSON.parse(saved)
      localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, publishedPlatforms: Array.from(publishedPlatforms) }))
    } catch { }
  }, [publishedPlatforms, complete, rhyme])

  const handleUpload = useCallback((platform: Platform, url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
    setPublishedPlatforms(prev => new Set([...prev, platform]))
  }, [])

  const clearAfterPublish = useCallback(() => {
    localStorage.removeItem(CACHE_KEY)
    setCachedAt(null)
    setPublishedPlatforms(new Set())
    setSteps({ rhyme: 'idle', review: 'idle', storyboard: 'idle', video: 'idle', vreview: 'idle', render: 'idle', publish: 'idle' })
    setLogs([{ time: new Date().toLocaleTimeString('en-US', { hour12: false }), msg: 'Published content cleared. Ready for new video.', type: 'success' }])
    setRhyme(null); setRhymeScore(null); setStoryboard(null)
    setVideoScore(null); setCaptions(null); setVideoMeta(null); setJob(null)
    setComplete(false); setShowPublish(false)
  }, [])

  const getCapText = (platform: Platform) => {
    if (!captions) return ''
    const c = captions[platform]
    return `${c.title}\n\n${c.caption}\n\n${c.cta}\n\n${c.hashtags.map(h => '#' + h.replace('#', '')).join(' ')}`
  }

  const finalScore = videoScore?.total ?? 0
  const isReady = finalScore > 8

  return (
    <div className="min-h-screen bg-[#0a0815] text-white" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style suppressHydrationWarning>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');`}</style>

      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Fredoka One', cursive", background: 'linear-gradient(135deg,#ff6b9d,#c77dff,#4cc9f0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🎬 Kids AI Video Studio
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Autonomous 6-agent pipeline · Gemini AI + Kling AI video · SSE streaming</p>
          </div>
          <div className="flex items-center gap-2">
            {cachedAt && !running && (
              <div className="flex items-center gap-1.5 bg-violet-950/60 border border-violet-700 rounded-full px-3 py-1.5">
                <span className="text-[10px] text-violet-300">💾 Cached · {cachedAt}</span>
              </div>
            )}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-full px-4 py-2">
              <div className={`w-2 h-2 rounded-full ${running ? 'bg-emerald-400 animate-pulse' : complete ? 'bg-violet-400' : 'bg-slate-600'}`} />
              <span className="text-xs font-bold text-slate-300">
                {running ? 'Pipeline Running' : complete ? (isReady ? '🎉 Ready to Post' : '✅ Complete') : 'Ready'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-[1fr_300px] gap-6">

          {/* LEFT */}
          <div className="flex flex-col gap-5">

            {/* Agent Pipeline — visual character stage */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">AI Agent Crew</div>
                {running && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                    <span className="text-[9px] text-violet-400 font-bold">Pipeline active</span>
                  </div>
                )}
              </div>
              <div className="flex items-stretch gap-1">
                {STEPS.map((s, i) => (
                  <Fragment key={s.id}>
                    <div className="flex-1 min-w-0">
                      <AgentCard
                        stepId={s.id}
                        status={steps[s.id]}
                        message={agentMessages[s.id] ?? ''}
                      />
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className="flex items-center self-stretch shrink-0 px-0.5 pt-2">
                        <div
                          className="text-xs transition-all duration-500"
                          style={{
                            color: steps[STEPS[i + 1].id] === 'active' ? AGENT_CHARS[STEPS[i + 1].id].color :
                                   steps[s.id] === 'done' ? '#10b981' : '#1e293b',
                            textShadow: steps[STEPS[i + 1].id] === 'active'
                              ? `0 0 8px ${AGENT_CHARS[STEPS[i + 1].id].color}`
                              : 'none',
                          }}
                        >
                          →
                        </div>
                      </div>
                    )}
                  </Fragment>
                ))}
              </div>
            </div>

            {/* Rhyme */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Generated Rhyme</div>
              {rhyme ? (
                <>
                  <div className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-2">
                    Topic: {rhyme.topic} · {rhyme.learningConcept} · v{rhyme.version}
                  </div>
                  <div className="bg-slate-800 border border-violet-800/40 rounded-xl p-4 text-sm leading-loose whitespace-pre-wrap text-slate-100">
                    {rhyme.rhyme}
                  </div>
                </>
              ) : (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-500 italic min-h-[80px] flex items-center">
                  Rhyme will appear here after generation...
                </div>
              )}

              {rhymeScore && (
                <div className="mt-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Rhyme Quality Review</div>
                  <ScoreBar label="Entertainment (25%)" value={rhymeScore.entertainment} color="#c77dff" />
                  <ScoreBar label="Educational (25%)" value={rhymeScore.educational} color="#4cc9f0" />
                  <ScoreBar label="Age Appropriate (20%)" value={rhymeScore.ageAppropriate} color="#56cfb2" />
                  <ScoreBar label="Rhythm (10%)" value={rhymeScore.rhythm} color="#ff9f43" />
                  <ScoreBar label="Vocabulary (10%)" value={rhymeScore.simplicity} color="#ff6b9d" />
                  <ScoreBar label="Positive Message (10%)" value={rhymeScore.positiveMessage} color="#5bea8b" />
                  <div className={`mt-3 p-3 rounded-xl text-sm font-bold ${rhymeScore.approved ? 'bg-emerald-950/50 border border-emerald-700 text-emerald-300' : 'bg-amber-950/50 border border-amber-700 text-amber-300'}`}>
                    Total: {rhymeScore.total.toFixed(1)}/10 — {rhymeScore.approved ? '✅ APPROVED' : '⚠️ Needs Refinement'}
                  </div>
                  {!rhymeScore.approved && rhymeScore.feedback.length > 0 && (
                    <div className="mt-2 text-[11px] text-amber-400">Feedback: {rhymeScore.feedback.join(' · ')}</div>
                  )}
                </div>
              )}
            </div>

            {/* Storyboard */}
            {storyboard && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Storyboard — 4-Shot Plan</div>
                <div className="grid grid-cols-4 gap-3">
                  {storyboard.shots.map((shot, i) => (
                    <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                      <div className="h-20 flex items-center justify-center text-3xl" style={{ background: shot.bg || 'linear-gradient(135deg,#1a0a2e,#2d1b4e)' }}>
                        {shot.emoji}
                      </div>
                      <div className="p-2.5">
                        <div className="text-[9px] font-bold text-cyan-400 mb-1">SHOT {i + 1} · {shot.timestamp}</div>
                        <div className="text-[10px] text-slate-300 leading-tight">{shot.description}</div>
                        <div className="text-[9px] text-slate-500 mt-1.5 italic">📷 {shot.camera}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {[
                    { l: 'Music', v: storyboard.musicStyle },
                    { l: 'Mood', v: storyboard.mood },
                    { l: 'Voice', v: storyboard.voiceStyle },
                  ].map(m => (
                    <div key={m.l} className="bg-slate-800 rounded-xl p-2.5 text-center">
                      <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{m.l}</div>
                      <div className="text-[11px] font-bold text-cyan-300">{m.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Video Production Package */}
            {videoMeta && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Video Production Package</div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-3">
                  <div className="text-[10px] font-bold text-violet-400 uppercase tracking-wider mb-2">AI Video Generation Prompt</div>
                  <p className="text-[12px] text-slate-300 leading-relaxed">{videoMeta.videoPrompt}</p>
                  <CopyButton text={videoMeta.videoPrompt} label="Copy prompt" />
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2">Narration Script</div>
                  <p className="text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap">{videoMeta.audioScript}</p>
                  <CopyButton text={videoMeta.audioScript} label="Copy script" />
                </div>
                <div className="mt-3 p-3 bg-violet-950/40 border border-violet-800 rounded-xl text-[11px] text-violet-300">
                  🎬 <strong>Kling AI integrated:</strong> Each scene is generated as a real AI video clip via fal.ai. Set <code className="bg-slate-800 px-1 rounded">FAL_KEY</code> in <code className="bg-slate-800 px-1 rounded">.env.local</code> to enable.
                </div>
              </div>
            )}

            {/* Video Review */}
            {videoScore && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Video Quality Review</div>
                <ScoreBar label="Video Quality (20%)" value={videoScore.videoQuality} color="#c77dff" />
                <ScoreBar label="Audio Quality (15%)" value={videoScore.audioQuality} color="#4cc9f0" />
                <ScoreBar label="Audio Sync (20%)" value={videoScore.audioSync} color="#ff6b9d" />
                <ScoreBar label="Lip Sync (15%)" value={videoScore.lipSync} color="#56cfb2" />
                <ScoreBar label="Character Mood (15%)" value={videoScore.characterMood} color="#ff9f43" />
                <ScoreBar label="Scene Consistency (10%)" value={videoScore.sceneConsistency} color="#5bea8b" />
                <ScoreBar label="Kid Engagement (5%)" value={videoScore.engagement} color="#f8c537" />
                <div className={`mt-3 p-3 rounded-xl text-sm font-bold ${videoScore.approved ? 'bg-emerald-950/50 border border-emerald-700 text-emerald-300' : 'bg-amber-950/50 border border-amber-700 text-amber-300'}`}>
                  Video Score: {videoScore.total.toFixed(1)}/10 — {videoScore.approved ? '✅ APPROVED' : '⚠️ Re-rendering...'}
                </div>
              </div>
            )}

            {/* Captions */}
            {captions && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Platform Captions</div>
                <div className="flex gap-2 mb-4">
                  {(['youtube', 'instagram', 'facebook', 'tiktok'] as Platform[]).map(p => (
                    <button
                      key={p}
                      onClick={() => setCapTab(p)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${capTab === p ? 'bg-violet-900/50 border-violet-500 text-violet-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      {PLATFORM_META[p].icon} {PLATFORM_META[p].name}
                    </button>
                  ))}
                </div>
                {(() => {
                  const c = captions[capTab]
                  const pm = PLATFORM_META[capTab]
                  return (
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                      <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: pm.color }}>{c.creator}</div>
                      <div className="font-bold text-sm mb-2 text-white">{c.title}</div>
                      <div className="text-[12px] text-slate-300 leading-relaxed mb-3">{c.caption}</div>
                      <div className="bg-amber-950/40 border border-amber-800 rounded-lg p-2.5 text-[11px] text-amber-300 font-bold mb-3">📣 {c.cta}</div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {c.hashtags.map(h => (
                          <span key={h} className="text-[10px] bg-slate-700 text-cyan-300 rounded px-2 py-0.5">#{h.replace('#', '')}</span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <CopyButton text={getCapText(capTab)} />
                        <button
                          onClick={() => handleUpload(capTab, pm.url)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-700 border border-slate-600 text-slate-200 hover:border-violet-500 hover:text-violet-300 transition-all">
                          ↗ Open {pm.name}
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Ready Banner */}
            {complete && (
              <div className={`rounded-2xl p-5 border flex items-center gap-4 ${isReady ? 'bg-emerald-950/40 border-emerald-600' : 'bg-slate-800 border-slate-600'}`}>
                <div className="text-4xl">{isReady ? '🎉' : '✅'}</div>
                <div>
                  <div className="font-bold text-lg" style={{ fontFamily: "'Fredoka One', cursive", color: isReady ? '#5bea8b' : '#a78bfa' }}>
                    {isReady ? 'Final Video Ready — Ready to Post!' : 'Final Video Ready'}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    Video: {finalScore.toFixed(1)}/10 · All 7 agents complete ·{' '}
                    {isReady ? 'Copy captions + upload your video to go live' : 'Copy captions to publish'}
                  </div>
                </div>
              </div>
            )}

            {/* Social Posting */}
            {complete && showPublish && captions && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Post to Social Media</div>
                <div className="bg-amber-950/40 border border-amber-800 rounded-xl p-3 text-[11px] text-amber-300 mb-4">
                  <strong>Workflow:</strong> 1) Copy the caption → 2) Click "Upload" to open the platform → 3) Paste caption + upload your video file
                </div>
                <div className="flex flex-col gap-3">
                  {(['youtube', 'instagram', 'facebook', 'tiktok'] as Platform[]).map(pid => {
                    const pm = PLATFORM_META[pid]
                    const c = captions[pid]
                    const txt = getCapText(pid)
                    const published = publishedPlatforms.has(pid)
                    return (
                      <div key={pid} className={`border rounded-xl p-4 flex items-center gap-4 transition-all ${published ? 'bg-emerald-950/30 border-emerald-700' : 'bg-slate-800 border-slate-700'}`}>
                        <div className="text-2xl">{published ? '✅' : pm.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-white flex items-center gap-2">
                            {pm.name}
                            {published && <span className="text-[9px] font-bold bg-emerald-900/60 text-emerald-400 border border-emerald-700 rounded-full px-2 py-0.5">PUBLISHED</span>}
                          </div>
                          <div className="text-[10px] text-slate-400">{pm.desc}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate">{c.title}</div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <CopyButton text={txt} label="Copy" />
                          <button
                            onClick={() => handleUpload(pid, pm.url)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${published ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300' : 'bg-violet-900/50 border-violet-600 text-violet-200 hover:bg-violet-900'}`}>
                            {published ? '↗ Re-upload' : '↗ Upload'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Clear after publish */}
                {publishedPlatforms.size > 0 && (
                  <div className="mt-4 p-4 bg-emerald-950/40 border border-emerald-700 rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-emerald-300">
                        {publishedPlatforms.size === 4 ? '🎉 Published to all platforms!' : `✅ Published to ${publishedPlatforms.size} platform${publishedPlatforms.size > 1 ? 's' : ''}`}
                      </div>
                      <div className="text-[11px] text-emerald-500 mt-0.5">Clear this video from storage to make room for the next one.</div>
                    </div>
                    <button
                      onClick={clearAfterPublish}
                      className="shrink-0 px-4 py-2 rounded-xl text-[11px] font-bold bg-emerald-800 hover:bg-emerald-700 text-emerald-100 border border-emerald-600 transition-all">
                      🗑 Clear & New Video
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-4 sticky top-6">

            {/* Video Package */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Video Package</div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                {job?.finalVideoUrl ? (
                  <VideoPlayer videoUrl={job.finalVideoUrl} videoScore={videoScore} />
                ) : job ? (
                  <div className="relative" style={{ aspectRatio: '9/16' }}>
                    {storyboard && rhyme && (
                      <VideoPreview storyboard={storyboard} rhyme={rhyme} videoScore={videoScore} />
                    )}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 px-4 text-center">
                      <div className="w-6 h-6 border-2 border-slate-700 border-t-violet-400 rounded-full animate-spin" />
                      {(() => {
                        const done = job.clips.filter(c => c.status === 'done').length
                        const total = job.clips.length
                        const label = job.status === 'stitching'
                          ? 'Stitching final video...'
                          : `Rendering clip ${Math.min(done + 1, total)} / ${total}`
                        return (
                          <>
                            <span className="text-[12px] font-bold text-white">{label}</span>
                            <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500 transition-all duration-500" style={{ width: `${(done / total) * 100}%` }} />
                            </div>
                            <span className="text-[10px] text-slate-400">~{job.targetDurationSec}s final video · {job.clipDurationSec}s per clip</span>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                ) : storyboard && rhyme ? (
                  <VideoPreview storyboard={storyboard} rhyme={rhyme} videoScore={videoScore} />
                ) : (
                  <div className="h-36 flex flex-col items-center justify-center gap-2">
                    {running ? (
                      <>
                        <div className="w-5 h-5 border-2 border-slate-700 border-t-violet-400 rounded-full animate-spin" />
                        <span className="text-[11px] text-slate-400">Building package...</span>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl">🎬</div>
                        <span className="text-[11px] text-slate-500">Video appears here</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Log */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Live Agent Activity</div>
              <div ref={logRef} className="bg-slate-950 rounded-xl p-3 h-52 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-[9px] text-slate-600 font-mono shrink-0 mt-0.5 w-14">{l.time}</span>
                    <span className={`text-[11px] leading-tight ${
                      l.type === 'success' ? 'text-emerald-400' :
                      l.type === 'warning' ? 'text-amber-400' :
                      l.type === 'error' ? 'text-red-400' :
                      l.type === 'info' ? 'text-cyan-400' :
                      l.type === 'agent' ? 'text-violet-300 font-bold' :
                      'text-slate-400'
                    }`}>{l.msg}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={startPipeline}
                disabled={running}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: running ? '#1e1a35' : 'linear-gradient(135deg,#ff6b9d,#c77dff)', color: '#fff', border: running ? '1px solid #3d3560' : 'none' }}
              >
                {running ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Running Pipeline...</>
                ) : (
                  <><span>✨</span>{cachedAt ? '🔄 Generate New Rhyme' : complete ? 'Generate New Rhyme' : 'Generate Rhyme'}</>
                )}
              </button>

              {complete && (
                <button
                  onClick={() => setShowPublish(p => !p)}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
                  style={{ background: 'linear-gradient(135deg,#f8c537,#ff9f43)', color: '#1a1000' }}
                >
                  <span>📲</span>{showPublish ? 'Hide Publishing' : 'Post to Social Media'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
