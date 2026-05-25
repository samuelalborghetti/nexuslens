import { memo, useRef, useEffect } from 'react';
import { useStore } from '../store';

const levelColors: Record<string, string> = {
  info: 'text-blue-400/70',
  warn: 'text-amber-400/70',
  err: 'text-red-400/70',
  ok: 'text-green-400/70',
};

const levelLabels: Record<string, string> = {
  info: 'INFO',
  warn: 'WARN',
  err: 'ERR',
  ok: 'OK',
};

const EventLog = memo(function EventLog() {
  const logs = useStore(s => s.logs);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Event Log</h3>
      </div>

      <div
        ref={scrollRef}
        className="space-y-1 overflow-y-auto"
        style={{ maxHeight: 200 }}
      >
        {logs.length === 0 && (
          <div className="text-[10px] text-white/20 text-center py-8">
            Nessun evento registrato
          </div>
        )}
        {logs.map(log => (
          <div key={log.id} className="flex items-start gap-2 text-[10px] font-mono">
            <span className="text-white/20 shrink-0 w-14">
              {new Date(log.timestamp).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={`shrink-0 w-8 ${levelColors[log.level]}`}>
              {levelLabels[log.level]}
            </span>
            <span className="text-white/60 break-all">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

export default EventLog;
