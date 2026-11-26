import React, { useState } from 'react';
import {
  Info,
  ChevronDown,
  ChevronUp,
  Leaf,
  Droplets,
  Building2,
  Layers,
} from 'lucide-react';
import { ParcelPolygon, SpectralBand } from '../types/satellite';

interface SpectralLegendOverlayProps {
  activeBand: SpectralBand;
  onSelectBand: (band: SpectralBand) => void;
  sceneMetrics: {
    meanNdvi: number;
    meanNdwi: number;
    meanNdbi: number;
  };
  activeParcel: ParcelPolygon | null;
}

interface IndexMeta {
  id: 'ndvi' | 'ndwi' | 'ndbi';
  name: string;
  fullName: string;
  formula: string;
  range: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  gradient: string;
  scaleLabels: [string, string, string];
  thresholds: { label: string; range: string; meaning: string; tone: string }[];
  agriDefinition: string;
  diagnose: (val: number) => { badge: string; tone: string; hint: string };
}

const INDEX_DEFINITIONS: IndexMeta[] = [
  {
    id: 'ndvi',
    name: 'NDVI',
    fullName: 'Normalized Difference Vegetation Index',
    formula: '(NIR - Red) / (NIR + Red)',
    range: '-1.0 to +1.0',
    colorClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/50',
    bgClass: 'bg-emerald-950/60',
    gradient: 'linear-gradient(90deg, #991b1b 0%, #f59e0b 40%, #84cc16 68%, #15803d 100%)',
    scaleLabels: ['-0.2 Bare/Water', '+0.3 Moderate', '+0.8 Dense'],
    thresholds: [
      { label: 'Water / Fallow / Bare Soil', range: '< 0.15', meaning: 'No active leaf cover or open water', tone: 'text-amber-300' },
      { label: 'Stressed / Early Emergence', range: '0.15 – 0.35', meaning: 'Moisture stress, nutrient deficit, or young crop', tone: 'text-yellow-300' },
      { label: 'Healthy Growing Canopy', range: '0.35 – 0.60', meaning: 'Active photosynthesis & steady vigor', tone: 'text-lime-300' },
      { label: 'Peak Biomass / Dense Crop', range: '> 0.60', meaning: 'High chlorophyll density & full canopy closure', tone: 'text-emerald-300' },
    ],
    agriDefinition:
      'Measures chlorophyll absorption in Red light vs cell-structure reflectance in Near-Infrared. Higher values indicate denser, healthier crops and lower water or nitrogen stress.',
    diagnose: (v: number) => {
      if (v < 0.15) return { badge: 'Bare / Water / Stubble', tone: 'text-amber-300 bg-amber-950/70 border-amber-500/40', hint: 'Low chlorophyll signal; inspect soil or water.' };
      if (v < 0.35) return { badge: 'Sparse / Stressed Crop', tone: 'text-yellow-300 bg-yellow-950/70 border-yellow-500/40', hint: 'Possible moisture stress or early seedling stage.' };
      if (v < 0.58) return { badge: 'Healthy Vegetation', tone: 'text-emerald-300 bg-emerald-950/70 border-emerald-500/40', hint: 'Good photosynthetic canopy vigor.' };
      return { badge: 'Dense Vigorous Canopy', tone: 'text-emerald-200 bg-emerald-900/70 border-emerald-400/50', hint: 'Peak chlorophyll activity across plot.' };
    },
  },
  {
    id: 'ndwi',
    name: 'NDWI',
    fullName: 'Normalized Difference Water Index',
    formula: '(Green - NIR) / (Green + NIR)',
    range: '-1.0 to +1.0',
    colorClass: 'text-cyan-400',
    borderClass: 'border-cyan-500/50',
    bgClass: 'bg-cyan-950/60',
    gradient: 'linear-gradient(90deg, #78350f 0%, #94a3b8 45%, #38bdf8 72%, #1d4ed8 100%)',
    scaleLabels: ['-0.4 Dry Soil', '0.0 Moist/Mixed', '+0.5 Open Water'],
    thresholds: [
      { label: 'Dry Land / Upland Canopy', range: '< -0.10', meaning: 'Dry soil surface or dense non-flooded crop', tone: 'text-amber-300' },
      { label: 'Saturated / Irrigated Soil', range: '-0.10 – 0.08', meaning: 'Wet paddy field, canal edge, or high moisture', tone: 'text-sky-300' },
      { label: 'Open Water / Inundation', range: '> 0.08', meaning: 'Canals, ponds, rivers, aquaculture, or floodwater', tone: 'text-cyan-300' },
    ],
    agriDefinition:
      'Isolates surface water bodies, irrigation canals, aquaculture ponds, and saturated paddy fields while suppressing soil and dry vegetation signals.',
    diagnose: (v: number) => {
      if (v > 0.08) return { badge: 'Open Water / Flooded', tone: 'text-cyan-200 bg-cyan-950/70 border-cyan-400/50', hint: 'Strong liquid water reflectance detected.' };
      if (v > -0.1) return { badge: 'Moist / Irrigated Zone', tone: 'text-sky-300 bg-sky-950/70 border-sky-500/40', hint: 'Elevated surface moisture or wet bund margin.' };
      return { badge: 'Dry / Non-Inundated', tone: 'text-slate-300 bg-slate-800/80 border-slate-600/50', hint: 'No standing surface water in pixel mix.' };
    },
  },
  {
    id: 'ndbi',
    name: 'NDBI',
    fullName: 'Normalized Difference Built-up Index',
    formula: '(SWIR - NIR) / (SWIR + NIR)',
    range: '-1.0 to +1.0',
    colorClass: 'text-rose-400',
    borderClass: 'border-rose-500/50',
    bgClass: 'bg-rose-950/60',
    gradient: 'linear-gradient(90deg, #166534 0%, #64748b 45%, #f97316 75%, #e11d48 100%)',
    scaleLabels: ['-0.3 Vegetated', '0.0 Mixed/Loam', '+0.4 Built-up'],
    thresholds: [
      { label: 'Vegetated / Water Cover', range: '< 0.00', meaning: 'Crop canopy or water absorbs SWIR/Red', tone: 'text-emerald-300' },
      { label: 'Dry Fallow / Exposed Soil', range: '0.00 – 0.12', meaning: 'Tilled bare soil, dry earth bunds, or stubble', tone: 'text-orange-300' },
      { label: 'Impervious / Concrete', range: '> 0.12', meaning: 'Farmhouses, roads, roofs, warehouses, urban sprawl', tone: 'text-rose-300' },
    ],
    agriDefinition:
      'Separates impervious farm infrastructure, rural roads, and bare compacted soil from vegetated cropland so SAM masks do not confuse dry fallow fields with buildings.',
    diagnose: (v: number) => {
      if (v > 0.12) return { badge: 'Built-up / Impervious', tone: 'text-rose-300 bg-rose-950/70 border-rose-500/40', hint: 'High concrete/roof or compacted soil reflectance.' };
      if (v > 0.0) return { badge: 'Bare Soil / Fallow', tone: 'text-orange-300 bg-orange-950/70 border-orange-500/40', hint: 'Exposed loam, earthen bunds, or harvested field.' };
      return { badge: 'Natural / Cropped', tone: 'text-emerald-300 bg-emerald-950/70 border-emerald-500/40', hint: 'Minimal impervious interference.' };
    },
  },
];

