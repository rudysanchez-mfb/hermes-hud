import { useState, useMemo } from 'react'
import { useApi } from '../hooks/useApi'
import Panel from './MuiPanel'
import SkillModal from './SkillModal'
import { timeAgo, formatSize } from '../lib/utils'
import { useTranslation } from '../i18n'

const hoverOn = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = 'var(--hud-bg-hover)' }
const hoverOff = (e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.background = 'transparent' }

interface Skill {
  name: string
  category: string
  description: string
  path: string
  modified_at: string
  file_size: number
  is_custom: boolean
  triggers: string[]
  linked_files: Record<string, string[]>
  usage_count: number
  last_used: string | null
  version: string
  author: string
}

function SkillCard({ skill, onClick }: { skill: Skill; onClick: () => void }) {
  const { t } = useTranslation()
  const linkedCount = Object.values(skill.linked_files).reduce((sum, arr) => sum + arr.length, 0)

  return (
    <div
      onClick={onClick}
      className="rounded cursor-pointer p-3"
      style={{
        background: 'var(--hud-bg-deep)',
        border: '1px solid var(--hud-border)',
      }}
      onMouseEnter={hoverOn}
      onMouseLeave={hoverOff}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-bold text-[13px]" style={{ color: 'var(--hud-primary)' }}>{skill.name}</span>
        {skill.is_custom && (
          <span className="text-[10px] px-1 py-0.5 shrink-0" style={{ background: 'var(--hud-accent)', color: 'var(--hud-bg-deep)' }}>
            {t('dashboard.custom')}
          </span>
        )}
      </div>
      <div className="text-[12px] mb-2 line-clamp-2" style={{ color: 'var(--hud-text-dim)' }}>
        {skill.description?.slice(0, 140)}{skill.description?.length > 140 ? '...' : ''}
      </div>
      <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--hud-text-dim)' }}>
        {skill.usage_count > 0 && (
          <span>
            <strong style={{ color: 'var(--hud-primary)' }}>{skill.usage_count}</strong> {t('skills.uses')}
          </span>
        )}
        {skill.last_used && (
          <span>{timeAgo(skill.last_used)}</span>
        )}
        {linkedCount > 0 && (
          <span>{linkedCount} {t('skills.files')}</span>
        )}
        <span className="ml-auto">{formatSize(skill.file_size)}</span>
      </div>
    </div>
  )
}

