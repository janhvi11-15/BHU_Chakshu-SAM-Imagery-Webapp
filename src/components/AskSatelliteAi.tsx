import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Zap,
  Layers,
  Copy,
  Check,
} from 'lucide-react';
import {
  ParcelPolygon,
  SatelliteTilePreset,
  SpectralBand,
  UserPersona,
} from '../types/satellite';

interface AskSatelliteAiProps {
  preset: SatelliteTilePreset;
  activeBand: SpectralBand;
  persona: UserPersona;
  imageUrl: string;
  sceneMetrics: { meanNdvi: number; meanNdwi: number; meanNdbi: number };
  activeParcel: ParcelPolygon | null;
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  source?: string;
  cached?: boolean;
  latencyMs?: number;
}

async function compressTileForVision(srcUrl: string, maxDim = 448): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scale = Math.min(
          1,
          maxDim / Math.max(img.naturalWidth || maxDim, img.naturalHeight || maxDim)
        );
        const w = Math.max(1, Math.round((img.naturalWidth || maxDim) * scale));
        const h = Math.max(1, Math.round((img.naturalHeight || maxDim) * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(srcUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } catch {
        resolve(srcUrl);
      }
    };
    img.onerror = () => resolve(srcUrl);
    img.src = srcUrl;
  });
}

const PERSONA_QUICK_QUESTIONS: Record<UserPersona, string[]> = {
  farmer: [
    'Explain this land in simple Hindi and English with irrigation advice.',
    'Check crop vigor (NDVI), soil moisture, and Kharif/Rabi outlook.',
    'What does the segmented parcel area (Bigha/Hectare) tell me?',
  ],
  geologist: [
    'Analyze slope relief, structural lineaments, and rock/soil exposure.',
    'Check NDBI & NDVI contrast for erosion gullies or alluvial fans.',
    'What ground deformation or landslide scar cues are visible?',
  ],
  astrophysicist: [
    'Explain chlorophyll red-edge reflectance & albedo in this tile.',
    'How does Sentinel-2 / LISS-IV capture this spectral signature?',
    'Compare surface energy balance across water, vegetation, and soil.',
  ],
  sam_ml: [
    'Evaluate SAM zero-shot bund boundary clarity and IoU risks.',
    'Where could mixed-pixel edge bleed occur in this tile?',
    'Suggest EuroSAT / DeepGlobe fine-tuning strategies for this terrain.',
  ],
  remote_sensing: [
    'Interpret exact NDVI, NDWI, and NDBI metrics at current GSD.',
    'Diagnose spectral confusion between dry soil, urban, and shadows.',
    'Assess L2A reflectance suitability for cadastral vectorization.',
  ],
  calamity: [
    'Check flood inundation (NDWI), burn scar, or landslide indicators.',
    'What confidence level & false-positive caveats apply to this scan?',
    'Recommend ground verification steps for local disaster teams.',
  ],
};

