'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import type {
  LogEntry, RhymeData, RhymeScore, Storyboard, VideoScore,
  SocialCaptions, VideoMeta, VideoJob, Platform, ContentType,
} from '@/types'
import AuthButton from '@/components/AuthButton'
import Logo from '@/components/Logo'

// ── Types ────────────────────────────────────────────────────────────────────
type StepStatus = 'idle' | 'active' | 'done' | 'failed'
type StepId = 'rhyme' | 'review' | 'storyboard' | 'video' | 'vreview' | 'render' | 'publish'

const PLATFORM_META = {
  youtube:   { name: 'YouTube Shorts',  icon: '▶️', url: 'https://studio.youtube.com',           color: '#FF0000', desc: 'Upload → Create → Upload video' },
  instagram: { name: 'Instagram Reels', icon: '📸', url: 'https://www.instagram.com',              color: '#E1306C', desc: 'Open app → Reels → +' },
  facebook:  { name: 'Facebook Reels',  icon: '👍', url: 'https://www.facebook.com/reels/create', color: '#1877F2', desc: 'Reels → Create Reel' },
  tiktok:    { name: 'TikTok',          icon: '🎵', url: 'https://www.tiktok.com/upload',         color: '#000000', desc: 'TikTok → + → Upload' },
}

const CONTENT_TYPES: {
  id: ContentType; label: string; icon: string; color: string
  gradient: string; placeholder: string; desc: string
}[] = [
  { id: 'kids_rhyme',    label: 'Kids Rhyme',    icon: '🎠', color: '#8676FF', gradient: 'linear-gradient(135deg,#3b0764,#581c87)', placeholder: 'e.g. "counting animals at a farm"',           desc: 'Educational rhymes for toddlers 2–5' },
  { id: 'poem',          label: 'Poem',           icon: '📜', color: '#60a5fa', gradient: 'linear-gradient(135deg,#1e3a5f,#1e40af)', placeholder: 'e.g. "a poem about rain and renewal"',         desc: 'Evocative poetry with rich imagery' },
  { id: 'short_film',    label: 'Short Film',     icon: '🎬', color: '#f87171', gradient: 'linear-gradient(135deg,#450a0a,#7f1d1d)', placeholder: 'e.g. "a stranger finds a mysterious letter"', desc: 'Cinematic micro-narrative, 60s format' },
  { id: 'advertisement', label: 'Advertisement',  icon: '📣', color: '#fb923c', gradient: 'linear-gradient(135deg,#431407,#7c2d12)', placeholder: 'e.g. "eco-friendly water bottle launch"',      desc: 'Hook → Solution → CTA video ad' },
  { id: 'educational',   label: 'Educational',    icon: '🧠', color: '#34d399', gradient: 'linear-gradient(135deg,#022c22,#064e3b)', placeholder: 'e.g. "how photosynthesis works"',             desc: 'Feynman-style explainer video' },
  { id: 'music_video',   label: 'Music Video',    icon: '🎵', color: '#f472b6', gradient: 'linear-gradient(135deg,#500724,#831843)', placeholder: 'e.g. "upbeat pop song about friendship"',     desc: 'Lyrics + cinematic visual treatment' },
  { id: 'custom',        label: 'Custom',         icon: '✨', color: '#22D3EE', gradient: 'linear-gradient(135deg,#1e1b4b,#312e81)', placeholder: 'Describe exactly what you want to create...',  desc: 'Your creative brief, any format' },
]

const CONTENT_LABEL: Record<ContentType, string> = {
  kids_rhyme: 'Generated Rhyme', poem: 'Generated Poem', short_film: 'Generated Script',
  advertisement: 'Ad Script', educational: 'Explainer Script', music_video: 'Song Lyrics', custom: 'Generated Content',
}

