'use client'
import { useState, useRef, useEffect } from 'react'
import type { RhymeData, Storyboard, VideoScore } from '@/types'
import { renderScriptText } from '@/lib/script-text'
import { Pause, Play, Maximize, X, Camera } from '@/components/icons'

// Animated storyboard preview shown while the real video is still rendering.
// The shot emoji is content-flavor (the AI's own scene description), kept
// as emoji deliberately — only the player chrome around it uses icons.
export default function VideoPreview({ storyboard, rhyme, videoScore }: {
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
        <div className="text-6xl mb-3 motion-safe:animate-bounce">{shot.emoji}</div>
        <div className="text-xs font-semibold text-white/60 leading-relaxed line-clamp-3">{shot.description}</div>
      </div>
      <div className="absolute top-2 left-2 right-2 flex justify-between items-center">
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-0.5 text-[10px] font-bold text-white/80">
          SHOT {shotIdx + 1} / {storyboard.shots.length} · {shot.timestamp}
        </div>
        <div className="bg-accent-700/70 backdrop-blur-sm rounded-lg px-2 py-0.5 text-[10px] font-bold text-accent-50 flex items-center gap-1">
          <Camera className="w-3 h-3" /> {shot.camera?.split(',')[0]}
        </div>
      </div>
      <div className="absolute bottom-14 left-2 right-2">
        <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 text-center text-sm font-bold text-white leading-snug">
          {renderScriptText(lines[lineIdx] ?? '')}
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between bg-black/50 backdrop-blur-sm">
        <div className="flex gap-1">
          {storyboard.shots.map((_, i) => (
            <button key={i} onClick={() => { setShotIdx(i); setPlaying(false) }}
              aria-label={`Show shot ${i + 1}`}
              className="transition-all rounded-full"
              style={{ width: i === shotIdx ? 14 : 6, height: 6, background: i === shotIdx ? 'white' : 'rgba(255,255,255,0.4)' }} />
          ))}
        </div>
        <div className="flex gap-1.5">
          {videoScore && (
            <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${videoScore.approved ? 'bg-emerald-900/70 text-emerald-300' : 'bg-amber-900/70 text-amber-300'}`}>
              {videoScore.total.toFixed(1)}/10
            </div>
          )}
          <button onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause preview' : 'Play preview'}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-all">
            {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-all">
            {isFullscreen ? <X className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}
