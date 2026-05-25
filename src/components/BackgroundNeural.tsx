import { useEffect, useRef, memo } from 'react';

const BackgroundNeural = memo(function BackgroundNeural() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = window.innerWidth;
    let h = window.innerHeight;
    canvas.width = w * 1.5;
    canvas.height = h * 1.5;

    const particleCount = 700;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number }[] = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * w * 1.5,
        y: Math.random() * h * 1.5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.4,
      });
    }

    const c = ctx;

    function animate() {
      if (document.hidden) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }

      c.clearRect(0, 0, w * 1.5, h * 1.5);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = w * 1.5;
        if (p.x > w * 1.5) p.x = 0;
        if (p.y < 0) p.y = h * 1.5;
        if (p.y > h * 1.5) p.y = 0;

        c.beginPath();
        c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        c.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        c.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * 1.5;
      canvas.height = h * 1.5;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ width: '100vw', height: '100vh', opacity: 0.6 }}
    />
  );
});

export default BackgroundNeural;