const BAND_GRADIENT_META: Record<
  SpectralBand,
  { title: string; gradient: string; minLabel: string; midLabel: string; maxLabel: string; note: string }
> = {
  rgb: {
    title: 'True Color Composite (B4/B3/B2)',
    gradient: 'linear-gradient(90deg, #1d4ed8 0%, #92400e 35%, #4d7c0f 70%, #15803d 100%)',
    minLabel: 'Water',
    midLabel: 'Soil/Bunds',
    maxLabel: 'Healthy Crop',
    note: 'Visual spectrum view; hover any metric below for agricultural index thresholds.',
  },
  cir: {
    title: 'Color Infrared Biomass (CIR)',
    gradient: 'linear-gradient(90deg, #0f172a 0%, #64748b 35%, #fb7185 70%, #dc2626 100%)',
    minLabel: 'Water',
    midLabel: 'Bare Earth',
    maxLabel: 'Vigorous Chlorophyll (Red)',
    note: 'Healthy leaves appear bright crimson/magenta due to strong NIR reflection.',
  },
  ndvi: {
    title: 'NDVI Crop Health Scale',
    gradient: 'linear-gradient(90deg, #991b1b 0%, #f59e0b 40%, #84cc16 68%, #15803d 100%)',
    minLabel: '< 0.15 Stressed/Bare',
    midLabel: '0.35 Moderate',
    maxLabel: '> 0.60 Peak Vigor',
    note: 'Green zones indicate thriving chlorophyll; amber/red marks fallow or stressed crops.',
  },
  ndwi: {
    title: 'NDWI Hydrology & Moisture Scale',
    gradient: 'linear-gradient(90deg, #78350f 0%, #94a3b8 45%, #38bdf8 72%, #1d4ed8 100%)',
    minLabel: '< -0.1 Dry',
    midLabel: '0.0 Saturated',
    maxLabel: '> 0.15 Open Water',
    note: 'Blue highlights canals, aquaculture ponds, wet paddy, and flood boundaries.',
  },
  ndbi: {
    title: 'NDBI Built-up & Bare Soil Scale',
    gradient: 'linear-gradient(90deg, #166534 0%, #64748b 45%, #f97316 75%, #e11d48 100%)',
    minLabel: '< 0.0 Crop',
    midLabel: '0.05 Bare Soil',
    maxLabel: '> 0.15 Concrete/Roofs',
    note: 'Crimson isolates structures and roads; orange marks exposed dry loam.',
  },
  nbr: {
    title: 'Burn Scar & Moisture Deficit Scale',
    gradient: 'linear-gradient(90deg, #450a0a 0%, #dc2626 35%, #facc15 65%, #16a34a 100%)',
    minLabel: 'Severe Burn/Dry',
    midLabel: 'Moderate Stress',
    maxLabel: 'Moist Canopy',
    note: 'Highlights paddy stubble burn scars and acute soil moisture deficit zones.',
  },
  edge: {
    title: 'Sobel Cadastral Bund Edge Magnitude',
    gradient: 'linear-gradient(90deg, #020617 0%, #0ea5e9 55%, #34d399 100%)',
    minLabel: 'Uniform Interior',
    midLabel: 'Crop Furrows',
    maxLabel: 'Sharp Bund / Canal Edge',
    note: 'Bright lines trace earthen field ridges (meḍh) used to constrain SAM masks.',
  },
};

