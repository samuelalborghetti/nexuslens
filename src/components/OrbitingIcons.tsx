import { memo } from 'react';
import { Brain, Heart, Mic, Activity, ScanFace, Eye, Sun, Keyboard } from 'lucide-react';

const icons = [
  { Icon: Brain, label: 'Brain' },
  { Icon: Heart, label: 'Heart' },
  { Icon: Mic, label: 'Mic' },
  { Icon: Activity, label: 'Activity' },
  { Icon: ScanFace, label: 'Scan' },
  { Icon: Eye, label: 'Eye' },
  { Icon: Sun, label: 'Sun' },
  { Icon: Keyboard, label: 'Keyboard' },
];

interface OrbitingIconsProps {
  size?: number;
}

const OrbitingIcons = memo(function OrbitingIcons({ size = 140 }: OrbitingIconsProps) {
  const count = icons.length;
  const R = size * 0.55;

  return (
    <div className="relative mx-auto" style={{ width: size + 40, height: size + 40 }}>
      {/* Guide ring */}
      <div
        className="absolute rounded-full border border-white/5"
        style={{
          width: R * 2 + 20,
          height: R * 2 + 20,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      {icons.map(({ Icon, label }, i) => {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const x = R * Math.cos(angle);
        const y = R * Math.sin(angle);
        
        return (
          <div
            key={label}
            className="absolute"
            style={{
              left: `calc(50% + ${x}px - 14px)`,
              top: `calc(50% + ${y}px - 14px)`,
              width: 28,
              height: 28,
            }}
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-white/5 border border-white/10">
              <Icon size={12} className="text-white/60" />
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default OrbitingIcons;
