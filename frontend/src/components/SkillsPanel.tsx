import { useState, useMemo } from 'react'
import { useApi } from '../hooks/useApi'
import Panel from './MuiPanel'
import SkillModal from './SkillModal'
import { timeAgo, formatSize, formatNumber } from '../lib/utils'
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

function skillMatchesFilter(skill: Skill, filter: string): boolean {
  const haystack = [
    skill.name,
    skill.description,
    skill.category,
    skill.author,
    ...(skill.triggers || []),
  ].join(' ').toLowerCase()
  return haystack.includes(filter)
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
        border: '1px solid var(--hud-border-subtle)',
      }}
      onMouseEnter={hoverOn}
      onMouseLeave={hoverOff}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-bold text-sm" style={{ color: 'var(--hud-primary)' }}>{skill.name}</span>
        {skill.is_custom && (
          <span className="text-xs px-1 py-0.5 shrink-0" style={{ background: 'var(--hud-accent)', color: 'var(--hud-bg-deep)' }}>
            {t('dashboard.custom')}
          </span>
        )}
      </div>
      <div className="text-xs mb-2 line-clamp-2" style={{ color: 'var(--hud-text-dim)' }}>
        {skill.description?.slice(0, 140)}{skill.description?.length > 140 ? '...' : ''}
      </div>
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--hud-text-dim)' }}>
        {skill.usage_count > 0 && (
          <span>
            <strong style={{ color: 'var(--hud-primary)' }}>{formatNumber(skill.usage_count)}</strong> {t('skills.uses')}
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
    <div className="rounded overflow-hidden" style={{ background: 'var(--hud-bg-deep)' }}>
      {/* Header */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer"
        style={{
          background: isExpanded ? 'var(--hud-bg-hover)' : 'transparent',
          border: 'none',
        }}
      >
        <span className="text-sm w-4" style={{ color: 'var(--hud-primary)' }}>
          {isExpanded ? '▼' : '▶'}
        </span>
        <span className="font-bold text-sm flex-1" style={{ color: isExpanded ? 'var(--hud-primary)' : 'var(--hud-text)' }}>
          {category}
        </span>

        {/* Stats pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs px-1.5 py-0.5" style={{ background: 'var(--hud-bg-deep)', color: 'var(--hud-text-dim)' }}>
            {formatNumber(skills.length)} {skills.length === 1 ? t('skills.skill') : t('skills.skills')}
          </span>
          {totalUsage > 0 && (
            <span className="text-xs px-1.5 py-0.5" style={{ background: 'var(--hud-bg-deep)', color: 'var(--hud-primary)' }}>
              {formatNumber(totalUsage)} {t('skills.uses')}
            </span>
          )}
          {customCount > 0 && (
            <span className="text-xs px-1.5 py-0.5" style={{ background: 'var(--hud-accent)', color: 'var(--hud-bg-deep)' }}>
              {formatNumber(customCount)} {t('dashboard.custom')}
            </span>
          )}
          {totalLinked > 0 && (
            <span className="text-xs px-1.5 py-0.5" style={{ background: 'var(--hud-bg-deep)', color: 'var(--hud-text-dim)' }}>
              {formatNumber(totalLinked)} {t('skills.files')}
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
  const [filterQuery, setFilterQuery] = useState('')

  const filter = filterQuery.trim().toLowerCase()

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

  const filteredByCategory: Record<string, Skill[]> = useMemo(() => {
    if (!filter) return byCategory

    const next: Record<string, Skill[]> = {}
    for (const cat of sortedCats) {
      const skills = byCategory[cat] || []
      const categoryHit = cat.toLowerCase().includes(filter)
      const matchedSkills = categoryHit ? skills : skills.filter(s => skillMatchesFilter(s, filter))
      if (matchedSkills.length > 0) next[cat] = matchedSkills
    }
    return next
  }, [byCategory, filter, sortedCats])

  const visibleCats = useMemo(() => {
    return filter ? sortedCats.filter(cat => filteredByCategory[cat]?.length) : sortedCats
  }, [filter, filteredByCategory, sortedCats])

  const totalUsage = data?.total_usage || 0
  const mostUsed: Skill[] = data?.most_used || []

  const filteredMostUsed = useMemo(() => {
    if (!filter) return mostUsed
    return mostUsed.filter(skill => skillMatchesFilter(skill, filter))
  }, [filter, mostUsed])

  if (isLoading && !data) {
    return <Panel title={t('skills.title')} className="col-span-full"><div className="glow text-sm animate-pulse">{t('skills.scanning')}</div></Panel>
  }

  return (
    <>
      {selectedSkill && (
        <SkillModal skillName={selectedSkill} onClose={() => setSelectedSkill(null)} />
      )}

      <Panel title={t('skills.title')} className="col-span-full">
        {/* Summary bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <span className="text-sm px-2 py-0.5" style={{ background: 'var(--hud-bg-panel)', color: 'var(--hud-primary)' }}>
            {formatNumber(data?.total || 0)} {t('skills.total')}
          </span>
          <span className="text-sm px-2 py-0.5" style={{ background: 'var(--hud-bg-panel)', color: 'var(--hud-accent)' }}>
            {formatNumber(data?.custom_count || 0)} {t('dashboard.custom')}
          </span>
          <span className="text-sm px-2 py-0.5" style={{ background: 'var(--hud-bg-panel)', color: 'var(--hud-text-dim)' }}>
            {formatNumber(visibleCats.length)} {t('skills.categories')}
          </span>
          {totalUsage > 0 && (
            <span className="text-sm px-2 py-0.5" style={{ background: 'var(--hud-bg-panel)', color: 'var(--hud-primary)' }}>
              {formatNumber(totalUsage)} {t('skills.totalUses')}
            </span>
          )}
          <input
            type="search"
            value={filterQuery}
            onChange={e => setFilterQuery(e.target.value)}
            placeholder={t('skills.filterPlaceholder')}
            className="ml-auto w-full sm:w-56 px-2 py-1 text-sm outline-none"
            style={{
              background: 'var(--hud-bg-deep)',
              border: '1px solid var(--hud-border-subtle)',
              color: 'var(--hud-text)',
            }}
          />
        </div>

        {/* Most used skills */}
        {filteredMostUsed.length > 0 && (
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--hud-text-dim)' }}>
              {t('skills.mostUsed')}
            </div>
            <div className="flex flex-wrap gap-2">
              {filteredMostUsed.map((skill: Skill) => (
                <button
                  type="button"
                  key={skill.name}
                  onClick={() => setSelectedSkill(skill.name)}
                  className="text-xs px-2 py-1 cursor-pointer"
                  style={{
                    background: 'var(--hud-bg-panel)',
                    border: '1px solid var(--hud-border-subtle)',
                    color: 'var(--hud-text)',
                  }}
                >
                  <span style={{ color: 'var(--hud-primary)' }}>{formatNumber(skill.usage_count)}</span>
                  <span className="ml-1" style={{ color: 'var(--hud-text-dim)' }}>{skill.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category accordion */}
        <div className="space-y-2">
          {visibleCats.map(cat => (
            <CategoryRow
              key={cat}
              category={cat}
              skills={filteredByCategory[cat] || []}
              isExpanded={expandedCats.has(cat)}
              onSkillClick={(name) => setSelectedSkill(name)}
              onToggle={() => toggleCat(cat)}
            />
          ))}
        </div>

        {visibleCats.length === 0 && (
          <div className="text-sm" style={{ color: 'var(--hud-text-dim)' }}>
            {filter ? t('skills.noMatches') : t('skills.noSkills')}
          </div>
        )}
      </Panel>
    </>
  )
}
