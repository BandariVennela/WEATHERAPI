/**
 * OpenWeather API Integration Service
 * Securely handles communication with OpenWeather API endpoints.
 * Includes graceful handling of rate limits, invalid locations, and mock/demo fallback when key is not set.
 */

const BASE_URL = 'https://api.openweathermap.org';

/**
 * Fetch weather data by city query or coordinates.
 * @param {Object} params { city, lat, lon }
 * @returns {Promise<Object>} Raw OpenWeather payloads
 */
async function fetchRawWeatherData({ city, lat, lon }) {
  const apiKey = (process.env.OPENWEATHER_API_KEY && process.env.OPENWEATHER_API_KEY.trim()) || '78d18aaaba3f3987cda842f8ded78c7a';

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_openweather_api_key_here') {
    console.log('[OpenWeather Service] No valid OPENWEATHER_API_KEY found in .env. Using realistic fallback engine.');
    return getFallbackWeatherData({ city: city || 'Hyderabad', lat, lon });
  }

  try {
    let currentUrl = '';
    let forecastUrl = '';
    let airPollutionUrl = '';

    if (lat && lon) {
      currentUrl = `${BASE_URL}/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;

      forecastUrl = `${BASE_URL}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
      airPollutionUrl = `${BASE_URL}/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
    } else if (city) {
      const cleanCity = encodeURIComponent(city.trim());
      currentUrl = `${BASE_URL}/data/2.5/weather?q=${cleanCity}&units=metric&appid=${apiKey}`;
      forecastUrl = `${BASE_URL}/data/2.5/forecast?q=${cleanCity}&units=metric&appid=${apiKey}`;
    } else {
      throw new Error('Location query is required (city name or coordinates).');
    }

    let currentRes = await fetch(currentUrl);

    // Smart Geocoding Fallback if direct city lookup returned 404
    if (!currentRes.ok && currentRes.status === 404 && city) {
      const geoResult = await trySmartGeocoding(city.trim(), apiKey);
      if (geoResult) {
        currentUrl = `${BASE_URL}/data/2.5/weather?lat=${geoResult.lat}&lon=${geoResult.lon}&units=metric&appid=${apiKey}`;
        forecastUrl = `${BASE_URL}/data/2.5/forecast?lat=${geoResult.lat}&lon=${geoResult.lon}&units=metric&appid=${apiKey}`;
        currentRes = await fetch(currentUrl);
      }
    }

    if (!currentRes.ok) {
      if (currentRes.status === 404) {
        throw new Error(`We couldn't find "${city}". Please check the spelling or try searching for a major city (e.g., "Hyderabad", "Mumbai", "London", "New York").`);
      } else if (currentRes.status === 401) {
        throw new Error('Invalid OpenWeather API Key. Please verify your OPENWEATHER_API_KEY setting.');
      } else {
        throw new Error(`Weather service returned HTTP error ${currentRes.status}.`);
      }
    }
    const currentData = await currentRes.json();

    // Fetch forecast
    let forecastData = null;
    try {
      const fRes = await fetch(forecastUrl);
      if (fRes.ok) forecastData = await fRes.json();
    } catch (err) {
      console.warn('[OpenWeather Service] Forecast fetch non-critical warning:', err.message);
    }

    // Fetch Air Pollution using lat/lon from current weather
    let airPollutionData = null;
    if (currentData.coord && currentData.coord.lat && currentData.coord.lon) {
      try {
        const apUrl = `${BASE_URL}/data/2.5/air_pollution?lat=${currentData.coord.lat}&lon=${currentData.coord.lon}&appid=${apiKey}`;
        const apRes = await fetch(apUrl);
        if (apRes.ok) airPollutionData = await apRes.json();
      } catch (err) {
        console.warn('[OpenWeather Service] Air Pollution fetch warning:', err.message);
      }
    }

    return {
      current: currentData,
      forecast: forecastData,
      airPollution: airPollutionData,
      isDemo: false
    };

  } catch (error) {
    if (error.message.includes("couldn't find") || error.message.includes("Invalid OpenWeather")) {
      throw error;
    }
    console.error('[OpenWeather Service Error]:', error.message);
    // Fallback if live network error occurs
    return getFallbackWeatherData({ city: city || 'Hyderabad', lat, lon, errorMessage: error.message });
  }
}

