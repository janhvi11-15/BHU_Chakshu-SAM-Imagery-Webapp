import { GameMission, UserPersona } from '../types/satellite';

export interface PersonaConfig {
  id: UserPersona;
  name: string;
  nameHi: string;
  tagline: string;
  taglineHi: string;
  focusLayers: string[];
  accentColor: string;
  voicePromptHint: string;
}

export const PERSONA_CONFIGS: PersonaConfig[] = [
  {
    id: 'farmer',
    name: 'Farmer (Farmer’s Eye)',
    nameHi: 'किसान दृष्टि',
    tagline: 'Field boundaries, water sources, crop health & Kharif/Rabi outlook in Hindi & English',
    taglineHi: 'खेत की मेड़, पानी के स्रोत, फसल स्वास्थ्य और अगले मौसम की सलाह',
    focusLayers: ['Crop Vigor (NDVI)', 'Canal / Moisture (NDWI)', 'Bigha & Guntha Area'],
    accentColor: 'emerald',
    voicePromptHint: 'Ask in Hindi or English: "मेरी फसल कैसी है?" or "When should I irrigate?"',
  },
  {
    id: 'geologist',
    name: 'Geologist',
    nameHi: 'भू-वैज्ञानिक',
    tagline: 'Terrain relief, structural lineaments, bare rock/soil exposure & slope erosion',
    taglineHi: 'ढलान, चट्टान व मिट्टी का उभार और भू-कटाव संकेतक',
    focusLayers: ['DEM Relief', 'Bare Soil & Rock (NDBI)', 'Edge Lineaments'],
    accentColor: 'amber',
    voicePromptHint: 'Ask about alluvial fans, slope instability, or exposed bedrock.',
  },
  {
    id: 'astrophysicist',
    name: 'Astrophysicist & Space',
    nameHi: 'अंतरिक्ष विज्ञान',
    tagline: 'Orbital sensor physics, chlorophyll red-edge spectroscopy & planetary albedo',
    taglineHi: 'सैटेलाइट सेंसर भौतिकी और ग्रह परावर्तन (Albedo)',
    focusLayers: ['CIR Red-Edge (B8)', 'Spectral Albedo', 'Sensor Geometry'],
    accentColor: 'purple',
    voicePromptHint: 'Ask how sun-synchronous Sentinel-2 MSI measures chlorophyll at 780nm.',
  },
  {
    id: 'sam_ml',
    name: 'SAM / ML Practitioner',
    nameHi: 'SAM / ML विशेषज्ञ',
    tagline: 'Point/box prompts, geodesic edge barriers, IoU & open-dataset adapters',
    taglineHi: 'सेगमेंटेशन मास्क, प्रॉम्प्ट टॉलरेंस और मॉडल कार्ड',
    focusLayers: ['SAM Contour Graph', 'Bund Gradient Barrier', 'EuroSAT / DeepGlobe'],
    accentColor: 'sky',
    voicePromptHint: 'Ask about fine-tuning SAM2 on LandCover.ai or reducing bund bleed.',
  },
  {
    id: 'remote_sensing',
    name: 'Remote Sensing Expert',
    nameHi: 'सुदूर संवेदन विशेषज्ञ',
    tagline: 'Multispectral bands (B2/B3/B4/B8), L2A radiometric indices, GSD & CRS',
    taglineHi: 'स्पेक्ट्रल बैंड, NDVI/NDWI/NDBI और EPSG मेटाडेटा',
    focusLayers: ['NDVI / NDWI / NDBI', 'Sobel Bund Edges', 'RFC 7946 GeoJSON'],
    accentColor: 'cyan',
    voicePromptHint: 'Ask about atmospheric scattering or MNDWI vs NDWI water thresholds.',
  },
  {
    id: 'calamity',
    name: 'Calamity Analyst',
    nameHi: 'आपदा विश्लेषक',
    tagline: 'Before/after change indicators for floods, landslides, burn scars & coastlines',
    taglineHi: 'बाढ़, भूस्खलन और पराली आग परिवर्तन संकेतक',
    focusLayers: ['Change Delta (SAR/Opt)', 'Flood / Burn Masks', 'IMD & INCOIS Links'],
    accentColor: 'rose',
    voicePromptHint: 'Ask about flood extent anomalies or landslide scar demarcation.',
  },
];

export const GAME_MISSIONS: GameMission[] = [
  {
    id: 'mission-water',
    title: 'Locate the Water Source',
    titleHi: 'जल स्रोत खोजें',
    description: 'Walk or fly across the 3D terrain to inspect the irrigation canal / water reservoir basin.',
    targetType: 'water',
    xpReward: 120,
    badgeName: 'Jal-Mitra Scout',
    targetWorldPos: { x: -8, z: 6 },
  },
  {
    id: 'mission-stress',
    title: 'Spot the Stressed Crop Plot',
    titleHi: 'तनावग्रस्त फसल पहचानें',
    description: 'Find the dry/stressed soil sector with low NDVI vigor and check moisture hints.',
    targetType: 'stressed_crop',
    xpReward: 150,
    badgeName: 'Fasal Rakshak',
    targetWorldPos: { x: 9, z: -7 },
  },
  {
    id: 'mission-boundary',
    title: 'Verify the Hazard / Bund Boundary',
    titleHi: 'सीमा व आपदा क्षेत्र जांचें',
    description: 'Reach the elevated ridge / bund beacon to verify elevation slope and drainage runoff.',
    targetType: 'flood_boundary',
    xpReward: 180,
    badgeName: 'Bhu-Rakshak Sentinel',
    targetWorldPos: { x: -10, z: -10 },
  },
];