function CategoryRow({
  category,
  skills,
  onSkillClick,
  isExpanded,
  onToggle,
}: {
  category: string
  skills: Skill[]
  isExpanded: boolean
  onToggle: () => void
  onSkillClick: (name: string) => void
}) {
  const { t } = useTranslation()
  const totalUsage = skills.reduce((sum, s) => sum + (s.usage_count || 0), 0)
  const customCount = skills.filter(s => s.is_custom).length
  const totalLinked = skills.reduce((sum, s) => sum + Object.values(s.linked_files || {}).reduce((a, b) => a + b.length, 0), 0)

  return (
    <div className="rounded overflow-hidden" style={{ border: '1px solid var(--hud-border)' }}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer"
        style={{ background: isExpanded ? 'var(--hud-bg-hover)' : 'transparent' }}
      >
        <span className="text-[13px] w-4" style={{ color: 'var(--hud-primary)' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <span className="font-bold text-[13px] flex-1" style={{ color: isExpanded ? 'var(--hud-primary)' : 'var(--hud-text)' }}>
          {category}
        </span>

        {/* Stats pills */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-1.5 py-0.5" style={{ background: 'var(--hud-bg-deep)', color: 'var(--hud-text-dim)' }}>
            {skills.length} {skills.length === 1 ? t('skills.skill') : t('skills.skills')}
          </span>
          {totalUsage > 0 && (
            <span className="text-[11px] px-1.5 py-0.5" style={{ background: 'var(--hud-bg-deep)', color: 'var(--hud-primary)' }}>
              {totalUsage} {t('skills.uses')}
            </span>
          )}
          {customCount > 0 && (
            <span className="text-[11px] px-1.5 py-0.5" style={{ background: 'var(--hud-accent)', color: 'var(--hud-bg-deep)' }}>
              {customCount} {t('dashboard.custom')}
            </span>
          )}
          {totalLinked > 0 && (
            <span className="text-[11px] px-1.5 py-0.5" style={{ background: 'var(--hud-bg-deep)', color: 'var(--hud-text-dim)' }}>
              {totalLinked} {t('skills.files')}
            </span>
          )}
        </div>
      </button>

      {/* Expanded skills grid */}
      {isExpanded && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" style={{ background: 'var(--hud-bg-deep)' }}>
          {skills.map(skill => (
            <SkillCard
              key={skill.name}
              skill={skill}
              onClick={() => onSkillClick(skill.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function SkillsPanel() {
  const { t } = useTranslation()
  const { data, isLoading } = useApi('/skills', 60000)
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set())
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      return next
    })
  }

  const byCategory: Record<string, Skill[]> = useMemo(() => {
    return data?.by_category || {}
  }, [data])

  const catCounts: Record<string, number> = useMemo(() => data?.category_counts || {}, [data])
  const sortedCats = useMemo(() => {
    return Object.entries(catCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .map(([cat]) => cat)
  }, [catCounts])

  const totalUsage = data?.total_usage || 0
  const mostUsed: Skill[] = data?.most_used || []

  if (isLoading && !data) {
    return <Panel title={t('skills.title')} className="col-span-full"><div className="glow text-[13px] animate-pulse">{t('skills.scanning')}</div></Panel>
  }

  return (
    <>
      {selectedSkill && (
        <SkillModal skillName={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}

      <Panel title={t('skills.title')} className="col-span-full">
        {/* Summary bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-[13px] px-2 py-0.5" style={{ background: 'var(--hud-bg-panel)', color: 'var(--hud-primary)' }}>
            {data?.total || 0} {t('skills.total')}
          </span>
          <span className="text-[13px] px-2 py-0.5" style={{ background: 'var(--hud-bg-panel)', color: 'var(--hud-accent)' }}>
            {data?.custom_count || 0} {t('dashboard.custom')}
          </span>
          <span className="text-[13px] px-2 py-0.5" style={{ background: 'var(--hud-bg-panel)', color: 'var(--hud-text-dim)' }}>
            {sortedCats.length} {t('skills.categories')}
          </span>
          {totalUsage > 0 && (
            <span className="text-[13px] px-2 py-0.5" style={{ background: 'var(--hud-bg-panel)', color: 'var(--hud-primary)' }}>
              {totalUsage} {t('skills.totalUses')}
            </span>
          )}
        </div>

        {/* Most used skills */}
        {mostUsed.length > 0 && (
          <div className="mb-4">
            <div className="text-[12px] uppercase tracking-wider mb-2" style={{ color: 'var(--hud-text-dim)' }}>
              {t('skills.mostUsed')}
            </div>
            <div className="flex flex-wrap gap-2">
              {mostUsed.map((skill: Skill) => (
                <button
                  key={skill.name}
                  onClick={() => setSelectedSkill(skill.name)}
                  className="text-[12px] px-2 py-1 cursor-pointer"
                  style={{
                    background: 'var(--hud-bg-deep)',
                    border: '1px solid var(--hud-border)',
                    color: 'var(--hud-text)',
                  }}
                >
                  <span style={{ color: 'var(--hud-primary)' }}>{skill.usage_count}</span>
                  <span className="ml-1" style={{ color: 'var(--hud-text-dim)' }}>{skill.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category accordion */}
        <div className="space-y-2">
          {sortedCats.map(cat => (
            <CategoryRow
              key={cat}
              category={cat}
              skills={byCategory[cat] || []}
              isExpanded={expandedCats.has(cat)}
              onSkillClick={(name) => setSelectedSkill(name)}
              onToggle={() => toggleCat(cat)}
            />
          ))}
        </div>

        {sortedCats.length === 0 && (
          <div className="text-[13px]" style={{ color: 'var(--hud-text-dim)' }}>{t('skills.noSkills')}</div>
        )}
      </Panel>
    </>
  )
}
