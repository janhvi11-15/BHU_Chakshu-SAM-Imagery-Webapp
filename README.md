# BhuChakshu (भू-चक्षु) v2 🛰️

> Twice-verified satellite vision, persona-aware Earth observation AI, and interactive 3D field intelligence

BhuChakshu (**भू-चक्षु** — *"the Earth's eye"*) is an open-source satellite imagery segmentation and land-intelligence platform combining zero-cost edge **Segment Anything (SAM)** contouring, multi-spectral physics (**NDVI, NDWI, NDBI, NBR, Sobel Bund Edges**), and **Gemini multimodal verification** for farmers, geologists, remote-sensing engineers, ML practitioners, and disaster analysts.

---

<a target="_blank" href="https://github.com/janhvi11-15/BHU_Chakshu-SAM-Imagery-Webapp">
   "<img width="1280" height="640" alt="https___github com_janhvi11-15_BHU_Chakshu-SAM-Imagery-Webapp" src="https://github.com/user-attachments/assets/3f92ed21-7dff-4f33-990b-666083840141" />
" />
</a>

## Problem Statement

Manual land, boundary (*meḍh*), and crop monitoring across India is slow, fragmented, and costly. Farmers, local surveyors, and disaster response teams lack a fast, accessible, and transparent way to segment satellite imagery, convert measurements into local land units (*Bigha*, *Guntha*, *Hectares*, *Acres*), and translate spectral signals into actionable guidance.

## What BhuChakshu v2 Does

- **Pass 1 — Zero-Cost On-Device SAM Prompting**: Target (`+`), exclude (`-`), bounding-box prompts, and whole-scene auto-segmentation with geodesic bund barriers and instant Indian land-unit conversion (*Hectares, Acres, Bigha, Guntha*).
- **Multi-Spectral Workbench**: Real-time switching across **True Color (RGB)**, **Color Infrared (CIR)**, **NDVI**, **NDWI**, **NDBI**, **Burn/Moisture (NBR)**, and **Bund & Boundary Edge**, complete with split-screen swipe comparison and interactive legend tooltips.
- **Pass 2 — Twice-Verified EO AI & Live Voice Sahayak**:
  - **Dual-Verification Auditor** cross-checks SAM contours against spectral physics to flag cloud-shadow/water or dry-soil/urban confusion.
  - **Earth Observation AI Drawer** answers bilingual Hindi + English queries grounded in live NDVI/NDWI/NDBI and active parcel metrics.
  - **Live Voice Assistant** provides real-time audio Q&A over WebSocket (`gemini-3.8-live`).
- **6 Persona-Aware Lenses**: Switch seamlessly between **Farmer (किसान दृष्टि)**, **Geologist**, **Astrophysicist**, **SAM / ML Practitioner**, **Remote Sensing Expert**, and **Calamity Analyst**.
- **Interactive 3D Field Ops (`WalkField3D`)**: Drive a Scout Rover across DEM terrain draped with the segmented satellite tile using **Soil & NDVI Probe**, **Canal Sluice Gate & Irrigation Valve**, and **Geodesic Survey Pegs**, plus a **2D Lite** mode for low-end mobile devices.
- **Google Maps AOI Explorer & GIS Export**: Browse real-world coordinates, run nearby agricultural/disaster place grounding, and export RFC 7946 **GeoJSON** or starter Python **SAM2** scripts.

## Status

🚀 **v2 Interactive Web App Active** — Extending the original 12-week Python/SAM roadmap into a **16-week full-stack v2 plan**:
- **Weeks 1–3 (Completed)**: LLM foundations, multimodal prompting, and embedding similarity search.
- **v2 Web Platform (Shipped in App)**: Interactive SAM workbench, multi-spectral math, Dual-Verification, bilingual EO AI & Live Voice, 3D Field Ops, Open-Meteo agro-weather, Google Maps AOI explorer, and offline-capable PWA.
- **Weeks 4–16 (In Progress / Planned)**: Copernicus/Earthdata STAC ingestion, SAM2 LoRA fine-tuning on EuroSAT/DeepGlobe/LandCover.ai, Sentinel-1 SAR change pipelines, and field benchmarking.

## Tech Stack

