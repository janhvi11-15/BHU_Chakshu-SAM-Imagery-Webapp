import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel, Type } from '@google/genai';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extractReadableError(err: any): { status: number; message: string } {
  const rawStatus = Number(err?.status || err?.code || 500);
  const rawMsg = err?.message || String(err);
  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed?.error) {
      return {
        status: Number(parsed.error.code) || rawStatus || 500,
        message: parsed.error.message || rawMsg,
      };
    }
  } catch {
    // not JSON
  }
  return {
    status: rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500,
    message: rawMsg,
  };
}

function isRetryableGeminiError(err: any): boolean {
  const { status, message } = extractReadableError(err);
  return (
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 504 ||
    message.includes('UNAVAILABLE') ||
    message.includes('high demand') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('timed out')
  );
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

const eoAnalysisCache = new Map<string, { analysis: string; source: string; timestamp: number }>();
const EO_CACHE_TTL_MS = 15 * 60 * 1000;
const EO_CACHE_MAX_ENTRIES = 60;

function getCachedEoAnalysis(key: string) {
  const entry = eoAnalysisCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > EO_CACHE_TTL_MS) {
    eoAnalysisCache.delete(key);
    return null;
  }
  // Refresh LRU order
  eoAnalysisCache.delete(key);
  eoAnalysisCache.set(key, entry);
  return entry;
}

function setCachedEoAnalysis(key: string, analysis: string, source: string) {
  if (eoAnalysisCache.size >= EO_CACHE_MAX_ENTRIES) {
    const oldestKey = eoAnalysisCache.keys().next().value;
    if (oldestKey) eoAnalysisCache.delete(oldestKey);
  }
  eoAnalysisCache.set(key, { analysis, source, timestamp: Date.now() });
}

const modelCooldownUntil = new Map<string, number>();

