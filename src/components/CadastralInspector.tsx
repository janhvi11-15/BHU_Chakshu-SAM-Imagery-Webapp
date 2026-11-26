import React from 'react';
import {
  DepthLevel,
  ParcelPolygon,
  SatelliteTilePreset,
  UserPersona,
} from '../types/satellite';
import { PERSONA_CONFIGS } from '../data/personas';
import { FarmerWeatherPanel } from './FarmerWeatherPanel';
import {
  FileText,
  Map,
  TrendingUp,
  Droplets,
  Building2,
  ShieldCheck,
  Download,
  Compass,
} from 'lucide-react';

interface CadastralInspectorProps {
  preset: SatelliteTilePreset;
  persona: UserPersona;
  depthLevel: DepthLevel;
  sceneMetrics: { meanNdvi: number; meanNdwi: number; meanNdbi: number };
  activeParcel: ParcelPolygon | null;
  autoParcels: ParcelPolygon[];
  onSelectParcel: (parcel: ParcelPolygon) => void;
  onRunVerification: () => void;
  onExportSingleGeoJson: (parcel: ParcelPolygon) => void;
  onOpen3DExplore: () => void;
}

export const CadastralInspector: React.FC<CadastralInspectorProps> = ({
  preset,
  persona,
  depthLevel,
  sceneMetrics,
  activeParcel,
  autoParcels,
  onSelectParcel,
  onRunVerification,
  onExportSingleGeoJson,
  onOpen3DExplore,
}) => {
  const personaCfg = PERSONA_CONFIGS.find((p) => p.id === persona) || PERSONA_CONFIGS[0];

  const activeNdvi = activeParcel ? activeParcel.spectralMetrics.meanNdvi : sceneMetrics.meanNdvi;
  const activeNdwi = activeParcel ? activeParcel.spectralMetrics.meanNdwi : sceneMetrics.meanNdwi;
  const activeNdbi = activeParcel ? activeParcel.spectralMetrics.meanNdbi : sceneMetrics.meanNdbi;

  return (
    <div className="w-full lg:w-88 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900/95 flex flex-col h-auto lg:h-full shrink-0 lg:overflow-y-auto">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between gap-2 sticky top-0 bg-slate-900/95 z-10 lg:static">
        <div className="flex items-center gap-2 min-w-0">
          <Map className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider truncate">
              {personaCfg.name}
            </h2>
            <span className="text-[10px] text-slate-400 block truncate">{personaCfg.nameHi}</span>
          </div>
        </div>
        <button
          onClick={onOpen3DExplore}
          className="shrink-0 px-3 py-1.5 sm:px-2.5 sm:py-1 min-h-[38px] sm:min-h-0 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/70 border border-emerald-500/40 text-[11px] sm:text-[10px] font-semibold text-emerald-300 flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Compass className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
          <span>3D Walk</span>
        </button>
      </div>

      <div className="p-3 sm:p-4 flex flex-col gap-3 sm:gap-4">
        {/* Persona-Specific Intelligence Card */}
        {persona === 'farmer' && (
          <FarmerWeatherPanel
            coordinates={preset.coordinates}
            meanNdvi={activeNdvi}
            regionName={preset.name}
          />
        )}

        {persona === 'geologist' && (
          <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-700/40 space-y-1.5 text-xs">
            <div className="text-[11px] font-bold text-amber-300 uppercase">
              Geomorphology & Soil Lens
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Bare Soil / Impervious Index (NDBI): <strong className="font-mono text-amber-300">{activeNdbi.toFixed(3)}</strong>.
              Use the <strong>Bund & Boundary Edge</strong> filter to trace structural lineaments, slope gullies, and alluvial boundaries.
            </p>
          </div>
        )}

        {persona === 'astrophysicist' && (
          <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-700/40 space-y-1.5 text-xs">
            <div className="text-[11px] font-bold text-purple-300 uppercase">
              Orbital Radiometry & Red-Edge
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Sensor: <strong>{preset.sensor}</strong> ({preset.gsdMetersPerPixel}m GSD). Vegetation strongly reflects Near-Infrared (780–840nm) while chlorophyll absorbs Red (665nm), producing the planetary biosphere signature.
            </p>
          </div>
        )}

        {persona === 'sam_ml' && (
          <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-700/40 space-y-1.5 text-xs">
            <div className="text-[11px] font-bold text-sky-300 uppercase">
              SAM / ML Model Diagnostics
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Zero-shot Pass 1 geodesic barrier prevents bund bleed. Pair with spectral labels (NDVI/NDWI/NDBI) before lightweight LoRA fine-tuning on EuroSAT, DeepGlobe, or LandCover.ai.
            </p>
          </div>
        )}

        {persona === 'remote_sensing' && (
          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-700/40 space-y-1.5 text-xs">
            <div className="text-[11px] font-bold text-cyan-300 uppercase">
              Sensor & Processing Metadata
            </div>
            <div className="text-[11px] font-mono text-slate-300 space-y-0.5">
              <div>CRS: {preset.coordinates.crs}</div>
              <div>Date: {preset.acquisitionDate}</div>
              <div>GSD: {preset.gsdMetersPerPixel} m/pixel</div>
            </div>
          </div>
        )}

        {persona === 'calamity' && (
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-700/40 space-y-1.5 text-xs">
            <div className="text-[11px] font-bold text-rose-300 uppercase">
              Anomaly Indicator Lens
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Surface moisture/water proxy NDWI: <strong className="font-mono text-cyan-300">{activeNdwi.toFixed(3)}</strong>. Open the <strong>Calamity</strong> tab for optical + Sentinel-1 SAR change detection and official IMD/INCOIS links.
            </p>
          </div>
        )}

        {activeParcel ? (
          <>
            {/* Parcel Title & Classification */}
            <div className="flex items-start justify-between pt-2 border-t border-slate-800/80">
              <div>
                <span className="text-sm font-bold text-white block">
                  {activeParcel.label}
                </span>
                <span className="text-xs text-emerald-400 font-medium">
                  {activeParcel.classification} · {activeParcel.confidence}% conf
                </span>
              </div>
              <button
                onClick={() => onExportSingleGeoJson(activeParcel)}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Download Parcel GeoJSON"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Acreage & Land Unit Matrix */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Land Area Measurements
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Hectares (ha)</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">
                    {activeParcel.areaHectares}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Acres</span>
                  <span className="text-base font-bold text-white font-mono">
                    {activeParcel.areaAcres}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Bigha (बीघा)</span>
                  <span className="text-sm font-semibold text-amber-300 font-mono">
                    {activeParcel.areaBigha}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Guntha (गुंठा)</span>
                  <span className="text-sm font-semibold text-amber-300 font-mono">
                    {activeParcel.areaGuntha}
                  </span>
                </div>
              </div>

              {depthLevel === 'professional' && (
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 font-mono">
                  <span>{activeParcel.areaSquareMeters.toLocaleString()} m²</span>
                  <span>Perimeter: {activeParcel.perimeterMeters} m</span>
                </div>
              )}
            </div>

            {/* Multi-Spectral Radiometric Profile (Full details in Pro or compact in Local) */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Spectral Breakdown</span>
                <span className="text-emerald-400 text-[10px] font-normal">
                  {depthLevel === 'local' ? 'Simple' : 'Full Radiometry'}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    Crop Vigor (NDVI)
                  </span>
                  <span className="font-mono text-emerald-400 font-semibold">
                    {activeParcel.spectralMetrics.meanNdvi.toFixed(3)}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, (activeParcel.spectralMetrics.meanNdvi + 0.2) * 85))}%`,
                    }}
                    className="bg-emerald-500 h-full rounded-full"
                  />
                </div>
              </div>

              {depthLevel === 'professional' && (
                <>
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                        NDWI Hydrology
                      </span>
                      <span className="font-mono text-cyan-400 font-semibold">
                        {activeParcel.spectralMetrics.meanNdwi.toFixed(3)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        style={{
                          width: `${Math.max(0, Math.min(100, (activeParcel.spectralMetrics.meanNdwi + 0.5) * 100))}%`,
                        }}
                        className="bg-cyan-500 h-full rounded-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-rose-400" />
                        NDBI Impervious
                      </span>
                      <span className="font-mono text-rose-400 font-semibold">
                        {activeParcel.spectralMetrics.meanNdbi.toFixed(3)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        style={{
                          width: `${Math.max(0, Math.min(100, (activeParcel.spectralMetrics.meanNdbi + 0.3) * 100))}%`,
                        }}
                        className="bg-rose-500 h-full rounded-full"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={onRunVerification}
              className="w-full py-3 sm:py-2.5 min-h-[44px] sm:min-h-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all mt-1 active:scale-[0.99]"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Audit with Dual-Verification</span>
            </button>
          </>
        ) : (
          <div className="p-4 text-center text-slate-400 space-y-2 border-t border-slate-800/80">
            <FileText className="w-8 h-8 text-slate-700 mx-auto" />
            <p className="text-xs font-medium text-slate-300">No Parcel Selected Yet</p>
            <p className="text-[11px] text-slate-400">
              Click any field on the map with Target Point (+) or click Auto-Segment All.
            </p>
          </div>
        )}
      </div>

      {/* Auto-Segmented Parcels Catalog */}
      {autoParcels.length > 0 && (
        <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Discovered Parcels ({autoParcels.length})
          </span>
          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {autoParcels.map((parcel) => (
              <button
                key={parcel.id}
                onClick={() => onSelectParcel(parcel)}
                className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between border transition-all ${
                  activeParcel?.id === parcel.id
                    ? 'bg-emerald-950/40 border-emerald-500/80 text-emerald-300'
                    : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <div
                    style={{ backgroundColor: parcel.color }}
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                  />
                  <span className="truncate">{parcel.label}</span>
                </div>
                <span className="font-mono text-[11px] text-slate-400 shrink-0">
                  {parcel.areaHectares} ha
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