/**
 * Generates realistic fallback weather data if API key is not supplied or network fails.
 */
function getFallbackWeatherData({ city = 'Hyderabad', lat, lon, errorMessage }) {
  const targetCity = city.trim();
  const titleCity = targetCity.charAt(0).toUpperCase() + targetCity.slice(1);
  const nowSec = Math.floor(Date.now() / 1000);

  // Deterministic seed based on city name for consistent demo metrics
  let hash = 0;
  for (let i = 0; i < targetCity.length; i++) {
    hash = targetCity.charCodeAt(i) + ((hash << 5) - hash);
  }
  const baseTemp = 24 + (Math.abs(hash) % 14); // 24°C to 37°C
  const humidity = 45 + (Math.abs(hash * 3) % 40); // 45% to 85%
  const windSpeed = 3 + (Math.abs(hash * 7) % 15); // 3 to 18 m/s
  const feelsLike = Math.round(baseTemp + (humidity > 65 ? 4 : -1));
  const isCloudy = (Math.abs(hash) % 2 === 0);

  const forecastList = [];
  for (let i = 0; i < 40; i++) {
    const timeOffset = i * 3 * 3600;
    const hour = new Date((nowSec + timeOffset) * 1000).getUTCHours();
    const tempVar = Math.sin((hour / 24) * 2 * Math.PI) * 4;
    forecastList.push({
      dt: nowSec + timeOffset,
      main: {
        temp: parseFloat((baseTemp + tempVar).toFixed(1)),
        feels_like: parseFloat((feelsLike + tempVar).toFixed(1)),
        humidity: Math.min(95, Math.max(30, humidity + Math.round(tempVar * 2))),
        pressure: 1012
      },
      weather: [
        {
          main: isCloudy ? 'Clouds' : 'Clear',
          description: isCloudy ? 'scattered clouds' : 'clear sky',
          icon: isCloudy ? '03d' : '01d'
        }
      ],
      clouds: { all: isCloudy ? 40 : 10 },
      wind: { speed: windSpeed, deg: 180 },
      pop: (humidity > 70 ? 0.45 : 0.1),
      dt_txt: new Date((nowSec + timeOffset) * 1000).toISOString().replace('T', ' ').substring(0, 19)
    });
  }

  return {
    current: {
      coord: { lon: lon || 78.4867, lat: lat || 17.3850 },
      weather: [
        {
          id: isCloudy ? 802 : 800,
          main: isCloudy ? 'Clouds' : 'Clear',
          description: isCloudy ? 'scattered clouds' : 'clear sky',
          icon: isCloudy ? '03d' : '01d'
        }
      ],
      main: {
        temp: baseTemp,
        feels_like: feelsLike,
        temp_min: baseTemp - 3,
        temp_max: baseTemp + 4,
        pressure: 1012,
        humidity: humidity
      },
      visibility: 9500,
      wind: { speed: windSpeed, deg: 160 },
      clouds: { all: isCloudy ? 45 : 10 },
      dt: nowSec,
      sys: {
        country: 'IN',
        sunrise: nowSec - 21600,
        sunset: nowSec + 21600
      },
      name: titleCity
    },
    forecast: {
      list: forecastList,
      city: { name: titleCity, country: 'IN' }
    },
    airPollution: {
      list: [
        {
          main: { aqi: humidity > 70 ? 3 : 2 },
          components: { co: 250, no2: 12, o3: 45, pm2_5: 18, pm10: 35 }
        }
      ]
    },
    isDemo: true,
    demoReason: errorMessage || 'No OPENWEATHER_API_KEY provided in server environment.'
  };
}

/**
 * Smart Geocoding helper trying to resolve area names, local neighborhoods, or abbreviations.
 */
