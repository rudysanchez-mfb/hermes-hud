// Single source of truth for tab metadata. Order here = nav order.
// TopBar (legacy), NavShell, App.tsx, and CommandPalette all consume this.

export interface TabDef {
  id: string          // route path segment
  labelKey: string    // i18n key
  key: string | null  // keyboard shortcut digit, null for none
}

// Final 11-tab layout (Phase 3 consolidation):
// Dashboard · Costs · Debrid · Music · Services · Cron
// · Sessions · Memory · Skills · Agents · System
export const TABS: TabDef[] = [
  { id: 'dashboard',   labelKey: 'tab.dashboard',   key: '1' },
  { id: 'token-costs', labelKey: 'tab.token-costs', key: '2' },
  { id: 'debrid',      labelKey: 'tab.debrid',      key: '3' },
  { id: 'music',       labelKey: 'tab.music',       key: '4' },
  { id: 'services',    labelKey: 'tab.services',    key: '5' },
  { id: 'cron',        labelKey: 'tab.cron',        key: '6' },
  { id: 'sessions',    labelKey: 'tab.sessions',    key: '8' },
  { id: 'memory',      labelKey: 'tab.memory',      key: '9' },
  { id: 'skills',      labelKey: 'tab.skills',      key: null },
  { id: 'agents',      labelKey: 'tab.agents',      key: null },
  { id: 'system',      labelKey: 'tab.system',      key: '0' },
]

export type TabId = string

// Old tab IDs that redirect to their new homes
export const REDIRECTS: Record<string, string> = {
  health:      'services',
  replay:      'sessions',
  corrections: 'memory',
  profiles:    'system',
  providers:   'system',
  gateway:     'system',
  'model-info': 'system',
  plugins:     'system',
  sudo:        'system',
  patterns:    'system',
  projects:    'system',
}
