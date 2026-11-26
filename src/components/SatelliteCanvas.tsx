import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  GeoCoordinate, 
  ParcelPolygon, 
  SamBoxPrompt, 
  SamPointPrompt, 
  SpectralBand 
} from '../types/satellite';
import { SamToolMode } from './SamPromptControls';
import { processSpectralBand } from '../utils/spectralMath';
import { ZoomIn, ZoomOut, Maximize2, Move } from 'lucide-react';

interface SatelliteCanvasProps {
  imageUrl: string;
  centerCoord: GeoCoordinate;
  gsdMetersPerPixel: number;
  activeBand: SpectralBand;
  splitMode: boolean;
  splitPos: number; // percentage 0-100
  spectralOpacity: number;
  toolMode: SamToolMode;
  positivePoints: SamPointPrompt[];
  negativePoints: SamPointPrompt[];
  boxPrompt: SamBoxPrompt | null;
  activeParcel: ParcelPolygon | null;
  autoParcels: ParcelPolygon[];
  onAddPoint: (point: { x: number; y: number; isPositive: boolean }) => void;
  onSetBox: (box: SamBoxPrompt | null) => void;
  onSelectParcel: (parcel: ParcelPolygon) => void;
  onMouseMoveCoord: (coord: { lat: number; lon: number; x: number; y: number } | null) => void;
  onMetricsComputed: (metrics: { meanNdvi: number; meanNdwi: number; meanNdbi: number }) => void;
}