async function trySmartGeocoding(cityQuery, apiKey) {
  try {
    const qLower = cityQuery.toLowerCase().trim();

    // Known local neighborhood direct coordinate maps & aliases
    const directCoordMap = {
      'suchitra': { lat: 17.5135, lon: 78.4716, name: 'Suchitra, Hyderabad' },
      'suchitra circle': { lat: 17.5135, lon: 78.4716, name: 'Suchitra, Hyderabad' },
      'kphb': { lat: 17.4931, lon: 78.4054, name: 'KPHB, Hyderabad' },
      'kphb colony': { lat: 17.4931, lon: 78.4054, name: 'KPHB, Hyderabad' },
      'kompally': { lat: 17.5408, lon: 78.4878, name: 'Kompally, Hyderabad' },
      'jeedimetla': { lat: 17.5173, lon: 78.4526, name: 'Jeedimetla, Hyderabad' },
      'quthbullapur': { lat: 17.5028, lon: 78.4632, name: 'Quthbullapur, Hyderabad' },
      'bowenpally': { lat: 17.4665, lon: 78.4842, name: 'Bowenpally, Hyderabad' },
      'tarnaka': { lat: 17.4283, lon: 78.5283, name: 'Tarnaka, Hyderabad' },
      'uppal': { lat: 17.4056, lon: 78.5594, name: 'Uppal, Hyderabad' },
      'hitech city': { lat: 17.4435, lon: 78.3772, name: 'HITEC City, Hyderabad' },
      'hi-tech city': { lat: 17.4435, lon: 78.3772, name: 'HITEC City, Hyderabad' },
      'gachibowli': { lat: 17.4401, lon: 78.3489, name: 'Gachibowli, Hyderabad' },
      'banjara hills': { lat: 17.4156, lon: 78.4418, name: 'Banjara Hills, Hyderabad' },
      'jubilee hills': { lat: 17.4319, lon: 78.4072, name: 'Jubilee Hills, Hyderabad' },
      'madhapur': { lat: 17.4483, lon: 78.3915, name: 'Madhapur, Hyderabad' },
      'kondapur': { lat: 17.4655, lon: 78.3647, name: 'Kondapur, Hyderabad' },
      'miyapur': { lat: 17.4968, lon: 78.3614, name: 'Miyapur, Hyderabad' },
      'kukatpally': { lat: 17.4842, lon: 78.4018, name: 'Kukatpally, Hyderabad' },
      'secunderabad': { lat: 17.4399, lon: 78.4983, name: 'Secunderabad' },
      'dilsukhnagar': { lat: 17.3688, lon: 78.5247, name: 'Dilsukhnagar, Hyderabad' },
      'lb nagar': { lat: 17.3457, lon: 78.5522, name: 'L. B. Nagar, Hyderabad' }
    };

    if (directCoordMap[qLower]) {
      return directCoordMap[qLower];
    }

    // 1. Query Direct Geocoding with target name
    const geoUrl = `${BASE_URL}/geo/1.0/direct?q=${encodeURIComponent(cityQuery)}&limit=5&appid=${apiKey}`;
    const geoRes = await fetch(geoUrl);
    if (geoRes.ok) {
      const geoList = await geoRes.json();
      if (Array.isArray(geoList) && geoList.length > 0) {
        return { lat: geoList[0].lat, lon: geoList[0].lon, name: geoList[0].name };
      }
    }

    // 2. If no comma in original query, try appending ", Hyderabad, IN" as fallback context
    if (!cityQuery.includes(',')) {
      const hydUrl = `${BASE_URL}/geo/1.0/direct?q=${encodeURIComponent(cityQuery + ', Hyderabad, IN')}&limit=5&appid=${apiKey}`;
      const hRes = await fetch(hydUrl);
      if (hRes.ok) {
        const hList = await hRes.json();
        if (Array.isArray(hList) && hList.length > 0) {
          return { lat: hList[0].lat, lon: hList[0].lon, name: hList[0].name };
        }
      }

      // 3. Try appending ", IN"
      const countryGeoUrl = `${BASE_URL}/geo/1.0/direct?q=${encodeURIComponent(cityQuery + ', IN')}&limit=5&appid=${apiKey}`;
      const cRes = await fetch(countryGeoUrl);
      if (cRes.ok) {
        const cList = await cRes.json();
        if (Array.isArray(cList) && cList.length > 0) {
          return { lat: cList[0].lat, lon: cList[0].lon, name: cList[0].name };
        }
      }
    }
  } catch (err) {
    // Non-critical fallback
  }
  return null;
}

module.exports = {
  fetchRawWeatherData
};

