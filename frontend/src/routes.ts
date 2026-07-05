// Single source of truth for tab metadata. Order here = nav order.
// TopBar, App.tsx, and CommandPalette all consume this.

export interface TabDef {
  id: string          // route path segment (e.g., 'token-costs')
  labelKey: string    // i18n key
  key: string | null  // keyboard shortcut digit, null for none
}

export const TABS: TabDef[] = [
  { id: 'dashboard',   labelKey: 'tab.dashboard',   key: '1' },
  { id: 'token-costs', labelKey: 'tab.token-costs', key: '2' },
  { id: 'memory',      labelKey: 'tab.memory',      key: '3' },
  { id: 'skills',      labelKey: 'tab.skills',      key: '4' },
  { id: 'sessions',    labelKey: 'tab.sessions',    key: '5' },
  { id: 'replay',      labelKey: 'tab.replay',      key: null },
  { id: 'cron',        labelKey: 'tab.cron',        key: '6' },
  { id: 'projects',    labelKey: 'tab.projects',    key: null },
  { id: 'health',      labelKey: 'tab.health',      key: '7' },
  { id: 'agents',      labelKey: 'tab.agents',      key: '8' },
  { id: 'chat',        labelKey: 'tab.chat',        key: '9' },
  { id: 'profiles',    labelKey: 'tab.profiles',    key: '0' },
  { id: 'corrections', labelKey: 'tab.corrections', key: null },
  { id: 'patterns',    labelKey: 'tab.patterns',    key: null },
  { id: 'sudo',        labelKey: 'tab.sudo',        key: null },
  { id: 'providers',   labelKey: 'tab.providers',   key: null },
  { id: 'gateway',     labelKey: 'tab.gateway',     key: null },
  { id: 'model-info',  labelKey: 'tab.model-info',  key: null },
  { id: 'plugins',     labelKey: 'tab.plugins',     key: null },
]

export type TabId = string
