import { memo, useCallback } from 'react';
import { useStore, setSimulation, addLog } from '../store';

const sliders = [
  { key: 'ear' as const, label: 'EAR', min: 0, max: 0.5, step: 0.01 },
  { key: 'blink' as const, label: 'Blink Rate', min: 0, max: 60, step: 1 },
  { key: 'pitch' as const, label: 'Pitch', min: -30, max: 30, step: 1 },
  { key: 'distance' as const, label: 'Distanza', min: 20, max: 100, step: 1 },
  { key: 'noise' as const, label: 'Rumore', min: 0, max: 100, step: 1 },
  { key: 'typing' as const, label: 'Digitazione', min: 0, max: 100, step: 1 },
];

const presets: { label: string; values: Record<string, number> }[] = [
  { label: 'CALM', values: { ear: 0.35, blink: 12, pitch: 0, distance: 50, noise: 15, typing: 20 } },
  { label: 'FLOW', values: { ear: 0.32, blink: 8, pitch: 2, distance: 40, noise: 25, typing: 55 } },
  { label: 'STRESS', values: { ear: 0.25, blink: 25, pitch: 8, distance: 35, noise: 50, typing: 75 } },
  { label: 'RAGE', values: { ear: 0.15, blink: 35, pitch: 15, distance: 30, noise: 80, typing: 95 } },
];

const SimulationSuite = memo(function SimulationSuite() {
  const simulation = useStore(s => s.simulation);

  const handleSlider = useCallback((key: string, value: number) => {
    setSimulation({ [key]: value });
  }, []);

  const handlePreset = useCallback((label: string) => {
    const preset = presets.find(p => p.label === label);
    if (preset) {
      setSimulation(preset.values as any);
      addLog(`Preset: ${label}`, 'info');
    }
  }, []);

  const handleVoid = useCallback(() => {
    setSimulation({ ear: 0.05 });
    addLog('SIMULA VOID', 'warn');
  }, []);

  const handleReset = useCallback(() => {
    setSimulation({ ear: 0.35, blink: 15, pitch: 0, distance: 50, noise: 30, typing: 40 });
    addLog('Reset simulazione', 'info');
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Simulation Suite</h3>
        <div className="flex gap-1">
          <button
            onClick={handleVoid}
            className="text-[10px] px-2 py-1 rounded border border-white/10 text-white/30 hover:text-red-400 hover:border-red-400/30 transition-colors"
          >
            VOID
          </button>
          <button
            onClick={handleReset}
            className="text-[10px] px-2 py-1 rounded border border-white/10 text-white/30 hover:text-white/60 transition-colors"
          >
            RESET
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        {presets.map(p => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.label)}
            className="flex-1 text-[10px] py-1.5 rounded border border-white/10 text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {sliders.map(({ key, label, min, max, step }) => (
          <div key={key}>
            <div className="flex justify-between text-[10px] text-white/40 mb-1">
              <span>{label}</span>
              <span className="text-white/70 font-mono">{simulation[key]}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={simulation[key]}
              onChange={e => handleSlider(key, parseFloat(e.target.value))}
              className="w-full h-1 rounded-full appearance-none bg-white/5 cursor-pointer accent-[#10b981]"
            />
          </div>
        ))}
      </div>
    </div>
  );
});

export default SimulationSuite;
