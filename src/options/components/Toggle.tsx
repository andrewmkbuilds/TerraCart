interface Props {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}

export default function Toggle({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition-colors ${checked ? 'bg-forest' : 'bg-sand'}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-surface shadow-sm transition-all ${
          checked ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}