import React, { useState } from 'react';
import { MODEL_CARDS, V2_ROADMAP } from '../data/personas';
import readmeMarkdown from '../../README.md?raw';
import {
  Calendar,
  Cpu,
  Database,
  X,
  CheckCircle2,
  Clock,
  FileText,
  Copy,
  Check,
  Download,
  ExternalLink,
  Code2,
  BookOpen,
} from 'lucide-react';

interface RoadmapAndModelCardsModalProps {
  initialTab?: 'readme' | 'roadmap';
  onClose: () => void;
}

const TECH_STACK_ROWS = [
  { layer: 'Frontend & UI', tools: 'React 19, TypeScript, Tailwind CSS v4, Vite 8, Lucide Icons' },
  { layer: '3D Terrain & Maps', tools: 'Three.js (OrbitControls, RoomEnvironment), @vis.gl/react-google-maps' },
  { layer: 'AI & Live Voice', tools: '@google/genai (Gemini 4 Hydrogen, Gemini 3.1 Flash Lite, Gemini 3.8 Live)' },
  { layer: 'Backend Server', tools: 'Node.js, Express, ws WebSocket bridge, response caching' },
  { layer: 'Satellite & Weather', tools: 'ISRO Bhuvan LISS-IV, Copernicus Sentinel-1/2, NASA Earthdata / Landsat 9, Open-Meteo' },
  { layer: 'Python / ML (Roadmap)', tools: 'Python 3.11+, PyTorch, OpenCV, Hugging Face Transformers, SAM / SAM2' },
];

