import { useEffect, useRef, memo, useState, useCallback } from 'react';
import {
  getState,
  setMetrics,
  addLog,
  setEarBaseline,
  setCalibration,
  setHeartRate,
} from '../store';
import { RppgProcessor } from './rPPGProcessor';

// ─── MediaPipe loader ───
declare global {
  interface Window {
    FaceMesh: any;
    Camera: any;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      setTimeout(resolve, 200);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function loadMediaPipe(): Promise<void> {
  await Promise.all([
    loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'),
    loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'),
  ]);
}

// ─── Helpers ───
function calculateEAR(lm: any, eyeIdx: number[]): number {
  const pts = eyeIdx.map((i) => lm[i]);
  if (pts.some((p: any) => !p)) return 0.35;
  const A = Math.hypot(pts[1].x - pts[5].x, pts[1].y - pts[5].y);
  const B = Math.hypot(pts[2].x - pts[4].x, pts[2].y - pts[4].y);
  const C = Math.hypot(pts[0].x - pts[3].x, pts[0].y - pts[3].y);
  return C > 0 ? (A + B) / (2 * C) : 0.35;
}

const LEFT_EYE = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380];
const NOSE = 1;
const LEFT_TEMPLE = 234;
const RIGHT_TEMPLE = 454;
const FOREHEAD = 10;
const CHIN = 152;
const MOUTH_LEFT = 61;
const MOUTH_RIGHT = 291;
const LEFT_CHEEK = 205;
const RIGHT_CHEEK = 425;

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface FaceSignature {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  area: number;
  ratios: number[];
}

function pointDistance(a?: Point3D, b?: Point3D) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function computeFaceSignature(lm: Point3D[]): FaceSignature {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of lm) {
    if (!p) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  const width = Math.max(0.001, maxX - minX);
  const height = Math.max(0.001, maxY - minY);
  const eyeWidth = pointDistance(lm[33], lm[263]) / width;
  const faceHeightRatio = height / width;
  const noseChin = pointDistance(lm[NOSE], lm[CHIN]) / width;
  const mouthWidth = pointDistance(lm[MOUTH_LEFT], lm[MOUTH_RIGHT]) / width;
  const templeWidth = pointDistance(lm[LEFT_TEMPLE], lm[RIGHT_TEMPLE]) / width;

  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width,
    height,
    area: width * height,
    ratios: [eyeWidth, faceHeightRatio, noseChin, mouthWidth, templeWidth],
  };
}

function faceScore(a: FaceSignature, b: FaceSignature) {
  const ratioScore = a.ratios.reduce((sum, value, i) => sum + Math.abs(value - b.ratios[i]), 0) / a.ratios.length;
  const centerScore = Math.hypot(a.centerX - b.centerX, a.centerY - b.centerY);
  const scaleScore = Math.abs(Math.log(Math.max(0.2, Math.min(5, a.area / Math.max(0.0001, b.area)))));
  return ratioScore * 1.8 + centerScore * 0.45 + scaleScore * 0.18;
}

function blendSignature(a: FaceSignature, b: FaceSignature, amount = 0.015): FaceSignature {
  return {
    centerX: a.centerX * (1 - amount) + b.centerX * amount,
    centerY: a.centerY * (1 - amount) + b.centerY * amount,
    width: a.width * (1 - amount) + b.width * amount,
    height: a.height * (1 - amount) + b.height * amount,
    area: a.area * (1 - amount) + b.area * amount,
    ratios: a.ratios.map((v, i) => v * (1 - amount) + b.ratios[i] * amount),
  };
}

