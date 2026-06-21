'use client'
import { useEffect, useState } from 'react'
import Logo from '@/components/Logo'
import type { ContentType, JobStatus } from '@/types'

interface VideoSummary {
  id: string
  createdAt: string
  status: JobStatus
  contentType?: ContentType
  topic?: string
  thumbnailUrl?: string
  finalVideoUrl?: string
  error?: string
}

const TYPE_ICON: Record<ContentType, string> = {
  kids_rhyme: '🎠', poem: '📜', short_film: '🎬',
  advertisement: '📣', educational: '🧠', music_video: '🎵', custom: '✨',
}

const STATUS_META: Record<JobStatus, { label: string; color: string }> = {
  pending: { label: 'Queued', color: '#A0A3B1' },
  generating_clips: { label: 'Rendering', color: '#FB923C' },
  stitching: { label: 'Finishing up', color: '#FB923C' },
  complete: { label: 'Ready', color: '#34D399' },
  error: { label: 'Failed', color: '#F87171' },
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoSummary[] | null>(null)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    setError('')
    fetch('/api/videos')
      .then(async (res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        const data = await res.json() as { jobs?: VideoSummary[]; error?: string }
        if (data.error) throw new Error(data.error)
        setVideos(data.jobs ?? [])
      })
      .catch((err) => setError(`Could not load your videos (${err.message}).`))
  }, [retryCount])

  return (
    <div className="min-h-screen bg-ink text-ink-50">
      <div className="border-b border-ink-500 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <a href="/" className="text-sm text-ink-300 hover:text-ink-50 transition-colors">← Back to Studio</a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="font-display text-2xl font-bold mb-1">My Videos</h1>
        <p className="text-ink-300 text-sm mb-8">Everything you&apos;ve generated, in one place.</p>

        {error && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-rose-400">{error}</span>
            <button
              onClick={() => { setVideos(null); setRetryCount((c) => c + 1) }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-ink-500 bg-ink-700 text-ink-200 hover:border-accent-500 hover:text-accent-400 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!error && videos === null && (
          <div className="flex items-center gap-2 text-ink-300 text-sm">
            <div className="w-4 h-4 border-2 border-ink-500 border-t-ink-200 rounded-full animate-spin" />
            Loading your videos...
          </div>
        )}

        {videos !== null && videos.length === 0 && (
          <div className="bg-ink-700 border border-ink-500 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">🎬</div>
            <div className="text-ink-50 font-semibold mb-1">No videos yet</div>
            <p className="text-ink-300 text-sm mb-4">Generate your first video and it&apos;ll show up here.</p>
            <a href="/" className="inline-flex px-4 py-2 rounded-xl font-semibold text-sm text-white bg-accent-500 hover:bg-accent-600 transition-colors">
              Start creating
            </a>
          </div>
        )}

        {videos !== null && videos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {videos.map((v) => {
              const statusMeta = STATUS_META[v.status]
              return (
                <div key={v.id} className="bg-ink-700 border border-ink-500 rounded-2xl overflow-hidden flex flex-col">
                  <div className="relative bg-ink-600" style={{ aspectRatio: '9/16' }}>
                    {v.finalVideoUrl ? (
                      <video src={v.finalVideoUrl} className="w-full h-full object-cover" muted playsInline />
                    ) : v.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        {v.contentType ? TYPE_ICON[v.contentType] : '🎬'}
                      </div>
                    )}
                    <div
                      className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm"
                      style={{ background: 'rgba(0,0,0,0.6)', color: statusMeta.color }}
                    >
                      {statusMeta.label}
                    </div>
                  </div>
                  <div className="p-3 flex flex-col gap-1 flex-1">
                    <div className="text-[12px] font-semibold text-ink-50 line-clamp-2">{v.topic ?? 'Untitled'}</div>
                    <div className="text-[10px] text-ink-300">
                      {new Date(v.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    {v.finalVideoUrl && (
                      <a
                        href={v.finalVideoUrl}
                        download
                        className="mt-auto pt-2 text-[11px] font-semibold text-accent-400 hover:text-accent-400/80 transition-colors"
                      >
                        Download →
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
