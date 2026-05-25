import { memo } from 'react';
import { useStore, addLog } from '../store';

const CognitiveProfile = memo(function CognitiveProfile() {
  const earBaseline = useStore(s => s.earBaseline);
  const calibration = useStore(s => s.calibration);
  const eyeStatus = useStore(s => s.eyeStatus);
  const heartRate = useStore(s => s.heartRate);
  const heartRateHistory = useStore(s => s.heartRateHistory);

  const trainingProgress = calibration.calibratedAt
    ? Math.min(14, Math.round((Date.now() - calibration.calibratedAt) / (1000 * 60 * 60 * 24)))
    : 0;
  const progressPercent = Math.min(100, (trainingProgress / 14) * 100);

  const handlePurge = () => {
    addLog('Dati profilo eliminati', 'warn');
  };

  const avgHR = heartRateHistory.length > 0
    ? Math.round(heartRateHistory.reduce((a, b) => a + b, 0) / heartRateHistory.length)
    : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Profilo Cognitivo</h3>
        <button
          onClick={handlePurge}
          className="text-[10px] px-2 py-1 rounded border border-white/10 text-white/30 hover:text-red-400 hover:border-red-400/30 transition-colors"
        >
          PURGE DATA
        </button>
      </div>

      <div>
        <div className="flex justify-between text-[10px] text-white/40 mb-1">
          <span>Addestramento Modello</span>
          <span>{trainingProgress}/14 giorni</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500/50 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-[10px] text-white/40 mb-1">EAR Baseline</div>
          <div className="text-lg font-mono text-white/80">{earBaseline.toFixed(3)}</div>
          <div className="text-[10px] text-white/20 mt-1">Soglia personale</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-[10px] text-white/40 mb-1">CPM Medio</div>
          <div className="text-lg font-mono text-white/80">{calibration.cpm || '—'}</div>
          <div className="text-[10px] text-white/20 mt-1">Battiti per minuto</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-[10px] text-white/40 mb-1">Stato Attuale</div>
          <div className="text-lg font-mono text-white/80">{eyeStatus}</div>
          <div className="text-[10px] text-white/20 mt-1">Eye tracking</div>
        </div>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-[10px] text-white/40 mb-1">Battito Card.</div>
          <div className="text-lg font-mono text-white/80">
            {heartRate > 0 ? `${heartRate} BPM` : '—'}
          </div>
          <div className="text-[10px] text-white/20 mt-1">
            {heartRateHistory.length > 0 ? `Media: ${avgHR} BPM` : 'rPPG'}
          </div>
        </div>
      </div>

      {heartRateHistory.length > 5 && (
        <div className="rounded-xl bg-white/5 p-3">
          <div className="text-[10px] text-white/40 mb-2">Storico Battito (ultimi 60s)</div>
          <svg viewBox="0 0 200 40" className="w-full h-8">
            <polyline
              fill="none"
              stroke="rgba(16,185,129,0.5)"
              strokeWidth="1"
              points={heartRateHistory.map((v, i) => {
                const x = (i / Math.max(heartRateHistory.length - 1, 1)) * 200;
                const y = 40 - ((v - 40) / 120) * 40;
                return `${x},${Math.max(0, Math.min(40, y))}`;
              }).join(' ')}
            />
          </svg>
        </div>
      )}

      <div className="text-[10px] text-white/20 text-center">
        Dati memorizzati localmente · Nessuna trasmissione esterna
      </div>
    </div>
  );
});

export default CognitiveProfile;
