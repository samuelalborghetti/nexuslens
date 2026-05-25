import { memo } from 'react';
import { useStore } from '../store';

const faqs = [
  { q: 'La webcam non viene rilevata', a: 'Verifica i permessi del browser. Nelle impostazioni del sito, assicurati che la webcam sia consentita.' },
  { q: 'I dati EAR sono instabili', a: 'Assicurati di essere in un ambiente ben illuminato. Il viso deve essere centrato e ben visibile.' },
  { q: 'Il microfono non capta', a: 'Controlla che il microfono non sia silenziato nel sistema operativo e che i permessi siano concessi.' },
  { q: 'Latenza elevata', a: 'Riduci il numero di applicazioni aperte. Nexus Lens è ottimizzato per performance riducendo il frame rate.' },
];

const HardwareTroubleshooter = memo(function HardwareTroubleshooter() {
  const isSimulated = useStore(s => s.isSimulated);
  const modeText = useStore(s => s.modeText);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-4">
      <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Hardware</h3>

      {/* Mode toggle */}
      <div className="flex items-center justify-between rounded-lg bg-white/5 p-3">
        <div>
          <div className="text-xs text-white/70">Modalità</div>
          <div className="text-[10px] text-white/30">{isSimulated ? 'Simulazione' : 'Hardware Live'}</div>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded font-mono ${
          isSimulated ? 'bg-amber-500/10 text-amber-400' : 'bg-green-500/10 text-green-400'
        }`}>
          {modeText}
        </span>
      </div>

      {/* FAQ */}
      <div>
        <div className="text-[10px] text-white/40 font-semibold mb-2 uppercase tracking-wider">FAQ · Protocolli</div>
        <div className="space-y-2">
          {faqs.map(({ q, a }) => (
            <div key={q} className="rounded-lg bg-white/[0.02] border border-white/5 p-3">
              <div className="text-[10px] text-white/70 font-medium mb-1">{q}</div>
              <div className="text-[10px] text-white/30">{a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default HardwareTroubleshooter;
