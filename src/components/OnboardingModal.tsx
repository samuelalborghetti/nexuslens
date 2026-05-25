import { memo } from 'react';
import { addLog } from '../store';
import HeroOrb from './HeroOrb';
import OrbitingIcons from './OrbitingIcons';

interface OnboardingModalProps {
  onComplete: (simulated: boolean) => void;
}

const OnboardingModal = memo(function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const handleStart = (simulated: boolean) => {
    addLog(`Avvio in modalità ${simulated ? 'simulazione' : 'hardware'}`, 'ok');
    onComplete(simulated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto scroll-smooth">
      <div className="w-full min-h-screen flex flex-col items-center px-4 py-8">
        {/* Spacer top to center content visually */}
        <div className="flex-1 min-h-8" />
        
        <div className="max-w-sm w-full text-center space-y-5">
          {/* Hero orb */}
          <div className="w-36 h-36 mx-auto">
            <HeroOrb size={144} />
          </div>
          
          {/* Titolo */}
          <div className="space-y-0.5">
            <h1 className="text-lg font-light text-white/80 tracking-[0.2em]">
              NEXUS LENS
            </h1>
            <p className="text-[9px] text-white/25 font-light tracking-[0.3em]">
              PC COGNITIVO ADATTIVO
            </p>
          </div>

          {/* Orbiting icons */}
          <div className="w-[220px] h-[220px] mx-auto">
            <OrbitingIcons size={180} />
          </div>

          {/* Descrizione */}
          <p className="text-[10px] text-white/35 leading-relaxed px-4">
            Sistema di monitoraggio biometrico che si adatta al tuo stato cognitivo 
            in tempo reale. Sensori per occhi, battito cardiaco, capo, ambiente e 
            digitazione lavorano insieme.
          </p>

          {/* Bottoni */}
          <div className="flex gap-3 justify-center pt-2 pb-1">
            <button
              onClick={() => handleStart(false)}
              className="px-5 py-2.5 rounded-xl border border-white/20 text-[11px] text-white/80 
                         hover:bg-white/5 hover:border-white/30 transition-all duration-300
                         active:scale-95"
            >
              AVVIA SENSORI
            </button>
            <button
              onClick={() => handleStart(true)}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-[11px] text-white/40 
                         hover:text-white/60 hover:border-white/20 transition-all duration-300
                         active:scale-95"
            >
              SIMULAZIONE
            </button>
          </div>

          <div className="text-[8px] text-white/15 pb-2">
            v1.0 · rPPG · Zero-knowledge · Locale
          </div>
        </div>

        {/* Spacer bottom */}
        <div className="flex-1 min-h-4" />
      </div>
    </div>
  );
});

export default OnboardingModal;
