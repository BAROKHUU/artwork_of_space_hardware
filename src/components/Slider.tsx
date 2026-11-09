export function Slider({ label, value, min, max, step, unit, display, onChange }: { label: string; value: number; min: number; max: number; step: number; unit: string; display?: string; onChange: (v: number) => void }) {
  return (
    <label className="slider">
      <span>{label} <b>{display ?? `${value.toLocaleString()} ${unit}`}</b></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
