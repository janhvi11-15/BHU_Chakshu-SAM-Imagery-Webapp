import React, { useEffect, useRef, useState } from 'react';
import { SatelliteTilePreset } from '../types/satellite';
import {
  AlertTriangle,
  Play,
  Pause,
  ExternalLink,
  Layers,
  ShieldAlert,
  Activity,
} from 'lucide-react';

interface CalamityChangeMonitorProps {
  preset: SatelliteTilePreset;
}

const TIMELAPSE_FRAMES = [
  { label: 'T-0 Baseline (Dry / Pre-Event)', dateOffset: '-45 days', deltaPct: 0.0, confidence: 94 },
  { label: 'T-1 Early Moisture / Stress Shift', dateOffset: '-20 days', deltaPct: 8.4, confidence: 89 },
  { label: 'T-2 Peak Anomaly (Optical + SAR)', dateOffset: '-5 days', deltaPct: 24.7, confidence: 91 },
  { label: 'T-3 Current Monitoring Pass', dateOffset: 'Latest Pass', deltaPct: 18.2, confidence: 92 },
];

export const CalamityChangeMonitor: React.FC<CalamityChangeMonitorProps> = ({ preset }) => {
  const [viewSensor, setViewSensor] = useState<'optical' | 'sar' | 'change_delta'>('change_delta');
  const [frameIdx, setFrameIdx] = useState<number>(2);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % TIMELAPSE_FRAMES.length);
    }, 1350);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = preset.thumbnailUrl;
    img.onload = () => {
      canvas.width = 640;
      canvas.height = 640;
      ctx.drawImage(img, 0, 0, 640, 640);

      const frame = TIMELAPSE_FRAMES[frameIdx];
      const imgData = ctx.getImageData(0, 0, 640, 640);
      const d = imgData.data;

      for (let y = 0; y < 640; y++) {
        for (let x = 0; x < 640; x++) {
          const i = (y * 640 + x) * 4;
          const r = d[i], g = d[i + 1], b = d[i + 2];

          if (viewSensor === 'sar') {
            // Synthetic Sentinel-1 VV/VH backscatter grayscale + specular dark water
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const isWaterLike = b > r + 10 || (r < 55 && g < 75);
            const val = isWaterLike ? Math.max(8, lum * 0.35) : Math.min(255, lum * 1.15 + ((x * y) % 19));
            d[i] = d[i + 1] = d[i + 2] = val;
          } else if (viewSensor === 'change_delta') {
            // Highlight anomaly regions dynamically by frameIdx
            const threshold = 0.08 + frame.deltaPct * 0.01;
            const isWaterOrLow = b > r + 6 || (r > 105 && g < 90 && b < 55);
            const distCenter = Math.hypot(x - 320, y - 340) / 320;
            if (isWaterOrLow && distCenter < threshold * 2.1 && frameIdx > 0) {
              // Highlight flood / landslide / burn scar change mask in coral/cyan
              if (preset.id === 'wayanad-landslide' || preset.id === 'thar-solar') {
                d[i] = 244; d[i + 1] = 63; d[i + 2] = 94;
              } else {
                d[i] = 6; d[i + 1] = 182; d[i + 2] = 212;
              }
            }
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    };
  }, [preset, viewSensor, frameIdx]);

  const activeFrame = TIMELAPSE_FRAMES[frameIdx];

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-slate-950">
      {/* Left: Before/After & SAR Change Canvas */}
      <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-400" />
              <span>Calamity & Change Anomaly Monitor — {preset.name}</span>
            </h2>
            <p className="text-[11px] text-slate-400">
              Optical + Sentinel-1 SAR backscatter indicator time-series
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            {[
              { id: 'change_delta', label: 'Change Overlay' },
              { id: 'sar', label: 'Sentinel-1 SAR' },
              { id: 'optical', label: 'Optical Baseline' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewSensor(tab.id as any)}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  viewSensor === tab.id
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Canvas Preview */}
        <div className="flex-1 min-h-0 flex items-center justify-center bg-slate-900/50 rounded-xl border border-slate-800 p-3">
          <canvas
            ref={canvasRef}
            className="max-h-full max-w-full rounded-lg border border-slate-700 object-contain shadow-2xl"
          />
        </div>

        {/* Time-Lapse Sequence Scrubber */}
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaying((p) => !p)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Pause' : 'Play Time-Lapse'}</span>
              </button>
              <span className="font-medium text-slate-200">{activeFrame.label}</span>
            </div>
            <span className="font-mono text-[11px] text-cyan-400">
              {activeFrame.dateOffset} · Delta: {activeFrame.deltaPct}% · Conf: {activeFrame.confidence}%
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={TIMELAPSE_FRAMES.length - 1}
            value={frameIdx}
            onChange={(e) => setFrameIdx(parseInt(e.target.value, 10))}
            className="w-full h-1.5 accent-rose-500 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      </div>

      {/* Right: Scientific Disclaimers, InSAR/Ocean Notes & Official Warning Links */}
      <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900 p-4 overflow-y-auto space-y-4">
        <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-700/60 space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Scientific Monitoring Disclaimer</span>
          </div>
          <p className="text-[11px] text-amber-100/90 leading-relaxed">
            BhuChakshu displays <strong>change indicators and surface anomalies only</strong>. It is not an official early-warning system and <strong>never predicts earthquakes or tsunamis</strong>. Always verify alerts with official national agencies.
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Detected Indicators ({preset.primaryClass})
          </h3>
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Surface Change Area:</span>
              <span className="font-mono text-rose-400 font-semibold">{activeFrame.deltaPct}% of tile</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Indicator Confidence:</span>
              <span className="font-mono text-emerald-400 font-semibold">{activeFrame.confidence}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">InSAR Deformation Layer:</span>
              <span className="font-mono text-slate-300">Sentinel-1 GRD Proxy</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-800">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Official Warning & Earth Agencies
          </h3>
          <div className="space-y-1.5 text-xs">
            {[
              { name: 'IMD — India Meteorological Department', desc: 'Official cyclone, rainfall & severe weather alerts', url: 'https://mausam.imd.gov.in/' },
              { name: 'INCOIS — Ocean Information Services', desc: 'Official tsunami, storm surge & wave advisories', url: 'https://incois.gov.in/' },
              { name: 'ISRO Bhuvan Disaster Portal', desc: 'National satellite flood & landslide mapping', url: 'https://bhuvan.nrsc.gov.in/' },
              { name: 'USGS Earthquake Hazards', desc: 'Global seismic monitoring catalog', url: 'https://earthquake.usgs.gov/' },
            ].map((agency) => (
              <a
                key={agency.name}
                href={agency.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-600 transition-colors"
              >
                <div>
                  <div className="font-semibold text-slate-200">{agency.name}</div>
                  <div className="text-[10px] text-slate-400">{agency.desc}</div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
