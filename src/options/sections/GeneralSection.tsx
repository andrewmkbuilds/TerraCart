import type { Preferences } from '../../types'
import Panel, { Row } from '../components/Panel'
import Toggle from '../components/Toggle'

interface Props {
  preferences: Preferences
  save: (patch: Partial<Preferences>) => Promise<void>
}

export default function GeneralSection({ preferences, save }: Props) {
  return (
    <Panel
      title="General"
      description="How TerraCart behaves while you browse. Everything runs locally on your device."
    >
      <Row label="Floating launcher" hint="Show the TerraCart button on product pages so you can open the analysis panel.">
        <Toggle
          label="Floating launcher"
          checked={preferences.floatingLauncher}
          onChange={(value) => void save({ floatingLauncher: value })}
        />
      </Row>
      <Row label="Save analysis history" hint="Keep a short record of scored products so you can revisit them.">
        <Toggle
          label="Save analysis history"
          checked={preferences.saveHistory}
          onChange={(value) => void save({ saveHistory: value })}
        />
      </Row>
      <Row label="Compact layout" hint="Tighter spacing in the extension panel.">
        <Toggle
          label="Compact layout"
          checked={preferences.compactMode}
          onChange={(value) => void save({ compactMode: value })}
        />
      </Row>
      <Row
        label="Auto-analyse product pages"
        hint="TerraScore is calculated as soon as a product page is recognised. Always on — no page data leaves your browser."
      >
        <span className="chip bg-forest-tint text-forest-soft">On</span>
      </Row>
    </Panel>
  )
}