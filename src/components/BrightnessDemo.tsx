import { memo } from 'react';
import { useStore } from '../store';

const dimmingColors = ['#10b981', '#65a30d', '#f59e0b', '#f97316', '#ef4444'];
const temperatureColors = ['#2bb487', '#43b72a', '#b99721', '#b86524', '#bb2e28'];
const comfortColors = ['#2f8a68', '#438f34', '#a98d3a', '#b8733e', '#c44d46'];

function ColorRow({
  title,
  value,
  colors,
  brightness,
  warmth,
}: {
  title: string;
  value: string;
  colors: string[];
  brightness: number;
  warmth: number;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-black p-4 sm:p-5">
      <div className="mb-5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-white/45">
        <span>{title}</span>
        <span className="font-normal normal-case text-white/45">{value}</span>
      </div>

      <div className="grid grid-cols-5 gap-3 sm:gap-4">
        {colors.map((color, index) => {
          const activeBias = index / Math.max(1, colors.length - 1);
          const dimOpacity = Math.max(0.22, brightness * (0.92 - activeBias * 0.14));
          const warmBoost = 1 + warmth * activeBias * 0.22;

          return (
            <div
              key={`${title}-${color}`}
              className="h-28 rounded-2xl transition-all duration-700 sm:h-36"
              style={{
                backgroundColor: color,
                opacity: dimOpacity,
                filter: `saturate(${1 + warmth * 0.28}) brightness(${warmBoost})`,
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

const BrightnessDemo = memo(function BrightnessDemo() {
  const earValue = useStore((s) => s.earValue);
  const eyeStatus = useStore((s) => s.eyeStatus);
  const closedDurationMs = useStore((s) => s.closedDurationMs);
  const closedSince = useStore((s) => s.closedSince);
  const isScreenVoid = useStore((s) => s.isScreenVoid);

  const isEyeHold = eyeStatus === 'SQUINTING' || eyeStatus === 'CLOSED';
  const isBlink = eyeStatus === 'BLINK' || (isEyeHold && closedDurationMs > 0 && closedDurationMs < 2000);
  const isFatigueHold = isEyeHold && closedDurationMs >= 2000;

  const toleranceProgress = isEyeHold ? Math.min(closedDurationMs / 2000, 1) : 0;
  const dimmingProgress = isFatigueHold ? Math.max(0, Math.min((closedDurationMs - 2000) / 7000, 1)) : 0;

  const brightness = isFatigueHold ? Math.max(0.05, 1 - dimmingProgress * 0.95) : 1;
  const warmth = isFatigueHold ? Math.min(1, 0.18 + dimmingProgress * 0.82) : 0;
  const comfort = isFatigueHold ? Math.min(1, 0.28 + dimmingProgress * 0.72) : 0;

  const statusText = isScreenVoid
    ? 'VOID'
    : isFatigueHold
      ? 'ADATTAMENTO'
      : isBlink
        ? 'IGNORATO'
        : 'ATTIVO';

  const statusClass = isScreenVoid
    ? 'text-red-400'
    : isFatigueHold
      ? 'text-amber-400'
      : 'text-emerald-400';

  return (
    <div className="rounded-3xl border border-white/10 bg-black p-5 shadow-none sm:p-6">
      <header className="mb-7 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/70">
          Luminosità Adattiva
        </h3>
        <span className={`text-sm font-medium uppercase ${statusClass}`}>{statusText}</span>
      </header>

      <div className="space-y-5">
        <ColorRow
          title="1 · Dimming"
          value={`${Math.round(brightness * 100)}% luce`}
          colors={dimmingColors}
          brightness={brightness}
          warmth={0}
        />

        <ColorRow
          title="2 · Temperatura"
          value={`${Math.round(warmth * 100)}% caldo`}
          colors={temperatureColors}
          brightness={Math.max(0.4, brightness)}
          warmth={warmth}
        />

        <ColorRow
          title="3 · Comfort consigliato"
          value={comfort > 0.5 ? 'caldo + contrasto stabile' : 'contrasto stabile'}
          colors={comfortColors}
          brightness={Math.max(0.42, brightness * (0.78 + comfort * 0.22))}
          warmth={comfort}
        />
      </div>

      <div className="mt-7 space-y-4">
        <div>
          <div className="mb-2 flex justify-between text-[11px] font-medium uppercase tracking-wide text-white/45">
            <span>Tolleranza · 2s</span>
            <span>{Math.round(toleranceProgress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-amber-500/70 transition-all duration-200"
              style={{ width: `${toleranceProgress * 100}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex justify-between text-[11px] font-medium uppercase tracking-wide text-white/45">
            <span>Dimming dopo 2s · 7s</span>
            <span>{Math.round(dimmingProgress * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-all duration-200"
              style={{
                width: `${dimmingProgress * 100}%`,
                background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 text-left">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] uppercase tracking-wide text-white/35">EAR</div>
          <div className="mt-1 font-mono text-sm text-white/75">{earValue.toFixed(3)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] uppercase tracking-wide text-white/35">Occhi da</div>
          <div className="mt-1 font-mono text-sm text-white/75">
            {closedSince ? `${(closedDurationMs / 1000).toFixed(1)}s` : '-'}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="text-[10px] uppercase tracking-wide text-white/35">Stato</div>
          <div className="mt-1 font-mono text-sm text-white/75">{eyeStatus}</div>
        </div>
      </div>
    </div>
  );
});

export default BrightnessDemo;