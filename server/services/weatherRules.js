/**
 * Rule-Based Weather Action Engine
 * Evaluates deterministic thresholds to generate immediate, practical recommendations
 * for clothing, travel, outdoor activities, and weather risk warnings.
 */

function generateWeatherActions(normalizedData) {
  if (!normalizedData) return null;

  const temp = normalizedData.temperature;
  const feelsLike = normalizedData.feels_like;
  const humidity = normalizedData.humidity;
  const windSpeed = normalizedData.wind_speed; // in km/h
  const rainProb = normalizedData.rain_probability;
  const visibility = normalizedData.visibility; // in km
  const cloudCover = normalizedData.cloud_cover;
  const condition = (normalizedData.weather_condition || '').toLowerCase();

  const rulesTriggered = [];
  const clothing = [];
  const travel = [];
  const outdoorActivities = [];
  const dailyPlanning = [];
  const risks = [];

  // --- 1. TEMPERATURE & THERMAL COMFORT RULES ---
  if (temp !== null) {
    if (temp >= 40) {
      rulesTriggered.push('EXTREME_HEAT');
      risks.push({
        level: 'HIGH',
        title: 'Extreme Heat Warning',
        message: 'Temperatures are dangerously high (≥40°C). Prolonged sun exposure poses severe heat risk.'
      });
      clothing.push('Ultra-lightweight, breathable cotton or linen clothing', 'Wide-brimmed hat & high SPF sunscreen');
      outdoorActivities.push('Avoid outdoor exposure during peak afternoon hours (11 AM - 4 PM)', 'Stay in air-conditioned environments');
      dailyPlanning.push('Hydrate frequently with water and electrolytes', 'Schedule outdoor errands strictly for early morning or late evening');
    } else if (temp >= 35) {
      rulesTriggered.push('HIGH_HEAT');
      risks.push({
        level: 'MODERATE',
        title: 'High Heat Caution',
        message: 'Very warm conditions (≥35°C). High physical exertion outdoors is not recommended during peak hours.'
      });
      clothing.push('Lightweight, loose-fitting clothes', 'Sunglasses and UV protection');
      outdoorActivities.push('Limit intense workouts outdoors', 'Prefer early morning or post-sunset hours for exercise');
      dailyPlanning.push('Keep hydrators nearby', 'Plan indoor rest periods during midday heat');
    } else if (temp >= 28) {
      rulesTriggered.push('WARM');
      clothing.push('Comfortable summer clothing', 'Light sunglasses');
      outdoorActivities.push('Good for outdoor walking, but seek shade during early afternoon');
      dailyPlanning.push('Stay comfortably hydrated');
    } else if (temp <= 10) {
      rulesTriggered.push('COLD');
      risks.push({
        level: 'LOW',
        title: 'Cold Weather Alert',
        message: 'Chilly conditions (≤10°C). Layer up to maintain body warmth.'
      });
      clothing.push('Warm heavy jacket, sweater, or thermal base layers', 'Beanie or scarf if windy');
      outdoorActivities.push('Keep outdoor activities brief and well-insulated');
      dailyPlanning.push('Hot beverages recommended for comfort');
    } else if (temp <= 18) {
      rulesTriggered.push('COOL');
      clothing.push('Light jacket, cardigan, or cozy hoodie');
      outdoorActivities.push('Great weather for crisp outdoor walks and jogging');
    } else {
      rulesTriggered.push('MILD');
      clothing.push('Standard casual wear (t-shirt/jeans or shirt)');
      outdoorActivities.push('Ideal conditions for all outdoor sports and recreation');
    }
  }

  // --- 2. HUMIDITY & FEELS-LIKE DELTA RULES ---
  if (humidity !== null && humidity >= 75) {
    rulesTriggered.push('HIGH_HUMIDITY');
    const diff = (feelsLike !== null && temp !== null) ? Math.round(feelsLike - temp) : 0;
    const msg = diff > 2
      ? `High humidity (${humidity}%) makes the weather feel ${diff}°C hotter than the actual temperature by suppressing sweat evaporation.`
      : `High humidity (${humidity}%) increases mugginess and perceived warmth.`;
    
    risks.push({
      level: 'INFO',
      title: 'High Humidity Impact',
      message: msg
    });
    clothing.push('Moisture-wicking fabrics');
    dailyPlanning.push('Prefer ventilated or climate-controlled workspaces');
  }

  // --- 3. PRECIPITATION & RAIN RULES ---
  if (rainProb >= 60 || condition.includes('rain') || condition.includes('drizzle') || condition.includes('thunderstorm')) {
    rulesTriggered.push('HIGH_RAIN_PROBABILITY');
    risks.push({
      level: 'MODERATE',
      title: 'Rain / Wet Weather Notice',
      message: `Rain probability is high (${rainProb}%). Wet roads and sudden downpours are expected.`
    });
    clothing.push('Waterproof raincoat or sturdy umbrella', 'Water-resistant footwear');
    travel.push('Allow extra commuting time due to wet road conditions and potential traffic slowdowns');
    outdoorActivities.push('Carry rain gear or plan indoor backup activities');
  } else if (rainProb >= 30) {
    rulesTriggered.push('SLIGHT_RAIN_CHANCE');
    clothing.push('Compact umbrella recommended in your bag');
    travel.push('Minor rain showers possible during the day');
  }

  // --- 4. WIND SPEED RULES ---
  if (windSpeed !== null && windSpeed >= 30) {
    rulesTriggered.push('STRONG_WIND');
    risks.push({
      level: 'MODERATE',
      title: 'Strong Wind Warning',
      message: `Gusty winds detected (${windSpeed} km/h). Loose objects may blow around.`
    });
    travel.push('Exercise caution while driving high-profile vehicles or two-wheelers');
    outdoorActivities.push('Secure loose outdoor items; avoid cycling under unstable trees');
  }

  // --- 5. VISIBILITY RULES ---
  if (visibility !== null && visibility <= 3.0) {
    rulesTriggered.push('REDUCED_VISIBILITY');
    risks.push({
      level: 'HIGH',
      title: 'Reduced Road Visibility',
      message: `Visibility is reduced to ${visibility} km due to fog/haze. Drive with headlights on.`
    });
    travel.push('Maintain increased braking distance; use low-beam fog lights while driving');
  }

  // --- 6. DEFAULT FALLBACKS IF LISTS ARE EMPTY ---
  if (travel.length === 0) {
    travel.push('Travel conditions are clear and favorable.');
  }
  if (outdoorActivities.length === 0) {
    outdoorActivities.push('Great day for walking, running, and outdoor recreation.');
  }
  if (dailyPlanning.length === 0) {
    dailyPlanning.push('Conditions are comfortable for routine daily plans.');
  }

  return {
    rules_triggered: rulesTriggered,
    recommendations: {
      clothing,
      travel,
      outdoor_activities: outdoorActivities,
      daily_planning: dailyPlanning
    },
    risks
  };
}

module.exports = {
  generateWeatherActions
};
