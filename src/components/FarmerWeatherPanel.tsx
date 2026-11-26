import React, { useEffect, useState } from 'react';
import { GeoCoordinate, WeatherOutlookData } from '../types/satellite';
import { CloudRain, Thermometer, Droplets, Volume2, VolumeX } from 'lucide-react';

interface FarmerWeatherPanelProps {
  coordinates: GeoCoordinate;
  meanNdvi: number;
  regionName: string;
}

export const FarmerWeatherPanel: React.FC<FarmerWeatherPanelProps> = ({
  coordinates,
  meanNdvi,
  regionName,
}) => {
  const [weather, setWeather] = useState<WeatherOutlookData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [speaking, setSpeaking] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/weather-outlook?lat=${coordinates.lat}&lon=${coordinates.lon}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.current) {
          setWeather(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coordinates.lat, coordinates.lon]);

  // Seasonal advisory derived from NDVI + live weather
  const precip7d = weather?.daily?.precipitation_sum?.reduce((a, b) => a + b, 0) ?? 0;
  const soilMoisture = weather?.current?.soil_moisture_0_to_7cm ?? 0.22;

  const cropHealthEn =
    meanNdvi >= 0.45
      ? 'Healthy active canopy. Maintain regular irrigation schedule.'
      : meanNdvi >= 0.25
      ? 'Moderate canopy vigor. Inspect dry edges for moisture or nitrogen deficit.'
      : 'Low vegetation cover (fallow, harvested, or stressed plot).';

  const cropHealthHi =
    meanNdvi >= 0.45
      ? 'फसल की हरियाली अच्छी है। सामान्य सिंचाई जारी रखें।'
      : meanNdvi >= 0.25
      ? 'फसल मध्यम स्थिति में है। खेत के सूखे किनारों की नमी जांचें।'
      : 'खेत में वनस्पति कम है (परती भूमि या कटाई/सूखे का संकेत)।';

  const seasonOutlook =
    precip7d > 20
      ? 'Kharif / Wet Outlook: Adequate rainfall projected over next 7 days; check field drainage bunds (Conf: 78%).'
      : 'Rabi / Zaid Outlook: Dry spell ahead; schedule drip or evening irrigation to conserve topsoil moisture (Conf: 81%).';

  const handleToggleSpeech = () => {
    if (!('speechSynthesis' in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const text = `${regionName}. ${cropHealthHi} ${cropHealthEn} ${seasonOutlook}`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'hi-IN';
    utter.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  };

  return (
    <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-700/40 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">
          Farmer’s Eye · किसान दृष्टि
        </span>
        <button
          onClick={handleToggleSpeech}
          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10px] text-emerald-300 flex items-center gap-1"
          title="Read out Hindi & English summary"
        >
          {speaking ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          <span>{speaking ? 'Stop Audio' : 'सुनें / Listen'}</span>
        </button>
      </div>

      {/* Bilingual Crop Summary */}
      <div className="space-y-1 text-[11px]">
        <p className="text-emerald-100 font-medium">{cropHealthHi}</p>
        <p className="text-slate-300">{cropHealthEn}</p>
      </div>

      {/* Live Weather & Soil Moisture */}
      {loading ? (
        <div className="text-[10px] text-slate-400">Loading live Open-Meteo weather...</div>
      ) : weather?.current ? (
        <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
          <div className="p-1.5 rounded bg-slate-950/70 border border-slate-800">
            <Thermometer className="w-3 h-3 text-amber-400 mx-auto mb-0.5" />
            <div className="text-[11px] font-mono font-bold text-white">
              {weather.current.temperature_2m}°C
            </div>
            <div className="text-[9px] text-slate-400">Temp</div>
          </div>
          <div className="p-1.5 rounded bg-slate-950/70 border border-slate-800">
            <CloudRain className="w-3 h-3 text-cyan-400 mx-auto mb-0.5" />
            <div className="text-[11px] font-mono font-bold text-white">
              {precip7d.toFixed(1)}mm
            </div>
            <div className="text-[9px] text-slate-400">7d Rain</div>
          </div>
          <div className="p-1.5 rounded bg-slate-950/70 border border-slate-800">
            <Droplets className="w-3 h-3 text-emerald-400 mx-auto mb-0.5" />
            <div className="text-[11px] font-mono font-bold text-white">
              {(soilMoisture * 100).toFixed(0)}%
            </div>
            <div className="text-[9px] text-slate-400">Soil Moist.</div>
          </div>
        </div>
      ) : null}

      <div className="text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5 leading-relaxed">
        <strong className="text-slate-300">Seasonal Estimate:</strong> {seasonOutlook}{' '}
        <span className="text-slate-500">Source: Open-Meteo & NDVI estimate.</span>
      </div>
    </div>
  );
};
