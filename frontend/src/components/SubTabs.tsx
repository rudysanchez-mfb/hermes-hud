import { Box, Tabs, Tab } from '@mui/material'
import { useState, type ReactNode } from 'react'

export interface SubTab {
  id: string
  label: string
  element: ReactNode
}

interface SubTabsProps {
  tabs: SubTab[]
  defaultTab?: string
}

export default function SubTabs({ tabs, defaultTab }: SubTabsProps) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id || '')

  const current = tabs.find(t => t.id === active) || tabs[0]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs
        value={active}
        onChange={(_e, val) => setActive(val)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 0, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
      >
        {tabs.map(t => (
          <Tab key={t.id} value={t.id} label={t.label} sx={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
        ))}
      </Tabs>
      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {current?.element}
      </Box>
    </Box>
  )
}