export interface RoadmapWeek {
  week: string;
  phase: string;
  status: 'completed' | 'active' | 'planned';
  focus: string;
  deliverables: string;
  freeStackNotes: string;
}

export const V2_ROADMAP: RoadmapWeek[] = [
  {
    week: 'Weeks 1–3',
    phase: 'Foundation (Completed)',
    status: 'completed',
    focus: 'LLM APIs, Multimodal Prompting & Embeddings',
    deliverables: 'Hugging Face Inference API calls, SentenceTransformers similarity search, prompt engineering basics.',
    freeStackNotes: '100% Free Tier (HF Inference + local CPU embeddings).',
  },
  {
    week: 'Weeks 4–5',
    phase: 'Geo-Ingestion & RAG Agents',
    status: 'active',
    focus: 'Satellite Tile Ingestion & Spectral Math',
    deliverables: 'STAC API search (Copernicus/Earthdata), cloud masking (SCL band), NDVI/NDWI/NDBI/BSI raster math, agro-weather RAG.',
    freeStackNotes: 'Planetary Computer / Copernicus Data Space free API + Open-Meteo.',
  },
  {
    week: 'Weeks 6–7',
    phase: 'SAM / SAM2 Fine-Tuning & Adapters',
    status: 'planned',
    focus: 'Domain Adaptation for Agricultural Bunds',
    deliverables: 'SAM/SAM2 automatic mask generation + LoRA/adapter experiments on EuroSAT, DeepGlobe & LandCover.ai.',
    freeStackNotes: 'Google Colab Free T4 GPU / Kaggle 30h/wk GPU.',
  },
  {
    week: 'Weeks 8–9',
    phase: '3D Terrain & Persona UX',
    status: 'planned',
    focus: 'Farmer’s Eye 3D + Bilingual Voice Sahayak',
    deliverables: 'Three.js DEM terrain draping, WASD Walk-Your-Field mode, persona switching, Hindi/English voice assistant.',
    freeStackNotes: 'Browser WebGL + SRTM/Copernicus 30m DEM + Gemini Live API.',
  },
  {
    week: 'Weeks 10–12',
    phase: 'Calamity Change Monitoring & SAR',
    status: 'planned',
    focus: 'Before/After Optical + Sentinel-1 SAR',
    deliverables: 'Flood inundation & burn-scar change detection, time-lapse sequence scrubber, IMD/INCOIS/USGS links.',
    freeStackNotes: 'Sentinel-1 GRD free scenes; note: true InSAR phase unwrapping needs heavy RAM (flag for cloud burst).',
  },
  {
    week: 'Weeks 13–14',
    phase: 'Game Missions & PWA Hardening',
    status: 'planned',
    focus: 'Offline Field Mode & Interactive Quests',
    deliverables: 'Service Worker tile caching, 2D lightweight fallback for low-end Android phones, interactive quests & badges.',
    freeStackNotes: 'Vite PWA + IndexedDB tile cache + Cloudflare Pages / HF Spaces.',
  },
  {
    week: 'Weeks 15–16',
    phase: 'v2 Evaluation, Model Cards & Public Reveal',
    status: 'planned',
    focus: 'Benchmarking & Community Pilot',
    deliverables: 'IoU validation vs ground-truth plots, farmer usability feedback, model cards, open-source v2 launch.',
    freeStackNotes: 'GitHub Releases + HF Spaces Gradio/FastAPI + Vercel/Cloud Run.',
  },
];

export const MODEL_CARDS = [
  {
    name: 'On-Device Geodesic SAM Simulator (Pass 1)',
    license: 'Open-Source / MIT (Client JS)',
    role: 'Zero-cost interactive parcel contouring using spectral distance & Sobel bund barriers.',
    limitations: 'Operates on visible/synthesized bands in-browser; production GeoTIFF multi-band inference uses PyTorch SAM2 on Colab/HF Spaces.',
  },
  {
    name: 'Gemini 4 Hydrogen + Google Maps Grounding (Pass 2)',
    license: 'Google AI / Gemini API Terms',
    role: 'Multimodal Earth-Observation verification, bilingual Hindi/English advisory, and nearby agri/disaster place lookup.',
    limitations: 'AI interpretations include confidence estimates and must not replace certified revenue surveys or official IMD/INCOIS warnings.',
  },
  {
    name: 'Gemini 3.8 Live (Real-Time Voice Sahayak)',
    license: 'Google AI Live API',
    role: 'Low-latency 16kHz/24kHz voice Q&A for farmers and analysts in Hindi & English.',
    limitations: 'Requires active network connection and microphone permission.',
  },
];
