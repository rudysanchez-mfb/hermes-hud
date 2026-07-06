import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useTranslation } from '../i18n'
import { timeAgo, formatSize } from '../lib/utils'

interface SkillModalProps {
  skillName: string
  onClose: () => void
}

export default function SkillModal({ skillName, onClose }: SkillModalProps) {
  const { t } = useTranslation()
  const { data, isLoading } = useApi(`/skills/${encodeURIComponent(skillName)}`, 0)
  const [activeTab, setActiveTab] = useState<string>('content')
  // Current file content for non-content tabs (hooks must stay above the early return)
  const [fileContent, setFileContent] = useState<string>('')
  const [fileLoading, setFileLoading] = useState(false)

  if (isLoading && !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
        <div className="text-[13px] animate-pulse" style={{ color: 'var(--hud-text-dim)' }}>
          {t('skills.loading')}
        </div>
      </div>
    )
  }

  const skill = data || {}
  const linkedFiles: Record<string, string[]> = skill.linked_files || {}

  // Build tab list: content + all linked files
  const tabs: { key: string; label: string }[] = [{ key: 'content', label: 'SKILL.md' }]
  for (const [type, files] of Object.entries(linkedFiles)) {
    for (const file of files) {
      tabs.push({ key: `${type}:${file}`, label: file.split('/').pop() || file })
    }
  }

  const handleTabClick = async (key: string) => {
    setActiveTab(key)
    if (key === 'content') return

    const path = key.split(':').slice(1).join(':')
    setFileLoading(true)
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skillName)}/file?path=${encodeURIComponent(path)}`)
      if (res.ok) {
        setFileContent(await res.text())
      } else {
        setFileContent(`Error loading file: ${res.status}`)
      }
    } catch (e) {
      setFileContent(`Error: ${e}`)
    }
    setFileLoading(false)
  }

  const contentToShow = activeTab === 'content' ? (skill.content || '') : fileContent

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div
        className="flex flex-col w-full mx-4 rounded"
        style={{
          background: 'var(--hud-bg-panel)',
          border: '1px solid var(--hud-border)',
          maxWidth: '900px',
          maxHeight: '85vh',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2 shrink-0 border-b"
          style={{ borderColor: 'var(--hud-border)' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-bold" style={{ color: 'var(--hud-primary)' }}>
              {skill.name || skillName}
            </span>
            {skill.category && (
              <span className="text-[11px] px-1.5 py-0.5" style={{ background: 'var(--hud-bg-deep)', color: 'var(--hud-text-dim)' }}>
                {skill.category}
              </span>
            )}
            {skill.is_custom && (
              <span className="text-[11px] px-1.5 py-0.5" style={{ background: 'var(--hud-accent)', color: 'var(--hud-bg-deep)' }}>
                {t('dashboard.custom')}
              </span>
            )}
            {skill.version && (
              <span className="text-[11px]" style={{ color: 'var(--hud-text-dim)' }}>v{skill.version}</span>
            )}
            {skill.author && (
              <span className="text-[11px]" style={{ color: 'var(--hud-text-dim)' }}>{skill.author}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[13px] px-2 py-0.5 cursor-pointer"
            style={{ color: 'var(--hud-text-dim)' }}
          >
            ✕ {t('skills.close')}
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 px-4 py-1.5 text-[12px] border-b" style={{ borderColor: 'var(--hud-border)' }}>
          <span style={{ color: 'var(--hud-text-dim)' }}>
            {t('skills.usage')}: <strong style={{ color: 'var(--hud-primary)' }}>{skill.usage_count || 0}</strong>
          </span>
          {skill.last_used && (
            <span style={{ color: 'var(--hud-text-dim)' }}>
              {t('skills.lastUsed')}: {timeAgo(skill.last_used)}
            </span>
          )}
          <span style={{ color: 'var(--hud-text-dim)' }}>
            {formatSize(skill.file_size || 0)}
          </span>
          {skill.triggers?.length > 0 && (
            <span style={{ color: 'var(--hud-text-dim)' }}>
              {skill.triggers.length} {t('skills.triggers')}
            </span>
          )}
        </div>

        {/* Triggers */}
        {skill.triggers?.length > 0 && (
          <div className="px-4 py-1.5 text-[11px] border-b" style={{ borderColor: 'var(--hud-border)' }}>
            <div className="flex flex-wrap gap-1">
              {skill.triggers.map((t: string, i: number) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5"
                  style={{ background: 'var(--hud-bg-deep)', color: 'var(--hud-text-dim)' }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tab bar */}
        {tabs.length > 1 && (
          <div className="flex gap-0 px-4 border-b overflow-x-auto" style={{ borderColor: 'var(--hud-border)' }}>
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => handleTabClick(tab.key)}
                className="px-3 py-1.5 text-[12px] cursor-pointer whitespace-nowrap"
                style={{
                  background: activeTab === tab.key ? 'var(--hud-bg-hover)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--hud-primary)' : 'var(--hud-text-dim)',
                  borderBottom: activeTab === tab.key ? '2px solid var(--hud-primary)' : '2px solid transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {activeTab !== 'content' && fileLoading ? (
            <div className="text-[13px] animate-pulse" style={{ color: 'var(--hud-text-dim)' }}>{t('skills.loading')}</div>
          ) : (
            <pre
              className="text-[13px] whitespace-pre-wrap break-words"
              style={{
                color: 'var(--hud-text)',
                fontFamily: 'monospace',
                lineHeight: 1.5,
              }}
            >
              {contentToShow}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}
