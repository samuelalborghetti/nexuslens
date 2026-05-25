export type EyeStatus = 'OPEN' | 'BLINK' | 'CLOSED' | 'SQUINTING' | 'VOID';
export type SensorType = 'webcam' | 'mic' | 'keyboard';
export type TabType = 'live' | 'reading' | 'write' | 'brightness' | 'profile' | 'privacy';
export type LogLevel = 'info' | 'warn' | 'err' | 'ok';

export interface LogEntry {
  id: number;
  timestamp: number;
  message: string;
  level: LogLevel;
}

export interface SimulationState {
  ear: number;
  blink: number;
  pitch: number;
  distance: number;
  noise: number;
  typing: number;
}

export interface CalibrationData {
  baselineEAR: number;
  cpm: number;
  dwellTime: number;
  flightTime: number;
  errorRate: number;
  calibratedAt: number | null;
}

export interface SensorMetrics {
  earValue: number;
  headPitch: number;
  distanceCm: number;
  eyeStatus: EyeStatus;
  closedDurationMs: number;
  closedSince: number | null;
  isScreenVoid: boolean;
  isSimulated: boolean;
  modeText: string;
  trackingText: string;
}

export interface HeartRateData {
  bpm: number;
  confidence: number;
  signal: number[];
  timestamp: number;
}