const FaceMeshTracker = memo(function FaceMeshTracker({ isVisible }: { isVisible: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const fmRef = useRef<any>(null);
  const camRef = useRef<any>(null);
  const runningRef = useRef(false);

  const calibPhase = useRef<'idle' | 'ear' | 'stable' | 'done'>('idle');
  const calibFrames = useRef<number[]>([]);
  const emaRef = useRef<Point3D[] | null>(null);
  const alpha = 0.65;

  const [status, setStatus] = useState('INIZIALIZZAZIONE');
  const [calibInfo, setCalibInfo] = useState({ phase: 'idle', count: 0, baseEar: 0 });
  const [error, setError] = useState<string | null>(null);

  const rppgRef = useRef<RppgProcessor | null>(null);
  const rppgCounter = useRef(0);
  const lockedFaceRef = useRef<FaceSignature | null>(null);
  const [isFaceLocked, setIsFaceLocked] = useState(false);
  const [showLandmarks, setShowLandmarks] = useState(true);

  // ─── draw landmarks ───
  const drawOverlay = useCallback((landmarks: Point3D[], w: number, h: number, showPoints: boolean) => {
    const ctx = overlayRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    if (showPoints) {
      // draw dots every 2 landmarks
      ctx.fillStyle = 'rgba(16, 185, 129, 0.55)';
      for (let i = 0; i < landmarks.length; i += 2) {
        const p = landmarks[i];
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // eye outline – brighter green
      ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
      for (const idx of [...LEFT_EYE, ...RIGHT_EYE]) {
        const p = landmarks[idx];
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // rPPG sensor circle on forehead
    const fh = landmarks[FOREHEAD];
    if (fh) {
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(fh.x * w, fh.y * h, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.beginPath();
      ctx.arc(fh.x * w, fh.y * h, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
      ctx.font = '9px monospace';
      ctx.fillText('rPPG SENSOR', fh.x * w + 18, fh.y * h + 3);
    }
  }, []);

  // ─── smooth landmarks (EMA) ───
  const smoothLm = useCallback((lm: Point3D[]): Point3D[] => {
    if (!emaRef.current || emaRef.current.length !== lm.length) {
      emaRef.current = lm.map((p) => ({ x: p.x, y: p.y, z: p.z }));
      return emaRef.current;
    }
    const ema = emaRef.current;
    for (let i = 0; i < lm.length; i++) {
      ema[i].x = alpha * lm[i].x + (1 - alpha) * ema[i].x;
      ema[i].y = alpha * lm[i].y + (1 - alpha) * ema[i].y;
      ema[i].z = alpha * lm[i].z + (1 - alpha) * ema[i].z;
    }
    return ema;
  }, []);

  // ─── process results ───
  const onResults = useCallback(
    (results: any) => {
      const w = canvasRef.current?.width ?? 640;
      const h = canvasRef.current?.height ?? 480;
      const ctx = canvasRef.current?.getContext('2d');

      // Show the real webcam image every frame. The overlay is drawn on top.
      if (ctx && results.image) {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(results.image, 0, 0, w, h);
      }

      const overlayCtx = overlayRef.current?.getContext('2d');
      if (overlayCtx) overlayCtx.clearRect(0, 0, w, h);

      if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        setStatus('NESSUN VOLTO');
        return;
      }

      const faces: Point3D[][] = results.multiFaceLandmarks;
      const signatures = faces.map(computeFaceSignature);
      let selectedIndex = 0;

      if (!lockedFaceRef.current) {
        selectedIndex = signatures.reduce((best, sig, i) => (sig.area > signatures[best].area ? i : best), 0);
        lockedFaceRef.current = signatures[selectedIndex];
        setIsFaceLocked(true);
        addLog('Volto agganciato. Il tracker ignorerà altri volti finché non ricalcoli.', 'ok');
      } else {
        let bestScore = Number.POSITIVE_INFINITY;
        for (let i = 0; i < signatures.length; i++) {
          const score = faceScore(lockedFaceRef.current, signatures[i]);
          if (score < bestScore) {
            bestScore = score;
            selectedIndex = i;
          }
        }

        if (bestScore > 0.44) {
          setStatus('VOLTO DIVERSO IGNORATO');
          return;
        }

        lockedFaceRef.current = blendSignature(lockedFaceRef.current, signatures[selectedIndex]);
      }

      const lm: Point3D[] = faces[selectedIndex];
      const smoothed = smoothLm(lm);

      drawOverlay(smoothed, w, h, showLandmarks);

      // EAR
      const ear =
        (calculateEAR(smoothed, LEFT_EYE) + calculateEAR(smoothed, RIGHT_EYE)) / 2;

      // rPPG – extract normalized green channel from forehead + both cheeks.
      // Multiple skin ROIs are less noisy than a single forehead patch.
      if (ctx && isVisible) {
        const sampleSkin = (p?: Point3D, boxW = 0.055, boxH = 0.04) => {
          if (!p) return null;
          const gx = Math.floor(p.x * w);
          const gy = Math.floor(p.y * h);
          const gw = Math.max(4, Math.floor(w * boxW));
          const gh = Math.max(4, Math.floor(h * boxH));
          const sx = Math.max(0, Math.min(w - 2, gx - gw));
          const sy = Math.max(0, Math.min(h - 2, gy - gh));
          const sw = Math.max(2, Math.min(gw * 2, w - sx));
          const sh = Math.max(2, Math.min(gh * 2, h - sy));
          const imgData = ctx.getImageData(sx, sy, sw, sh);
          let chromaGreen = 0,
            cnt = 0;
          for (let i = 0; i < imgData.data.length; i += 16) {
            const r = imgData.data[i];
            const g = imgData.data[i + 1];
            const b = imgData.data[i + 2];
            chromaGreen += (g / Math.max(1, r + g + b)) * 255;
            cnt++;
          }
          return cnt > 0 ? chromaGreen / cnt : null;
        };

        const samples = [
          sampleSkin(smoothed[FOREHEAD], 0.045, 0.035),
          sampleSkin(smoothed[LEFT_CHEEK], 0.04, 0.035),
          sampleSkin(smoothed[RIGHT_CHEEK], 0.04, 0.035),
        ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

        if (samples.length > 0) {
          const greenVal = samples.reduce((sum, value) => sum + value, 0) / samples.length;
          rppgCounter.current++;
          rppgRef.current?.addSample(greenVal);

          if (rppgCounter.current % 15 === 0) {
            const r = rppgRef.current?.process();
            if (r && r.bpm > 0 && r.confidence > 0.18) {
              setHeartRate(r.bpm, r.confidence);
            }
          }
        }
      }

      // Calibration
      if (calibPhase.current === 'ear') {
        calibFrames.current.push(ear);
        if (calibFrames.current.length >= 20) {
          const sorted = [...calibFrames.current].sort((a, b) => a - b);
          const trimmed = sorted.slice(2, -2);
          const base = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
          setEarBaseline(base);
          setCalibration({ baselineEAR: base, calibratedAt: Date.now() });
          addLog(`EAR baseline: ${base.toFixed(3)}`, 'ok');
          calibPhase.current = 'stable';
          calibFrames.current = [];
          setCalibInfo({ phase: 'stable', count: 0, baseEar: base });
        }
      } else if (calibPhase.current === 'stable') {
        calibFrames.current.push(ear);
        if (calibFrames.current.length >= 50) {
          addLog(`Stabilizzazione completata`, 'ok');
          calibPhase.current = 'done';
          calibFrames.current = [];
          setCalibInfo({ phase: 'done', count: 0, baseEar: getState().earBaseline });
        }
      }

      const count = calibFrames.current.length;

      // Eye status
      const base = getState().earBaseline || 0.35;
      const thr = base * 0.75;
      const closedThr = base * 0.3;
      let eyeStatus: string;
      if (ear < closedThr) eyeStatus = 'CLOSED';
      else if (ear < thr) eyeStatus = 'SQUINTING';
      else if (ear < thr * 1.05) eyeStatus = 'BLINK';
      else eyeStatus = 'OPEN';

      const now = Date.now();
      let closedSince = getState().closedSince;
      let closedMs = 0;
      if (eyeStatus === 'CLOSED' || eyeStatus === 'SQUINTING') {
        if (!closedSince) closedSince = now;
        closedMs = now - closedSince;
      } else {
        closedSince = null;
        closedMs = 0;
      }

      // Head pose & distance
      const nose = smoothed[NOSE];
      const lt = smoothed[LEFT_TEMPLE];
      const rt = smoothed[RIGHT_TEMPLE];
      const faceW = nose && lt && rt ? Math.hypot(lt.x - rt.x, lt.y - rt.y) : 0.3;
      const pitch = faceW > 0 ? ((nose.y - (lt.y + rt.y) / 2) / faceW) * 30 : 0;
      const dist = faceW > 0 ? Math.min(Math.max(150 / faceW, 20), 100) : 50;

      const isVoid = eyeStatus === 'CLOSED' && closedMs > 9000;

      setCalibInfo({
        phase: calibPhase.current,
        count,
        baseEar: getState().earBaseline,
      });
      setStatus(isVoid ? 'SCREEN VOID' : eyeStatus);

      setMetrics({
        earValue: ear,
        headPitch: pitch,
        distanceCm: dist,
        eyeStatus: eyeStatus as any,
        closedSince,
        closedDurationMs: closedMs,
        isScreenVoid: isVoid,
        modeText: isVoid
          ? 'SCREEN VOID'
          : eyeStatus === 'CLOSED'
          ? 'CHIUSO'
          : eyeStatus === 'SQUINTING'
          ? 'SQUINTING'
          : 'LIVE · TRACKING',
        trackingText:
          calibPhase.current === 'ear'
            ? 'FASE CALIBRAZIONE: 1 (EAR BASELINE)'
            : calibPhase.current === 'stable'
            ? 'FASE CALIBRAZIONE: 2 (STABILIZZAZIONE)'
            : calibPhase.current === 'done'
            ? 'CALIBRAZIONE COMPLETATA'
            : 'INIZIALIZZAZIONE',
      });
    },
    [drawOverlay, isVisible, showLandmarks, smoothLm]
  );

  // ─── init MediaPipe + camera ───
  useEffect(() => {
    if (!isVisible) return;
    runningRef.current = true;

    let mounted = true;

    async function init() {
      try {
        addLog('Caricamento MediaPipe...', 'info');
        setStatus('CARICAMENTO MEDIAPIPE...');
        await loadMediaPipe();
        if (!mounted) return;

        const FaceMeshCtor = window.FaceMesh;
        const CameraCtor = window.Camera;
        if (!FaceMeshCtor || !CameraCtor) {
          throw new Error('MediaPipe non caricato');
        }

        // FaceMesh
        const fm = new FaceMeshCtor({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });
        fm.setOptions({
          maxNumFaces: 2,
          refineLandmarks: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        fm.onResults(onResults);
        fmRef.current = fm;

        const videoEl = videoRef.current;
        if (!videoEl || !mounted) return;

        addLog('Avvio webcam...', 'info');
        setStatus('AVVIO WEBCAM...');

        const cam = new CameraCtor(videoEl, {
          onFrame: async () => {
            if (runningRef.current && fmRef.current) {
              await fmRef.current.send({ image: videoEl });
            }
          },
          width: 640,
          height: 480,
        });
        cam.start();
        camRef.current = cam;

        // rPPG
        rppgRef.current = new RppgProcessor(30, 8);
        rppgCounter.current = 0;

        // Calibration
        calibPhase.current = 'ear';
        calibFrames.current = [];
        emaRef.current = null;
        addLog('Calibrazione EAR avviata', 'info');
        setCalibInfo({ phase: 'ear', count: 0, baseEar: 0 });
        setStatus('EYE OPEN');

        const c = canvasRef.current;
        const o = overlayRef.current;
        if (c && o) {
          c.width = 640;
          c.height = 480;
          o.width = 640;
          o.height = 480;
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || 'Errore inizializzazione');
        addLog(`Errore: ${e?.message}`, 'err');
        setStatus('ERRORE');
      }
    }

    init();

    return () => {
      mounted = false;
      runningRef.current = false;
      if (camRef.current) {
        try {
          camRef.current.stop();
        } catch {}
      }
      if (fmRef.current) {
        try {
          fmRef.current.close();
        } catch {}
      }
      rppgRef.current?.reset();
      emaRef.current = null;
    };
  }, [isVisible, onResults]);

  // ─── render ───
  const progress =
    calibInfo.phase === 'ear'
      ? Math.min(100, (calibInfo.count / 20) * 100)
      : calibInfo.phase === 'stable'
      ? Math.min(100, (calibInfo.count / 50) * 100)
      : calibInfo.phase === 'done'
      ? 100
      : 0;

  const handleRecalculateFace = () => {
    lockedFaceRef.current = null;
    emaRef.current = null;
    calibPhase.current = 'ear';
    calibFrames.current = [];
    rppgRef.current?.reset();
    rppgCounter.current = 0;
    setIsFaceLocked(false);
    setCalibInfo({ phase: 'ear', count: 0, baseEar: 0 });
    setStatus('RICALCOLO VOLTO');
    addLog('Ricalcolo volto avviato: il prossimo volto rilevato verrà bloccato.', 'warn');
  };

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-2">
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-black/60">
      {/* Hidden video */}
      <video ref={videoRef} className="hidden" playsInline autoPlay muted />

      {/* Camera feed */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block h-full w-full bg-black"
      />

      {/* Landmark overlay */}
      <canvas
        ref={overlayRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ aspectRatio: '4/3' }}
      />

      {/* Top-left status HUD */}
      <div className="absolute top-2 left-2 text-[10px] font-mono space-y-1 pointer-events-none select-none">
        <div className="w-fit rounded bg-black/55 px-1.5 py-0.5 text-white/70">
          CALIBRATION:{' '}
          <span className="text-white/70">{calibInfo.phase.toUpperCase()}</span>{' '}
          ({calibInfo.count}/{calibPhase.current === 'ear' ? 20 : calibPhase.current === 'stable' ? 50 : 70})
        </div>
        <div className="w-fit rounded bg-black/55 px-1.5 py-0.5 text-white/70">
          BASE EAR:{' '}
          <span className="text-white/70">{calibInfo.baseEar.toFixed(3)}</span>
        </div>
        <div className="w-fit rounded bg-black/55 px-1.5 py-0.5 text-white/70">
          FACIAL rPPG:{' '}
          <span className={rppgRef.current ? 'text-green-400/80' : 'text-white/30'}>
            {rppgRef.current ? 'ACTIVE' : '—'}
          </span>
        </div>
        <div
          className={`w-fit rounded bg-black/55 px-1.5 py-0.5 ${status === 'SCREEN VOID' ? 'text-red-400' : 'text-green-400/90'}`}
        >
          STATUS: {status}
        </div>
      </div>

      {/* Bottom calibration bar */}
      {calibInfo.phase !== 'done' && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm p-3 border-t border-white/5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-mono text-amber-400/90 font-semibold">
              {calibInfo.phase === 'ear'
                ? 'FASE CALIBRAZIONE: 1 (EAR BASELINE)'
                : calibInfo.phase === 'stable'
                ? 'FASE CALIBRAZIONE: 2 (STABILIZZAZIONE)'
                : 'INIZIALIZZAZIONE'}
            </span>
            <span className="text-[10px] font-mono text-white/40">
              {calibInfo.count}/
              {calibPhase.current === 'ear'
                ? 20
                : calibPhase.current === 'stable'
                ? 50
                : 70}{' '}
              f
            </span>
          </div>
          <p className="text-[9px] text-white/35 mb-2">
            Mantieni una posa rilassata e guarda dritto lo schermo per calibrare
            l'intelligenza adattiva.
          </p>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-500/60 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {calibInfo.phase === 'done' && (
        <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-sm p-3 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-green-400/90 font-semibold">
              ✓ CALIBRAZIONE COMPLETATA
            </span>
            <span className="text-[10px] font-mono text-white/40">
              EAR base: {calibInfo.baseEar.toFixed(3)}
            </span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-6">
          <div className="text-center space-y-3">
            <div className="text-red-400 text-sm font-mono">ERRORE</div>
            <div className="text-white/50 text-xs">{error}</div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-1.5 rounded-lg border border-white/20 text-xs text-white/60 hover:text-white/80"
            >
              RITENTA
            </button>
          </div>
        </div>
      )}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 p-2">
      <div className="text-[10px] text-white/40">
        {isFaceLocked ? 'Volto bloccato: il tracker ignora altri volti.' : 'Volto non ancora bloccato.'}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleRecalculateFace}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] text-white/65 transition-colors hover:border-amber-400/40 hover:text-amber-300"
        >
          Ricalcola volto
        </button>
        <button
          onClick={() => setShowLandmarks((value) => !value)}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] text-white/65 transition-colors hover:border-green-400/40 hover:text-green-300"
        >
          {showLandmarks ? 'Nascondi puntini' : 'Mostra puntini'}
        </button>
      </div>
    </div>
    </div>
  );
});

export default FaceMeshTracker;
