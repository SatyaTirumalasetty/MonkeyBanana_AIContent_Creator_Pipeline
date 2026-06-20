import LegalLayout from '@/components/LegalLayout'

export const metadata = { title: 'Privacy Policy — AI Creative Studio' }

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="June 21, 2026">
      <p>
        AI Creative Studio (&quot;we&quot;, &quot;us&quot;) provides an AI video-generation tool that turns a short
        brief into a script, storyboard, AI-rendered clips, and social captions. This policy explains what
        information we collect, how we use it, and who we share it with.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account information.</strong> If you sign in, we collect your email address to create and authenticate your account.</li>
        <li><strong>Content you generate.</strong> Briefs you submit, and the scripts, storyboards, captions, and video files produced from them, are stored so the pipeline can run and so you can retrieve your results.</li>
        <li><strong>Usage data.</strong> We track how many videos an account or anonymous visitor has generated each month, to enforce plan limits. Anonymous visitors are tracked via a random identifier stored in a cookie, not by name or email.</li>
        <li><strong>Payment information.</strong> If you subscribe to a paid plan, payment is processed by Stripe. We do not receive or store your card number — only a customer/subscription reference used to manage your plan.</li>
      </ul>

      <h2>How we use this information</h2>
      <p>
        We use the information above to operate the service: running the generation pipeline, enforcing plan
        limits, processing payments, and authenticating your sessions. We do not sell your information, and we
        do not use your briefs or generated content to train AI models.
      </p>

      <h2>Third-party service providers</h2>
      <p>Generating a video requires sending parts of your request to the following providers, each under their own terms:</p>
      <ul>
        <li><strong>Google (Gemini)</strong> — generates scripts, storyboards, and captions from your brief.</li>
        <li><strong>fal.ai (Kling AI / Flux)</strong> — generates AI video clips and images from the storyboard.</li>
        <li><strong>Supabase</strong> — hosts our database and handles account authentication.</li>
        <li><strong>Vercel</strong> — hosts the application and stores generated video/image files.</li>
        <li><strong>Stripe</strong> — processes subscription payments.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        We use a session cookie to keep you signed in, and a separate anonymous cookie to track free-tier usage
        for visitors who haven&apos;t created an account. Neither cookie is used for advertising or cross-site
        tracking.
      </p>

      <h2>Data retention</h2>
      <p>
        We retain account information and generated content for as long as your account is active, or as
        needed to provide the service. You can request deletion of your account and associated content at any
        time by contacting us below.
      </p>

      <h2>Children&apos;s privacy</h2>
      <p>
        AI Creative Studio is a tool for creators and is not directed at children. While one of its content
        types is designed to produce content suitable for young children to watch, the service itself is
        intended for use by adults and is not knowingly used to collect information from children under 13.
      </p>

      <h2>Your rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal information by contacting us at
        the email below. We will respond within a reasonable time.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        We may update this policy as the service changes. We&apos;ll update the &quot;Last updated&quot; date
        above when we do.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Email <a href="mailto:privacy@aicreativestudio.app">privacy@aicreativestudio.app</a>.
      </p>
    </LegalLayout>
  )
}
