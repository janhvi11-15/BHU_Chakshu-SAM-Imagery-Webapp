export type SpectralBand = 
  | 'rgb'          // Natural True Color (B4-B3-B2)
  | 'cir'          // Color Infrared (B8-B4-B3) - Vegetation vigor
  | 'ndvi'         // Normalized Difference Vegetation Index
  | 'ndwi'         // Normalized Difference Water Index
  | 'ndbi'         // Normalized Difference Built-up Index
  | 'nbr'          // Normalized Burn Ratio / Soil moisture
  | 'edge';        // Cadastral Bund & Edge Gradient

export type UserPersona =
  | 'farmer'
  | 'geologist'
  | 'astrophysicist'
  | 'sam_ml'
  | 'remote_sensing'
  | 'calamity';

export type WorkspaceMode = 'workbench' | 'map' | 'explore3d' | 'calamity';

export type DepthLevel = 'local' | 'professional';

export type ScenarioCondition = 'normal' | 'monsoon_flood' | 'severe_drought';

export interface GeoCoordinate {
  lat: number;
  lon: number;
  crs: string; // e.g. "EPSG:4326"
}

export interface SatelliteTilePreset {
  id: string;
  name: string;
  state: string;
  country: string;
  coordinates: GeoCoordinate;
  sensor: 'Sentinel-2 (MSI)' | 'Bhuvan LISS-IV' | 'Landsat 9 (OLI-2)' | 'PlanetScope';
  gsdMetersPerPixel: number; // Ground Sampling Distance (e.g. 10m or 5m)
  acquisitionDate: string;
  description: string;
  primaryClass: 'Agriculture' | 'Water & Aquaculture' | 'Disaster / Landslide' | 'Peri-Urban' | 'Mangrove Forest' | 'Arid / Infrastructure';
  thumbnailUrl: string;
  initialZoom: number;
}

export interface SamPointPrompt {
  id: string;
  x: number; // pixel coordinate on original image
  y: number;
  isPositive: boolean; // true = foreground target, false = background exclusion
}

export interface SamBoxPrompt {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface ParcelPolygon {
  id: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
  areaSquareMeters: number;
  areaHectares: number;
  areaAcres: number;
  areaBigha: number; // Indian land unit (1 Hectare ≈ 3.95 Bigha)
  areaGuntha: number; // 1 Acre = 40 Guntha
  perimeterMeters: number;
  spectralMetrics: {
    meanNdvi: number;
    meanNdwi: number;
    meanNdbi: number;
    vegetationHealth: string;
  };
  classification: string;
  confidence: number;
}

export interface DualVerificationReport {
  verificationStatus: 'VERIFIED_HIGH_CONFIDENCE' | 'VERIFIED_WITH_CAVEATS' | 'DISPUTED_ANOMALY';
  concordanceScore: number;
  accuracySummary: string;
  samEvaluation: {
    boundaryPrecisionScore: number;
    leakageOrOverSegmentation: string;
    notes: string;
  };
  spectralPhysicalVerification: {
    vegetationAnalysis: string;
    waterHydrologyAnalysis: string;
    soilAndUrbanAnalysis: string;
  };
  detectedLandClassification: string;
  soilMoistureEstimate: string;
  cadastralIntegrity: string;
  disasterOrRiskIndicators: string[];
  anomaliesOrFalsePositives: string[];
  recommendationsForSurveyor: string;
  modelUsed?: string;
  verifiedAt: string;
  auditHash: string;
}

export interface WeatherOutlookData {
  source: string;
  lat: number;
  lon: number;
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    wind_speed_10m: number;
    soil_moisture_0_to_7cm?: number;
  } | null;
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    et0_fao_evapotranspiration?: number[];
  } | null;
}

export interface MapsGroundingPlace {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets?: { uri?: string; title?: string }[];
}

export interface GameMission {
  id: string;
  title: string;
  titleHi: string;
  description: string;
  targetType: 'water' | 'stressed_crop' | 'flood_boundary' | 'soil_ridge';
  xpReward: number;
  badgeName: string;
  targetWorldPos: { x: number; z: number };
}
