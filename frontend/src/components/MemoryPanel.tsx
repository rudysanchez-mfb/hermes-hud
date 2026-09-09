import { useApi } from '../hooks/useApi'
import MuiPanel, { CapacityBar } from './MuiPanel'
import { useTranslation } from '../i18n'

function MemoryEntry({ entry }: { entry: any }) {
  return (
    <div
      className="text-sm py-1.5 px-2"
      style={{ background: 'var(--hud-bg-panel)', borderLeft: '2px solid var(--hud-border)' }}
    >
      <div className="flex justify-between mb-0.5">
        <span className="uppercase tracking-wider text-sm font-bold" style={{ color: 'var(--hud-primary)' }}>
          {entry.category}
        </span>
        <span style={{ color: 'var(--hud-text-dim)' }}>{entry.char_count}c</span>
      </div>
      <div style={{ color: 'var(--hud-text)' }}>{entry.text}</div>
    </div>
  )
}

function MemoryEntries({ entries }: { entries: any[] }) {
  const { t } = useTranslation()
  if (!entries?.length) return <div className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>{t('memory.empty')}</div>

  return (
    <div className="space-y-1.5">
      {entries.map((e: any) => (
        <MemoryEntry key={e.text} entry={e} />
      ))}
    </div>
  )
}

export default function MemoryPanel() {
  const { t } = useTranslation()
  const { data, isLoading } = useApi('/memory', 30000)

  if (isLoading && !data) {
    return <MuiPanel title={t('memory.title')} className="col-span-full"><div className="glow text-sm animate-pulse">{t('memory.loading')}</div></MuiPanel>
  }

  const { memory, user } = data

  return (
    <>
      <MuiPanel title={t('memory.title')} className="col-span-1">
        <CapacityBar value={memory?.total_chars || 0} max={memory?.max_chars || 2200} label={t('memory.capacity')} />
        <div className="text-sm my-2" style={{ color: 'var(--hud-text-dim)' }}>
          {memory?.entry_count || 0} {t('memory.entries')} · {Object.entries(memory?.count_by_category || {}).map(([k,v]) => `${k}(${v})`).join(' ')}
        </div>
        <MemoryEntries entries={memory?.entries || []} />
      </MuiPanel>

      <MuiPanel title={t('memory.userProfile')} className="col-span-1">
        <CapacityBar value={user?.total_chars || 0} max={user?.max_chars || 1375} label={t('memory.capacity')} />
        <div className="text-sm my-2" style={{ color: 'var(--hud-text-dim)' }}>
          {user?.entry_count || 0} {t('memory.entries')}
        </div>
        <MemoryEntries entries={user?.entries || []} />
      </MuiPanel>
    </>
  )
}