async function generateWithFallback(
  ai: GoogleGenAI,
  request: {
    contents: any;
    config?: Record<string, any>;
    allowFallback?: boolean;
    useLowThinking?: boolean;
    preferFast?: boolean;
  }
) {
  const baseOrder = request.allowFallback === false
    ? ['gemini-4-hydrogen']
    : request.preferFast
    ? ['gemini-3.1-flash-lite', 'gemini-4-hydrogen']
    : ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

  // Put healthy models (not currently in 60s 503/429 cooldown) first
  const now = Date.now();
  const models = [...baseOrder].sort((a, b) => {
    const aCooling = (modelCooldownUntil.get(a) ?? 0) > now ? 1 : 0;
    const bCooling = (modelCooldownUntil.get(b) ?? 0) > now ? 1 : 0;
    return aCooling - bCooling;
  });

  let lastErr: any = null;
  const attemptNotes: string[] = [];
  for (const model of models) {
    const maxAttempts = model === 'gemini-4-hydrogen' ? 1 : 3;
    const timeoutMs = model === 'gemini-4-hydrogen' ? 7500 : 9500;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const config = { ...(request.config || {}) };
        if (model === 'gemini-4-hydrogen' && request.useLowThinking) {
          config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        } else if (model !== 'gemini-4-hydrogen') {
          delete config.thinkingConfig;
        }
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: request.contents,
            ...(Object.keys(config).length > 0 ? { config } : {}),
          }),
          timeoutMs,
          model
        );
        modelCooldownUntil.delete(model);
        return { response, modelUsed: model };
      } catch (err: any) {
        lastErr = err;
        const readable = extractReadableError(err);
        attemptNotes.push(`${model}#${attempt}:${readable.status}`);
        console.warn(`[Gemini] ${model} attempt ${attempt} failed:`, readable.message);
        if (readable.status === 503 || readable.status === 429) {
          modelCooldownUntil.set(model, Date.now() + 60_000);
        }
        if (!isRetryableGeminiError(err)) {
          throw err;
        }
        if (attempt < maxAttempts) {
          await sleep(400 * attempt + Math.floor(Math.random() * 150));
        }
      }
    }
  }
  if (lastErr && typeof lastErr === 'object') {
    lastErr.attemptTrace = attemptNotes.join(' -> ');
  }
  throw lastErr;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '30mb' }));

  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  let aiLive: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    // Live API (BidiGenerateContent) requires v1beta in @google/genai >= 3.x
    aiLive = new GoogleGenAI({
      apiKey,
      apiVersion: 'v1beta',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasApiKey: !!apiKey,
      hasMapsKey: !!process.env.VITE_GOOGLE_MAPS_API_KEY,
      timestamp: new Date().toISOString(),
      service: 'BhuChakshu v2 Satellite Intelligence Server',
    });
  });

  // Pass 2 Dual-Verification Endpoint (SAM + Spectral Physics + Gemini 4 Hydrogen)
  app.post('/api/verify-satellite', async (req, res) => {
    try {
      const {
        image,
        mimeType = 'image/jpeg',
        regionName,
        coordinates,
        targetClass,
        calculatedArea,
        spectralMetrics,
        samPrompts,
        contourPointsCount,
        persona = 'farmer',
      } = req.body;

      if (!image) {
        return res.status(400).json({ error: 'Image data is required for satellite verification' });
      }

      let base64Data = image;
      let effectiveMime = mimeType;
      if (image.startsWith('data:')) {
        const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          effectiveMime = matches[1];
          base64Data = matches[2];
        } else {
          base64Data = image.split(',')[1] || image;
        }
      }

      if (!ai) {
        return res.status(503).json({
          error: 'Gemini API key is not configured. Please verify GEMINI_API_KEY in Settings > Secrets.',
        });
      }

      const prompt = `You are the Lead Earth Observation (EO) & Geospatial Remote Sensing Scientist at BhuChakshu (National Satellite Land Intelligence).
You are performing Pass 2 of our Dual-Verification Engine (Pass 1 was Meta SAM edge-guided contouring).
Active User Persona Lens: ${persona}

CONTEXT OF ACQUISITION:
- Target Location / Region: ${regionName || 'Satellite Tile'}
- Geo-Coordinates (Lat/Lon): ${coordinates?.lat || 'N/A'}, ${coordinates?.lon || 'N/A'}
- Primary Target Class to Segment: ${targetClass || 'Agricultural Parcel Boundary'}
- SAM Segmented Parcel Area (approx): ${calculatedArea || 'Unknown'} (Contour vertices: ${contourPointsCount || 0})
- Multi-Spectral Pixel Indices:
  * NDVI (Normalized Difference Vegetation Index): ${spectralMetrics?.meanNdvi?.toFixed(3) ?? 'N/A'} (-1.0 to +1.0)
  * NDWI (Normalized Difference Water Index): ${spectralMetrics?.meanNdwi?.toFixed(3) ?? 'N/A'}
  * NDBI (Normalized Difference Built-up Index): ${spectralMetrics?.meanNdbi?.toFixed(3) ?? 'N/A'}
  * Estimated Health/Reflectance: ${spectralMetrics?.vegetationHealth || 'Calculated from bands'}
- SAM Prompting Mode: ${samPrompts?.mode || 'Interactive Points'} (${samPrompts?.positiveCount || 0} positive pins, ${samPrompts?.negativeCount || 0} negative pins)

TASK:
Analyze the satellite image carefully. Correlate visual textures (field bunds, water reflections, soil moisture, building edges, shadows) with the radiometric indices and SAM segmentation.
Detect common satellite SAM failure modes:
1. Cloud shadow misclassified as water reservoir or burnt field
2. Dry fallow red/brown soil misclassified as urban concrete/built-up
3. Mixed pixels on agricultural bunds causing parcel boundary bleed
4. Seasonal flood inundation vs permanent water body
Never claim to predict earthquakes or tsunamis; frame any hazard signal strictly as monitoring indicators with confidence and limitations.`;

      const { response, modelUsed } = await generateWithFallback(ai, {
        useLowThinking: true,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: effectiveMime,
                data: base64Data,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              verificationStatus: {
                type: Type.STRING,
                description: 'VERIFIED_HIGH_CONFIDENCE, VERIFIED_WITH_CAVEATS, or DISPUTED_ANOMALY',
              },
              concordanceScore: { type: Type.NUMBER },
              accuracySummary: { type: Type.STRING },
              samEvaluation: {
                type: Type.OBJECT,
                properties: {
                  boundaryPrecisionScore: { type: Type.NUMBER },
                  leakageOrOverSegmentation: { type: Type.STRING },
                  notes: { type: Type.STRING },
                },
              },
              spectralPhysicalVerification: {
                type: Type.OBJECT,
                properties: {
                  vegetationAnalysis: { type: Type.STRING },
                  waterHydrologyAnalysis: { type: Type.STRING },
                  soilAndUrbanAnalysis: { type: Type.STRING },
                },
              },
              detectedLandClassification: { type: Type.STRING },
              soilMoistureEstimate: { type: Type.STRING },
              cadastralIntegrity: { type: Type.STRING },
              disasterOrRiskIndicators: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              anomaliesOrFalsePositives: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              recommendationsForSurveyor: { type: Type.STRING },
            },
          },
        },
      });

      const rawText = (response.text ?? '{}')
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '')
        .trim();
      const parsed = JSON.parse(rawText);
      return res.json({
        ...parsed,
        modelUsed: `${modelUsed} (Pass 2 Multimodal EO Auditor)`,
      });
    } catch (err: any) {
      console.error('Error during satellite dual-verification:', err);
      const { status, message } = extractReadableError(err);
      res.status(status).json({
        error: `Verification engine failed: ${message}`,
        details: message,
      });
    }
  });

  // Persona-Aware Multi-Spectral Interpreter / Bilingual Q&A
  app.post('/api/analyze-region', async (req, res) => {
    const startedAt = Date.now();
    try {
      const {
        image,
        mimeType = 'image/jpeg',
        question,
        regionName,
        currentBand,
        persona = 'farmer',
        language = 'en-hi',
        sensor,
        gsdMetersPerPixel,
        coordinates,
        spectralMetrics,
        parcelSummary,
        history = [],
      } = req.body;

      if (!image) {
        return res.status(400).json({ error: 'Image required' });
      }
      if (!ai) {
        return res.status(503).json({
          error: 'Gemini API key is not configured. Check Settings > Secrets.',
        });
      }

      let base64Data = image;
      let effectiveMime = mimeType;
      if (image.startsWith('data:')) {
        const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (matches) {
          effectiveMime = matches[1];
          base64Data = matches[2];
        } else {
          base64Data = image.split(',')[1] || image;
        }
      }

      const safeQuestion = String(question || 'Analyze this land parcel and explain what the segmentation reveals.').trim();
      const telemetryBlock = [
        `Region: ${regionName || 'Satellite Observation Tile'}`,
        `Sensor & GSD: ${sensor || 'Sentinel-2 (MSI)'} @ ${gsdMetersPerPixel ?? 10}m/px`,
        coordinates?.lat != null ? `Coordinates: ${Number(coordinates.lat).toFixed(4)}°N, ${Number(coordinates.lon).toFixed(4)}°E` : null,
        `Active Spectral Layer: ${currentBand || 'rgb'}`,
        spectralMetrics
          ? `Scene Indices -> NDVI: ${Number(spectralMetrics.meanNdvi).toFixed(3)}, NDWI: ${Number(spectralMetrics.meanNdwi).toFixed(3)}, NDBI: ${Number(spectralMetrics.meanNdbi).toFixed(3)}`
          : null,
        parcelSummary
          ? `Active SAM Parcel -> Class: ${parcelSummary.classification}, Area: ${parcelSummary.areaHectares} ha (${parcelSummary.areaAcres} acres / ${parcelSummary.areaBigha} Bigha), Perimeter: ${parcelSummary.perimeterMeters}m, Parcel NDVI: ${parcelSummary.meanNdvi}, Confidence: ${parcelSummary.confidence}%`
          : 'Active SAM Parcel: None drawn yet (analyzing full tile scene)',
      ]
        .filter(Boolean)
        .join('\n');

      const safeHistory = Array.isArray(history)
        ? history
            .slice(-4)
            .filter((h: any) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
        : [];

      // Cache first-turn / identical telemetry queries for zero-latency repeat accuracy
      const cacheKey =
        safeHistory.length === 0
          ? crypto
              .createHash('sha256')
              .update(
                JSON.stringify({
                  q: safeQuestion.toLowerCase(),
                  regionName,
                  currentBand,
                  persona,
                  language,
                  telemetryBlock,
                  imgLen: base64Data.length,
                  imgSample: base64Data.slice(0, 256),
                })
              )
              .digest('hex')
          : null;

      if (cacheKey) {
        const cached = getCachedEoAnalysis(cacheKey);
        if (cached) {
          return res.json({
            analysis: cached.analysis,
            source: cached.source,
            cached: true,
            latencyMs: Date.now() - startedAt,
          });
        }
      }

      const personaInstructions: Record<string, string> = {
        farmer:
          'Speak directly to an Indian farmer in warm, actionable language. Structure your answer concisely into: 1) Key Findings (English bullets citing exact NDVI/NDWI/area numbers), 2) Actionable Next Step (irrigation/crop health), 3) सरल हिंदी सारांश (2-3 crisp lines in Devanagari), and 4) Confidence & Limitations.',
        geologist:
          'Analyze geomorphology, slope gradient, structural lineaments, bare rock vs alluvial soil exposure (NDBI/NDVI), erosion gullies, and landslide scar cues. Cite exact index values and end with Confidence % & Limitations.',
        astrophysicist:
          'Explain orbital Earth-observation radiometry: sun-synchronous reflectance, chlorophyll red-edge spectroscopy (B8/B4), water NIR absorption, and planetary albedo. Cite exact index values and end with Confidence % & Limitations.',
        sam_ml:
          'Evaluate SAM zero-shot segmentation performance: bund gradient barriers, mixed-pixel boundary bleed, IoU estimation, and fine-tuning adapters (EuroSAT/DeepGlobe/LandCover.ai). Cite exact metrics and end with Confidence % & Limitations.',
        remote_sensing:
          'Provide crisp remote sensing diagnostics referencing Sentinel-2/LISS-IV spectral bands (B2/B3/B4/B8/B11), exact NDVI/NDWI/NDBI readings, GSD resolution, and mixed-pixel caveats with Confidence %.',
        calamity:
          'Assess change-detection hazard indicators (flood extent, slope scar, burn ratio, coastal shift) using the visual tile and NDWI/NDVI metrics. Include Confidence % and explicitly state this is a satellite monitoring indicator, not an official warning or earthquake/tsunami prediction.',
      };

      const historyText =
        safeHistory.length > 0
          ? `\nPrevious conversation context:\n${safeHistory
              .map((h: any) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content.slice(0, 260)}`)
              .join('\n')}\n`
          : '';

      const prompt = `ROLE & ACCURACY RULES:
You are the BhuChakshu v2 Geospatial & Earth Observation AI Specialist.
Active Persona: ${persona} (${language})
Guidance: ${personaInstructions[persona] || personaInstructions.farmer}
Strict Accuracy Rules:
- Anchor your visual reading in the exact telemetry numbers provided; never invent contradictory coordinates or parcel areas.
- Keep responses focused, crisp, and scannable (under ~220 words unless user explicitly asks for exhaustive detail).
- Always state an honest confidence percentage and brief radiometric/cloud/GSD limitation.

TELEMETRY & SEGMENTATION CONTEXT:
${telemetryBlock}${historyText}

USER QUESTION:
${safeQuestion}`;

      const { response, modelUsed } = await generateWithFallback(ai, {
        useLowThinking: true,
        preferFast: true,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: effectiveMime,
                data: base64Data,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          temperature: 0.35,
          maxOutputTokens: 700,
        },
      });

      const analysisText = (response.text ?? '').trim();
      if (cacheKey && analysisText) {
        setCachedEoAnalysis(cacheKey, analysisText, modelUsed);
      }

      return res.json({
        analysis: analysisText,
        source: modelUsed,
        cached: false,
        latencyMs: Date.now() - startedAt,
      });
    } catch (err: any) {
      console.error('Error analyzing region:', err);
      const { status, message } = extractReadableError(err);
      res.status(status).json({
        error: `EO AI error: ${message}`,
        details: message,
        attemptTrace: err?.attemptTrace || undefined,
      });
    }
  });

  // Google Maps Grounding Endpoint using gemini-4-hydrogen + googleMaps tool
  app.post('/api/maps-grounding', async (req, res) => {
    try {
      const { query, lat, lon, persona = 'farmer' } = req.body;
      if (!ai) {
        return res.status(503).json({
          error: 'Gemini API key is not configured for Maps Grounding.',
        });
      }

      const safeLat = typeof lat === 'number' ? lat : 30.901;
      const safeLon = typeof lon === 'number' ? lon : 75.8573;

      const personaQueryFallback: Record<string, string> = {
        farmer: 'Find nearby Krishi Vigyan Kendra, agricultural mandis, irrigation canals, and soil testing labs near this location.',
        geologist: 'Find nearby geological formations, river basins, quarries, or elevation landmarks near this location.',
        calamity: 'Find nearby disaster management centers, flood relief shelters, meteorological stations, and hospitals near this location.',
        astrophysicist: 'Find nearby space observatories, ISRO centers, planetariums, or clear-sky geography landmarks near this location.',
        sam_ml: 'Find nearby university geospatial labs, GIS centers, or agricultural research institutes near this location.',
        remote_sensing: 'Find nearby remote sensing centers, meteorological stations, and major water reservoirs near this location.',
      };

      const effectiveQuery = query?.trim() || personaQueryFallback[persona] || personaQueryFallback.farmer;

      const { response, modelUsed } = await generateWithFallback(ai, {
        allowFallback: false,
        contents: effectiveQuery,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: safeLat,
                longitude: safeLon,
              },
            },
          },
        },
      });

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const places = groundingChunks
        .filter((chunk: any) => chunk.maps)
        .map((chunk: any) => ({
          title: chunk.maps.title || 'Google Maps Place',
          uri: chunk.maps.uri,
          placeId: chunk.maps.placeId,
          reviewSnippets: chunk.maps.placeAnswerSources?.reviewSnippets ?? [],
        }));

      return res.json({
        text: response.text ?? '',
        places,
        modelUsed: `${modelUsed} (Maps Grounding)`,
      });
    } catch (err: any) {
      console.error('Error in Maps Grounding:', err);
      const { status, message } = extractReadableError(err);
      res.status(status).json({
        error: `Google Maps grounding failed: ${message}`,
        details: message,
      });
    }
  });

  // Live Free Weather & Soil Moisture Outlook via Open-Meteo (No API key required)
  app.get('/api/weather-outlook', async (req, res) => {
    try {
      const lat = parseFloat(String(req.query.lat ?? '30.901'));
      const lon = parseFloat(String(req.query.lon ?? '75.8573'));

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,soil_moisture_0_to_7cm&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration&timezone=auto&forecast_days=7`;
      const weatherRes = await fetch(url);
      if (!weatherRes.ok) {
        throw new Error(`Open-Meteo returned ${weatherRes.status}`);
      }
      const data = await weatherRes.json();
      res.json({
        source: 'Open-Meteo (Free Open Agro-Meteorological Feed)',
        lat,
        lon,
        current: data.current ?? null,
        daily: data.daily ?? null,
        units: data.current_units ?? null,
      });
    } catch (err: any) {
      console.error('Open-Meteo fetch error:', err);
      res.status(500).json({ error: 'Weather outlook unavailable', details: err?.message });
    }
  });

  // WebSocket Bridge for Gemini 3.8 Live API Real-Time Voice Conversations (/live)
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', async (clientWs: WebSocket, req) => {
    if (!aiLive) {
      clientWs.send(JSON.stringify({ error: 'GEMINI_API_KEY not configured on server.' }));
      clientWs.close();
      return;
    }

    const urlObj = new URL(req.url || '/live', `http://${req.headers.host || 'localhost'}`);
    const persona = urlObj.searchParams.get('persona') || 'farmer';
    const region = urlObj.searchParams.get('region') || 'India Satellite Tile';
    const ndvi = urlObj.searchParams.get('ndvi') || '0.45';

    const systemInstructionsByPersona: Record<string, string> = {
      farmer: `You are BhuChakshu Voice Sahayak (भू-चक्षु सहायक), a warm, knowledgeable agricultural & satellite companion speaking with a farmer about "${region}" (mean NDVI: ${ndvi}). Speak naturally in simple Hindi and English (or Hinglish) as requested by the user. Give clear, practical crop-health, irrigation, and seasonal tips, and always remind them that satellite estimates have confidence bounds.`,
      geologist: `You are BhuChakshu Geomorphology Voice Assistant analyzing "${region}" (mean NDVI: ${ndvi}). Discuss terrain relief, rock/soil exposure, lineaments, and erosion indicators concisely.`,
      calamity: `You are BhuChakshu Calamity Monitoring Voice Analyst for "${region}". Discuss flood inundation, landslide scars, and change detection indicators carefully. Always clarify you provide monitoring indicators, not official warnings or earthquake/tsunami predictions.`,
      sam_ml: `You are BhuChakshu SAM & ML Vision Copilot for "${region}". Discuss zero-shot segmentation prompts, geodesic boundary tolerance, IoU, and spectral labeling concisely.`,
      remote_sensing: `You are BhuChakshu Remote Sensing Specialist for "${region}". Discuss Sentinel-2/LISS-IV bands, NDVI/NDWI/NDBI indices, and atmospheric correction concisely.`,
      astrophysicist: `You are BhuChakshu Earth-Observation & Space Science Guide for "${region}". Discuss orbital sensors, spectral absorption physics, and Earth-as-a-planet comparisons concisely.`,
    };

    let session: any = null;
    let clientClosed = false;

    clientWs.on('close', () => {
      clientClosed = true;
      try {
        session?.close();
      } catch {
        // ignore close error
      }
    });

    try {
      session = await aiLive.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            systemInstructionsByPersona[persona] || systemInstructionsByPersona.farmer,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;
            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onerror: (e: any) => {
            console.error('Gemini Live error:', e);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ error: e?.message || 'Live session error' }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ closed: true }));
            }
          },
        },
      });

      if (clientClosed) {
        try {
          session?.close();
        } catch {
          // ignore
        }
        return;
      }

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ ready: true }));
      }
    } catch (err: any) {
      console.error('Failed to connect Gemini Live session:', err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: err?.message || 'Failed to start Live voice session' }));
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (raw) => {
      if (!session || clientClosed) return;
      try {
        const payload = JSON.parse(raw.toString());
        if (payload.audio) {
          session.sendRealtimeInput({
            audio: { data: payload.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (payload.text) {
          session.sendRealtimeInput({
            text: payload.text,
          });
        }
      } catch (err) {
        console.error('Live WS message error:', err);
      }
    });
  });

  // Mount Vite middleware in development or static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`BhuChakshu v2 server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
