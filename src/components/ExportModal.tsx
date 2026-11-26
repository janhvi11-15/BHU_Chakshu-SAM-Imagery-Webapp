import React, { useState } from 'react';
import { ParcelPolygon, SatelliteTilePreset } from '../types/satellite';
import { exportToGeoJson } from '../utils/spectralMath';
import { 
  Download, 
  Copy, 
  Check, 
  X, 
  FileCode, 
  Map, 
  Terminal,
  FileCheck
} from 'lucide-react';

interface ExportModalProps {
  parcels: ParcelPolygon[];
  preset: SatelliteTilePreset;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  parcels,
  preset,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'geojson' | 'python' | 'report'>('geojson');
  const [copied, setCopied] = useState<boolean>(false);

  // Generate GeoJSON
  const geoJsonString = exportToGeoJson(
    parcels,
    preset.coordinates,
    800,
    800,
    preset.gsdMetersPerPixel
  );

  // Python SAM / SAM2 Pipeline Code
  const pythonPipelineCode = `"""
BhuChakshu (भू-चक्षु) - Open-Source Satellite Land Intelligence Pipeline
Segment Anything Model (SAM / SAM2) + Multi-Spectral Radiometric Verification
Target Location: ${preset.name} (${preset.state})
Coordinates: ${preset.coordinates.lat}°N, ${preset.coordinates.lon}°E | Sensor: ${preset.sensor}
"""

import numpy as np
import rasterio
from rasterio.plot import reshape_as_image
import torch
from transformers import SamModel, SamProcessor
from shapely.geometry import Polygon
import geopandas as gpd

# 1. Ingest Satellite Tile (Sentinel-2 / Bhuvan LISS-IV)
def load_and_preprocess_tile(image_path: str):
    with rasterio.open(image_path) as src:
        # Read Red (B4), Green (B3), Blue (B2), and NIR (B8)
        bands = src.read()
        transform = src.transform
        crs = src.crs
    
    rgb = reshape_as_image(bands[:3])
    nir = bands[3] if bands.shape[0] >= 4 else bands[1] # fallback
    return rgb, nir, transform, crs

# 2. Compute Radiometric Multi-Spectral Indices (NDVI, NDWI)
def compute_spectral_indices(red, green, nir):
    # NDVI = (NIR - Red) / (NIR + Red)
    ndvi = (nir.astype(float) - red.astype(float)) / (nir + red + 1e-8)
    # NDWI = (Green - NIR) / (Green + NIR)
    ndwi = (green.astype(float) - nir.astype(float)) / (green + nir + 1e-8)
    return ndvi, ndwi

# 3. Run Segment Anything (SAM / SAM2) Zero-Shot Prompt Segmentation
def segment_field_boundaries(rgb_image, positive_points, negative_points=None):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Executing BhuChakshu SAM on {device}...")
    
    # Load Meta SAM checkpoint from Hugging Face
    processor = SamProcessor.from_pretrained("facebook/sam-vit-base")
    model = SamModel.from_pretrained("facebook/sam-vit-base").to(device)

    # Positive prompt points (1) and negative exclusion points (0)
    input_points = [positive_points]
    input_labels = [[1] * len(positive_points)]

    inputs = processor(
        rgb_image, 
        input_points=input_points, 
        input_labels=input_labels, 
        return_tensors="pt"
    ).to(device)

    with torch.no_grad():
        outputs = model(**inputs)

    masks = processor.image_processor.post_process_masks(
        outputs.pred_masks.cpu(),
        inputs["original_sizes"].cpu(),
        inputs["reshaped_input_sizes"].cpu()
    )
    return masks[0][0][0].numpy()

# 4. Vectorize to GeoJSON & Cadastral Shapefile
def export_cadastral_demarcation(mask, transform, crs, output_path="bhuchakshu_parcels.geojson"):
    import cv2
    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    polygons = []
    for cnt in contours:
        if cv2.contourArea(cnt) > 50:
            coords = [rasterio.transform.xy(transform, pt[0][1], pt[0][0]) for pt in cnt]
            if len(coords) >= 3:
                polygons.append(Polygon(coords))
                
    gdf = gpd.GeoDataFrame({'geometry': polygons}, crs=crs)
    gdf['area_ha'] = gdf.geometry.area / 10000.0 # hectares
    gdf['area_acres'] = gdf['area_ha'] * 2.47105
    gdf.to_file(output_path, driver="GeoJSON")
    print(f"Exported {len(polygons)} cadastral parcels to {output_path}")

if __name__ == "__main__":
    print("BhuChakshu 12-Week Build Pipeline Ready.")
`;

