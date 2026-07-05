import SubTabs from './SubTabs'
import ProvidersPanel from './ProvidersPanel'
import GatewayPanel from './GatewayPanel'
import ModelInfoPanel from './ModelInfoPanel'
import PluginsPanel from './PluginsPanel'
import ProfilesPanel from './ProfilesPanel'
import SudoPanel from './SudoPanel'
import PatternsPanel from './PatternsPanel'
import ProjectsPanel from './ProjectsPanel'
import { useI18n } from '../i18n'

export default function SystemPanel() {
  const { t } = useI18n()

  return (
    <SubTabs
      defaultTab="providers"
      tabs={[
        { id: 'providers',   label: t('tab.providers'),   element: <ProvidersPanel /> },
        { id: 'gateway',     label: t('tab.gateway'),     element: <GatewayPanel /> },
        { id: 'model-info',  label: t('tab.model-info'),  element: <ModelInfoPanel /> },
        { id: 'plugins',     label: t('tab.plugins'),     element: <PluginsPanel /> },
        { id: 'profiles',    label: t('tab.profiles'),    element: <ProfilesPanel /> },
        { id: 'sudo',        label: t('tab.sudo'),        element: <SudoPanel /> },
        { id: 'patterns',    label: t('tab.patterns'),    element: <PatternsPanel /> },
        { id: 'projects',    label: t('tab.projects'),    element: <ProjectsPanel /> },
      ]}
    />
  )
}
