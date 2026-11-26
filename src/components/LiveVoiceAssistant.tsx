import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2, X, Radio, Send } from 'lucide-react';
import { UserPersona } from '../types/satellite';

interface LiveVoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  persona: UserPersona;
  regionName: string;
  meanNdvi: number;
}

interface TranscriptEntry {
  id: string;
  speaker: 'you' | 'bhuchakshu' | 'system';
  text: string;
}

function floatTo16BitPCMBase64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function downsampleBuffer(
  input: Float32Array,
  inputRate: number,
  targetRate = 16000
): Float32Array {
  if (inputRate === targetRate || inputRate <= 0) return input;
  const ratio = inputRate / targetRate;
  const newLength = Math.max(1, Math.round(input.length / ratio));
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      count++;
    }
    result[i] = count > 0 ? sum / count : input[Math.min(start, input.length - 1)];
  }
  return result;
}

export const LiveVoiceAssistant: React.FC<LiveVoiceAssistantProps> = ({
  isOpen,
  onClose,
  persona,
  regionName,
  meanNdvi,
}) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [quickText, setQuickText] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isMutedRef = useRef<boolean>(false);
  const isLiveReadyRef = useRef<boolean>(false);
  const hasErrorRef = useRef<boolean>(false);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const stopPlaybackQueue = () => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // ignore already stopped
      }
    }
    activeSourcesRef.current = [];
    if (outputCtxRef.current) {
      nextStartTimeRef.current = outputCtxRef.current.currentTime;
    }
  };

  const playPcm24kChunk = (base64Audio: string) => {
    const ctx = outputCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const pcm16 = base64ToInt16Array(base64Audio);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) {
      float32[i] = pcm16[i] / 32768;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    activeSourcesRef.current.push(source);
    source.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
    };
  };

  const cleanupSession = (preserveError = false) => {
    isLiveReadyRef.current = false;
    stopPlaybackQueue();
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      outputCtxRef.current.close().catch(() => {});
      outputCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    }
    if (!preserveError) {
      setStatus('idle');
    }
  };

  useEffect(() => {
    if (!isOpen) {
      hasErrorRef.current = false;
      setErrorMsg('');
      cleanupSession(false);
    }
    return () => {
      cleanupSession(false);
    };
  }, [isOpen]);

  const startLiveSession = async () => {
    cleanupSession(false);
    hasErrorRef.current = false;
    setErrorMsg('');
    setStatus('connecting');
    setTranscripts([
      {
        id: `sys-${Date.now()}`,
        speaker: 'system',
        text: `Connecting Voice Sahayak (gemini-3.8-live) for ${regionName}...`,
      },
    ]);

    try {
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      await inputCtx.resume();
      await outputCtx.resume();
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const params = new URLSearchParams({
        persona,
        region: regionName,
        ndvi: meanNdvi.toFixed(2),
      });
      const ws = new WebSocket(`${protocol}//${window.location.host}/live?${params.toString()}`);
      wsRef.current = ws;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        if (isMutedRef.current || !isLiveReadyRef.current) return;
        if (wsRef.current?.readyState !== WebSocket.OPEN) return;
        const rawSamples = e.inputBuffer.getChannelData(0);
        const resampled = downsampleBuffer(rawSamples, inputCtx.sampleRate, 16000);
        const base64 = floatTo16BitPCMBase64(resampled);
        wsRef.current.send(JSON.stringify({ audio: base64 }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.ready) {
          isLiveReadyRef.current = true;
          setStatus('live');
          setTranscripts((prev) => [
            ...prev,
            {
              id: `ready-${Date.now()}`,
              speaker: 'system',
              text: 'Live! Speak in Hindi or English (e.g., "मेरी फसल कैसी है?" or "Explain water boundaries").',
            },
          ]);
        }
        if (msg.audio) {
          playPcm24kChunk(msg.audio);
        }
        if (msg.interrupted) {
          stopPlaybackQueue();
        }
        if (msg.inputTranscript) {
          setTranscripts((prev) => [
            ...prev.slice(-14),
            { id: `u-${Date.now()}-${Math.random()}`, speaker: 'you', text: msg.inputTranscript },
          ]);
        }
        if (msg.outputTranscript) {
          setTranscripts((prev) => [
            ...prev.slice(-14),
            {
              id: `a-${Date.now()}-${Math.random()}`,
              speaker: 'bhuchakshu',
              text: msg.outputTranscript,
            },
          ]);
        }
        if (msg.error) {
          hasErrorRef.current = true;
          isLiveReadyRef.current = false;
          setStatus('error');
          setErrorMsg(msg.error);
          cleanupSession(true);
        }
        if (msg.closed && !hasErrorRef.current) {
          cleanupSession(false);
        }
      };

      ws.onerror = () => {
        hasErrorRef.current = true;
        setStatus('error');
        setErrorMsg('WebSocket connection error. Verify microphone permission and server status.');
        cleanupSession(true);
      };

      ws.onclose = () => {
        isLiveReadyRef.current = false;
        if (!hasErrorRef.current) {
          setStatus('idle');
        }
      };
    } catch (err: any) {
      hasErrorRef.current = true;
      setStatus('error');
      setErrorMsg(err?.message || 'Microphone access denied or Live API unavailable.');
      cleanupSession(true);
    }
  };

  const sendTextTurn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickText.trim() || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text: quickText.trim() }));
    setTranscripts((prev) => [
      ...prev.slice(-14),
      { id: `ut-${Date.now()}`, speaker: 'you', text: quickText.trim() },
    ]);
    setQuickText('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-96 max-w-[92vw] rounded-2xl bg-slate-900 border border-emerald-500/40 shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${status === 'live' ? 'text-emerald-400' : 'text-slate-400'}`} />
          <div>
            <h3 className="text-xs font-bold text-white">
              BhuChakshu Voice Sahayak (भू-चक्षु Live)
            </h3>
            <p className="text-[10px] text-slate-400">
              Gemini 3.8 Live · {persona.replace('_', ' ')} lens
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Transcript Feed */}
      <div className="p-3 h-56 overflow-y-auto space-y-2 bg-slate-950/60 text-xs">
        {transcripts.length === 0 && (
          <div className="text-slate-400 text-center py-10 space-y-2">
            <Volume2 className="w-8 h-8 mx-auto text-emerald-500/60" />
            <p className="font-medium text-slate-200">Real-Time Bilingual Voice Copilot</p>
            <p className="text-[11px] text-slate-400">
              Talk naturally in Hindi or English about field health, irrigation, terrain, or flood indicators.
            </p>
          </div>
        )}
        {transcripts.map((t) => (
          <div
            key={t.id}
            className={`p-2 rounded-lg leading-relaxed ${
              t.speaker === 'you'
                ? 'bg-emerald-950/60 border border-emerald-700/40 text-emerald-100 ml-6'
                : t.speaker === 'bhuchakshu'
                ? 'bg-slate-900 border border-slate-800 text-slate-200 mr-6'
                : 'text-[11px] text-cyan-300 text-center'
            }`}
          >
            {t.speaker !== 'system' && (
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
                {t.speaker === 'you' ? 'You' : 'BhuChakshu Voice'}
              </span>
            )}
            {t.text}
          </div>
        ))}
        {errorMsg && (
          <div className="p-2 rounded bg-rose-950/70 border border-rose-700 text-rose-200 text-[11px]">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
        {status === 'live' && (
          <form onSubmit={sendTextTurn} className="flex items-center gap-1.5">
            <input
              type="text"
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder="Or type message to voice AI..."
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        <div className="flex items-center justify-between gap-2">
          {status !== 'live' ? (
            <button
              onClick={startLiveSession}
              disabled={status === 'connecting'}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-2"
            >
              <Mic className="w-4 h-4" />
              <span>{status === 'connecting' ? 'Connecting Mic & Live API...' : 'Start Live Voice Conversation'}</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => setIsMuted((m) => !m)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 border ${
                  isMuted
                    ? 'bg-amber-950/70 border-amber-600 text-amber-300'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                <span>{isMuted ? 'Mic Muted' : 'Mic Live'}</span>
              </button>
              <button
                onClick={() => cleanupSession(false)}
                className="px-4 py-2 rounded-lg bg-rose-700 hover:bg-rose-600 text-xs font-semibold text-white"
              >
                End Call
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
