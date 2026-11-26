import React, { useState } from 'react';
import { SatelliteTilePreset } from '../types/satellite';
import { Upload, X, MapPin, Image as ImageIcon, Sliders } from 'lucide-react';

interface CustomUploadModalProps {
  onUploadComplete: (preset: SatelliteTilePreset) => void;
  onClose: () => void;
}

export const CustomUploadModal: React.FC<CustomUploadModalProps> = ({
  onUploadComplete,
  onClose,
}) => {
  const [name, setName] = useState<string>('Custom Survey Tile');
  const [lat, setLat] = useState<number>(28.6139);
  const [lon, setLon] = useState<number>(77.209);
  const [gsd, setGsd] = useState<number>(10);
  const [sensor, setSensor] = useState<'Sentinel-2 (MSI)' | 'Bhuvan LISS-IV' | 'Landsat 9 (OLI-2)' | 'PlanetScope'>('Sentinel-2 (MSI)');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPreviewUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewUrl) return;

    const customPreset: SatelliteTilePreset = {
      id: `custom-${Date.now()}`,
      name,
      state: 'User Ingested',
      country: 'Custom Geospatial Region',
      coordinates: {
        lat,
        lon,
        crs: 'EPSG:4326',
      },
      sensor,
      gsdMetersPerPixel: gsd,
      acquisitionDate: new Date().toISOString().split('T')[0],
      description: `User-uploaded satellite or drone tile calibrated at ${gsd}m/pixel. Ready for dual-verified SAM parcel demarcation.`,
      primaryClass: 'Agriculture',
      thumbnailUrl: previewUrl,
      initialZoom: 1,
    };

    onUploadComplete(customPreset);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Ingest Custom Satellite / Drone Tile
              </h2>
              <p className="text-[11px] text-slate-400">
                Processed locally at 0 cost in your browser
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* File Upload Area */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Select Satellite Imagery (PNG, JPG, GeoTIFF Preview)
            </label>
            <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-950/40 relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                required
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {previewUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded-lg border border-slate-700"
                  />
                  <div className="text-left text-xs">
                    <span className="font-semibold text-emerald-400 block">Image Loaded</span>
                    <span className="text-slate-400 text-[11px]">Click or drag to replace</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <ImageIcon className="w-8 h-8 text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-300 font-medium">
                    Click to browse or drop tile here
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Bhuvan, Sentinel-2, Landsat, or Drone Orthomosaic
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Name & Sensor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Region / Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Sensor Platform</label>
              <select
                value={sensor}
                onChange={(e) => setSensor(e.target.value as any)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="Sentinel-2 (MSI)">Sentinel-2 (MSI)</option>
                <option value="Bhuvan LISS-IV">Bhuvan LISS-IV</option>
                <option value="Landsat 9 (OLI-2)">Landsat 9 (OLI-2)</option>
                <option value="PlanetScope">PlanetScope / Drone</option>
              </select>
            </div>
          </div>

          {/* Spatial Calibration (GSD & Coordinates) */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Spatial Calibration
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Latitude (°N)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-slate-200"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Longitude (°E)</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lon}
                  onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-slate-200"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Resolution (m/px)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={gsd}
                  onChange={(e) => setGsd(parseFloat(e.target.value) || 10)}
                  className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-emerald-400"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={!previewUrl}
            className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Load into BhuChakshu Workbench</span>
          </button>
        </form>
      </div>
    </div>
  );
};
