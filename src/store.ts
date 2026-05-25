import { useState, useRef, useEffect } from 'react';
import type { EyeStatus, TabType, LogEntry, LogLevel, SimulationState, SensorMetrics, CalibrationData } from './types';

let logId = 0;

const defaultSimulation: SimulationState = {
  ear: 0.35,
  blink: 15,
  pitch: 0,
  distance: 50,
  noise: 30,
  typing: 40,
};

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyAll() {
  listeners.forEach(l => l());
}

// Global mutable state
const state = {
  earValue: 0.35,
  headPitch: 0,
  distanceCm: 50,
  eyeStatus: 'OPEN' as EyeStatus,
  closedDurationMs: 0,
  closedSince: null as number | null,
  isScreenVoid: false,
  isSimulated: false,
  modeText: 'LIVE · TRACKING',
  trackingText: 'INIZIALIZZAZIONE',
  logs: [] as LogEntry[],
  sensors: { webcam: false, mic: false, keyboard: false } as Record<string, boolean>,
  simulation: { ...defaultSimulation },
  calibration: {
    baselineEAR: 0,
    cpm: 0,
    dwellTime: 0,
    flightTime: 0,
    errorRate: 0,
    calibratedAt: null as number | null,
  } as CalibrationData,
  earBaseline: 0.35,
  activeTab: 'live' as TabType,
  onboardingComplete: false,
  cameraActive: false,
  blinkCount: 0,
  lastBlinkTime: 0,
  audioBaseline: 30,
  audioPeak: 30,
  audioCurrent: 30,
  cpm: 0,
  typingSpeed: 0,
  isGamingMode: false,
  isCalm: false,
  isFlow: false,
  isStressed: false,
  isRage: false,
  readingExpanded: false,
  heartRate: 0 as number,
  heartRateConfidence: 0 as number,
  heartRateSignal: [] as number[],
  heartRateHistory: [] as number[],
  lastHeartRateUpdate: 0 as number,
};

export type GlobalState = typeof state;
export function getState() { return state; }
export function subscribe(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }

export function addLog(message: string, level: LogLevel = 'info') {
  state.logs = [{ id: ++logId, timestamp: Date.now(), message, level }, ...state.logs].slice(0, 100);
  notifyAll();
}

export function setSensor(key: 'webcam' | 'mic' | 'keyboard', value: boolean) {
  state.sensors[key] = value;
  notifyAll();
}

export function setSimulation(s: Partial<SimulationState>) {
  Object.assign(state.simulation, s);
  notifyAll();
}

export function setMetrics(m: Partial<SensorMetrics>) {
  if (m.earValue !== undefined) state.earValue = m.earValue;
  if (m.headPitch !== undefined) state.headPitch = m.headPitch;
  if (m.distanceCm !== undefined) state.distanceCm = m.distanceCm;
  if (m.eyeStatus !== undefined) state.eyeStatus = m.eyeStatus;
  if (m.closedDurationMs !== undefined) state.closedDurationMs = m.closedDurationMs;
  if (m.closedSince !== undefined) state.closedSince = m.closedSince;
  if (m.isScreenVoid !== undefined) state.isScreenVoid = m.isScreenVoid;
  if (m.modeText !== undefined) state.modeText = m.modeText;
  if (m.trackingText !== undefined) state.trackingText = m.trackingText;
  notifyAll();
}

export function setCalibration(c: Partial<CalibrationData>) {
  Object.assign(state.calibration, c);
  notifyAll();
}

export function setEarBaseline(v: number) {
  state.earBaseline = v;
  notifyAll();
}

export function setHeartRate(bpm: number, confidence: number) {
  state.heartRate = bpm;
  state.heartRateConfidence = confidence;
  state.lastHeartRateUpdate = Date.now();
  state.heartRateHistory = [...state.heartRateHistory.slice(-60), bpm];
  notifyAll();
}

export function addHeartRateSignal(value: number) {
  state.heartRateSignal = [...state.heartRateSignal.slice(-300), value];
}

export function completeOnboarding(simulated: boolean) {
  state.isSimulated = simulated;
  state.onboardingComplete = true;
  if (!simulated) {
    state.sensors = { webcam: true, mic: true, keyboard: true };
  }
  notifyAll();
}

// React hook for consuming state
export function useStore<T>(selector: (s: typeof state) => T): T {
  const [val, setVal] = useState(() => selector(state));
  const lastVal = useRef(val);
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  useEffect(() => {
    const unsub = subscribe(() => {
      const next = selectorRef.current(state);
      if (next !== lastVal.current) {
        lastVal.current = next;
        setVal(next);
      }
    });
    return () => { unsub(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return val;
}

// Derive eye status in simulation mode
export function useSimulationDerivation() {
  const isSimulated = useStore(s => s.isSimulated);
  const simEar = useStore(s => s.simulation.ear);

  useEffect(() => {
    if (!isSimulated) return;

    const interval = setInterval(() => {
      const ear = state.simulation.ear;
      let status: EyeStatus = 'OPEN';

      if (ear < 0.1) status = 'CLOSED';
      else if (ear < 0.2) status = 'SQUINTING';
      else if (ear < 0.25) status = 'BLINK';

      const now = Date.now();
      let closedSince = state.closedSince;
      let closedMs = 0;

      if (status === 'CLOSED' || status === 'SQUINTING') {
        if (!closedSince) closedSince = now;
        closedMs = now - closedSince;
      } else {
        closedSince = null;
        closedMs = 0;
      }

      const isVoid = status === 'CLOSED' && closedMs > 9000;

      setMetrics({
        earValue: ear,
        eyeStatus: status,
        closedSince,
        closedDurationMs: closedMs,
        isScreenVoid: isVoid,
        headPitch: state.simulation.pitch,
        distanceCm: state.simulation.distance,
        modeText: isVoid
          ? 'SCREEN VOID'
          : status === 'CLOSED'
          ? 'CHIUSO'
          : status === 'SQUINTING'
          ? 'SQUINTING'
          : 'LIVE · TRACKING',
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isSimulated, simEar]);
}
