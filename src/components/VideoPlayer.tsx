'use client'
import { useState, useRef, useEffect } from 'react'
import { Maximize, X } from '@/components/icons'

export default function VideoPlayer({ videoUrl }: { videoUrl: string }) {
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
      <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-all backdrop-blur-sm border border-white/20">
        {isFullscreen ? <X className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
      </button>
    </div>
  )
}
