import { useState, useEffect, useCallback } from 'react';
import { useStore, useSimulationDerivation, completeOnboarding, addLog, getState } from './store';
import BackgroundNeural from './components/BackgroundNeural';
import FaceMeshTracker from './components/FaceMeshTracker';
import BrightnessDemo from './components/BrightnessDemo';
import AdaptiveReading from './components/AdaptiveReading';
import WriteAnalyzer from './components/WriteAnalyzer';
import EventLog from './components/EventLog';
import CognitiveProfile from './components/CognitiveProfile';
import PrivacyEngine from './components/PrivacyEngine';
import HardwareTroubleshooter from './components/HardwareTroubleshooter';
import SimulationSuite from './components/SimulationSuite';
import OnboardingModal from './components/OnboardingModal';
import type { TabType } from './types';

const tabs: { id: TabType; emoji: string }[] = [
  { id: 'live', emoji: '🛰️' },
  { id: 'reading', emoji: '📖' },
  { id: 'write', emoji: '✍️' },
  { id: 'brightness', emoji: '💡' },
  { id: 'profile', emoji: '🪐' },
  { id: 'privacy', emoji: '️' },
];

function ScreenVoidOverlay() {
  const isVoid = useStore(s => s.isScreenVoid);
  if (!isVoid) return null;
  return <div className="fixed inset-0 z-40 bg-black pointer-events-none transition-opacity duration-500" />;
}

function StatusDot() {
  const eyeStatus = useStore(s => s.eyeStatus);
  const isSimulated = useStore(s => s.isSimulated);
  
  let color = 'bg-green-400';
  if (eyeStatus === 'CLOSED' || eyeStatus === 'VOID') color = 'bg-red-400';
  else if (eyeStatus === 'SQUINTING' || eyeStatus === 'BLINK') color = 'bg-amber-400';
  if (isSimulated) color = 'bg-amber-400';
  
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3">
      <div className="text-[10px] text-white/40">{label}</div>
      <div className="text-lg font-mono text-white/80 mt-1">{value}</div>
      {sub && <div className="text-[10px] text-white/20 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function App() {
  const [onboarding, setOnboarding] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('live');
  const isScreenVoid = useStore(s => s.isScreenVoid);
  const earValue = useStore(s => s.earValue);
  const headPitch = useStore(s => s.headPitch);
  const distanceCm = useStore(s => s.distanceCm);
  const eyeStatus = useStore(s => s.eyeStatus);
  const isSimulated = useStore(s => s.isSimulated);
  const trackingText = useStore(s => s.trackingText);
  const heartRate = useStore(s => s.heartRate);
  const heartRateConfidence = useStore(s => s.heartRateConfidence);

  useSimulationDerivation();

  useEffect(() => {
    if (getState().onboardingComplete) {
      setOnboarding(false);
    }
  }, []);

  const handleOnboarding = useCallback((simulated: boolean) => {
    completeOnboarding(simulated);
    setOnboarding(false);
    addLog('Sistema avviato', 'ok');
  }, []);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    addLog(`Tab: ${tab}`, 'info');
  };

  const handleReset = () => {
    const s = getState();
    s.onboardingComplete = false;
    s.isScreenVoid = false;
    s.closedSince = null;
    s.closedDurationMs = 0;
    s.eyeStatus = 'OPEN';
    s.modeText = 'LIVE · TRACKING';
    s.trackingText = 'INIZIALIZZAZIONE';
    setOnboarding(true);
    addLog('Re-inizializzazione', 'warn');
  };

  if (onboarding) {
    return (
      <>
        <BackgroundNeural />
        <OnboardingModal onComplete={handleOnboarding} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white/80 flex flex-col">
      <ScreenVoidOverlay />

      {isScreenVoid && <div className="fixed inset-0 z-40 bg-black" />}

      {/* Navbar */}
      <header className="relative z-30 flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <div className="text-[10px] text-white/30 tracking-[0.15em] font-light">
          NEXUS LENS
        </div>

        <nav className="flex items-center gap-1">
          {tabs.map(({ id, emoji }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all duration-200 ${
                activeTab === id
                  ? 'bg-white/10 border border-white/30'
                  : 'opacity-40 hover:opacity-60'
              }`}
            >
              {emoji}
            </button>
          ))}
        </nav>

        <StatusDot />
      </header>

      {/* Content */}
      <main className="relative z-30 flex-1 overflow-y-auto p-4">
        {/* LIVE TAB */}
        <div className={activeTab === 'live' ? 'block' : 'hidden'}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              {/* Tracker */}
              <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden">
                <FaceMeshTracker isVisible={!isSimulated} />
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="EAR" value={earValue.toFixed(3)} sub="Eye Aspect Ratio" />
                <MetricCard 
                  label="Battito Cardiaco" 
                  value={heartRate > 0 ? `${heartRate} BPM` : '—'} 
                  sub={heartRate > 0 ? `Confidenza: ${(heartRateConfidence * 100).toFixed(0)}%` : 'rPPG in calibrazione...'}
                />
                <MetricCard label="Pitch" value={`${headPitch.toFixed(1)}°`} sub="Inclinazione capo" />
                <MetricCard label="Distanza" value={`${distanceCm.toFixed(0)} cm`} sub="Dallo schermo" />
              </div>

              {/* Status */}
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${trackingText === 'CALIBRATO' ? 'bg-green-400' : 'bg-amber-400'}`} />
                    <span className="text-[10px] text-white/40">{trackingText}</span>
                  </div>
                  <span className="text-[10px] text-white/30">{eyeStatus}</span>
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">Regole Adattive</h3>
                <div className="space-y-2 text-[10px] text-white/40">
                  <div className="flex justify-between">
                    <span>Blink {'<'} 2s</span>
                    <span className="text-green-400/60">IGNORATO</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Socchiuso/chiuso {'>'} 2s</span>
                    <span className="text-amber-400/60">ADATTA TESTO</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Luminosità</span>
                    <span className="text-amber-400/60">STESSA REGOLA 2s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Chiuso {'>'} 9s</span>
                    <span className="text-red-400/60">SCREEN VOID</span>
                  </div>
                </div>
              </div>

              <HardwareTroubleshooter />
              {isSimulated && <SimulationSuite />}
              <EventLog />
            </div>
          </div>
        </div>

        {/* READING TAB */}
        <div className={activeTab === 'reading' ? 'block' : 'hidden'}>
          <div className="max-w-2xl mx-auto">
            <AdaptiveReading />
          </div>
        </div>

        {/* BRIGHTNESS TAB */}
        <div className={activeTab === 'brightness' ? 'block' : 'hidden'}>
          <div className="max-w-5xl mx-auto">
            <BrightnessDemo />
          </div>
        </div>

        {/* WRITE TAB */}
        <div className={activeTab === 'write' ? 'block' : 'hidden'}>
          <div className="max-w-lg mx-auto">
            <WriteAnalyzer />
          </div>
        </div>

        {/* PROFILE TAB */}
        <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
          <div className="max-w-lg mx-auto">
            <CognitiveProfile />
          </div>
        </div>

        {/* PRIVACY TAB */}
        <div className={activeTab === 'privacy' ? 'block' : 'hidden'}>
          <div className="max-w-lg mx-auto">
            <PrivacyEngine />
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-4 mt-4">
          <button
            onClick={handleReset}
            className="text-[10px] text-white/20 hover:text-white/40 transition-colors"
          >
            Re-inizializza
          </button>
        </footer>
      </main>
    </div>
  );
}