export const SatelliteCanvas: React.FC<SatelliteCanvasProps> = ({
  imageUrl,
  centerCoord,
  gsdMetersPerPixel,
  activeBand,
  splitMode,
  splitPos,
  spectralOpacity,
  toolMode,
  positivePoints,
  negativePoints,
  boxPrompt,
  activeParcel,
  autoParcels,
  onAddPoint,
  onSetBox,
  onSelectParcel,
  onMouseMoveCoord,
  onMetricsComputed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rawCanvasRef = useRef<HTMLCanvasElement>(null);
  const spectralCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport transformation (zoom & pan)
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Box prompt drag tracking
  const [isDraggingBox, setIsDraggingBox] = useState<boolean>(false);
  const [boxStart, setBoxStart] = useState<{ x: number; y: number } | null>(null);
  const [tempBox, setTempBox] = useState<SamBoxPrompt | null>(null);

  // Loaded base image element
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number }>({ width: 800, height: 800 });

  // Load image when imageUrl changes
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
      setLoadedImage(img);
      setImageDims({ width: img.naturalWidth || 800, height: img.naturalHeight || 800 });
      // Reset pan to center
      setPan({ x: 0, y: 0 });
      setZoom(1);
    };
  }, [imageUrl]);

  // Render raw and spectral canvases when image or activeBand changes
  useEffect(() => {
    if (!loadedImage) return;

    const rawCanvas = rawCanvasRef.current;
    const specCanvas = spectralCanvasRef.current;
    if (!rawCanvas || !specCanvas) return;

    const w = imageDims.width;
    const h = imageDims.height;

    rawCanvas.width = w;
    rawCanvas.height = h;
    specCanvas.width = w;
    specCanvas.height = h;

    const rawCtx = rawCanvas.getContext('2d')!;
    const specCtx = specCanvas.getContext('2d', { willReadFrequently: true })!;

    // Draw base raw image
    rawCtx.drawImage(loadedImage, 0, 0, w, h);

    // Read pixel data for spectral transformation
    const rawData = rawCtx.getImageData(0, 0, w, h);
    const specData = specCtx.createImageData(w, h);

    const metrics = processSpectralBand(rawData, specData, activeBand);
    specCtx.putImageData(specData, 0, 0);

    onMetricsComputed(metrics);
  }, [loadedImage, imageDims, activeBand]);

  // Convert client mouse event to satellite image pixel coordinates
  const clientToImageCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();

      // Canvas center offset
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Click relative to canvas center, factoring pan and zoom
      const relX = (clientX - rect.left - centerX - pan.x) / zoom;
      const relY = (clientY - rect.top - centerY - pan.y) / zoom;

      // Convert to image coordinate (origin at top-left of image)
      const imgX = relX + imageDims.width / 2;
      const imgY = relY + imageDims.height / 2;

      return {
        x: Math.round(Math.max(0, Math.min(imageDims.width - 1, imgX))),
        y: Math.round(Math.max(0, Math.min(imageDims.height - 1, imgY))),
      };
    },
    [pan, zoom, imageDims]
  );

  // Convert image pixel coordinates to GPS Lat/Lon
  const pixelToGps = useCallback(
    (px: number, py: number) => {
      const metersPerDegLat = 111320;
      const metersPerDegLon = 111320 * Math.cos((centerCoord.lat * Math.PI) / 180);

      const dxMeters = (px - imageDims.width / 2) * gsdMetersPerPixel;
      const dyMeters = (imageDims.height / 2 - py) * gsdMetersPerPixel;

      const lon = centerCoord.lon + dxMeters / metersPerDegLon;
      const lat = centerCoord.lat + dyMeters / metersPerDegLat;

      return { lat, lon };
    },
    [centerCoord, gsdMetersPerPixel, imageDims]
  );

  // Mouse handlers for drawing prompts and panning
  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click or space+click for panning
    if (e.button === 1 || e.shiftKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (e.button === 0) {
      const coords = clientToImageCoords(e.clientX, e.clientY);

      if (toolMode === 'box') {
        setIsDraggingBox(true);
        setBoxStart(coords);
        setTempBox({ startX: coords.x, startY: coords.y, endX: coords.x, endY: coords.y });
      } else if (toolMode === 'point-positive') {
        onAddPoint({ x: coords.x, y: coords.y, isPositive: true });
      } else if (toolMode === 'point-negative') {
        onAddPoint({ x: coords.x, y: coords.y, isPositive: false });
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Panning
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
      return;
    }

    // Box prompt drag
    if (isDraggingBox && boxStart) {
      const current = clientToImageCoords(e.clientX, e.clientY);
      setTempBox({
        startX: boxStart.x,
        startY: boxStart.y,
        endX: current.x,
        endY: current.y,
      });
    }

    // Telemetry updates
    const imgCoords = clientToImageCoords(e.clientX, e.clientY);
    const gps = pixelToGps(imgCoords.x, imgCoords.y);
    onMouseMoveCoord({
      lat: gps.lat,
      lon: gps.lon,
      x: imgCoords.x,
      y: imgCoords.y,
    });
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }
    if (isDraggingBox && tempBox) {
      setIsDraggingBox(false);
      // Validate box minimum dimensions
      const w = Math.abs(tempBox.endX - tempBox.startX);
      const h = Math.abs(tempBox.endY - tempBox.startY);
      if (w > 10 && h > 10) {
        onSetBox(tempBox);
      }
      setTempBox(null);
      setBoxStart(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((prev) => Math.min(6, Math.max(0.5, prev * zoomFactor)));
  };

  // Render overlay elements (polygons, points, box prompts)
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    canvas.width = imageDims.width;
    canvas.height = imageDims.height;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw auto-segmented parcels
    for (const p of autoParcels) {
      if (p.points.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(p.points[0].x, p.points[0].y);
      for (let i = 1; i < p.points.length; i++) {
        ctx.lineTo(p.points[i].x, p.points[i].y);
      }
      ctx.closePath();

      // Semi-transparent fill
      ctx.fillStyle = `${p.color}33`; // 20% opacity
      ctx.fill();

      // Crisp boundary stroke
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Centroid label
      let cx = 0, cy = 0;
      for (const pt of p.points) { cx += pt.x; cy += pt.y; }
      cx /= p.points.length;
      cy /= p.points.length;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(cx - 30, cy - 10, 60, 20);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 30, cy - 10, 60, 20);

      ctx.fillStyle = '#ffffff';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${p.areaHectares} ha`, cx, cy);
    }

    // 2. Draw current active single parcel (from prompt segmentation)
    if (activeParcel && activeParcel.points.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(activeParcel.points[0].x, activeParcel.points[0].y);
      for (let i = 1; i < activeParcel.points.length; i++) {
        ctx.lineTo(activeParcel.points[i].x, activeParcel.points[i].y);
      }
      ctx.closePath();

      // Glowing emerald fill
      ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.fill();

      // Outer boundary glow
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    }

    // 3. Draw Bounding Box Prompt (if any)
    const activeBox = tempBox || boxPrompt;
    if (activeBox) {
      const bx = Math.min(activeBox.startX, activeBox.endX);
      const by = Math.min(activeBox.startY, activeBox.endY);
      const bw = Math.abs(activeBox.endX - activeBox.startX);
      const bh = Math.abs(activeBox.endY - activeBox.startY);

      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.setLineDash([]);
    }

    // 4. Draw Positive Prompts (Green reticles)
    for (const pt of positivePoints) {
      drawPointPin(ctx, pt.x, pt.y, '#10b981', '+');
    }

    // 5. Draw Negative Prompts (Red reticles)
    for (const pt of negativePoints) {
      drawPointPin(ctx, pt.x, pt.y, '#f43f5e', '-');
    }
  }, [imageDims, autoParcels, activeParcel, boxPrompt, tempBox, positivePoints, negativePoints]);

  const drawPointPin = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: string,
    symbol: string
  ) => {
    // Outer pulse ring
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Solid core
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Center symbol (+ or -)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(symbol, x, y);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onMouseLeave={() => onMouseMoveCoord(null)}
      className="relative w-full h-full overflow-hidden bg-slate-950 gis-grid-pattern cursor-crosshair-gis select-none flex items-center justify-center"
    >
      {/* Zoom / Pan Controls Overlay */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 shadow-xl">
        <button
          onClick={() => setZoom((z) => Math.min(6, z * 1.25))}
          className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z * 0.8))}
          className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="p-2 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
          title="Reset View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <div className="text-[10px] text-center font-mono text-slate-400 py-1 border-t border-slate-800">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Helper HUD tooltip in bottom left */}
      <div className="absolute bottom-4 left-4 z-20 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Move className="w-3.5 h-3.5 text-slate-400" />
          <span>Shift+Drag to Pan</span>
        </div>
        <span className="text-slate-700">|</span>
        <span>Scroll to Zoom</span>
        <span className="text-slate-700">|</span>
        <span className="text-emerald-400">Click to place SAM prompt</span>
      </div>

      {/* Main Layered Canvas Stage */}
      <div
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          width: imageDims.width,
          height: imageDims.height,
        }}
        className="relative shadow-2xl transition-transform duration-75 ease-out"
      >
        {/* Layer 1: Raw True-Color Satellite Imagery */}
        <canvas
          ref={rawCanvasRef}
          className="absolute inset-0 w-full h-full"
        />

        {/* Layer 2: Spectral Band Transformed Imagery (Clipped if Split Mode is on) */}
        <canvas
          ref={spectralCanvasRef}
          style={{
            opacity: spectralOpacity,
            clipPath: splitMode ? `polygon(0 0, ${splitPos}% 0, ${splitPos}% 100%, 0 100%)` : undefined,
          }}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Split screen swipe boundary vertical line */}
        {splitMode && (
          <div
            style={{ left: `${splitPos}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 shadow-[0_0_10px_#10b981] pointer-events-none z-10"
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 bg-slate-900 border border-emerald-400 text-emerald-400 text-[9px] font-mono px-1 py-0.5 rounded shadow">
              SPLIT
            </div>
          </div>
        )}

        {/* Layer 3: Interactive Overlays (Polygons, Pins, Box Prompt) */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-15"
        />
      </div>
    </div>
  );
};
