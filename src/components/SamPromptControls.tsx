import React from 'react';
import { 
  PlusCircle, 
  MinusCircle, 
  Square, 
  Wand2, 
  Trash2, 
  RotateCcw,
  Cpu,
  Layers
} from 'lucide-react';

export type SamToolMode = 'point-positive' | 'point-negative' | 'box';

interface SamPromptControlsProps {
  mode: SamToolMode;
  onSetMode: (mode: SamToolMode) => void;
  sensitivity: number;
  onSensitivityChange: (val: number) => void;
  positiveCount: number;
  negativeCount: number;
  hasBox: boolean;
  onClearPrompts: () => void;
  onUndoLastPrompt: () => void;
  onRunAutoSegment: () => void;
  isAutoSegmenting: boolean;
}

export const SamPromptControls: React.FC<SamPromptControlsProps> = ({
  mode,
  onSetMode,
  sensitivity,
  onSensitivityChange,
  positiveCount,
  negativeCount,
  hasBox,
  onClearPrompts,
  onUndoLastPrompt,
  onRunAutoSegment,
  isAutoSegmenting,
}) => {
  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-2.5 shadow-lg flex flex-col gap-2">
      {/* Header & Edge Badge */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200">
            SAM Interactive Prompting (Pass 1)
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
          <Cpu className="w-3 h-3" />
          <span>0-Cost On-Device Edge</span>
        </div>
      </div>

      {/* Tool Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* Positive Point */}
        <button
          onClick={() => onSetMode('point-positive')}
          className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-between transition-all ${
            mode === 'point-positive'
              ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200 shadow-sm'
              : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
          }`}
          title="Click on the parcel to add foreground points"
        >
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Target Point (+)</span>
          </div>
          {positiveCount > 0 && (
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
              {positiveCount}
            </span>
          )}
        </button>

        {/* Negative Point */}
        <button
          onClick={() => onSetMode('point-negative')}
          className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-between transition-all ${
            mode === 'point-negative'
              ? 'bg-rose-950/70 border-rose-500 text-rose-200 shadow-sm'
              : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
          }`}
          title="Click to prune out background shadows, roads, or non-target fields"
        >
          <div className="flex items-center gap-2">
            <MinusCircle className="w-4 h-4 text-rose-400" />
            <span>Exclude (-)</span>
          </div>
          {negativeCount > 0 && (
            <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono">
              {negativeCount}
            </span>
          )}
        </button>

        {/* Box Prompt */}
        <button
          onClick={() => onSetMode('box')}
          className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center justify-between transition-all ${
            mode === 'box'
              ? 'bg-sky-950/70 border-sky-500 text-sky-200 shadow-sm'
              : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
          }`}
          title="Click and drag bounding box across parcel"
        >
          <div className="flex items-center gap-2">
            <Square className="w-4 h-4 text-sky-400" />
            <span>Box Prompt</span>
          </div>
          {hasBox && (
            <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-mono">
              1
            </span>
          )}
        </button>

        {/* Whole Scene Auto-Segmentation */}
        <button
          onClick={onRunAutoSegment}
          disabled={isAutoSegmenting}
          className="px-3 py-2 rounded-lg border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/40 text-purple-200 text-xs font-medium flex items-center justify-center gap-2 transition-all"
          title="Automatically detect and delineate all agricultural parcels in this scene"
        >
          <Wand2 className={`w-4 h-4 text-purple-400 ${isAutoSegmenting ? 'animate-spin' : ''}`} />
          <span>{isAutoSegmenting ? 'Segmenting Scene...' : 'Auto-Segment All'}</span>
        </button>
      </div>

      {/* Sensitivity & Reset Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pt-1 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-slate-400">Geodesic Boundary Tolerance:</span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={sensitivity}
            onChange={(e) => onSensitivityChange(parseFloat(e.target.value))}
            className="w-28 h-1.5 accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[11px] font-mono text-slate-300">
            {Math.round(sensitivity * 100)}%
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(positiveCount > 0 || negativeCount > 0 || hasBox) && (
            <>
              <button
                onClick={onUndoLastPrompt}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition-colors"
                title="Undo last pin"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Undo Pin</span>
              </button>
              <button
                onClick={onClearPrompts}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-950/50 hover:bg-rose-900/60 border border-rose-900/60 text-[11px] text-rose-300 transition-colors"
                title="Clear all prompt pins and masks"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
