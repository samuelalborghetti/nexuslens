/**
 * rPPG (remote Photoplethysmography) Processor
 * 
 * Estimates heart rate from facial video by analyzing subtle color changes
 * in the green channel of the face region of interest (ROI).
 */

function fftRadix2(signal: number[]): { real: number[]; imag: number[] } {
  const N = signal.length;
  if (N === 1) return { real: [signal[0]], imag: [0] };
  
  const even: number[] = [];
  const odd: number[] = [];
  for (let i = 0; i < N; i += 2) even.push(signal[i]);
  for (let i = 1; i < N; i += 2) odd.push(signal[i]);
  
  const evenResult = fftRadix2(even);
  const oddResult = fftRadix2(odd);
  
  const real: number[] = new Array(N).fill(0);
  const imag: number[] = new Array(N).fill(0);
  
  for (let k = 0; k < N / 2; k++) {
    const angle = -2 * Math.PI * k / N;
    const cosAng = Math.cos(angle);
    const sinAng = Math.sin(angle);
    
    const tReal = cosAng * oddResult.real[k] - sinAng * oddResult.imag[k];
    const tImag = cosAng * oddResult.imag[k] + sinAng * oddResult.real[k];
    
    real[k] = evenResult.real[k] + tReal;
    imag[k] = evenResult.imag[k] + tImag;
    real[k + N / 2] = evenResult.real[k] - tReal;
    imag[k + N / 2] = evenResult.imag[k] - tImag;
  }
  
  return { real, imag };
}

function fft(signal: number[]): { real: number[]; imag: number[] } {
  const N = signal.length;
  if (N <= 1) return { real: [...signal], imag: new Array(N).fill(0) };
  
  const power = Math.pow(2, Math.ceil(Math.log2(N)));
  const padded = new Array(power).fill(0);
  for (let i = 0; i < N; i++) padded[i] = signal[i];
  
  return fftRadix2(padded);
}

function bandpassFilter(signal: number[], sampleRate: number, lowFreq: number, highFreq: number): number[] {
  if (signal.length < 10) return signal;
  
  const dt = 1 / sampleRate;
  const rc_low = 1 / (2 * Math.PI * highFreq);
  const alpha_low = dt / (rc_low + dt);
  
  const rc_high = 1 / (2 * Math.PI * lowFreq);
  const alpha_high = rc_high / (rc_high + dt);
  
  let filtered: number[] = [signal[0]];
  for (let i = 1; i < signal.length; i++) {
    filtered.push(alpha_high * (filtered[i - 1] + signal[i] - signal[i - 1]));
  }
  
  const result: number[] = [filtered[0]];
  for (let i = 1; i < filtered.length; i++) {
    result.push(result[i - 1] + alpha_low * (filtered[i] - result[i - 1]));
  }
  
  return result;
}

function normalizeSignal(signal: number[]): number[] {
  const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
  const detrended = signal.map(v => v - mean);
  const max = Math.max(...detrended.map(Math.abs));
  return max > 0 ? detrended.map(v => v / max) : detrended;
}

function movingAverage(signal: number[], radius = 2): number[] {
  if (signal.length < radius * 2 + 1) return signal;
  return signal.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - radius); j <= Math.min(signal.length - 1, i + radius); j++) {
      sum += signal[j];
      count++;
    }
    return sum / count;
  });
}

function hammingWindow(signal: number[]): number[] {
  const n = signal.length;
  if (n <= 1) return signal;
  return signal.map((v, i) => v * (0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (n - 1))));
}

function findDominantFrequency(
  real: number[], 
  imag: number[], 
  sampleRate: number, 
  minBpm: number, 
  maxBpm: number
): { frequency: number; magnitude: number } {
  const N = real.length;
  const minIdx = Math.max(1, Math.floor(N * minBpm / (60 * sampleRate)));
  const maxIdx = Math.min(Math.floor(N / 2), Math.ceil(N * maxBpm / (60 * sampleRate)));
  
  let maxMag = 0;
  let maxIdx2 = minIdx;
  
  for (let i = minIdx; i <= maxIdx; i++) {
    const mag = Math.sqrt(real[i] ** 2 + imag[i] ** 2);
    if (mag > maxMag) {
      maxMag = mag;
      maxIdx2 = i;
    }
  }
  
  const freq = maxIdx2 * sampleRate / N;
  return { frequency: freq, magnitude: maxMag };
}