export const RoadmapAndModelCardsModal: React.FC<RoadmapAndModelCardsModalProps> = ({
  initialTab = 'readme',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'readme' | 'roadmap'>(initialTab);
  const [readmeMode, setReadmeMode] = useState<'formatted' | 'raw'>('formatted');
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopyReadme = () => {
    navigator.clipboard?.writeText(readmeMarkdown).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleDownloadReadme = () => {
    const blob = new Blob([readmeMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'README.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2.5 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">
              BhuChakshu (भू-चक्षु) v2 — Documentation & Roadmap
            </h2>
            <p className="text-[11px] text-slate-400">
              Open-Source Satellite Intelligence · MIT Licensed
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
              <button
                onClick={() => setActiveTab('readme')}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  activeTab === 'readme'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>README.md</span>
              </button>
              <button
                onClick={() => setActiveTab('roadmap')}
                className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  activeTab === 'roadmap'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Roadmap & Models</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              aria-label="Close documentation modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab 1: README.md Viewer */}
        {activeTab === 'readme' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-xs">
            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setReadmeMode('formatted')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                    readmeMode === 'formatted'
                      ? 'bg-slate-800 border-emerald-500/60 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  Formatted View
                </button>
                <button
                  onClick={() => setReadmeMode('raw')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border flex items-center gap-1 ${
                    readmeMode === 'raw'
                      ? 'bg-slate-800 border-emerald-500/60 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Code2 className="w-3 h-3" />
                  <span>Raw Markdown</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="https://github.com/janhvi11-15/Bhu_Chakshu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-200 flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3 text-emerald-400" />
                  <span>GitHub Repo</span>
                </a>
                <button
                  onClick={handleCopyReadme}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-slate-200 flex items-center gap-1"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400" />
                  )}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleDownloadReadme}
                  className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-[11px] font-semibold text-white flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  <span>Download README.md</span>
                </button>
              </div>
            </div>

            {readmeMode === 'raw' ? (
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {readmeMarkdown}
              </pre>
            ) : (
              <div className="space-y-5 text-slate-200 leading-relaxed">
                {/* Banner + Title */}
                <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                  <img
                    src="https://github.com/user-attachments/assets/f037baae-c198-444b-b33a-2ced32010dbd"
                    alt="BhuChakshu Banner"
                    className="w-full h-36 sm:h-44 object-cover"
                  />
                  <div className="p-4 space-y-1.5">
                    <h3 className="text-base sm:text-lg font-bold text-white">
                      BhuChakshu (भू-चक्षु) v2
                    </h3>
                    <p className="text-xs text-emerald-300 font-medium">
                      Twice-verified satellite vision, persona-aware Earth observation AI, and interactive 3D field intelligence.
                    </p>
                    <p className="text-xs text-slate-300">
                      Open-source satellite imagery segmentation combining zero-cost on-device <strong>SAM</strong> edge contouring, multi-spectral physics (<strong>NDVI, NDWI, NDBI, NBR</strong>), and <strong>Gemini multimodal verification</strong> for farmers, geologists, ML practitioners, and disaster analysts.
                    </p>
                  </div>
                </div>

                {/* Problem Statement & What This Does */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Problem Statement
                    </h4>
                    <p className="text-slate-300">
                      Manual land, boundary (<em>meḍh</em>), and crop monitoring across India is slow, fragmented, and costly. Farmers, local surveyors, and disaster teams need a fast, zero-cost way to segment satellite imagery, compute Indian land units (<strong>Bigha, Guntha, Hectares, Acres</strong>), and act on spectral signals.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                    <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Current Status (v2 Live)
                    </h4>
                    <p className="text-slate-300">
                      Weeks 1–3 LLM foundations completed and extended into the live <strong>BhuChakshu v2 full-stack web platform</strong> featuring Pass 1 SAM prompting, Pass 2 Dual-Verification, grounded EO AI, Gemini 3.8 Live Voice, Google Maps AOI Explorer, and interactive 3D Field Ops.
                    </p>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    What BhuChakshu v2 Does
                  </h4>
                  <ul className="space-y-1.5 text-slate-300 list-disc pl-4">
                    <li>
                      <strong>Pass 1 — Zero-Cost On-Device SAM:</strong> Point (+)/(-), bounding box, and whole-scene auto-segmentation with geodesic bund barriers.
                    </li>
                    <li>
                      <strong>Multi-Spectral Workbench:</strong> RGB, CIR, NDVI, NDWI, NDBI, NBR, and Sobel Bund Edge layers with swipe compare and dynamic legend tooltips.
                    </li>
                    <li>
                      <strong>Pass 2 — Twice-Verified EO AI & Voice:</strong> Dual-Verification Auditor, telemetry-grounded bilingual Q&A, and real-time Gemini 3.8 Live voice assistant.
                    </li>
                    <li>
                      <strong>Interactive 3D Field Ops:</strong> Rover exploration with Soil Probe, Canal Sluice Gate, and Geodesic Survey Pegs plus 2D Lite mobile fallback.
                    </li>
                  </ul>
                </div>

                {/* Tech Stack Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Tech Stack
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-[11px] text-slate-400">
                          <th className="p-2.5 font-semibold">Layer</th>
                          <th className="p-2.5 font-semibold">Tools & Services</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
                        {TECH_STACK_ROWS.map((row) => (
                          <tr key={row.layer}>
                            <td className="p-2.5 font-semibold text-white whitespace-nowrap">
                              {row.layer}
                            </td>
                            <td className="p-2.5 text-slate-300">{row.tools}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tech Basket Visual */}
                <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                  <img
                    src="https://github.com/user-attachments/assets/6e60f50d-1e14-407e-8ff8-f773bfdc5a30"
                    alt="BhuChakshu Tech Basket"
                    className="w-full max-h-64 object-cover"
                  />
                </div>

                {/* How to Run */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    How to Run Locally
                  </h4>
                  <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-200 overflow-x-auto">
{`git clone https://github.com/janhvi11-15/Bhu_Chakshu
cd Bhu_Chakshu
npm install
# Add GEMINI_API_KEY & VITE_GOOGLE_MAPS_API_KEY to .env
npm run dev`}
                  </pre>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>License: MIT</span>
                    <span className="italic">Built one evening at a time.</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: 16-Week Roadmap & Model Cards */}
        {activeTab === 'roadmap' && (
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-6 text-xs">
            {/* Revised Week-by-Week Timeline */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Revised Deployment Timeline (Weeks 1–16)</span>
              </h3>
              <div className="space-y-2">
                {V2_ROADMAP.map((item) => (
                  <div
                    key={item.week}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {item.status === 'completed' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        <span className="font-mono font-bold text-white">{item.week}</span>
                        <span className="text-emerald-300 font-semibold">{item.phase}</span>
                      </div>
                      <p className="text-slate-300">{item.deliverables}</p>
                    </div>
                    <div className="text-[11px] text-slate-400 sm:text-right shrink-0 max-w-xs">
                      {item.freeStackNotes}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Model Cards */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                <span>Model Cards & Honest Accuracy Limitations</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {MODEL_CARDS.map((card) => (
                  <div
                    key={card.name}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                  >
                    <div className="font-bold text-white">{card.name}</div>
                    <div className="text-[10px] font-mono text-emerald-400">{card.license}</div>
                    <p className="text-[11px] text-slate-300">{card.role}</p>
                    <p className="text-[10px] text-amber-300/90 border-t border-slate-800 pt-1.5">
                      Limitation: {card.limitations}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Attribution */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Open Data Sources & Attribution</span>
              </h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ISRO Bhuvan LISS-IV · Copernicus Sentinel-1 SAR & Sentinel-2 MSI · NASA Earthdata / Landsat 9 · Open-Meteo Agro-Weather · EuroSAT, DeepGlobe & LandCover.ai open benchmarks · Google Maps Platform.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