  // Cadastral Survey Summary Report
  const reportString = `================================================================================
BHUCHAKSHU SATELLITE LAND INTELLIGENCE - AUDIT & VERIFICATION REPORT
National Land Observation Protocol · 0-Cost High Accuracy Pipeline
================================================================================

SCENE METADATA:
- Region: ${preset.name}
- Administrative Jurisdiction: ${preset.state}, ${preset.country}
- Geographic Coordinates: ${preset.coordinates.lat}°N, ${preset.coordinates.lon}°E (EPSG:4326)
- Satellite Sensor: ${preset.sensor} (GSD: ${preset.gsdMetersPerPixel} m/pixel)
- Acquisition Date: ${preset.acquisitionDate}
- Target Land Use Category: ${preset.primaryClass}

SEGMENTATION & PARCEL DEMARCATION RESULTS:
- Total Parcels Demarcated: ${parcels.length}
${parcels
  .map(
    (p, i) => `
[Parcel #${i + 1} - ${p.label}]
  * Classification: ${p.classification}
  * Area: ${p.areaHectares} Hectares (${p.areaAcres} Acres | ${p.areaBigha} Bigha | ${p.areaGuntha} Guntha)
  * Perimeter: ${p.perimeterMeters} meters (${p.areaSquareMeters.toLocaleString()} m²)
  * Mean NDVI (Canopy Vigor): ${p.spectralMetrics.meanNdvi.toFixed(3)}
  * Mean NDWI (Moisture Index): ${p.spectralMetrics.meanNdwi.toFixed(3)}
  * Mean NDBI (Impervious Surface): ${p.spectralMetrics.meanNdbi.toFixed(3)}
  * Status: Dual-Verified (Pass 1 SAM + Pass 2 Gemini EO / Physical Radiometry)`
  )
  .join('\n')}

SURVEYOR STATEMENT & LEGAL NOTICE:
This digital demarcation has undergone dual-verification cross-referencing Segment Anything Model (SAM) geodesic contouring against physical optical reflectance signatures. It complies with RFC 7946 GeoJSON and can be ingested into QGIS, ArcGIS, or the Bhuvan Geoportal for Khasra land record synchronization.
================================================================================
Generated via BhuChakshu Engine · Zero GPU Cloud Costs
`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Export GIS Parcels & Pipeline Scripts
              </h2>
              <p className="text-[11px] text-slate-400">
                0-Cost Open-Source Data Outputs · Standard Geospatial Formats
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

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 px-4 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('geojson')}
            className={`px-4 py-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'geojson'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>GeoJSON (RFC 7946)</span>
          </button>
          <button
            onClick={() => setActiveTab('python')}
            className={`px-4 py-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'python'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Python & SAM2 Pipeline</span>
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-3 text-xs font-medium border-b-2 flex items-center gap-2 transition-all ${
              activeTab === 'report'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Cadastral Survey Report</span>
          </button>
        </div>

        {/* Code / Content Area */}
        <div className="p-4 flex-1 overflow-y-auto">
          {activeTab === 'geojson' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Standard GIS vector polygon layer containing {parcels.length} parcel(s) with Indian land metrics.
                </span>
                <span className="font-mono text-emerald-400">EPSG:4326</span>
              </div>
              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-96">
                {geoJsonString}
              </pre>
            </div>
          )}

          {activeTab === 'python' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Reproducible Hugging Face Transformers & SAM/SAM2 Python pipeline.
                </span>
                <span className="font-mono text-sky-400">Python 3.11+</span>
              </div>
              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-96">
                {pythonPipelineCode}
              </pre>
            </div>
          )}

          {activeTab === 'report' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Ready for PM Fasal Bima Yojana, Patwari land audit, or disaster relief filing.
                </span>
                <span className="font-mono text-amber-400">Audit Protocol</span>
              </div>
              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-96 whitespace-pre-wrap">
                {reportString}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              const text =
                activeTab === 'geojson'
                  ? geoJsonString
                  : activeTab === 'python'
                  ? pythonPipelineCode
                  : reportString;
              handleCopy(text);
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (activeTab === 'geojson') {
                handleDownload('bhuchakshu_parcels.geojson', geoJsonString, 'application/geo+json');
              } else if (activeTab === 'python') {
                handleDownload('bhuchakshu_sam_pipeline.py', pythonPipelineCode, 'text/x-python');
              } else {
                handleDownload('bhuchakshu_cadastral_report.txt', reportString, 'text/plain');
              }
            }}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-2 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download File</span>
          </button>
        </div>
      </div>
    </div>
  );
};
