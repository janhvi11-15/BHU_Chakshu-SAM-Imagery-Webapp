import React, { useState, useEffect, useRef } from 'react';
import {
  SatelliteTilePreset,
  UserPersona,
  WorkspaceMode,
  DepthLevel,
} from '../types/satellite';
import { PERSONA_CONFIGS } from '../data/personas';
import { PWAInstallButton } from './PWAControls';
import {
  ShieldCheck,
  Upload,
  Download,
  MapPin,
  Sparkles,
  ChevronDown,
  Mic,
  Compass,
  Map as MapIcon,
  Layers,
  Activity,
  BookOpen,
  UserCheck,
  FileText,
} from 'lucide-react';

interface HeaderProps {
  currentPreset: SatelliteTilePreset;
  presets: SatelliteTilePreset[];
  workspaceMode: WorkspaceMode;
  onSetWorkspaceMode: (mode: WorkspaceMode) => void;
  persona: UserPersona;
  onSelectPersona: (persona: UserPersona) => void;
  depthLevel: DepthLevel;
  onToggleDepthLevel: () => void;
  onSelectPreset: (preset: SatelliteTilePreset) => void;
  onOpenUpload: () => void;
  onOpenExport: () => void;
  onOpenReadme: () => void;
  onOpenRoadmap: () => void;
  onRunVerification: () => void;
  onToggleAiDrawer: () => void;
  onToggleLiveVoice: () => void;
  isVerifying: boolean;
  hasSegmentation: boolean;
  mouseCoord: { lat: number; lon: number; x: number; y: number } | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentPreset,
  presets,
  workspaceMode,
  onSetWorkspaceMode,
  persona,
  onSelectPersona,
  depthLevel,
  onToggleDepthLevel,
  onSelectPreset,
  onOpenUpload,
  onOpenExport,
  onOpenReadme,
  onOpenRoadmap,
  onRunVerification,
  onToggleAiDrawer,
  onToggleLiveVoice,
  isVerifying,
  hasSegmentation,
  mouseCoord,
}) => {
  const activePersonaCfg =
    PERSONA_CONFIGS.find((p) => p.id === persona) || PERSONA_CONFIGS[0];

  const [openMenu, setOpenMenu] = useState<'preset' | 'persona' | null>(null);
  const menusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (menusRef.current && !menusRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
    };
  }, []);

  return (
    <header className="border-b border-slate-800 bg-slate-900/95 px-2.5 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 z-30 shrink-0">
      {/* Left: Brand & Workspace Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2 sm:gap-3 w-full sm:w-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-950 border border-emerald-500/40 overflow-hidden shrink-0 shadow-sm">
            <img
              src="/favicon.ico"
              alt="BhuChakshu icon"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                BhuChakshu
              </h1>
              <span className="text-[11px] text-emerald-400 font-mono">भू-चक्षु v2</span>
            </div>
            <div className="text-[10px] text-slate-400 hidden sm:block">
              {mouseCoord
                ? `${mouseCoord.lat.toFixed(4)}°N, ${mouseCoord.lon.toFixed(4)}°E`
                : `${currentPreset.coordinates.lat.toFixed(4)}°N, ${currentPreset.coordinates.lon.toFixed(4)}°E`}{' '}
              · {currentPreset.gsdMetersPerPixel}m/px
            </div>
          </div>
        </div>

        {/* Workspace Mode Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
          {[
            { id: 'workbench', label: 'SAM 2D', icon: Layers },
            { id: 'map', label: 'Maps', icon: MapIcon },
            { id: 'explore3d', label: '3D Walk', icon: Compass },
            { id: 'calamity', label: 'Calamity', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = workspaceMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSetWorkspaceMode(tab.id as WorkspaceMode)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Center: Preset & Persona Selectors */}
      <div ref={menusRef} className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Preset Selector */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'preset' ? null : 'preset'))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] sm:min-h-0 rounded-lg bg-slate-800/80 border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-200"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="max-w-[115px] sm:max-w-[170px] truncate">{currentPreset.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {openMenu === 'preset' && (
            <div className="absolute top-full left-0 mt-1 w-72 max-w-[90vw] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                Satellite Testbeds
              </div>
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    onSelectPreset(preset);
                    setOpenMenu(null);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 hover:bg-slate-800 transition-colors ${
                    preset.id === currentPreset.id
                      ? 'bg-emerald-950/50 text-emerald-300 font-medium'
                      : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{preset.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {preset.sensor.split(' ')[0]}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {preset.state} · {preset.primaryClass}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Persona Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'persona' ? null : 'persona'))}
            className="flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] sm:min-h-0 rounded-lg bg-slate-800/80 border border-slate-700 hover:border-emerald-500/60 text-xs font-medium text-emerald-300"
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="max-w-[95px] sm:max-w-[110px] truncate">
              {activePersonaCfg.name.split(' ')[0]}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {openMenu === 'persona' && (
            <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-1 w-80 max-w-[90vw] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 border-b border-slate-800 uppercase tracking-wider">
                Switch Persona Lens
              </div>
              {PERSONA_CONFIGS.map((cfg) => (
                <button
                  key={cfg.id}
                  onClick={() => {
                    onSelectPersona(cfg.id);
                    setOpenMenu(null);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex flex-col gap-0.5 hover:bg-slate-800 transition-colors ${
                    cfg.id === persona ? 'bg-emerald-950/50 text-emerald-300' : 'text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{cfg.name}</span>
                    <span className="text-[10px] text-slate-400">{cfg.nameHi}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 line-clamp-1">{cfg.tagline}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Depth Level Toggle (Local vs Professional) */}
        <button
          onClick={onToggleDepthLevel}
          className="flex items-center px-2 py-1.5 min-h-[36px] sm:min-h-0 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-[11px] font-mono text-slate-300"
          title="Toggle between simple Local view and full Professional data"
        >
          {depthLevel === 'local' ? 'Local' : 'Pro'}
        </button>
      </div>

      {/* Right: Tools & Primary Actions */}
      <div className="flex items-center gap-1.5">
        <PWAInstallButton />

        <button
          onClick={onOpenReadme}
          className="px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5"
          title="Read Project README.md inside BhuChakshu"
        >
          <FileText className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden xl:inline">README</span>
        </button>

        <button
          onClick={onOpenRoadmap}
          className="px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5"
          title="v2 Roadmap, Model Cards & Limitations"
        >
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden xl:inline">Roadmap</span>
        </button>

        <button
          onClick={onOpenUpload}
          className="px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5"
          title="Upload custom satellite or drone tile"
        >
          <Upload className="w-3.5 h-3.5 text-slate-400" />
          <span className="hidden xl:inline">Upload</span>
        </button>

        <button
          onClick={onToggleLiveVoice}
          className="px-2.5 py-1.5 rounded-lg bg-cyan-950/70 hover:bg-cyan-900/70 text-xs text-cyan-200 border border-cyan-500/40 flex items-center gap-1.5"
          title="Talk live with BhuChakshu Voice Sahayak (Gemini 3.8 Live)"
        >
          <Mic className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Voice Live</span>
        </button>

        <button
          onClick={onToggleAiDrawer}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5"
          title="Ask Earth Observation AI questions"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden lg:inline">EO AI</span>
        </button>

        <button
          onClick={onOpenExport}
          className="px-2 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5"
          title="Export GeoJSON, Survey Report, or Python SAM2 pipeline"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
        </button>

        <button
          onClick={onRunVerification}
          disabled={isVerifying}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            isVerifying
              ? 'bg-emerald-800 text-emerald-200 cursor-wait'
              : hasSegmentation
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-emerald-700 hover:bg-emerald-600 text-white'
          }`}
          title="Run Pass 2 Dual-Verification Audit with Gemini 4 Hydrogen"
        >
          <ShieldCheck className={`w-4 h-4 ${isVerifying ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">
            {isVerifying ? 'Auditing...' : 'Dual-Verify'}
          </span>
        </button>
      </div>
    </header>
  );
};
