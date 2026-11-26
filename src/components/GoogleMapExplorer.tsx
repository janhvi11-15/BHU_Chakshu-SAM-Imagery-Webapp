import React, { useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useApiLoadingStatus,
  APILoadingStatus,
} from '@vis.gl/react-google-maps';
import {
  GeoCoordinate,
  MapsGroundingPlace,
  SatelliteTilePreset,
  UserPersona,
} from '../types/satellite';
import {
  MapPin,
  Search,
  ExternalLink,
  Compass,
  Layers,
  Loader2,
  Navigation,
} from 'lucide-react';

interface GoogleMapExplorerProps {
  presets: SatelliteTilePreset[];
  currentPreset: SatelliteTilePreset;
  persona: UserPersona;
  onSelectPreset: (preset: SatelliteTilePreset) => void;
  onLaunchScanAtCoords: (coords: GeoCoordinate, label: string) => void;
}

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const MapStatusGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 p-6 text-center">
        <div className="max-w-md space-y-2 rounded-xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm font-semibold text-amber-300">
            Interactive Satellite Map Unavailable
          </p>
          <p className="text-xs text-slate-400">
            Verify that Google Maps Platform is enabled and quota limits have not been exceeded. You can still use the SAM Workbench and 3D Field Explorer offline.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

export const GoogleMapExplorer: React.FC<GoogleMapExplorerProps> = ({
  presets,
  currentPreset,
  persona,
  onSelectPreset,
  onLaunchScanAtCoords,
}) => {
  const [selectedPin, setSelectedPin] = useState<SatelliteTilePreset | null>(currentPreset);
  const [customPin, setCustomPin] = useState<{ lat: number; lng: number } | null>(null);
  const [latInput, setLatInput] = useState<string>(String(currentPreset.coordinates.lat));
  const [lonInput, setLonInput] = useState<string>(String(currentPreset.coordinates.lon));

  // Google Maps Grounding state
  const [groundingQuery, setGroundingQuery] = useState<string>('');
  const [groundingLoading, setGroundingLoading] = useState<boolean>(false);
  const [groundingText, setGroundingText] = useState<string>('');
  const [groundingPlaces, setGroundingPlaces] = useState<MapsGroundingPlace[]>([]);
  const [groundingError, setGroundingError] = useState<string>('');

  const activeCenter = customPin
    ? customPin
    : { lat: currentPreset.coordinates.lat, lng: currentPreset.coordinates.lon };

  const handleRunGrounding = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGroundingLoading(true);
    setGroundingError('');

    try {
      const res = await fetch('/api/maps-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: groundingQuery,
          lat: activeCenter.lat,
          lon: activeCenter.lng,
          persona,
        }),
      });
      const data = await res.json();
      if (
        res.status === 429 ||
        data?.error?.status === 'RESOURCE_EXHAUSTED' ||
        String(data?.error || '').includes('RESOURCE_EXHAUSTED')
      ) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
      if (!res.ok) {
        throw new Error(data.error || 'Maps grounding failed');
      }
      setGroundingText(data.text || '');
      setGroundingPlaces(Array.isArray(data.places) ? data.places : []);
    } catch (err: any) {
      setGroundingError(err?.message || 'Unable to query Google Maps grounding.');
    } finally {
      setGroundingLoading(false);
    }
  };

  const handleJumpCoords = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(latInput);
    const lng = parseFloat(lonInput);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      setCustomPin({ lat, lng });
      setSelectedPin(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full w-full overflow-hidden bg-slate-950">
      {/* Left: Interactive Google Maps Satellite Stage */}
      <div className="flex-1 relative min-h-[380px] h-full">
        {!MAPS_API_KEY ? (
          <div className="w-full h-full flex items-center justify-center bg-slate-950 p-6">
            <div className="max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 text-center space-y-2">
              <MapPin className="w-8 h-8 text-amber-400 mx-auto" />
              <h3 className="text-sm font-bold text-white">Google Maps Key Pending</h3>
              <p className="text-xs text-slate-400">
                Restart the dev server or refresh after Maps provisioning so <code>VITE_GOOGLE_MAPS_API_KEY</code> is loaded into the browser.
              </p>
            </div>
          </div>
        ) : (
          <APIProvider apiKey={MAPS_API_KEY} language="en" region="IN">
            <MapStatusGuard>
              <GoogleMap
                mapId="DEMO_MAP_ID"
                defaultCenter={activeCenter}
                center={activeCenter}
                defaultZoom={11}
                mapTypeId="hybrid"
                gestureHandling="greedy"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                onClick={(ev) => {
                  const latLng = ev.detail?.latLng;
                  if (latLng) {
                    setCustomPin({ lat: latLng.lat, lng: latLng.lng });
                    setLatInput(latLng.lat.toFixed(4));
                    setLonInput(latLng.lng.toFixed(4));
                    setSelectedPin(null);
                  }
                }}
                style={{ width: '100%', height: '100%' }}
              >
                {presets.map((preset) => (
                  <AdvancedMarker
                    key={preset.id}
                    position={{ lat: preset.coordinates.lat, lng: preset.coordinates.lon }}
                    title={preset.name}
                    onClick={() => {
                      setSelectedPin(preset);
                      setCustomPin(null);
                      setLatInput(String(preset.coordinates.lat));
                      setLonInput(String(preset.coordinates.lon));
                    }}
                  >
                    <Pin
                      background={preset.id === currentPreset.id ? '#10b981' : '#0ea5e9'}
                      borderColor="#020617"
                      glyphColor="#ffffff"
                    />
                  </AdvancedMarker>
                ))}

                {customPin && (
                  <AdvancedMarker position={customPin} title="Selected AOI Target">
                    <Pin background="#f59e0b" borderColor="#020617" glyphColor="#020617" />
                  </AdvancedMarker>
                )}

                {selectedPin && (
                  <InfoWindow
                    position={{
                      lat: selectedPin.coordinates.lat,
                      lng: selectedPin.coordinates.lon,
                    }}
                    onCloseClick={() => setSelectedPin(null)}
                  >
                    <div className="p-1 text-slate-900 max-w-xs space-y-1.5">
                      <div className="text-xs font-bold">{selectedPin.name}</div>
                      <div className="text-[11px] text-slate-600">
                        {selectedPin.state} · {selectedPin.sensor} ({selectedPin.gsdMetersPerPixel}m)
                      </div>
                      <button
                        onClick={() => onSelectPreset(selectedPin)}
                        className="w-full px-2.5 py-1 rounded bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-500"
                      >
                        Load Tile into SAM Workbench
                      </button>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </MapStatusGuard>
          </APIProvider>
        )}

        {/* Coordinate Jump Bar (Top Left of Map) */}
        <form
          onSubmit={handleJumpCoords}
          className="absolute top-3 left-3 z-10 bg-slate-900/95 border border-slate-700 rounded-xl p-2 flex flex-wrap items-center gap-2 shadow-xl"
        >
          <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
          <input
            type="text"
            value={latInput}
            onChange={(e) => setLatInput(e.target.value)}
            aria-label="Latitude"
            placeholder="Lat"
            className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200"
          />
          <input
            type="text"
            value={lonInput}
            onChange={(e) => setLonInput(e.target.value)}
            aria-label="Longitude"
            placeholder="Lon"
            className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200"
          />
          <button
            type="submit"
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
          >
            Go
          </button>
          <button
            type="button"
            onClick={() =>
              onLaunchScanAtCoords(
                { lat: activeCenter.lat, lon: activeCenter.lng, crs: 'EPSG:4326' },
                customPin ? `AOI (${activeCenter.lat.toFixed(3)}, ${activeCenter.lng.toFixed(3)})` : currentPreset.name
              )
            }
            className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white flex items-center gap-1"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Scan AOI</span>
          </button>
        </form>
      </div>

      {/* Right: Google Maps Grounding Panel (gemini-4-hydrogen + googleMaps tool) */}
      <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-900 flex flex-col shrink-0 h-80 lg:h-full overflow-hidden">
        <div className="p-4 border-b border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Navigation className="w-3.5 h-3.5 text-emerald-400" />
              <span>Maps Grounding Intel</span>
            </h3>
            <span className="text-[10px] font-mono text-cyan-400">gemini-4-hydrogen</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Discover verified nearby agricultural centers, canals, mandis, or disaster relief stations around ({activeCenter.lat.toFixed(3)}°, {activeCenter.lng.toFixed(3)}°).
          </p>
        </div>

        <form onSubmit={handleRunGrounding} className="p-3 border-b border-slate-800 flex gap-2">
          <input
            type="text"
            value={groundingQuery}
            onChange={(e) => setGroundingQuery(e.target.value)}
            placeholder="e.g., Krishi Kendra, canal, or flood shelter nearby"
            className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={groundingLoading}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5"
          >
            {groundingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>Find</span>
          </button>
        </form>

        <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
          {!groundingText && !groundingError && !groundingLoading && (
            <div className="text-center py-8 space-y-3 text-slate-400">
              <p className="text-xs">
                Click <strong>Find</strong> to query real-world geospatial context anchored to the selected coordinates.
              </p>
              <button
                onClick={() => handleRunGrounding()}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-emerald-300 border border-slate-700"
              >
                Auto-Discover Nearby {persona === 'farmer' ? 'Agri Support' : 'Field Stations'}
              </button>
            </div>
          )}

          {groundingError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-700 text-rose-200 text-xs">
              {groundingError}
            </div>
          )}

          {groundingText && (
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-200 whitespace-pre-wrap leading-relaxed">
              {groundingText}
            </div>
          )}

          {groundingPlaces.length > 0 && (
            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Verified Google Maps Locations
              </span>
              {groundingPlaces.map((place, idx) => (
                <a
                  key={idx}
                  href={place.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-emerald-300 truncate">{place.title}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </div>
                  {place.reviewSnippets && place.reviewSnippets.length > 0 && (
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                      {place.reviewSnippets[0]?.title || 'View details on Google Maps'}
                    </p>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
