# 🎬 Kids AI Video Studio

Production-grade autonomous 6-agent pipeline for kids educational video generation.
Built with Next.js 14 · TypeScript · TailwindCSS · Claude AI · Server-Sent Events

## Quick Start (3 steps)

### 1. Install
```bash
npm install
```

### 2. Set API key
```bash
cp .env.example .env.local
# Add your ANTHROPIC_API_KEY from https://console.anthropic.com
```

### 3. Run
```bash
npm run dev
# Open http://localhost:3000 → Click "Generate Rhyme"
```

## Deploy to Vercel
```bash
npx vercel
# Set ANTHROPIC_API_KEY in Vercel dashboard → Settings → Environment Variables
```

## The 6 Agents

| Agent | Does | Auto-retry |
|-------|------|-----------|
| Rhyme Generator | Creates 6-10 line educational rhyme | Up to 5× |
| Rhyme Reviewer | Scores on 6 criteria, gives feedback | — |
| Storyboard Planner | 4-shot visual plan with camera moves | — |
| Video Generator | AI video prompt + narration script | — |
| Video Reviewer | Scores on 7 criteria, approves/rejects | Up to 3× |
| Social Publisher | Captions + hashtags for 4 platforms | — |

## Add Real Video Generation

Copy the AI video prompt from the UI and paste it into:
- **Runway ML** → https://runwayml.com (Gen-3 Alpha)
- **Kling AI** → https://kling.kuaishou.com
- **Pika** → https://pika.art

To automate: add `RUNWAYML_API_KEY` to `.env.local` and extend `generateVideoMetadata()` in `src/lib/agents.ts`.

## Add Real Social Posting

Each platform requires OAuth — see `.env.example` for the keys needed:
- **YouTube** → YouTube Data API v3 at console.cloud.google.com
- **Instagram** → Meta Graph API at developers.facebook.com
- **TikTok** → Content Posting API at developers.tiktok.com
- **Facebook** → Same Meta app as Instagram

The UI already generates captions + deep-links to each platform's upload page.