| Layer | Tools & Services |
| --- | --- |
| Frontend & UI | React 19, TypeScript, Tailwind CSS v4, Vite 8, Lucide Icons |
| 3D Terrain & Maps | Three.js (`OrbitControls`, `RoomEnvironment`), `@vis.gl/react-google-maps` |
| AI & Live Voice | `@google/genai` (Gemini 4 Hydrogen, Gemini 3.1 Flash Lite, Gemini 3.8 Live) |
| Backend Server | Node.js, Express, `ws` WebSocket bridge, response caching |
| Satellite & Weather Data | ISRO Bhuvan LISS-IV, Copernicus Sentinel-1/2, NASA Earthdata / Landsat 9, Open-Meteo |
| Python / ML Pipeline (Roadmap) | Python 3.11+, PyTorch, OpenCV, Hugging Face Transformers, SAM / SAM2 |

<img width="1920" height="1080" alt="Tech basket" src="https://github.com/user-attachments/assets/6e60f50d-1e14-407e-8ff8-f773bfdc5a30" />

## Repository Structure

```
bhuchakshu/
├── index.html                           # App entry HTML & PWA metadata
├── server.ts                            # Express API (/api/verify-satellite, /api/analyze-region, /api/maps-grounding, /api/weather-outlook) + /live WebSocket
├── public/favicon.ico                   # App icon
├── src/
│   ├── App.tsx                          # Responsive workbench, Maps, 3D Field Ops & Calamity coordinator
│   ├── components/
│   │   ├── Header.tsx                   # Mode tabs, testbed & persona switchers, AI/Voice/Docs triggers
│   │   ├── SatelliteCanvas.tsx          # Multi-spectral canvas, swipe compare, SAM prompt pins & contours
│   │   ├── SpectralToolbox.tsx          # Spectral band selector & opacity/split controls
│   │   ├── SpectralLegendOverlay.tsx    # Dynamic NDVI/NDWI/NDBI legend & agricultural metric tooltips
│   │   ├── SamPromptControls.tsx        # Point (+)/(-), box prompt & auto-segment controls
│   │   ├── CadastralInspector.tsx       # Persona lens card, Bigha/Guntha/Ha stats & Dual-Verify trigger
│   │   ├── AskSatelliteAi.tsx           # Grounded multimodal EO AI chat drawer
│   │   ├── LiveVoiceAssistant.tsx       # Real-time bidirectional voice assistant
│   │   ├── WalkField3D.tsx              # Three.js interactive task-and-doer field simulation + 2D Lite
│   │   ├── GoogleMapExplorer.tsx        # Interactive map AOI launcher & Maps Grounding
│   │   ├── CalamityChangeMonitor.tsx    # Optical + SAR disaster change indicators & IMD/INCOIS links
│   │   ├── FarmerWeatherPanel.tsx       # Open-Meteo 7-day agro-weather & speech readout
│   │   └── RoadmapAndModelCardsModal.tsx# In-app README.md viewer, 16-week roadmap & model cards
│   ├── data/
│   │   ├── personas.ts                  # 6 user personas, 3D field missions, v2 roadmap & model cards
│   │   └── satellitePresets.ts          # India satellite testbeds (Punjab, Godavari, Wayanad, etc.)
│   ├── types/satellite.ts               # Core TypeScript interfaces
│   └── utils/
│       ├── spectralMath.ts              # Client-side spectral band transforms, geodesic SAM & GeoJSON export
│       └── satelliteImageGenerator.ts   # Procedural multi-biome satellite testbed tile generator
└── README.md
```

## How to Run Locally

```bash
git clone https://github.com/janhvi11-15/Bhu_Chakshu
cd Bhu_Chakshu
npm install
```

Create a `.env` file (see `.env.example`):

```env
GEMINI_API_KEY="your_gemini_api_key"
VITE_GOOGLE_MAPS_API_KEY="your_google_maps_api_key"
```

Start the full-stack server (Express + Vite on port `3000`):

```bash
npm run dev
```

Build for production:

```bash
npm run build
npm start
```

## License

MIT — see `[LICENSE](LICENSE)`.

---

*Built one evening at a time.*
                                               <h2>Build / Developed/ Designed with 🫰<h2/>
