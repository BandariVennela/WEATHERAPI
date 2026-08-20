/**
 * Normalized Weather Data Engine
 * Maps raw OpenWeather API JSON payload into a clean, predictable, standard schema.
 * Missing or unsupported fields are explicitly set to null.
 */

function normalizeWeatherData(rawPayload) {
  if (!rawPayload || !rawPayload.current) {
    throw new Error('Invalid raw weather payload provided to normalizer.');
  }

  const c = rawPayload.current;
  const f = rawPayload.forecast;
  const ap = rawPayload.airPollution;

  // Extract primary current metrics
  const location = c.name || null;
  const country = c.sys && c.sys.country ? c.sys.country : null;
  const latitude = c.coord && c.coord.lat !== undefined ? c.coord.lat : null;
  const longitude = c.coord && c.coord.lon !== undefined ? c.coord.lon : null;
  const timestamp = c.dt ? new Date(c.dt * 1000).toISOString() : new Date().toISOString();

  const temperature = c.main && c.main.temp !== undefined ? Math.round(c.main.temp * 10) / 10 : null;
  const feels_like = c.main && c.main.feels_like !== undefined ? Math.round(c.main.feels_like * 10) / 10 : null;
  const temp_min = c.main && c.main.temp_min !== undefined ? Math.round(c.main.temp_min * 10) / 10 : null;
  const temp_max = c.main && c.main.temp_max !== undefined ? Math.round(c.main.temp_max * 10) / 10 : null;
  const humidity = c.main && c.main.humidity !== undefined ? c.main.humidity : null;
  const pressure = c.main && c.main.pressure !== undefined ? c.main.pressure : null;

  // Wind metrics (convert m/s to km/h for standard readability: 1 m/s = 3.6 km/h)
  const wind_speed_ms = c.wind && c.wind.speed !== undefined ? c.wind.speed : null;
  const wind_speed = wind_speed_ms !== null ? Math.round(wind_speed_ms * 3.6 * 10) / 10 : null;
  const wind_direction = c.wind && c.wind.deg !== undefined ? c.wind.deg : null;

  // Visibility in km
  const visibility_m = c.visibility !== undefined ? c.visibility : null;
  const visibility = visibility_m !== null ? Math.round((visibility_m / 1000) * 10) / 10 : null;

  const cloud_cover = c.clouds && c.clouds.all !== undefined ? c.clouds.all : null;

  const weather_condition = c.weather && c.weather[0] ? c.weather[0].main : null;
  const weather_description = c.weather && c.weather[0] ? c.weather[0].description : null;
  const weather_icon = c.weather && c.weather[0] ? c.weather[0].icon : null;

  // Rain / Snow volume in mm (last 1h or 3h)
  let precipitation = null;
  if (c.rain) {
    precipitation = c.rain['1h'] || c.rain['3h'] || 0;
  } else if (c.snow) {
    precipitation = c.snow['1h'] || c.snow['3h'] || 0;
  }

  // Sunrise / Sunset format
  const sunrise = c.sys && c.sys.sunrise ? new Date(c.sys.sunrise * 1000).toISOString() : null;
  const sunset = c.sys && c.sys.sunset ? new Date(c.sys.sunset * 1000).toISOString() : null;

  // Air Pollution / AQI (1: Good, 2: Fair, 3: Moderate, 4: Poor, 5: Very Poor)
  let air_quality = null;
  if (ap && ap.list && ap.list[0]) {
    const apMain = ap.list[0].main;
    const apComp = ap.list[0].components;
    const aqiNum = apMain ? apMain.aqi : null;
    const aqiLabels = { 1: 'Good', 2: 'Fair', 3: 'Moderate', 4: 'Poor', 5: 'Very Poor' };
    air_quality = {
      aqi: aqiNum,
      label: aqiNum ? aqiLabels[aqiNum] || 'Unknown' : null,
      pm2_5: apComp ? apComp.pm2_5 : null,
      pm10: apComp ? apComp.pm10 : null,
      no2: apComp ? apComp.no2 : null,
      o3: apComp ? apComp.o3 : null
    };
  }

  // UV index (if supplied in extended payloads or OneCall API; set to null if unavailable)
  const uv_index = c.uvi !== undefined ? c.uvi : null;

  // Process 5-day / 3-hour forecast entries
  let forecast = [];
  let rain_probability = 0;

  if (f && Array.isArray(f.list)) {
    forecast = f.list.map(item => {
      const fTemp = item.main ? Math.round(item.main.temp * 10) / 10 : null;
      const fFeelsLike = item.main ? Math.round(item.main.feels_like * 10) / 10 : null;
      const fHumidity = item.main ? item.main.humidity : null;
      const fPop = item.pop !== undefined ? Math.round(item.pop * 100) : 0;
      const fWind = item.wind ? Math.round(item.wind.speed * 3.6 * 10) / 10 : null;
      const fCondition = item.weather && item.weather[0] ? item.weather[0].main : null;
      const fDesc = item.weather && item.weather[0] ? item.weather[0].description : null;
      const fIcon = item.weather && item.weather[0] ? item.weather[0].icon : null;

      return {
        timestamp: item.dt ? new Date(item.dt * 1000).toISOString() : item.dt_txt,
        dt: item.dt,
        formatted_time: item.dt ? new Date(item.dt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        formatted_date: item.dt ? new Date(item.dt * 1000).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '',
        temperature: fTemp,
        feels_like: fFeelsLike,
        humidity: fHumidity,
        rain_probability: fPop,
        wind_speed: fWind,
        condition: fCondition,
        description: fDesc,
        icon: fIcon
      };
    });

    // Highest rain probability in immediate 12 hours
    const nearTerm = forecast.slice(0, 4);
    if (nearTerm.length > 0) {
      rain_probability = Math.max(...nearTerm.map(i => i.rain_probability));
    }
  }

  // Weather alerts (if present from API)
  const alerts = c.alerts || f.alerts || null;

  return {
    location,
    country,
    latitude,
    longitude,
    timestamp,
    temperature,
    feels_like,
    temp_min,
    temp_max,
    humidity,
    pressure,
    wind_speed,
    wind_direction,
    visibility,
    cloud_cover,
    weather_condition,
    weather_description,
    weather_icon,
    precipitation,
    rain_probability,
    sunrise,
    sunset,
    air_quality,
    uv_index,
    alerts,
    forecast,
    is_demo: !!rawPayload.isDemo,
    demo_reason: rawPayload.demoReason || null
  };
}

module.exports = {
  normalizeWeatherData
};
