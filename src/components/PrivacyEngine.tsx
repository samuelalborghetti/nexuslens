import { memo } from 'react';
import { useStore, setSensor, addLog } from '../store';

const sensors = [
  { key: 'webcam' as const, label: 'Webcam', desc: 'Rilevamento volto e occhi' },
  { key: 'mic' as const, label: 'Microfono', desc: 'Analisi acustica ambiente' },
  { key: 'keyboard' as const, label: 'Tastiera', desc: 'Dinamiche di digitazione' },
];

const PrivacyEngine = memo(function PrivacyEngine() {
  const sensorsState = useStore(s => s.sensors);

  const handleToggle = (key: 'webcam' | 'mic' | 'keyboard') => {
    const newVal = !sensorsState[key];
    setSensor(key, newVal);
    addLog(`${key}: ${newVal ? 'ATTIVO' : 'DISATTIVO'}`, newVal ? 'ok' : 'warn');
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-4">
      <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Privacy Engine</h3>

      <div className="space-y-3">
        {sensors.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between rounded-lg bg-white/5 p-3">
            <div>
              <div className="text-xs text-white/70 font-medium">{label}</div>
              <div className="text-[10px] text-white/30">{desc}</div>
            </div>
            <button
              onClick={() => handleToggle(key)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                sensorsState[key] ? 'bg-green-500/30' : 'bg-white/10'
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  sensorsState[key] ? 'translate-x-5' : 'translate-x-0.5'
                }`}
                style={{ left: 0 }}
              />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white/[0.02] border border-white/5 p-4">
        <div className="text-[10px] text-white/40 font-semibold mb-2">Zero-Knowledge Privacy</div>
        <ul className="space-y-1 text-[10px] text-white/30">
          <li>• Tutti i dati biometrici sono elaborati localmente</li>
          <li>• Nessuna trasmissione a server esterni</li>
          <li>• I dati di calibrazione rimangono sul dispositivo</li>
          <li>• Disconnessione immediata alla disattivazione</li>
          <li>• Purge cancella permanentemente tutti i dati</li>
        </ul>
      </div>
    </div>
  );
});

export default PrivacyEngine;
