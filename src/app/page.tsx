'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import type { LogEntry, RhymeData, RhymeScore, Storyboard, VideoScore, SocialCaptions, VideoData, Platform } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────
type StepStatus = 'idle' | 'active' | 'done' | 'failed'
type StepId = 'rhyme' | 'review' | 'storyboard' | 'video' | 'vreview' | 'publish'

const STEPS: { id: StepId; icon: string; name: string; sub: string }[] = [
  { id: 'rhyme',      icon: '✍️', name: 'Rhyme Generator',    sub: 'Generating rhyme' },
  { id: 'review',     icon: '🔍', name: 'Rhyme Reviewer',     sub: 'Scoring quality' },
  { id: 'storyboard', icon: '🎨', name: 'Storyboard Planner', sub: 'Planning scenes' },
  { id: 'video',      icon: '🎬', name: 'Video Generator',    sub: 'Building package' },
  { id: 'vreview',    icon: '⭐', name: 'Video Reviewer',     sub: 'Quality check' },
  { id: 'publish',    icon: '🚀', name: 'Social Publisher',   sub: 'Preparing assets' },
]

const PLATFORM_META = {
  youtube:   { name: 'YouTube Shorts',  icon: '▶️', url: 'https://studio.youtube.com',           color: '#FF0000', desc: 'Upload → Create → Upload video' },
  instagram: { name: 'Instagram Reels', icon: '📸', url: 'https://www.instagram.com',              color: '#E1306C', desc: 'Open app → Reels → +' },
  facebook:  { name: 'Facebook Reels',  icon: '👍', url: 'https://www.facebook.com/reels/create', color: '#1877F2', desc: 'Reels → Create Reel' },
  tiktok:    { name: 'TikTok',          icon: '🎵', url: 'https://www.tiktok.com/upload',         color: '#000000', desc: 'TikTok → + → Upload' },
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

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [steps, setSteps] = useState<Record<StepId, StepStatus>>({
    rhyme: 'idle', review: 'idle', storyboard: 'idle', video: 'idle', vreview: 'idle', publish: 'idle'
  })
  const [logs, setLogs] = useState<LogEntry[]>([{ time: '--:--:--', msg: 'Studio ready. Click Generate Rhyme to start.', type: '' }])
  const [rhyme, setRhyme] = useState<RhymeData | null>(null)
  const [rhymeScore, setRhymeScore] = useState<RhymeScore | null>(null)
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null)
  const [videoScore, setVideoScore] = useState<VideoScore | null>(null)
  const [captions, setCaptions] = useState<SocialCaptions | null>(null)
  const [videoMeta, setVideoMeta] = useState<{ videoPrompt: string; audioScript: string } | null>(null)
  const [videoData, setVideoData] = useState<VideoData | null>(null)
  const [running, setRunning] = useState(false)
  const [complete, setComplete] = useState(false)
  const [capTab, setCapTab] = useState<Platform>('youtube')
  const [showPublish, setShowPublish] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const addLog = useCallback((msg: string, type: LogEntry['type'] = '') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false })
    setLogs(prev => [...prev, { time, msg, type }])
  }, [])

  const setStep = useCallback((id: StepId, status: StepStatus) => {
    setSteps(prev => ({ ...prev, [id]: status }))
  }, [])

  const reset = useCallback(() => {
    setSteps({ rhyme: 'idle', review: 'idle', storyboard: 'idle', video: 'idle', vreview: 'idle', publish: 'idle' })
    setLogs([])
    setRhyme(null); setRhymeScore(null); setStoryboard(null)
    setVideoScore(null); setCaptions(null); setVideoMeta(null); setVideoData(null)
    setComplete(false); setShowPublish(false)
  }, [])

  const startPipeline = useCallback(async () => {
    if (running) return
    reset()
    setRunning(true)

    abortRef.current = new AbortController()
    try {
      const res = await fetch('/api/pipeline', { signal: abortRef.current.signal })
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
                setVideoMeta(chunk.payload as { videoPrompt: string; audioScript: string })
                break
              case 'video_data':
                setVideoData(chunk.payload as VideoData)
                break
              case 'video_score':
                setVideoScore(chunk.payload as VideoScore)
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
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        addLog(`Connection error: ${(err as Error).message}`, 'error')
        addLog('Make sure ANTHROPIC_API_KEY is set in your .env.local file', 'warning')
      }
    } finally {
      setRunning(false)
    }
  }, [running, reset, setStep, addLog])

  const getCapText = (platform: Platform) => {
    if (!captions) return ''
    const c = captions[platform]
    return `${c.title}\n\n${c.caption}\n\n${c.cta}\n\n${c.hashtags.map(h => '#' + h.replace('#', '')).join(' ')}`
  }

  const stepColors: Record<StepStatus, string> = {
    idle: 'border-slate-700 bg-slate-900',
    active: 'border-violet-500 bg-violet-950/50',
    done: 'border-emerald-600 bg-emerald-950/40',
    failed: 'border-amber-500 bg-amber-950/30',
  }

  const finalScore = videoScore?.total ?? 0
  const isReady = finalScore > 8

  return (
    <div className="min-h-screen bg-[#0a0815] text-white" style={{ fontFamily: "'Nunito', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');`}</style>

      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Fredoka One', cursive", background: 'linear-gradient(135deg,#ff6b9d,#c77dff,#4cc9f0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              🎬 Kids AI Video Studio
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Autonomous 6-agent pipeline · Real Claude AI · SSE streaming</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-full px-4 py-2">
            <div className={`w-2 h-2 rounded-full ${running ? 'bg-emerald-400 animate-pulse' : complete ? 'bg-violet-400' : 'bg-slate-600'}`} />
            <span className="text-xs font-bold text-slate-300">
              {running ? 'Pipeline Running' : complete ? (isReady ? '🎉 Ready to Post' : '✅ Complete') : 'Ready'}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-[1fr_300px] gap-6">

          {/* LEFT */}
          <div className="flex flex-col gap-5">

            {/* Pipeline Steps */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Agent Pipeline</div>
              <div className="grid grid-cols-6 gap-2">
                {STEPS.map(s => {
                  const st = steps[s.id]
                  return (
                    <div key={s.id} className={`border rounded-xl p-3 transition-all duration-200 ${stepColors[st]}`}>
                      <div className="text-lg mb-1">{st === 'done' ? '✅' : st === 'active' ? '⚡' : st === 'failed' ? '⚠️' : s.icon}</div>
                      <div className="text-[10px] font-bold text-white leading-tight">{s.name}</div>
                      <div className="text-[9px] text-slate-400 mt-1">
                        {st === 'active' ? s.sub : st === 'done' ? 'Complete' : st === 'failed' ? 'Retrying...' : 'Waiting'}
                      </div>
                    </div>
                  )
                })}
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
                  💡 <strong>To generate real video:</strong> Copy the prompt above and use it with{' '}
                  <a href="https://runwayml.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-violet-100">Runway ML</a>,{' '}
                  <a href="https://kling.kuaishou.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-violet-100">Kling AI</a>, or{' '}
                  <a href="https://pika.art" target="_blank" rel="noopener noreferrer" className="underline hover:text-violet-100">Pika</a>.
                  Add their API key to <code className="bg-slate-800 px-1 rounded">.env.local</code> to automate this step.
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
                        <a href={pm.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-700 border border-slate-600 text-slate-200 hover:border-violet-500 hover:text-violet-300 transition-all">
                          ↗ Open {pm.name}
                        </a>
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
                    Video: {finalScore.toFixed(1)}/10 · All 6 agents complete ·{' '}
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
                  <strong>Workflow:</strong> 1) Copy the caption for each platform → 2) Click "Upload" to open the platform → 3) Paste caption + upload your video file
                </div>
                <div className="flex flex-col gap-3">
                  {(['youtube', 'instagram', 'facebook', 'tiktok'] as Platform[]).map(pid => {
                    const pm = PLATFORM_META[pid]
                    const c = captions[pid]
                    const txt = getCapText(pid)
                    return (
                      <div key={pid} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
                        <div className="text-2xl">{pm.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-white">{pm.name}</div>
                          <div className="text-[10px] text-slate-400">{pm.desc}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate">{c.title}</div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <CopyButton text={txt} label="Copy" />
                          <a href={pm.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-violet-900/50 border border-violet-600 text-violet-200 hover:bg-violet-900 transition-all">
                            ↗ Upload
                          </a>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-4 sticky top-6">

            {/* Video Package */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Video Package</div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                {videoData ? (
                  <div>
                    <video
                      controls
                      autoPlay
                      loop
                      playsInline
                      src={`data:${videoData.mimeType};base64,${videoData.base64}`}
                      className="w-full rounded-t-xl"
                      style={{ aspectRatio: '9/16', objectFit: 'cover' }}
                    />
                    {videoScore && (
                      <div className={`text-center py-2 text-xs font-bold ${videoScore.approved ? 'bg-emerald-900/40 text-emerald-400' : 'bg-amber-900/40 text-amber-400'}`}>
                        Score: {videoScore.total.toFixed(1)}/10 {videoScore.approved ? '✅' : '⚠️'}
                      </div>
                    )}
                    <div className="px-3 py-2 text-[9px] text-violet-400 font-bold text-center bg-violet-950/30">
                      ✨ Generated by Gemini Veo
                    </div>
                  </div>
                ) : videoMeta ? (
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-16 rounded-lg flex items-center justify-center text-2xl shrink-0" style={{ background: storyboard?.shots?.[0]?.bg || 'linear-gradient(135deg,#1a0a2e,#2d1b4e)' }}>
                        {storyboard?.shots?.[0]?.emoji || '🎬'}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">Kids Rhyme Video</div>
                        <div className="text-[10px] text-slate-400">9:16 · HD + 4K ready</div>
                        <div className="text-[10px] text-slate-400">{storyboard?.characters?.slice(0, 2).join(', ')}</div>
                      </div>
                    </div>
                    {videoScore && (
                      <div className={`text-center py-2 rounded-lg text-xs font-bold ${videoScore.approved ? 'bg-emerald-900/40 text-emerald-400' : 'bg-amber-900/40 text-amber-400'}`}>
                        Score: {videoScore.total.toFixed(1)}/10 {videoScore.approved ? '✅' : '⚠️'}
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <div className="text-[10px] text-slate-400 mb-2">Add GOOGLE_API_KEY to generate real video with Veo</div>
                    </div>
                  </div>
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
                  <><span>✨</span>{complete ? 'Generate New Rhyme' : 'Generate Rhyme'}</>
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
