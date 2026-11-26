import React from 'react';
import { DualVerificationReport, ParcelPolygon, SatelliteTilePreset } from '../types/satellite';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Printer, 
  Download, 
  Check, 
  FileCheck2,
  ExternalLink,
  Cpu,
  Layers,
  Sparkles
} from 'lucide-react';

interface DualVerificationModalProps {
  report: DualVerificationReport;
  activeParcel: ParcelPolygon;
  preset: SatelliteTilePreset;
  onClose: () => void;
}

export const DualVerificationModal: React.FC<DualVerificationModalProps> = ({
  report,
  activeParcel,
  preset,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const isVerified = report.verificationStatus === 'VERIFIED_HIGH_CONFIDENCE';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Dual-Verification Land Intelligence Certificate</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded">
                  AUTHENTICATED
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                BhuChakshu Geospatial Trust Protocol · Pass 1 (SAM) + Pass 2 (Spectral Physics & Gemini EO)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Certificate Body */}
        <div className="p-6 overflow-y-auto space-y-6 print:p-0">
          {/* Top Verification Hero Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-base font-bold text-white">
                  Ground-Truth Concordance: {report.concordanceScore}%
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                {report.accuracySummary}
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] text-slate-400 font-mono block">AUDIT STAMP</span>
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                {report.auditHash}
              </span>
            </div>
          </div>

          {/* Dual-Verification Cross-Check Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pass 1: SAM Model Edge Precision */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Pass 1: SAM Geodesic Boundary
                  </span>
                </div>
                <span className="text-xs font-mono text-sky-400 font-semibold">
                  {report.samEvaluation.boundaryPrecisionScore}% Score
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Bund Bleed / Leakage:</span>
                  <span className="text-emerald-400 font-medium">
                    {report.samEvaluation.leakageOrOverSegmentation}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {report.samEvaluation.notes}
                </p>
              </div>
            </div>

            {/* Pass 2: Radiometric & Multimodal EO Auditor */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200">
                    Pass 2: Physical Radiometric Audit
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  {report.modelUsed?.split(' ')[0] || 'Gemini 4 Hydrogen'}
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Vegetation Chlorophyll:</span>
                  <span className="text-emerald-400 font-medium">
                    NDVI {activeParcel.spectralMetrics.meanNdvi.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Soil Moisture Regime:</span>
                  <span className="text-cyan-400 font-medium">
                    {report.soilMoistureEstimate}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {report.spectralPhysicalVerification.vegetationAnalysis}
                </p>
              </div>
            </div>
          </div>

          {/* Cadastral Land & Survey Details */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Cadastral Demarcation Summary</span>
              <span className="text-slate-400 text-[11px] font-mono font-normal">
                EPSG:4326 · {preset.sensor}
              </span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Classification</span>
                <span className="text-xs font-bold text-emerald-400">
                  {report.detectedLandClassification}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Area (Hectares)</span>
                <span className="text-xs font-bold text-white font-mono">
                  {activeParcel.areaHectares} ha
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Area (Acres)</span>
                <span className="text-xs font-bold text-white font-mono">
                  {activeParcel.areaAcres} ac
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block">Area (Bigha)</span>
                <span className="text-xs font-bold text-amber-300 font-mono">
                  {activeParcel.areaBigha} Bigha
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1">
              <span className="font-semibold text-emerald-400 block">
                Cadastral Integrity Verdict:
              </span>
              <p className="text-[11px] text-slate-300">
                {report.cadastralIntegrity}
              </p>
            </div>
          </div>

          {/* Anomaly & Risk Check */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800 space-y-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              False-Positive Anomaly Filter
            </h3>
            <div className="space-y-1.5">
              {report.anomaliesOrFalsePositives.length > 0 ? (
                report.anomaliesOrFalsePositives.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-emerald-300">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-300">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>No spectral cloud shadows, false bund bleed, or water misclassifications detected.</span>
                </div>
              )}
            </div>

            <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-800/80">
              <strong className="text-slate-300">Surveyor Directive: </strong>
              {report.recommendationsForSurveyor}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[10px] text-slate-400 font-mono">
            Verified {report.verifiedAt} · BhuChakshu Core
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Certificate</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