export class RppgProcessor {
  private signalBuffer: number[] = [];
  private timeBuffer: number[] = [];
  private sampleRate: number;
  private bufferDuration: number;
  private minBpm = 48;
  private maxBpm = 180;
  private lastResult = { bpm: 0, confidence: 0 };
  
  constructor(sampleRate = 30, bufferDuration = 8) {
    this.sampleRate = sampleRate;
    this.bufferDuration = bufferDuration;
  }
  
  extractGreenValue(canvas: HTMLCanvasElement): number {
    const ctx = canvas.getContext('2d');
    if (!ctx) return 0;
    
    const w = Math.floor(canvas.width * 0.4);
    const h = Math.floor(canvas.height * 0.15);
    const x = Math.floor((canvas.width - w) / 2);
    const y = Math.floor(canvas.height * 0.05);
    
    const imageData = ctx.getImageData(x, y, w, h);
    const pixels = imageData.data;
    
    let greenSum = 0;
    let count = 0;
    
    for (let i = 0; i < pixels.length; i += 16) {
      greenSum += pixels[i + 1];
      count++;
    }
    
    return count > 0 ? greenSum / count : 0;
  }
  
  addSample(value: number, timestamp = performance.now()): void {
    this.signalBuffer.push(value);
    this.timeBuffer.push(timestamp / 1000);

    while (
      this.timeBuffer.length > 2 &&
      this.timeBuffer[this.timeBuffer.length - 1] - this.timeBuffer[0] > this.bufferDuration
    ) {
      this.signalBuffer.shift();
      this.timeBuffer.shift();
    }
  }
  
  process(): { bpm: number; confidence: number } {
    const duration = this.timeBuffer.length > 1
      ? this.timeBuffer[this.timeBuffer.length - 1] - this.timeBuffer[0]
      : 0;
    const effectiveSampleRate = duration > 0
      ? Math.min(60, Math.max(10, (this.signalBuffer.length - 1) / duration))
      : this.sampleRate;

    if (this.signalBuffer.length < effectiveSampleRate * 5) {
      return { bpm: 0, confidence: 0 };
    }
    
    const normalized = normalizeSignal(this.signalBuffer);
    const smoothed = movingAverage(normalized, 2);
    const filtered = bandpassFilter(smoothed, effectiveSampleRate, 0.8, 3.0);
    const windowed = hammingWindow(filtered);
    const { real, imag } = fft(windowed);
    const { frequency, magnitude } = findDominantFrequency(real, imag, effectiveSampleRate, this.minBpm, this.maxBpm);
    
    const bpm = Math.round(frequency * 60);
    
    const totalEnergy = real.reduce((a, b) => a + b * b, 0) + imag.reduce((a, b) => a + b * b, 0);
    const peakEnergy = magnitude * magnitude;
    const confidence = totalEnergy > 0 ? Math.min(1, peakEnergy / (totalEnergy / (real.length / 4))) : 0;
    
    if (bpm >= this.minBpm && bpm <= this.maxBpm && confidence > 0.18) {
      if (this.lastResult.confidence > 0 && this.lastResult.bpm > 0) {
        this.lastResult.bpm = Math.round(this.lastResult.bpm * 0.72 + bpm * 0.28);
        this.lastResult.confidence = this.lastResult.confidence * 0.72 + confidence * 0.28;
      } else {
        this.lastResult = { bpm, confidence };
      }
    }
    
    return { ...this.lastResult };
  }
  
  reset(): void {
    this.signalBuffer = [];
    this.timeBuffer = [];
    this.lastResult = { bpm: 0, confidence: 0 };
  }
  
  getBufferLength(): number {
    return this.signalBuffer.length;
  }
  
  getRequiredSamples(): number {
    return this.sampleRate * 5;
  }
}
