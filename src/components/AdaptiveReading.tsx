import { memo, useState, useEffect, useRef } from 'react';
import { useStore } from '../store';

const sampleText = `Questo pannello serve a verificare una cosa semplice: se sbatti le palpebre o chiudi gli occhi per meno di due secondi, non succede nulla. Quello è un gesto normale.

Se invece tieni gli occhi socchiusi o chiusi per almeno due secondi, il sistema lo interpreta come possibile stanchezza visiva. A quel punto il testo diventa più grande, più distanziato e più comodo da leggere.

La webcam resta locale: i punti sul viso servono solo a calcolare l'apertura degli occhi e, quando possibile, il battito cardiaco tramite rPPG.

Questa è la logica pratica che vogliamo: niente effetti strani, solo adattamento utile dopo una soglia chiara di due secondi.`;

const AdaptiveReading = memo(function AdaptiveReading() {
  const eyeStatus = useStore(s => s.eyeStatus);
  const closedDurationMs = useStore(s => s.closedDurationMs);
  const [isExpanded, setIsExpanded] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const isFatigueHold =
      (eyeStatus === 'SQUINTING' || eyeStatus === 'CLOSED') && closedDurationMs >= 2000;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (isFatigueHold) {
      setIsExpanded(true);
    } else if (eyeStatus === 'OPEN' || eyeStatus === 'BLINK' || closedDurationMs < 2000) {
      // Blink and normal short squint below 2s are ignored.
      setIsExpanded(false);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [eyeStatus, closedDurationMs]);

  const isShortEyeAction =
    (eyeStatus === 'BLINK' || eyeStatus === 'CLOSED' || eyeStatus === 'SQUINTING') &&
    closedDurationMs > 0 &&
    closedDurationMs < 2000;
  const holdProgress = Math.min(100, (closedDurationMs / 2000) * 100);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Lettura Adattiva</h3>
        {isShortEyeAction && (
          <span className="text-[10px] text-green-400/70 font-mono">SOTTO 2s · IGNORATO</span>
        )}
        {isExpanded && (
          <span className="text-[10px] text-amber-400/70 font-mono">STANCHEZZA · TESTO ADATTATO</span>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-white/35">
          <span>Adattamento dopo 2 secondi di occhi socchiusi/chiusi</span>
          <span>{Math.round(holdProgress)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-amber-500/70 transition-all duration-150"
            style={{ width: `${holdProgress}%` }}
          />
        </div>
      </div>

      <div
        className="rounded-xl bg-zinc-900/50 border border-white/5 p-4 overflow-y-auto"
        style={{ maxHeight: 300 }}
      >
        <p
          className={`text-white/70 transition-[font-size,line-height,letter-spacing,color] duration-[1800ms] ease-out ${
            isExpanded ? 'text-base tracking-wide leading-8' : 'text-xs tracking-normal leading-relaxed'
          }`}
        >
          {sampleText}
        </p>
      </div>

      <div className="flex items-center gap-2 text-[10px] text-white/30">
        <div className={`w-1.5 h-1.5 rounded-full ${isExpanded ? 'bg-amber-400' : 'bg-green-400/50'}`} />
        <span>
          {isExpanded
            ? 'Testo espanso per ridurre l\'affaticamento visivo'
            : 'Testo in modalità standard · Lo stato degli occhi controlla l\'adattamento'}
        </span>
      </div>
    </div>
  );
});

export default AdaptiveReading;
