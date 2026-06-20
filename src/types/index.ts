export type StepStatus = 'idle' | 'active' | 'done' | 'failed'

export type ContentType =
  | 'kids_rhyme'
  | 'poem'
  | 'short_film'
  | 'advertisement'
  | 'educational'
  | 'music_video'
  | 'custom'

export interface CreativeBrief {
  contentType: ContentType
  userBrief?: string
}

export type PipelineEvent =
  | 'RHYME_GENERATED'
  | 'RHYME_APPROVED'
  | 'RHYME_REJECTED'
  | 'RHYME_REFINED'
  | 'STORYBOARD_COMPLETE'
  | 'VIDEO_GENERATION_COMPLETE'
  | 'VIDEO_APPROVED'
  | 'VIDEO_REJECTED'
  | 'PUBLISH_STARTED'
  | 'PUBLISH_COMPLETE'
  | 'PUBLISH_FAILED'

export interface LogEntry {
  time: string
  msg: string
  type: 'info' | 'success' | 'warning' | 'error' | 'agent' | ''
}

export interface RhymeData {
  rhyme: string
  topic: string
  learningConcept: string
  version: number
  timestamp: string
}

export interface RhymeScore {
  entertainment: number
  educational: number
  ageAppropriate: number
  rhythm: number
  simplicity: number
  positiveMessage: number
  total: number
  approved: boolean
  feedback: string[]
}

export interface StoryboardShot {
  timestamp: string
  emoji: string
  description: string
  camera: string
  bg: string
}

export interface Storyboard {
  shots: StoryboardShot[]
  musicStyle: string
  voiceStyle: string
  characters: string[]
  mood: string
  backgroundStyle: string
  narratorTiming: string
}

export interface VideoScore {
  videoQuality: number
  audioQuality: number
  audioSync: number
  lipSync: number
  characterMood: number
  sceneConsistency: number
  engagement: number
  total: number
  approved: boolean
  feedback: string[]
}

export interface PlatformCaption {
  creator: string
  title: string
  caption: string
  hashtags: string[]
  cta: string
  thumbnailDesc: string
}

export interface SocialCaptions {
  youtube: PlatformCaption
  instagram: PlatformCaption
  facebook: PlatformCaption
  tiktok: PlatformCaption
}

export type Platform = 'youtube' | 'instagram' | 'facebook' | 'tiktok'

export interface PipelineState {
  steps: Record<string, StepStatus>
  logs: LogEntry[]
  rhyme: RhymeData | null
  rhymeScore: RhymeScore | null
  storyboard: Storyboard | null
  videoScore: VideoScore | null
  captions: SocialCaptions | null
  rhymeRetries: number
  videoRetries: number
  isRunning: boolean
  isComplete: boolean
}

export interface VideoData {
  base64: string
  mimeType: string
}

export interface StreamChunk {
  type: 'log' | 'step' | 'rhyme' | 'rhyme_score' | 'storyboard' | 'video_meta' | 'video_data' | 'video_score' | 'captions' | 'job' | 'complete' | 'error'
  payload: unknown
}

export interface VideoMeta {
  videoPrompt: string
  audioScript: string
  subtitles: { time: string; text: string }[]
  lipSyncMap: { word: string; startMs: number; endMs: number }[]
}

export type ClipStatus = 'pending' | 'generating' | 'done' | 'error'

export interface ClipState {
  index: number
  durationSec: number
  status: ClipStatus
  url?: string
  error?: string
}

export type JobStatus = 'pending' | 'generating_clips' | 'stitching' | 'complete' | 'error'

export interface VideoJob {
  id: string
  createdAt: string
  status: JobStatus
  rhyme: RhymeData
  rhymeScore: RhymeScore
  storyboard: Storyboard
  videoMeta: VideoMeta
  clipDurationSec: number
  targetDurationSec: number
  clips: ClipState[]
  contentType?: ContentType
  userBrief?: string
  referenceImageUrl?: string
  finalVideoUrl?: string
  error?: string
  ownerKey: string
  useKling: boolean
  useFlux: boolean
}