const TEMPLATES: { label: string; brief: string; type: ContentType }[] = [
  { label: '🦆 Duck Song',         brief: 'baby ducks learning to swim at the pond',        type: 'kids_rhyme' },
  { label: '🌅 Sunrise Poem',      brief: 'sunrise over misty mountain peaks',               type: 'poem' },
  { label: '☕ Coffee Ad',          brief: 'premium artisan morning coffee experience',       type: 'advertisement' },
  { label: '🧬 Science Explainer', brief: 'how DNA replication works inside a cell',         type: 'educational' },
  { label: '🎸 Road Anthem',       brief: 'indie rock song about freedom on the open road',  type: 'music_video' },
  { label: '🚀 Astronaut Story',   brief: 'astronaut finally returns home to family',        type: 'short_film' },
]

const CACHE_KEY = 'ai_studio_result_v2'

interface UsageSnapshot {
  plan: string
  videoCount: number
  videoLimit: number | null
}

// ── Script text renderer ─────────────────────────────────────────────────────
// Several content types (ads, explainers, short films, custom) come back
// with **label** markers (e.g. "**Visuals:**") — render them as emphasis
// instead of leaving literal asterisks, since they're genuinely useful
// structure for scanning a script before production, not noise to strip.
function renderScriptText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-accent-400">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
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
    <button onClick={copy} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${copied ? 'bg-emerald-500/10 border-emerald-600 text-emerald-400' : 'bg-ink-600 border-ink-500 text-ink-200 hover:border-accent-500 hover:text-accent-400'}`}>
      {copied ? '✓ Copied!' : `📋 ${label}`}
    </button>
  )
}

// ── Content Type Card ─────────────────────────────────────────────────────────
function TypeCard({ ct, selected, onSelect, disabled }: {
  ct: typeof CONTENT_TYPES[0]; selected: ContentType; onSelect: (t: ContentType) => void; disabled?: boolean
}) {
  const isSelected = selected === ct.id
  return (
    <button
      onClick={() => !disabled && onSelect(ct.id)}
      disabled={disabled}
      className="relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center disabled:pointer-events-none"
      style={{
        background: isSelected ? `${ct.color}14` : 'transparent',
        borderColor: isSelected ? ct.color : '#23252F',
      }}
    >
      <span className="text-2xl">{ct.icon}</span>
      <span className="text-[10px] font-semibold text-ink-50 leading-tight">{ct.label}</span>
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
          style={{ background: ct.color }}>✓</div>
      )}
    </button>
  )
}

// ── Content Type Selector ─────────────────────────────────────────────────────
function ContentTypeSelector({
  selected, onSelect, brief, onBriefChange, disabled,
}: {
  selected: ContentType; onSelect: (t: ContentType) => void
  brief: string; onBriefChange: (v: string) => void; disabled?: boolean
}) {
  const meta = CONTENT_TYPES.find(t => t.id === selected)!
  return (
    <div className="bg-ink-700 border border-ink-500 rounded-2xl p-4 sm:p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-300 mb-4">What do you want to create?</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {CONTENT_TYPES.map(ct => (
          <TypeCard key={ct.id} ct={ct} selected={selected} onSelect={onSelect} disabled={disabled} />
        ))}
      </div>
      <div className="text-[12px] text-ink-200 mb-2">{meta.desc}</div>
      <textarea
        value={brief}
        onChange={e => onBriefChange(e.target.value)}
        placeholder={meta.placeholder}
        maxLength={500}
        rows={2}
        disabled={disabled}
        className="w-full bg-ink-600 border border-ink-500 rounded-xl px-3 py-2 text-[13px] text-ink-100 placeholder-ink-300 resize-none focus:outline-none focus:border-accent-500 transition-colors disabled:opacity-40"
      />
      <div className="text-[10px] text-ink-400 mt-1">Optional — leave blank for AI to decide · {brief.length}/500</div>
    </div>
  )
}

// ── Pipeline 3-Phase Progress ─────────────────────────────────────────────────
function PipelineProgress({ steps, job }: { steps: Record<StepId, StepStatus>; job: VideoJob | null }) {
  const phases = [
    {
      label: 'Writing', icon: '✍️',
      done: steps.rhyme === 'done' && steps.review === 'done',
      active: steps.rhyme === 'active' || steps.review === 'active',
    },
    {
      label: 'Designing', icon: '🎨',
      done: steps.storyboard === 'done' && steps.video === 'done' && steps.publish === 'done',
      active: steps.storyboard === 'active' || steps.video === 'active' || steps.publish === 'active',
    },
    {
      label: 'Rendering', icon: '🎬',
      done: steps.render === 'done',
      active: steps.render === 'active',
    },
  ]
  const clipsDone = job?.clips.filter(c => c.status === 'done').length ?? 0
  const clipsTotal = job?.clips.length ?? 0
  const renderPct = clipsTotal > 0 ? (clipsDone / clipsTotal) * 100 : 0

  return (
    <div className="bg-ink-700 border border-ink-500 rounded-2xl p-4 sm:p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-300 mb-4">Creating your video...</div>
      <div className="flex flex-col sm:flex-row items-stretch gap-2 mb-4">
        {phases.map((phase, i) => (
          <div key={phase.label} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-2 flex-1 p-3 rounded-xl border transition-all ${
              phase.done ? 'border-emerald-700 bg-emerald-500/10' :
              phase.active ? 'border-accent-500 bg-accent-500/10' :
              'border-ink-500 bg-ink-700'
            }`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                phase.done ? 'bg-emerald-600 text-white' :
                phase.active ? 'bg-accent-500 text-white animate-pulse' :
                'bg-ink-500 text-ink-300'
              }`}>
                {phase.done ? '✓' : phase.icon}
              </div>
              <div>
                <div className={`text-[11px] font-semibold ${
                  phase.done ? 'text-emerald-400' :
                  phase.active ? 'text-accent-400' :
                  'text-ink-400'
                }`}>{phase.label}</div>
                <div className="text-[9px] text-ink-300">
                  {phase.done ? 'Complete' : phase.active ? 'In progress...' : 'Waiting'}
                </div>
              </div>
            </div>
            {i < phases.length - 1 && (
              <div className={`hidden sm:block text-xs shrink-0 ${phase.done ? 'text-emerald-600' : 'text-ink-500'}`}>→</div>
            )}
          </div>
        ))}
      </div>
      {steps.render === 'active' && clipsTotal > 0 && (
        <div>
          <div className="flex justify-between text-[10px] text-ink-300 mb-1.5">
            <span>Rendering clips</span>
            <span>{clipsDone} / {clipsTotal}</span>
          </div>
          <div className="h-2 bg-ink-600 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${renderPct}%`, background: 'linear-gradient(90deg,#6D5DFC,#22D3EE)' }} />
          </div>
        </div>
      )}
      {steps.render === 'active' && job?.status === 'stitching' && (
        <div className="flex items-center gap-2 text-[11px] text-accent-400 mt-2">
          <div className="w-3 h-3 border-2 border-accent-700 border-t-accent-400 rounded-full animate-spin" />
          Stitching final video...
        </div>
      )}
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
    if (!document.fullscreenElement) await containerRef.current.requestFullscreen()
    else await document.exitFullscreen()
  }

  const lineIdx = Math.min(Math.floor(shotIdx * lines.length / storyboard.shots.length), lines.length - 1)

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl select-none"
      style={{ aspectRatio: '9/16', background: shot.bg || 'linear-gradient(135deg,#1a0a2e,#2d1b4e)' }}>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-3 text-center">
        <div className="text-6xl mb-3" style={{ animation: 'bounce 1s infinite' }}>{shot.emoji}</div>
        <div className="text-[10px] font-semibold text-white/60 leading-relaxed line-clamp-3">{shot.description}</div>
      </div>
      <div className="absolute top-2 left-2 right-2 flex justify-between items-center">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-0.5 text-[9px] font-bold text-white/80">
          SHOT {shotIdx + 1} / {storyboard.shots.length} · {shot.timestamp}
        </div>
        <div className="bg-accent-700/70 backdrop-blur-sm rounded-lg px-2 py-0.5 text-[9px] font-bold text-accent-50">
          📷 {shot.camera?.split(',')[0]}
        </div>
      </div>
      <div className="absolute bottom-14 left-2 right-2">
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center text-[11px] font-bold text-white leading-snug">
          {renderScriptText(lines[lineIdx] ?? '')}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between bg-black/50 backdrop-blur-sm">
        <div className="flex gap-1">
          {storyboard.shots.map((_, i) => (
            <button key={i} onClick={() => { setShotIdx(i); setPlaying(false) }}
              className="transition-all rounded-full"
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

// ── Real Video Player ─────────────────────────────────────────────────────────
function VideoPlayer({ videoUrl }: { videoUrl: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = async () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) await containerRef.current.requestFullscreen()
    else await document.exitFullscreen()
  }

  return (
    <div ref={containerRef} className="relative rounded-xl overflow-hidden bg-black">
      <video controls autoPlay loop playsInline src={videoUrl}
        className="w-full" style={{ aspectRatio: '9/16', objectFit: 'cover' }} />
      <button onClick={toggleFullscreen}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white text-sm transition-all backdrop-blur-sm border border-white/20">
        {isFullscreen ? '✕' : '⛶'}
      </button>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [steps, setStepsState] = useState<Record<StepId, StepStatus>>({
    rhyme: 'idle', review: 'idle', storyboard: 'idle', video: 'idle', vreview: 'idle', render: 'idle', publish: 'idle',
  })
  const [logs, setLogs] = useState<LogEntry[]>([])
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
  const [contentType, setContentType] = useState<ContentType>('kids_rhyme')
  const [userBrief, setUserBrief] = useState('')
  const [publishedPlatforms, setPublishedPlatforms] = useState<Set<Platform>>(new Set())
  const [capTab, setCapTab] = useState<Platform>('youtube')
  const [showPublish, setShowPublish] = useState(false)
  const [agentMessages, setAgentMessages] = useState<Partial<Record<StepId, string>>>({})
  const [usage, setUsage] = useState<UsageSnapshot>({ plan: 'free', videoCount: 0, videoLimit: 3 })
  const [scriptExpanded, setScriptExpanded] = useState(true)
  const abortRef = useRef<AbortController | null>(null)
  const activeStepRef = useRef<StepId | null>(null)

  const refreshUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/usage')
      if (res.ok) setUsage(await res.json())
    } catch { /* offline — keep last known usage */ }
  }, [])

  // Load cache and server-side usage on mount
  useEffect(() => {
    refreshUsage()
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
      if (data.contentType) setContentType(data.contentType)
      if (data.userBrief) setUserBrief(data.userBrief)
      if (data.publishedPlatforms?.length) setPublishedPlatforms(new Set(data.publishedPlatforms as Platform[]))
      setComplete(true)
      setStepsState({ rhyme: 'done', review: 'done', storyboard: 'done', video: 'done', vreview: 'done', render: data.job?.finalVideoUrl ? 'done' : 'idle', publish: 'done' })
    } catch { /* corrupt cache — ignore */ }
  }, [])

  // Save to cache when pipeline completes
  useEffect(() => {
    if (!complete || !rhyme || !storyboard) return
    try {
      const ts = new Date().toLocaleString()
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        rhyme, rhymeScore, storyboard, videoMeta, videoScore, job, captions,
        contentType, userBrief, publishedPlatforms: Array.from(publishedPlatforms), cachedAt: ts,
      }))
      setCachedAt(ts)
    } catch { /* quota */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete])

  const addLog = useCallback((msg: string, type: LogEntry['type'] = '') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLogs(prev => [...prev, { time, msg, type }])
    const stepId = activeStepRef.current
    if (stepId) setAgentMessages(prev => ({ ...prev, [stepId]: msg }))
  }, [])

  const setStep = useCallback((id: StepId, status: StepStatus) => {
    setStepsState(prev => ({ ...prev, [id]: status }))
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
    setStepsState({ rhyme: 'idle', review: 'idle', storyboard: 'idle', video: 'idle', vreview: 'idle', render: 'idle', publish: 'idle' })
    setLogs([])
    setRhyme(null); setRhymeScore(null); setStoryboard(null)
    setVideoScore(null); setCaptions(null); setVideoMeta(null); setJob(null)
    setComplete(false); setShowPublish(false); setScriptExpanded(true)
    setAgentMessages({})
    activeStepRef.current = null
  }, [])

  const renderClip = useCallback(async (jobId: string, clipIndex: number, signal: AbortSignal): Promise<VideoJob> => {
    const MAX_ATTEMPTS = 12
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

  const renderVideo = useCallback(async (initialJob: VideoJob, signal: AbortSignal) => {
    setStep('render', 'active')
    addLog(`Rendering ${initialJob.clips.length} clips (~${initialJob.targetDurationSec}s total)...`, 'agent')

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

    addLog('Stitching clips into final video...', 'agent')
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
    addLog('🎉 Pipeline complete! Final video ready.', 'success')
  }, [renderClip, addLog, setStep])

  const startPipeline = useCallback(async () => {
    if (running) return
    if (usage.videoLimit !== null && usage.videoCount >= usage.videoLimit) return
    reset()
    setRunning(true)
    abortRef.current = new AbortController()
    let createdJob: VideoJob | null = null
    try {
      const params = new URLSearchParams()
      params.set('type', contentType)
      if (userBrief.trim()) params.set('brief', userBrief.trim())

      const res = await fetch(`/api/pipeline/start?${params}`, { signal: abortRef.current.signal })
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
                { const stepId = activeStepRef.current; if (stepId) setAgentMessages(prev => ({ ...prev, [stepId]: chunk.payload.msg as string })) }
                break
              case 'step':   setStep(chunk.payload.id as StepId, chunk.payload.status as StepStatus); break
              case 'rhyme':  setRhyme(chunk.payload as RhymeData); break
              case 'rhyme_score': setRhymeScore(chunk.payload as RhymeScore); break
              case 'storyboard': setStoryboard(chunk.payload as Storyboard); break
              case 'video_meta': setVideoMeta(chunk.payload as VideoMeta); break
              case 'video_score': setVideoScore(chunk.payload as VideoScore); break
              case 'job':    createdJob = chunk.payload as VideoJob; setJob(createdJob); break
              case 'captions': setCaptions(chunk.payload as SocialCaptions); break
              case 'complete': setComplete(true); break
              case 'error':  addLog(`Error: ${(chunk.payload as { message: string }).message}`, 'error'); break
            }
          } catch { /* skip malformed */ }
        }
      }
      if (createdJob) await renderVideo(createdJob, abortRef.current.signal)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        addLog(`Connection error: ${(err as Error).message}`, 'error')
        addLog('Make sure GOOGLE_API_KEY is set in your environment', 'warning')
      }
    } finally {
      setRunning(false)
      refreshUsage()
    }
  }, [running, usage, reset, setStep, addLog, renderVideo, contentType, userBrief, refreshUsage])

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
    setStepsState({ rhyme: 'idle', review: 'idle', storyboard: 'idle', video: 'idle', vreview: 'idle', render: 'idle', publish: 'idle' })
    setLogs([])
    setRhyme(null); setRhymeScore(null); setStoryboard(null)
    setVideoScore(null); setCaptions(null); setVideoMeta(null); setJob(null)
    setComplete(false); setShowPublish(false); setScriptExpanded(true)
  }, [])

  const getCapText = (platform: Platform) => {
    if (!captions) return ''
    const c = captions[platform]
    return `${c.title}\n\n${c.caption}\n\n${c.cta}\n\n${c.hashtags.map(h => '#' + h.replace('#', '')).join(' ')}`
  }

  const selectedTypeMeta = CONTENT_TYPES.find(t => t.id === contentType)!
  const contentLabel = CONTENT_LABEL[contentType]
  const videosLeft = usage.videoLimit === null ? null : Math.max(0, usage.videoLimit - usage.videoCount)
  const isOverLimit = usage.videoLimit !== null && usage.videoCount >= usage.videoLimit
  const isUnlimited = usage.videoLimit === null
  // suppress unused-variable lint for agentMessages (kept for cache compat)
  void agentMessages; void cachedAt; void logs

  return (
    <div className="min-h-screen bg-ink text-ink-50">
      {/* Header */}
      <div className="border-b border-ink-500 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Logo subtitle="Turn any idea into a short video in 90 seconds" />
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {!isUnlimited && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold ${isOverLimit ? 'border-amber-600 bg-amber-500/10 text-amber-300' : 'border-ink-500 bg-ink-700 text-ink-200'}`}>
                {isOverLimit ? '⚠️ Free limit reached' : `🎬 ${videosLeft} free video${videosLeft !== 1 ? 's' : ''} left`}
              </div>
            )}
            <div className="flex items-center gap-2 bg-ink-700 border border-ink-500 rounded-full px-4 py-1.5">
              <div className={`w-2 h-2 rounded-full ${running ? 'bg-emerald-400 animate-pulse' : complete ? 'bg-accent-400' : 'bg-ink-400'}`} />
              <span className="text-[11px] font-semibold text-ink-200">
                {running ? 'Creating...' : complete ? '✅ Ready' : 'Ready'}
              </span>
            </div>
            <a href="/videos" className="text-[11px] font-semibold text-ink-300 hover:text-ink-50 transition-colors">
              My Videos
            </a>
            <AuthButton />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

          {/* ── LEFT ── */}
          <div className="flex flex-col gap-5 min-w-0">

            <ContentTypeSelector
              selected={contentType}
              onSelect={setContentType}
              brief={userBrief}
              onBriefChange={setUserBrief}
              disabled={running}
            />

            {/* Quick-start templates */}
            {!running && !complete && (
              <div className="bg-ink-700 border border-ink-500 rounded-2xl p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-300 mb-3">Quick Start Templates</div>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.label}
                      onClick={() => { setContentType(t.type); setUserBrief(t.brief) }}
                      className="px-3 py-1.5 rounded-full text-[11px] font-semibold border border-ink-500 bg-ink-600 text-ink-200 hover:border-accent-500 hover:text-accent-400 transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 3-phase progress while running */}
            {running && <PipelineProgress steps={steps} job={job} />}

            {/* Generated script */}
            {rhyme && (
              <div className="bg-ink-700 border border-ink-500 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setScriptExpanded(e => !e)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-ink-600/50 transition-colors"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-300">
                    {selectedTypeMeta.icon} {contentLabel} · {rhyme.topic}
                  </div>
                  <span className="text-ink-300 text-xs">{scriptExpanded ? '▲' : '▼'}</span>
                </button>
                {scriptExpanded && (
                  <div className="px-5 pb-4">
                    <div className="bg-ink-600 border border-accent-700/40 rounded-xl p-4 text-sm leading-loose whitespace-pre-wrap text-ink-100">
                      {renderScriptText(rhyme.rhyme)}
                    </div>
                    {rhymeScore && (
                      <div className={`mt-3 px-3 py-2 rounded-xl text-[11px] font-semibold inline-flex items-center gap-2 ${rhymeScore.approved ? 'bg-emerald-500/10 border border-emerald-700 text-emerald-300' : 'bg-amber-500/10 border border-amber-700 text-amber-300'}`}>
                        {rhymeScore.approved ? '✅' : '⚠️'} Quality: {rhymeScore.total.toFixed(1)}/10
                        {!rhymeScore.approved && rhymeScore.feedback[0] && ` — ${rhymeScore.feedback[0]}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Platform captions */}
            {captions && (
              <div className="bg-ink-700 border border-ink-500 rounded-2xl p-5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-300 mb-3">Platform Captions</div>
                <div className="flex gap-2 mb-4 flex-wrap">
                  {(['youtube', 'instagram', 'facebook', 'tiktok'] as Platform[]).map(p => (
                    <button key={p} onClick={() => setCapTab(p)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${capTab === p ? 'bg-accent-500/15 border-accent-500 text-accent-400' : 'border-ink-500 text-ink-300 hover:border-ink-400'}`}>
                      {PLATFORM_META[p].icon} {PLATFORM_META[p].name}
                    </button>
                  ))}
                </div>
                {(() => {
                  const c = captions[capTab]
                  const pm = PLATFORM_META[capTab]
                  return (
                    <div className="bg-ink-600 border border-ink-500 rounded-xl p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: pm.color }}>{c.creator}</div>
                      <div className="font-semibold text-sm mb-2 text-ink-50">{c.title}</div>
                      <div className="text-[12px] text-ink-200 leading-relaxed mb-3">{c.caption}</div>
                      <div className="bg-amber-500/10 border border-amber-800 rounded-lg p-2.5 text-[11px] text-amber-300 font-semibold mb-3">📣 {c.cta}</div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {c.hashtags.map(h => (
                          <span key={h} className="text-[10px] bg-ink-500 text-teal rounded px-2 py-0.5">#{h.replace('#', '')}</span>
                        ))}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <CopyButton text={getCapText(capTab)} />
                        <button onClick={() => handleUpload(capTab, pm.url)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-ink-500 border border-ink-400 text-ink-100 hover:border-accent-500 hover:text-accent-400 transition-colors">
                          ↗ Open {pm.name}
                        </button>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* Social publish panel */}
            {complete && showPublish && captions && (
              <div className="bg-ink-700 border border-ink-500 rounded-2xl p-5">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-300 mb-4">Post to Social Media</div>
                <div className="bg-amber-500/10 border border-amber-800 rounded-xl p-3 text-[11px] text-amber-300 mb-4">
                  <strong>Workflow:</strong> 1) Copy the caption → 2) Click &quot;Upload&quot; to open the platform → 3) Paste caption + upload your video file
                </div>
                <div className="flex flex-col gap-3">
                  {(['youtube', 'instagram', 'facebook', 'tiktok'] as Platform[]).map(pid => {
                    const pm = PLATFORM_META[pid]
                    const c = captions[pid]
                    const txt = getCapText(pid)
                    const published = publishedPlatforms.has(pid)
                    return (
                      <div key={pid} className={`border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 transition-all ${published ? 'bg-emerald-500/10 border-emerald-700' : 'bg-ink-600 border-ink-500'}`}>
                        <div className="text-2xl">{published ? '✅' : pm.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-ink-50 flex items-center gap-2 flex-wrap">
                            {pm.name}
                            {published && <span className="text-[9px] font-semibold bg-emerald-900/60 text-emerald-400 border border-emerald-700 rounded-full px-2 py-0.5">PUBLISHED</span>}
                          </div>
                          <div className="text-[10px] text-ink-300">{pm.desc}</div>
                          <div className="text-[10px] text-ink-400 mt-0.5 truncate">{c.title}</div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <CopyButton text={txt} label="Copy" />
                          <button onClick={() => handleUpload(pid, pm.url)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${published ? 'bg-emerald-900/40 border-emerald-700 text-emerald-300' : 'bg-accent-500/15 border-accent-500 text-accent-400 hover:bg-accent-500/25'}`}>
                            {published ? '↗ Re-upload' : '↗ Upload'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {publishedPlatforms.size > 0 && (
                  <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-700 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-emerald-300">
                        {publishedPlatforms.size === 4 ? '🎉 Published to all platforms!' : `✅ Published to ${publishedPlatforms.size} platform${publishedPlatforms.size > 1 ? 's' : ''}`}
                      </div>
                      <div className="text-[11px] text-emerald-500 mt-0.5">Clear this video to make room for your next one.</div>
                    </div>
                    <button onClick={clearAfterPublish}
                      className="shrink-0 px-4 py-2 rounded-xl text-[11px] font-semibold bg-emerald-800 hover:bg-emerald-700 text-emerald-100 border border-emerald-600 transition-colors">
                      🗑 Clear & New Video
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT (sticky on desktop) ── */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">

            {/* Video player / preview */}
            <div className="bg-ink-700 border border-ink-500 rounded-2xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-300 mb-3">Your Video</div>
              <div className="bg-ink-600 border border-ink-500 rounded-xl overflow-hidden">
                {job?.finalVideoUrl ? (
                  <VideoPlayer videoUrl={job.finalVideoUrl} />
                ) : job ? (
                  <div className="relative" style={{ aspectRatio: '9/16' }}>
                    {storyboard && rhyme && (
                      <VideoPreview storyboard={storyboard} rhyme={rhyme} videoScore={videoScore} />
                    )}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 px-4 text-center">
                      <div className="w-6 h-6 border-2 border-ink-400 border-t-accent-400 rounded-full animate-spin" />
                      {(() => {
                        const done = job.clips.filter(c => c.status === 'done').length
                        const total = job.clips.length
                        const label = job.status === 'stitching' ? 'Stitching final video...' : `Rendering clip ${Math.min(done + 1, total)} / ${total}`
                        return (
                          <>
                            <span className="text-[12px] font-semibold text-white">{label}</span>
                            <div className="w-full h-1.5 bg-ink-500 rounded-full overflow-hidden">
                              <div className="h-full bg-accent-500 transition-all duration-500" style={{ width: `${(done / total) * 100}%` }} />
                            </div>
                            <span className="text-[10px] text-ink-300">~{job.targetDurationSec}s final video</span>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                ) : storyboard && rhyme ? (
                  <VideoPreview storyboard={storyboard} rhyme={rhyme} videoScore={videoScore} />
                ) : (
                  <div className="h-52 flex flex-col items-center justify-center gap-2">
                    {running ? (
                      <>
                        <div className="w-5 h-5 border-2 border-ink-400 border-t-accent-400 rounded-full animate-spin" />
                        <span className="text-[11px] text-ink-300">Generating...</span>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl">{selectedTypeMeta.icon}</div>
                        <span className="text-[11px] text-ink-300">Video appears here</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Download */}
              {job?.finalVideoUrl && (
                <a href={job.finalVideoUrl} download="ai-studio-video.mp4" target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm bg-emerald-700 hover:bg-emerald-600 text-white transition-colors">
                  ⬇ Download Video
                </a>
              )}

              {complete && (
                <div className="mt-3 text-center text-[11px] text-emerald-400 font-semibold">
                  🎉 Pipeline complete! Ready to post.
                </div>
              )}
            </div>

            {/* Upgrade CTA — shows after 2 videos used */}
            {!isUnlimited && usage.videoCount >= 2 && (
              <div className="bg-ink-700 border border-accent-700/50 rounded-2xl p-4">
                <div className="text-[11px] font-semibold text-accent-400 mb-1">
                  {isOverLimit ? '🔒 Free limit reached' : '⚡ Almost out of free videos'}
                </div>
                <div className="text-[10px] text-ink-300 mb-3">
                  {isOverLimit
                    ? 'Upgrade to Creator for unlimited AI videos.'
                    : `You've used ${usage.videoCount} of ${usage.videoLimit} free videos this month.`}
                </div>
                <div className="flex flex-col gap-1.5 mb-3">
                  {['Unlimited AI image videos', 'No watermarks', '20 Kling AI videos/month'].map(f => (
                    <div key={f} className="flex items-center gap-2 text-[10px] text-ink-200">
                      <span className="text-emerald-400">✓</span> {f}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <a href="/pricing" className="flex-1 py-2 rounded-xl text-[11px] font-semibold bg-accent-500 hover:bg-accent-600 text-white text-center transition-colors">
                    Creator — $19.99/mo
                  </a>
                  <a href="/pricing" className="px-3 py-2 rounded-xl text-[11px] font-semibold bg-ink-600 hover:bg-ink-500 text-ink-200 border border-ink-500 transition-colors">
                    See plans
                  </a>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={startPipeline}
                disabled={running || isOverLimit}
                className="w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: running ? '#181923' : 'linear-gradient(135deg,#6D5DFC,#22D3EE)', color: '#fff', border: running ? '1px solid #34374A' : 'none' }}
              >
                {running ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating...</>
                ) : isOverLimit ? (
                  <>🔒 Free limit reached</>
                ) : (
                  <><span>{selectedTypeMeta.icon}</span>{complete ? '🔄 Create Another' : `✨ Generate ${selectedTypeMeta.label}`}</>
                )}
              </button>

              {complete && (
                <button
                  onClick={() => setShowPublish(p => !p)}
                  className="w-full py-3 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-ink-900 transition-colors"
                >
                  <span>📲</span>{showPublish ? 'Hide Publishing' : 'Post to Social Media'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-ink-500 px-4 sm:px-6 py-5 mt-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-4 text-[12px] text-ink-300">
          <a href="/privacy" className="hover:text-ink-100 transition-colors">Privacy Policy</a>
          <span className="text-ink-500">·</span>
          <a href="/terms" className="hover:text-ink-100 transition-colors">Terms of Service</a>
        </div>
      </div>
    </div>
  )
}
