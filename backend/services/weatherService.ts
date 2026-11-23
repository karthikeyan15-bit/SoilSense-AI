import type { WeatherAdvisoryResponse } from '../../shared/types.js';
import { INDIA_DISTRICTS } from '../data/agronomicData.js';

function weatherCodeToLabel(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Morning Mist / Fog';
  if (code <= 67) return 'Light to Moderate Rain';
  if (code <= 82) return 'Rain Showers';
  return 'Thunderstorm / Heavy Rain';
}

export async function getWeatherAdvisoryForDistrict(
  districtName: string,
  latOverride?: number | null,
  lonOverride?: number | null,
  stateName?: string,
): Promise<WeatherAdvisoryResponse> {
  const profile =
    INDIA_DISTRICTS.find((d) => d.district.toLowerCase() === districtName.toLowerCase()) ??
    (stateName ? INDIA_DISTRICTS.find((d) => d.state.toLowerCase() === stateName.toLowerCase()) : undefined) ??
    INDIA_DISTRICTS[0];

  const lat = typeof latOverride === 'number' && Number.isFinite(latOverride) ? latOverride : profile.latitude;
  const lon = typeof lonOverride === 'number' && Number.isFinite(lonOverride) ? lonOverride : profile.longitude;

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=precipitation_sum&forecast_days=3&timezone=Asia%2FKolkata`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }

    const data = (await res.json()) as {
      current?: {
        temperature_2m?: number;
        relative_humidity_2m?: number;
        wind_speed_10m?: number;
        weather_code?: number;
      };
      daily?: {
        precipitation_sum?: number[];
      };
    };

    const tempC = Number((data.current?.temperature_2m ?? 28.5).toFixed(1));
    const humidity = Math.round(data.current?.relative_humidity_2m ?? 64);
    const wind = Number((data.current?.wind_speed_10m ?? 9.2).toFixed(1));
    const rainArr = data.daily?.precipitation_sum ?? [0, 0, 0];
    const rain24h = Number((rainArr[0] ?? 0).toFixed(1));
    const rain72h = Number((rainArr.reduce((a, b) => a + b, 0)).toFixed(1));
    const conditionLabel = weatherCodeToLabel(data.current?.weather_code ?? 1);

    let irrigationAdvice = 'Maintain normal irrigation interval and check top 10 cm soil moisture before scheduling.';
    let fertilizerTimingWarning =
      'Weather window is favorable for basal or split fertilizer application during cool morning hours.';

    if (rain24h >= 15 || rain72h >= 35) {
      irrigationAdvice = 'Pause supplemental irrigation — significant rainfall is forecast over the next 24–72 hours.';
      fertilizerTimingWarning =
        'Delay Urea / top-dressing broadcast: heavy rain increases nitrogen surface runoff and leaching losses.';
    } else if (tempC >= 35 && humidity < 45) {
      irrigationAdvice = 'High evapotranspiration expected; schedule light irrigation in early morning or evening.';
      fertilizerTimingWarning =
        'Avoid broadcasting Urea on hot dry soil (>35°C) to prevent ammonia volatilization losses; irrigate lightly after incorporation.';
    } else if (wind >= 22) {
      fertilizerTimingWarning =
        'High wind speed detected — avoid foliar micronutrient spraying until wind drops below 15 km/h.';
    }

    return {
      district: districtName || profile.district,
      latitude: lat,
      longitude: lon,
      temperatureC: tempC,
      humidityPct: humidity,
      windSpeedKmh: wind,
      rainfallNext24hMm: rain24h,
      rainfallNext72hMm: rain72h,
      conditionLabel,
      irrigationAdvice,
      fertilizerTimingWarning,
      source: 'Open-Meteo Meteorological Forecast (Non-blocking Phase 2 Advisory)',
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    // Strictly non-blocking per Section 7 Module 9
    return {
      district: districtName || profile.district,
      latitude: lat,
      longitude: lon,
      temperatureC: 28.4,
      humidityPct: 62,
      windSpeedKmh: 8.5,
      rainfallNext24hMm: 2.0,
      rainfallNext72hMm: 6.5,
      conditionLabel: 'Regional Seasonal Baseline (Live weather temporarily unreachable)',
      irrigationAdvice: 'Verify local field moisture manually before scheduling irrigation.',
      fertilizerTimingWarning:
        'Apply nitrogen top-dressings in moist soil during early morning and avoid immediately preceding heavy rain.',
      source: 'All-India Regional Seasonal Fallback (Weather API offline — non-blocking)',
      fetchedAt: new Date().toISOString(),
    };
  }
}
