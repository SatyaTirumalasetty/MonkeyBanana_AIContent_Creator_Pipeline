// Several content types (ads, explainers, short films, custom) come back
// with **label** markers (e.g. "**Visuals:**") — render them as emphasis
// instead of leaving literal asterisks, since they're genuinely useful
// structure for scanning a script before production, not noise to strip.
export function renderScriptText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-accent-400">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}
