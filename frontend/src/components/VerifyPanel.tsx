import MuiPanel from './MuiPanel'

export default function VerifyPanel({ className = '', embedded = false }: { className?: string; embedded?: boolean }) {
  const content = (
    <div className="text-xs" style={{ color: 'var(--hud-text-dim)' }}>
      Verification is read-only in this view.
    </div>
  )

  if (embedded) {
    return <div className={className}>{content}</div>
  }

  return (
    <MuiPanel title="Verify" className={className}>
      {content}
    </MuiPanel>
  )
}
