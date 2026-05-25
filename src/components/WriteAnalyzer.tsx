import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useStore, addLog } from '../store';

const sampleWords = ['casa', 'mare', 'sole', 'luna', 'stella', 'vento', 'nube', 'fiore', 'montagna', 'fiume'];

// Emoji for acoustic signature
const getAcousticEmoji = (noiseLevel: number, baseline: number) => {
  const delta = noiseLevel - baseline;
  if (delta > 30) return '🔴';
  if (delta > 20) return '🟠';
  if (delta > 10) return '🟡';
  if (noiseLevel < baseline * 0.5) return '🔇';
  return '🟢';
};

const WriteAnalyzer = memo(function WriteAnalyzer() {
  const isSimulated = useStore(s => s.isSimulated);
  const simNoise = useStore(s => s.simulation.noise);
  
  const [calibrationPhase, setCalibrationPhase] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [cpm, setCpm] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [audioBaseline, setAudioBaseline] = useState(30);
  const [audioCurrent, setAudioCurrent] = useState(30);
  const [audioPeak, setAudioPeak] = useState(30);
  const [isGaming, setIsGaming] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const baselineFrames = useRef<number[]>([]);
  const lastKeyTime = useRef<number>(0);
  const errors = useRef(0);
  const totalKeys = useRef(0);
  const keyTimings = useRef<number[]>([]);

  // Start mic analysis
  useEffect(() => {
    if (isSimulated) return;
    
    async function startMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.2;
        src.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        function readAudio() {
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          
          setAudioCurrent(prev => {
            const smoothed = prev * 0.7 + avg * 0.3;
            
            baselineFrames.current.push(smoothed);
            if (baselineFrames.current.length > 30) baselineFrames.current.shift();
            
            if (baselineFrames.current.length >= 15) {
              const sorted = [...baselineFrames.current].sort((a, b) => a - b);
              const p15 = sorted[Math.floor(sorted.length * 0.15)];
              setAudioBaseline(p15);
            }
            
            setAudioPeak(prev => Math.max(prev * 0.95, smoothed));
            
            return smoothed;
          });
          
          requestAnimationFrame(readAudio);
        }
        readAudio();
        addLog('Analisi acustica avviata', 'ok');
      } catch {
        addLog('Microfono non disponibile', 'warn');
      }
    }
    
    startMic();
    
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      audioCtxRef.current?.close();
    };
  }, [isSimulated]);

  // Simulated audio
  useEffect(() => {
    if (!isSimulated) return;
    const interval = setInterval(() => {
      const noise = simNoise + (Math.random() - 0.5) * 10;
      setAudioCurrent(noise);
      setAudioBaseline(prev => prev * 0.95 + noise * 0.05);
      setAudioPeak(prev => Math.max(prev * 0.95, noise));
    }, 200);
    return () => clearInterval(interval);
  }, [isSimulated, simNoise]);

  const handleCalibrationStart = () => {
    setCalibrationPhase(true);
    setWordIndex(0);
    keyTimings.current = [];
    errors.current = 0;
    totalKeys.current = 0;
    addLog('Calibrazione CPM avviata · Digita le 10 parole', 'info');
  };

  const handleWordSubmit = useCallback(() => {
    const word = sampleWords[wordIndex];
    if (userInput.trim().toLowerCase() === word) {
      const now = Date.now();
      if (lastKeyTime.current > 0) {
        keyTimings.current.push(now - lastKeyTime.current);
      }
      lastKeyTime.current = now;
      
      setUserInput('');
      
      if (wordIndex + 1 >= sampleWords.length) {
        const avg = keyTimings.current.length > 0 
          ? keyTimings.current.reduce((a, b) => a + b, 0) / keyTimings.current.length 
          : 500;
        const wordsPerMin = Math.round(60000 / avg);
        setCpm(wordsPerMin);
        setCalibrationPhase(false);
        addLog(`Calibrazione completata · CPM: ${wordsPerMin}`, 'ok');
      } else {
        setWordIndex(prev => prev + 1);
      }
    } else {
      errors.current++;
      totalKeys.current++;
    }
  }, [wordIndex, userInput]);

  // Keystroke monitoring
  useEffect(() => {
    const handleKeyDown = () => {
      if (!calibrationPhase) {
        const now = Date.now();
        if (lastKeyTime.current > 0) {
          const delta = now - lastKeyTime.current;
          if (delta > 0) {
            setCpm(prev => Math.round(prev * 0.7 + (60000 / delta) * 0.3));
          }
        }
        lastKeyTime.current = now;
        totalKeys.current++;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [calibrationPhase]);

  const noiseDelta = audioCurrent - audioBaseline;
  const acousticEmoji = getAcousticEmoji(audioCurrent, audioBaseline);

  const getCognitiveState = () => {
    if (noiseDelta > 30 && (!isGaming || (isGaming && noiseDelta > 30))) {
      return { label: 'RAGE', color: 'text-red-400' };
    }
    if (cpm > 0) {
      if (cpm > 90) return { label: 'STRESSED', color: 'text-red-400' };
      if (cpm > 60) return { label: 'FLOW', color: 'text-green-400' };
    }
    return { label: 'CALM', color: 'text-green-400/70' };
  };

  const cogState = getCognitiveState();

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Write Analyzer</h3>
        <span className={`text-xs font-mono ${cogState.color}`}>{cogState.label}</span>
      </div>

      {/* Calibration */}
      {calibrationPhase ? (
        <div className="space-y-3">
          <div className="text-sm text-white/60 text-center">
            Digita: <span className="text-white font-semibold">{sampleWords[wordIndex]}</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleWordSubmit()}
              className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 outline-none focus:border-white/20"
              placeholder="Scrivi qui..."
              autoFocus
            />
            <button
              onClick={handleWordSubmit}
              className="px-3 py-2 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
            >
              OK
            </button>
          </div>
          <div className="text-[10px] text-white/30 text-center">
            {wordIndex + 1} / {sampleWords.length}
          </div>
        </div>
      ) : (
        <button
          onClick={handleCalibrationStart}
          className="w-full py-2 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white/80 hover:border-white/20 transition-colors"
        >
          CALIBRAZIONE CPM (10 PAROLE)
        </button>
      )}

      {/* Acoustic Analysis */}
      <div className="space-y-2">
        <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Analisi Acustica</div>
        
        <div>
          <div className="flex justify-between text-[10px] text-white/30 mb-0.5">
            <span>Ambiente Baseline</span>
            <span>{Math.round(audioBaseline)}</span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-green-500/50" style={{ width: `${Math.min(audioBaseline / 1.5, 100)}%` }} />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-[10px] text-white/30 mb-0.5">
            <span>Rumore Corrente</span>
            <span>{Math.round(audioCurrent)}</span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-cyan-500/50" style={{ width: `${Math.min(audioCurrent / 1.5, 100)}%` }} />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-[10px] text-white/30 mb-0.5">
            <span>Picco Recente</span>
            <span>{Math.round(audioPeak)}</span>
          </div>
          <div className="h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-red-500/50" style={{ width: `${Math.min(audioPeak / 1.5, 100)}%` }} />
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-white/40">
          <span>Delta tasti: <span className="text-white/70">{noiseDelta.toFixed(1)} dB</span></span>
          <span>· Firma: <span className="text-lg">{acousticEmoji}</span></span>
        </div>
      </div>

      {/* Gaming Mode */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/40">Gaming Mode</span>
        <button
          onClick={() => setIsGaming(!isGaming)}
          className={`text-[10px] px-2 py-1 rounded border transition-colors ${
            isGaming ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'border-white/10 text-white/30'
          }`}
        >
          {isGaming ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Keystroke Dynamics */}
      <div>
        <div className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-2">Keystroke Dynamics</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-white/5 p-2">
            <div className="text-[10px] text-white/40">CPM</div>
            <div className="text-sm font-mono text-white/80">{cpm}</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2">
            <div className="text-[10px] text-white/40">Dwell Time</div>
            <div className="text-sm font-mono text-white/80">—</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2">
            <div className="text-[10px] text-white/40">Flight Time</div>
            <div className="text-sm font-mono text-white/80">—</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2">
            <div className="text-[10px] text-white/40">Error Rate</div>
            <div className="text-sm font-mono text-white/80">{totalKeys.current > 0 ? `${Math.round((errors.current / totalKeys.current) * 100)}%` : '0%'}</div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default WriteAnalyzer;
