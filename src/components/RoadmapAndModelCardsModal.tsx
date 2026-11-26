import React from 'react';
import { MODEL_CARDS, V2_ROADMAP } from '../data/personas';
import { Calendar, Cpu, Database, X, CheckCircle2, Clock } from 'lucide-react';

interface RoadmapAndModelCardsModalProps {
  onClose: () => void;
}

export const RoadmapAndModelCardsModal: React.FC<RoadmapAndModelCardsModalProps> = ({
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[88vh] shadow-2xl flex flex-col overflow-hidden">
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white">
              BhuChakshu v2 — Revised 16-Week Roadmap, Model Cards & Limitations
            </h2>
            <p className="text-[11px] text-slate-400">
              Extending Weeks 1–3 · Solo Student 1 hr/day Free-Tier Build Plan
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 text-xs">
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
      </div>
    </div>
  );
};