export const AskSatelliteAi: React.FC<AskSatelliteAiProps> = ({
  preset,
  activeBand,
  persona,
  imageUrl,
  sceneMetrics,
  activeParcel,
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Namaste! I am your BhuChakshu v2 Earth Observation Specialist for **${preset.name}** (${preset.sensor}) in **${persona.replace('_', ' ')}** mode. Ask in Hindi or English—your live NDVI, NDWI, NDBI & parcel metrics are grounded automatically.`,
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<{ message: string; query: string } | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const compressedTileCacheRef = useRef<Record<string, string>>({});
  const scrollEndRef = useRef<HTMLDivElement>(null);

  // Pre-warm compressed tile whenever imageUrl changes
  useEffect(() => {
    let active = true;
    if (imageUrl && !compressedTileCacheRef.current[imageUrl]) {
      compressTileForVision(imageUrl, 448).then((compressed) => {
        if (active) {
          compressedTileCacheRef.current[imageUrl] = compressed;
        }
      });
    }
    return () => {
      active = false;
    };
  }, [imageUrl]);

  // Auto-scroll when messages arrive
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sampleQuestions = useMemo(
    () => PERSONA_QUICK_QUESTIONS[persona] || PERSONA_QUICK_QUESTIONS.farmer,
    [persona]
  );

  const parcelSummary = useMemo(() => {
    if (!activeParcel) return null;
    return {
      classification: activeParcel.classification,
      areaHectares: activeParcel.areaHectares,
      areaAcres: activeParcel.areaAcres,
      areaBigha: activeParcel.areaBigha,
      perimeterMeters: activeParcel.perimeterMeters,
      meanNdvi: activeParcel.spectralMetrics.meanNdvi,
      confidence: activeParcel.confidence,
    };
  }, [activeParcel]);

  const runAnalysisRequest = async (
    question: string,
    compressedImage: string,
    history: Message[]
  ) => {
    const res = await fetch('/api/analyze-region', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: compressedImage,
        regionName: `${preset.name} (${preset.state})`,
        currentBand: activeBand,
        persona,
        question,
        sensor: preset.sensor,
        gsdMetersPerPixel: preset.gsdMetersPerPixel,
        coordinates: preset.coordinates,
        spectralMetrics: sceneMetrics,
        parcelSummary,
        history: history.slice(-4).map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const rawText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { error: rawText || `Server returned HTTP ${res.status}` };
    }
    return { ok: res.ok, status: res.status, data };
  };

  const handleSend = async (questionText?: string, isRetry = false) => {
    const textToSend = (questionText || input).trim();
    if (!textToSend || loading) return;

    const historySnapshot = messages;
    if (!isRetry) {
      const userMsg: Message = { role: 'user', content: textToSend };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
    }
    setRequestError(null);
    setRetryStatus(null);
    setLoading(true);

    try {
      const compressedImage =
        compressedTileCacheRef.current[imageUrl] ||
        (await compressTileForVision(imageUrl, 448));
      compressedTileCacheRef.current[imageUrl] = compressedImage;

      let result = await runAnalysisRequest(textToSend, compressedImage, historySnapshot);

      // Up to 2 automatic exponential retries on transient 503/429 upstream spikes
      for (let retry = 1; retry <= 2 && !result.ok && (result.status === 503 || result.status === 429); retry++) {
        setRetryStatus(`Switching to fast route (attempt ${retry + 1}/3)...`);
        await new Promise((r) => setTimeout(r, 750 * retry));
        result = await runAnalysisRequest(textToSend, compressedImage, historySnapshot);
      }

      if (result.ok && result.data.analysis) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: result.data.analysis,
            source: result.data.source,
            cached: !!result.data.cached,
            latencyMs: result.data.latencyMs,
          },
        ]);
      } else {
        setRequestError({
          message:
            result.status === 429
              ? 'Free-tier AI rate/daily limit reached right now. Wait a few seconds and tap Retry, or check Settings > Secrets.'
              : result.status === 503
              ? 'EO AI service is experiencing temporary high demand. Tap Retry to re-run.'
              : result.data.details || result.data.error || 'Unable to analyze satellite imagery right now.',
          query: textToSend,
        });
      }
    } catch (err: any) {
      setRequestError({
        message: err?.message || 'Unable to reach EO analysis server.',
        query: textToSend,
      });
    } finally {
      setRetryStatus(null);
      setLoading(false);
    }
  };

  const handleCopy = (content: string, idx: number) => {
    navigator.clipboard?.writeText(content).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 max-w-full bg-slate-900/95 border-l border-slate-800 shadow-2xl flex flex-col">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <div>
            <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Earth Observation AI
            </h2>
            <span className="text-[10px] text-slate-400">
              Grounded Dual-Route EO · {persona.replace('_', ' ')} lens
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Live Grounded Telemetry Context Strip */}
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-slate-300">
        <span className="flex items-center gap-1 text-cyan-300">
          <Layers className="w-3 h-3" />
          {activeBand.toUpperCase()}
        </span>
        <span className="text-emerald-400">NDVI {sceneMetrics.meanNdvi.toFixed(2)}</span>
        <span className="text-sky-400">NDWI {sceneMetrics.meanNdwi.toFixed(2)}</span>
        <span className="text-amber-300">NDBI {sceneMetrics.meanNdbi.toFixed(2)}</span>
        {activeParcel && (
          <span className="text-emerald-300">
            Parcel: {activeParcel.areaHectares}ha ({activeParcel.areaBigha} Bigha)
          </span>
        )}
      </div>

      <div className="p-3 border-b border-slate-800/80 bg-slate-950/40 space-y-1.5">
        <span className="text-[10px] text-slate-400 font-medium block">
          Quick Inquiries ({persona.replace('_', ' ')}):
        </span>
        <div className="space-y-1">
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={loading}
              className="w-full text-left p-1.5 rounded bg-slate-900 hover:bg-slate-800 disabled:opacity-50 border border-slate-800 text-[11px] text-slate-300 hover:text-cyan-300 truncate transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-md bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                <Bot className="w-3.5 h-3.5" />
              </div>
            )}
            <div
              className={`p-3 rounded-xl text-xs max-w-[85%] leading-relaxed ${
                m.role === 'user'
                  ? 'bg-emerald-600 text-white rounded-tr-none'
                  : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none whitespace-pre-wrap'
              }`}
            >
              <div>{m.content}</div>
              {m.role === 'assistant' && m.source && (
                <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between gap-2 text-[10px] text-slate-400 font-mono">
                  <span className="flex items-center gap-1">
                    {m.cached && <Zap className="w-2.5 h-2.5 text-amber-400" />}
                    <span>
                      {m.source}
                      {m.cached ? ' · Cached' : ''}
                      {typeof m.latencyMs === 'number' ? ` · ${(m.latencyMs / 1000).toFixed(1)}s` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(m.content, idx)}
                    className="text-slate-400 hover:text-cyan-300 flex items-center gap-0.5"
                    title="Copy response"
                  >
                    {copiedIdx === idx ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-6 h-6 rounded-md bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <User className="w-3.5 h-3.5" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-cyan-400 p-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{retryStatus || 'Analyzing tile + spectral metrics...'}</span>
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {requestError && (
        <div className="mx-3 mb-2 p-2.5 rounded-lg bg-amber-950/70 border border-amber-700/70 text-[11px] text-amber-200 flex items-center justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{requestError.message}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleSend(requestError.query, true)}
              disabled={loading}
              className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
            <button
              type="button"
              onClick={() => setRequestError(null)}
              className="p-1 text-amber-300 hover:text-white"
              aria-label="Dismiss error"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <div className="p-3 border-t border-slate-800 bg-slate-950">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask in Hindi or English..."
            disabled={loading}
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="p-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
