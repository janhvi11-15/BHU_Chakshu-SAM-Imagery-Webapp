import React from 'react';
import { SpectralBand } from '../types/satellite';
import { Eye, SplitSquareVertical, Sliders, Info } from 'lucide-react';

interface SpectralToolboxProps {
  activeBand: SpectralBand;
  onSelectBand: (band: SpectralBand) => void;
  splitMode: boolean;
  onToggleSplitMode: () => void;
  splitPos: number; // 0 to 100
  onSplitPosChange: (pos: number) => void;
  spectralOpacity: number;
  onOpacityChange: (opacity: number) => void;
  metrics: {
    meanNdvi: number;
    meanNdwi: number;
    meanNdbi: number;
  };
}

const BAND_OPTIONS: { id: SpectralBand; label: string; desc: string; tag: string }[] = [
  { id: 'rgb', label: 'True Color (RGB)', desc: 'Natural visual spectrum (B4/B3/B2)', tag: 'Natural' },
  { id: 'cir', label: 'Color Infrared (CIR)', desc: 'Vegetation photosynthetic vigor (B8/B4/B3)', tag: 'Biomass' },
  { id: 'ndvi', label: 'NDVI Vegetation', desc: 'Canopy health & crop density heatmap', tag: 'Agri Health' },
  { id: 'ndwi', label: 'NDWI Water Index', desc: 'Water bodies, aquaculture & flood inundation', tag: 'Hydrology' },
  { id: 'ndbi', label: 'NDBI Built-up', desc: 'Concrete structures, settlements & asphalt', tag: 'Cadastre' },
  { id: 'nbr', label: 'Burn Scar / Moisture', desc: 'Stubble burn scars & soil moisture deficit', tag: 'Disaster' },
  { id: 'edge', label: 'Bund & Boundary Edge', desc: 'Sobel gradient isolating farm bunds (meḍh)', tag: 'Cadastral Edge' },
];

export const SpectralToolbox: React.FC<SpectralToolboxProps> = ({
  activeBand,
  onSelectBand,
  splitMode,
  onToggleSplitMode,
  splitPos,
  onSplitPosChange,
  spectralOpacity,
  onOpacityChange,
  metrics,
}) => {
  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-2.5 shadow-lg flex flex-col gap-2">
      {/* Header & Mode Selector */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200">
            Multi-Spectral Image Converter
          </span>
        </div>
        
        {/* Split Screen Wipe Toggle */}
        <button
          onClick={onToggleSplitMode}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            splitMode
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          }`}
          title="Compare Raw Satellite vs Spectral Layer side-by-side"
        >
          <SplitSquareVertical className="w-3.5 h-3.5" />
          <span>{splitMode ? 'Split Swipe Active' : 'Swipe Compare'}</span>
        </button>
      </div>

      {/* Spectral Band Switcher Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
        {BAND_OPTIONS.map((opt) => {
          const isActive = activeBand === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onSelectBand(opt.id)}
              className={`p-2 rounded-lg text-left transition-all border flex flex-col justify-between ${
                isActive
                  ? 'bg-slate-800 border-emerald-500/60 shadow-inner'
                  : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <span className={`text-xs font-medium truncate ${isActive ? 'text-emerald-300' : 'text-slate-200'}`}>
                  {opt.label.split(' ')[0]}
                </span>
                <span className="text-[9px] text-slate-400 font-mono">
                  {opt.tag}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 line-clamp-1 mt-1">
                {opt.desc}
              </p>
            </button>
          );
        })}
      </div>

      {/* Controls & Real-Time Radiometric Telemetry Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-slate-400">
        {/* Split Position & Opacity Sliders */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {splitMode && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Split:</span>
              <input
                type="range"
                min="5"
                max="95"
                value={splitPos}
                onChange={(e) => onSplitPosChange(parseInt(e.target.value, 10))}
                className="w-24 h-1.5 accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="text-[11px] font-mono text-slate-300">{splitPos}%</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Blend Opacity:</span>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={spectralOpacity}
              onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
              className="w-24 h-1.5 accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="text-[11px] font-mono text-slate-300">
              {Math.round(spectralOpacity * 100)}%
            </span>
          </div>
        </div>

        {/* Live Scene Radiometric Averages */}
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">NDVI:</span>
            <span className={metrics.meanNdvi > 0.4 ? 'text-emerald-400' : 'text-amber-400'}>
              {metrics.meanNdvi.toFixed(3)}
            </span>
          </div>
          <span className="text-slate-700">·</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">NDWI:</span>
            <span className={metrics.meanNdwi > 0.05 ? 'text-cyan-400' : 'text-slate-400'}>
              {metrics.meanNdwi.toFixed(3)}
            </span>
          </div>
          <span className="text-slate-700">·</span>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">NDBI:</span>
            <span className={metrics.meanNdbi > 0.1 ? 'text-rose-400' : 'text-slate-400'}>
              {metrics.meanNdbi.toFixed(3)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
