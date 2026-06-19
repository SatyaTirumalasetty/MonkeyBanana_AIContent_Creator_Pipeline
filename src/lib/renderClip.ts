import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import ffmpegPath from '@ffmpeg-installer/ffmpeg'
import ffmpeg from 'fluent-ffmpeg'

ffmpeg.setFfmpegPath(ffmpegPath.path)

const WIDTH = 1080
const HEIGHT = 1920
const FPS = 25

// Animates a still frame into a short video clip with a slow Ken Burns
// zoom (in or out), matching the resolution/fps used by the stitch step.
export function renderSlideClip(frame: Buffer, durationSec: number, zoomIn: boolean): Promise<Buffer> {
  return (async () => {
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kids-studio-frame-'))
    const inputPath = path.join(workDir, 'frame.png')
    const outputPath = path.join(workDir, 'clip.mp4')
    await fs.writeFile(inputPath, frame)

    const frames = Math.round(durationSec * FPS)
    const zoomExpr = zoomIn
      ? `min(zoom+0.0015,1.2)`
      : `if(eq(on,1),1.2,max(zoom-0.0015,1.0))`

    try {
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(inputPath)
          .inputOptions(['-loop 1'])
          .videoFilters(`zoompan=z='${zoomExpr}':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS}`)
          .videoCodec('libx264')
          .outputOptions(['-t', String(durationSec), '-pix_fmt', 'yuv420p', '-preset', 'ultrafast', '-movflags', '+faststart'])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run()
      })
      return await fs.readFile(outputPath)
    } finally {
      await fs.rm(workDir, { recursive: true, force: true })
    }
  })()
}
