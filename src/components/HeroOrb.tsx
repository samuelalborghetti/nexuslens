import { useEffect, useRef, memo } from 'react';
import * as THREE from 'three';

interface HeroOrbProps {
  eyeStatus?: string;
  size?: number;
}

const HeroOrb = memo(function HeroOrb({ eyeStatus = 'OPEN', size = 180 }: HeroOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const particleRef = useRef<THREE.Points | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = size;
    const h = size;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
    camera.position.z = 3;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const geo = new THREE.IcosahedronGeometry(1.2, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    meshRef.current = mesh;

    const particleCount = 150;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.8 + Math.random() * 1.2;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.02,
      transparent: true,
      opacity: 0.4,
    });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);
    particleRef.current = points;

    let animId = 0;
    function animate() {
      animId = requestAnimationFrame(animate);
      if (document.hidden) return;
      mesh.rotation.x += 0.003;
      mesh.rotation.y += 0.005;
      points.rotation.x += 0.001;
      points.rotation.y += 0.002;
      const isDimmed = eyeStatus === 'CLOSED' || eyeStatus === 'VOID';
      mat.opacity = isDimmed ? 0.08 : 0.3;
      pMat.opacity = isDimmed ? 0.1 : 0.4;
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [eyeStatus, size]);

  return (
    <div
      ref={containerRef}
      className="mx-auto"
      style={{ width: size, height: size }}
    />
  );
});

export default HeroOrb;