export const SpectralLegendOverlay: React.FC<SpectralLegendOverlayProps> = ({
  activeBand,
  onSelectBand,
  sceneMetrics,
  activeParcel,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [hoveredIndex, setHoveredIndex] = useState<'ndvi' | 'ndwi' | 'ndbi' | null>(null);

  const values = activeParcel
    ? {
        ndvi: activeParcel.spectralMetrics.meanNdvi,
        ndwi: activeParcel.spectralMetrics.meanNdwi,
        ndbi: activeParcel.spectralMetrics.meanNdbi,
        scopeLabel: `Parcel: ${activeParcel.label}`,
      }
    : {
        ndvi: sceneMetrics.meanNdvi,
        ndwi: sceneMetrics.meanNdwi,
        ndbi: sceneMetrics.meanNdbi,
        scopeLabel: 'Full Scene Mean',
      };

  const activeGradient = BAND_GRADIENT_META[activeBand] || BAND_GRADIENT_META.rgb;
  const activeTooltipMeta = hoveredIndex
    ? INDEX_DEFINITIONS.find((d) => d.id === hoveredIndex) || null
    : null;

  const getIndexIcon = (id: 'ndvi' | 'ndwi' | 'ndbi') => {
    if (id === 'ndvi') return <Leaf className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (id === 'ndwi') return <Droplets className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    return <Building2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
  };

  // Compute normalized 0-100 marker position on [-0.5, +0.8] range for visual scale
  const markerPercent = (() => {
    const val =
      activeBand === 'ndwi'
        ? values.ndwi
        : activeBand === 'ndbi'
        ? values.ndbi
        : values.ndvi;
    return Math.max(4, Math.min(96, ((val + 0.5) / 1.3) * 100));
  })();

  return (
    <div
      className={`absolute top-20 right-3 md:top-3 md:right-16 z-30 pointer-events-auto max-h-[calc(100%-5.5rem)] md:max-h-[calc(100%-1.5rem)] flex flex-col ${
        isExpanded ? 'w-72 sm:w-80 max-w-[calc(100vw-2rem)]' : 'w-auto max-w-[calc(100vw-5rem)]'
      }`}
    >
      <div className="bg-slate-900/95 border border-slate-700/90 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header Bar */}
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className={`w-full px-3 py-2 flex items-center justify-between gap-2.5 hover:bg-slate-800/60 transition-colors shrink-0 ${
            isExpanded ? 'border-b border-slate-800/90 rounded-t-xl' : 'rounded-xl'
          }`}
          title="Toggle dynamic spectral legend and agricultural index tooltips"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            {isExpanded ? (
              <div className="text-left min-w-0">
                <div className="text-[11px] font-bold text-slate-100 truncate">
                  Dynamic Spectral Legend
                </div>
                <div className="text-[10px] text-slate-400 truncate font-mono">
                  {values.scopeLabel}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[10px] font-mono whitespace-nowrap">
                <span className="font-sans font-semibold text-slate-200">Legend</span>
                <span className="text-emerald-400">NDVI {values.ndvi.toFixed(2)}</span>
                <span className="text-slate-600 hidden sm:inline">·</span>
                <span className="text-cyan-400 hidden sm:inline">NDWI {values.ndwi.toFixed(2)}</span>
                <span className="text-slate-600 hidden sm:inline">·</span>
                <span className="text-rose-400 hidden sm:inline">NDBI {values.ndbi.toFixed(2)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
              {activeBand}
            </span>
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="p-3 space-y-2.5 overflow-y-auto">
            {/* Active Band Ramp */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold text-slate-200 truncate">{activeGradient.title}</span>
              </div>
              <div className="relative h-2.5 rounded-full overflow-hidden border border-slate-700/80">
                <div
                  className="w-full h-full"
                  style={{ background: activeGradient.gradient }}
                />
                {(activeBand === 'ndvi' || activeBand === 'ndwi' || activeBand === 'ndbi') && (
                  <div
                    style={{ left: `${markerPercent}%` }}
                    title="Current mean value marker"
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_6px_#ffffff] -translate-x-1/2"
                  />
                )}
              </div>
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                <span>{activeGradient.minLabel}</span>
                <span>{activeGradient.midLabel}</span>
                <span>{activeGradient.maxLabel}</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                {activeGradient.note}
              </p>
            </div>

            {/* Interactive Index Readouts with Agricultural Health Tooltips */}
            <div className="pt-2 border-t border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-semibold uppercase tracking-wider">
                  Spectral Indices
                </span>
                <span className="text-[9px] text-slate-500">
                  Hover/tap <Info className="w-2.5 h-2.5 inline" /> for agri definition
                </span>
              </div>

              {INDEX_DEFINITIONS.map((idx) => {
                const val = values[idx.id];
                const diag = idx.diagnose(val);
                const isSelected = activeBand === idx.id;
                const isTooltipOpen = hoveredIndex === idx.id;

                return (
                  <div
                    key={idx.id}
                    className="relative"
                    onMouseEnter={() => setHoveredIndex(idx.id)}
                    onMouseLeave={() => setHoveredIndex((cur) => (cur === idx.id ? null : cur))}
                  >
                    <div
                      className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border transition-all ${
                        isSelected
                          ? `${idx.bgClass} ${idx.borderClass}`
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectBand(idx.id)}
                        className="flex items-center gap-1.5 text-left min-w-0 flex-1"
                        title={`Switch canvas to ${idx.name} view`}
                      >
                        {getIndexIcon(idx.id)}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[11px] font-bold ${idx.colorClass}`}>
                              {idx.name}
                            </span>
                            <span className="text-[11px] font-mono font-semibold text-white">
                              {val.toFixed(3)}
                            </span>
                          </div>
                          <div className="text-[9px] text-slate-400 truncate">
                            {diag.badge}
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setHoveredIndex((cur) => (cur === idx.id ? null : idx.id))
                        }
                        aria-label={`Agricultural health definition for ${idx.name}`}
                        className={`p-1 rounded border text-[10px] transition-colors shrink-0 ${
                          isTooltipOpen
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Tooltip Popover Card (rendered cleanly below or beside without clipping) */}
            {activeTooltipMeta && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 shadow-2xl space-y-2 text-[11px]">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className={`font-bold ${activeTooltipMeta.colorClass}`}>
                      {activeTooltipMeta.name} — {activeTooltipMeta.fullName}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      Formula: {activeTooltipMeta.formula} · Range: {activeTooltipMeta.range}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHoveredIndex(null)}
                    className="text-[10px] text-slate-400 hover:text-white px-1"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-[10px] text-slate-300 leading-relaxed">
                  {activeTooltipMeta.agriDefinition}
                </p>

                {(() => {
                  const currentVal = values[activeTooltipMeta.id];
                  const diag = activeTooltipMeta.diagnose(currentVal);
                  return (
                    <div className={`px-2 py-1 rounded border text-[10px] ${diag.tone}`}>
                      <strong>Current ({currentVal.toFixed(3)}):</strong> {diag.badge} — {diag.hint}
                    </div>
                  );
                })()}

                <div className="space-y-1 pt-1 border-t border-slate-800/80">
                  {activeTooltipMeta.thresholds.map((t) => (
                    <div
                      key={t.range}
                      className="flex items-center justify-between gap-2 text-[10px]"
                    >
                      <span className={`font-mono font-semibold shrink-0 ${t.tone}`}>
                        {t.range}
                      </span>
                      <span className="text-slate-300 text-right truncate" title={t.meaning}>
                        {t.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
