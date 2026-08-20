/**
 * AI Weather Intelligence & Conversational Agent Engine
 * Performs deep natural language weather data analysis, weather trend detection,
 * contextual chatbot question answering, and structured weather reporting.
 */

const { generateWeatherActions } = require('./weatherRules');

const SYSTEM_PROMPT = `You are an advanced AI Weather Assistant.
Your job is to interpret verified weather information provided by the weather-data service.
Always prioritize the latest available API data.
Never invent weather information.
When data is missing, clearly say that the information is unavailable.
Do not simply repeat raw weather values. Explain what they mean.
When appropriate, convert weather data into practical recommendations.
Use the user's conversation context to understand references such as 'today', 'tomorrow', 'this evening', and 'there'.
For advanced questions, analyze temperature, feels-like temperature, humidity, wind, precipitation, visibility, cloud cover, pressure, air quality, UV information, and alerts when those fields are available.
For comparisons, clearly compare the relevant weather metrics.
For recommendations, explain the weather factors behind the recommendation.
Keep normal answers concise.
When the user requests advanced analysis, provide a structured and detailed explanation.
Never claim that an action has been performed if the application has not actually performed it.
Never fabricate API data.
Your goal is to help the user understand the weather and make better daily decisions.`;

/**
 * Generate a complete AI Weather Analysis package for the UI Insights tab
 */
function generateAIInsightsPackage(normalizedData) {
  if (!normalizedData) return null;

  const actions = generateWeatherActions(normalizedData);
  const tempAnalysis = analyzeTemperature(normalizedData);
  const humidityAnalysis = analyzeHumidity(normalizedData);
  const windAnalysis = analyzeWind(normalizedData);
  const precipAnalysis = analyzePrecipitation(normalizedData);
  const visibilityAnalysis = analyzeVisibility(normalizedData);
  const cloudAnalysis = analyzeCloudCover(normalizedData);
  const forecastHighlights = analyzeForecastTrends(normalizedData);

  const headline = generateHeadline(normalizedData, actions);
  const structuredAnalysis = generateStructuredAnalysis(normalizedData, actions, forecastHighlights);

  return {
    headline,
    structured_analysis: structuredAnalysis,
    analyses: {
      temperature: tempAnalysis,
      humidity: humidityAnalysis,
      wind: windAnalysis,
      precipitation: precipAnalysis,
      visibility: visibilityAnalysis,
      cloud_cover: cloudAnalysis
    },
    forecast_trends: forecastHighlights,
    actions
  };
}

/**
 * Process a conversational chatbot request
 */
async function processChatbotQuery({ question, weatherData, history = [] }) {
  if (!weatherData) {
    return {
      reply: "Please select or search for a location first so I can access verified OpenWeather data to answer your question.",
      source: "AI Weather Agent"
    };
  }

  const q = question.trim().toLowerCase();
  const location = weatherData.location || 'the requested city';

  // Check if user has configured a Gemini API key for external LLM generation
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') {
    try {
      const llmReply = await queryGeminiAPI({ question, weatherData, history });
      if (llmReply) {
        return { reply: llmReply, source: "Gemini AI + OpenWeather API" };
      }
    } catch (err) {
      console.warn('[AI Engine] Gemini API call error fallback to built-in reasoning engine:', err.message);
    }
  }

  // --- LOCAL HIGH-PERFORMANCE AI REASONING PIPELINE ---
  const actions = generateWeatherActions(weatherData);
  const forecastTrends = analyzeForecastTrends(weatherData);

  // 1. COMPARISON INTENT ("compare today and tomorrow", "compare today's weather with tomorrow")
  if (q.includes('compare') || (q.includes('today') && q.includes('tomorrow'))) {
    return {
      reply: generateComparisonTable(weatherData),
      source: "AI Weather Agent (Reasoning Pipeline)"
    };
  }

  // 2. DETAILED / ADVANCED WEATHER ANALYSIS COMMANDS
  if (q.includes('detailed') || q.includes('advanced') || q.includes('complete weather analysis') || q.includes('everything important')) {
    return {
      reply: generateStructuredAnalysis(weatherData, actions, forecastTrends),
      source: "AI Weather Agent (Reasoning Pipeline)"
    };
  }

  // 3. BEST TIME OUTSIDE / OUTDOOR RECOMMENDATIONS
  if (q.includes('best time') || q.includes('go outside') || q.includes('walk') || q.includes('outdoor')) {
    return {
      reply: generateOutdoorTimeRecommendation(weatherData, actions),
      source: "AI Weather Agent (Reasoning Pipeline)"
    };
  }

  // 4. RAIN / UMBRELLA QUESTIONS
  if (q.includes('rain') || q.includes('umbrella') || q.includes('precipitation') || q.includes('wet')) {
    return {
      reply: generateRainExplanation(weatherData),
      source: "AI Weather Agent (Reasoning Pipeline)"
    };
  }

  // 5. TEMPERATURE & WHY FEELS HOTTER
  if (q.includes('feel') || q.includes('feels like') || q.includes('hotter') || q.includes('temperature') || q.includes('hot') || q.includes('cold')) {
    return {
      reply: generateTemperatureExplanation(weatherData),
      source: "AI Weather Agent (Reasoning Pipeline)"
    };
  }

  // 6. WEATHER RISKS COMMAND
  if (q.includes('risk') || q.includes('warning') || q.includes('caution') || q.includes('alert')) {
    return {
      reply: generateRiskExplanation(weatherData, actions),
      source: "AI Weather Agent (Reasoning Pipeline)"
    };
  }

  // 7. TRAVEL / DRIVING CONDITIONS
  if (q.includes('travel') || q.includes('driv') || q.includes('commute') || q.includes('road')) {
    return {
      reply: generateTravelExplanation(weatherData, actions),
      source: "AI Weather Agent (Reasoning Pipeline)"
    };
  }

  // 8. TOMORROW'S FORECAST
  if (q.includes('tomorrow') || q.includes('next 24 hours') || q.includes('forecast')) {
    return {
      reply: generateForecastExplanation(weatherData, forecastTrends),
      source: "AI Weather Agent (Reasoning Pipeline)"
    };
  }

  // 9. AIR QUALITY INTENT
  if (q.includes('air quality') || q.includes('aqi') || q.includes('pollution')) {
    return {
      reply: generateAirQualityExplanation(weatherData),
      source: "AI Weather Agent (Reasoning Pipeline)"
    };
  }

  // 10. DEFAULT CONCISE SUMMARY & INSIGHT
  return {
    reply: generateDefaultResponse(question, weatherData, actions),
    source: "AI Weather Agent (Reasoning Pipeline)"
  };
}

/* ==========================================================================
   AI DATA INTERPRETATION HELPER FUNCTIONS
   ========================================================================== */

function generateHeadline(data, actions) {
  const temp = data.temperature !== null ? `${data.temperature}°C` : '';
  const cond = data.weather_description || data.weather_condition || 'Clear';
  const feels = data.feels_like !== null ? `feels like ${data.feels_like}°C` : '';
  return `${data.location}: ${temp} with ${cond} (${feels}).`;
}

function analyzeTemperature(data) {
  if (data.temperature === null) return 'Temperature data unavailable.';
  const temp = data.temperature;
  const feels = data.feels_like;
  const diff = (feels !== null) ? Math.round((feels - temp) * 10) / 10 : 0;

  let category = 'mild';
  if (temp >= 38) category = 'very hot';
  else if (temp >= 32) category = 'hot';
  else if (temp >= 24) category = 'warm';
  else if (temp >= 16) category = 'mild';
  else if (temp >= 8) category = 'cool';
  else category = 'cold';

  let diffExplanation = '';
  if (Math.abs(diff) >= 2) {
    if (diff > 0) {
      diffExplanation = ` The actual temperature is ${temp}°C, but atmospheric moisture causes it to feel closer to ${feels}°C (${diff > 0 ? '+' : ''}${diff}°C difference).`;
    } else {
      diffExplanation = ` Wind ventilation makes it feel slightly cooler at ${feels}°C.`;
    }
  } else {
    diffExplanation = ` Thermal perception closely matches the actual temperature of ${temp}°C.`;
  }

  return `Current conditions are classified as **${category}** (${temp}°C).${diffExplanation}`;
}

function analyzeHumidity(data) {
  if (data.humidity === null) return 'Humidity data unavailable.';
  const h = data.humidity;
  let level = 'moderate';
  let impact = '';

  if (h >= 75) {
    level = 'high';
    impact = 'High humidity restricts body sweat evaporation, making outdoor activity feel significantly warmer and stickier than actual thermometer readings.';
  } else if (h <= 30) {
    level = 'low / dry';
    impact = 'Air is dry. You may experience dry skin or throat irritation. Stay hydrated.';
  } else {
    level = 'optimal / comfortable';
    impact = 'Humidity is at a comfortable level for body heat regulation and outdoor comfort.';
  }

  return `Humidity is currently **${h}%** (${level}). ${impact}`;
}

function analyzeWind(data) {
  if (data.wind_speed === null) return 'Wind speed data unavailable.';
  const w = data.wind_speed;
  let intensity = 'calm';
  let impact = '';

  if (w >= 35) {
    intensity = 'strong / gusty';
    impact = 'Noticeable wind turbulence. May affect light outdoor structures, cycling, or high-profile vehicles.';
  } else if (w >= 15) {
    intensity = 'moderate breeze';
    impact = 'A steady breeze is blowing, providing pleasant natural air ventilation.';
  } else {
    intensity = 'gentle / light';
    impact = 'Winds are light and calm.';
  }

  return `Wind speed is **${w} km/h** (${intensity}). ${impact}`;
}

function analyzePrecipitation(data) {
  const pop = data.rain_probability;
  const precip = data.precipitation;

  if (pop >= 60 || (precip && precip > 0)) {
    return `High rain probability detected (**${pop}%** chance). Rain or wet conditions are active/imminent. Carrying rain protection is strongly recommended.`;
  } else if (pop >= 30) {
    return `Moderate rain chance (**${pop}%**). Scattered local showers are possible during the day.`;
  } else {
    return `Rain probability is low (**${pop}%**). Precipitation is unlikely in the immediate period.`;
  }
}

function analyzeVisibility(data) {
  if (data.visibility === null) return 'Visibility data unavailable.';
  const v = data.visibility;
  if (v >= 9) {
    return `Visibility is **excellent (${v} km)**. Clear viewing for driving and outdoor observation.`;
  } else if (v >= 5) {
    return `Visibility is **good (${v} km)**. Normal driving conditions.`;
  } else {
    return `Visibility is **reduced (${v} km)** due to mist/fog/haze. Exercise caution while driving.`;
  }
}

function analyzeCloudCover(data) {
  if (data.cloud_cover === null) return 'Cloud cover data unavailable.';
  const c = data.cloud_cover;
  if (c >= 80) return `Sky is **overcast (${c}% cloud cover)**. Direct solar radiation is minimal.`;
  if (c >= 40) return `Sky is **partly cloudy (${c}% cloud cover)** with alternating sun and shade.`;
  return `Sky is **mostly clear (${c}% cloud cover)** with abundant direct sunlight.`;
}

function analyzeForecastTrends(data) {
  if (!data.forecast || data.forecast.length === 0) {
    return { summary: 'Detailed multi-day forecast entries are unavailable.', next24h: [], peakTemp: null, minTemp: null };
  }

  const next24 = data.forecast.slice(0, 8); // next 24h (8 x 3h slots)
  const temps = next24.map(i => i.temperature).filter(t => t !== null);
  const maxTemp = temps.length > 0 ? Math.max(...temps) : data.temperature;
  const minTemp = temps.length > 0 ? Math.min(...temps) : data.temperature;

  const maxRain = Math.max(...next24.map(i => i.rain_probability || 0));

  let trendMsg = '';
  if (next24.length >= 4) {
    const firstHalfAvg = (next24[0].temperature + next24[1].temperature) / 2;
    const secondHalfAvg = (next24[2].temperature + next24[3].temperature) / 2;
    const diff = Math.round((secondHalfAvg - firstHalfAvg) * 10) / 10;

    if (diff >= 2) trendMsg = `Temperatures are expected to rise by approximately ${diff}°C over the coming hours.`;
    else if (diff <= -2) trendMsg = `Temperatures are expected to drop by approximately ${Math.abs(diff)}°C over the coming hours.`;
    else trendMsg = `Temperatures will remain steady around ${data.temperature}°C.`;
  }

  return {
    trendMessage: trendMsg,
    maxTemp24h: maxTemp,
    minTemp24h: minTemp,
    maxRain24h: maxRain,
    sampleHours: next24
  };
}

function generateStructuredAnalysis(data, actions, forecastTrends) {
  const risks = actions.risks.length > 0
    ? actions.risks.map(r => `• **${r.title}**: ${r.message}`).join('\n')
    : 'No severe weather risks currently detected for this location.';

  const clothingRecs = actions.recommendations.clothing.map(c => `• ${c}`).join('\n');
  const outdoorRecs = actions.recommendations.outdoor_activities.map(o => `• ${o}`).join('\n');

  return `### Weather Summary
**${data.location}, ${data.country || ''}** is currently experiencing **${data.temperature}°C** with **${data.weather_description || data.weather_condition}**.

### Current Conditions
• **Temperature:** ${data.temperature}°C
• **Feels Like:** ${data.feels_like}°C
• **Humidity:** ${data.humidity}%
• **Wind Speed:** ${data.wind_speed} km/h
• **Atmospheric Pressure:** ${data.pressure} hPa
• **Visibility:** ${data.visibility} km
• **Cloud Cover:** ${data.cloud_cover}%

### What It Means
${analyzeTemperature(data)}
${analyzeHumidity(data)}

### Forecast Highlights
${forecastTrends.trendMessage} Expected 24-hour temperature range: **${forecastTrends.minTemp24h}°C to ${forecastTrends.maxTemp24h}°C**. Peak rain chance: **${forecastTrends.maxRain24h}%**.

### Recommendations
**Clothing:**
${clothingRecs}

**Outdoor Activity:**
${outdoorRecs}

### Weather Risk
${risks}`;
}

function generateComparisonTable(data) {
  if (!data.forecast || data.forecast.length < 8) {
    return `### Weather Comparison (Today vs Tomorrow)

| Metric | Today (${data.location}) | Tomorrow |
| :--- | :--- | :--- |
| **Temperature** | ${data.temperature}°C | Data updating |
| **Feels Like** | ${data.feels_like}°C | Data updating |
| **Humidity** | ${data.humidity}% | Data updating |
| **Wind Speed** | ${data.wind_speed} km/h | Data updating |
| **Rain Chance** | ${data.rain_probability}% | Data updating |

*Tomorrow forecast details are currently compiling from OpenWeather data.*`;
  }

  // Find tomorrow's entry (around 24h later, index 8)
  const tmr = data.forecast[8] || data.forecast[7] || data.forecast[data.forecast.length - 1];

  const todayTemp = `${data.temperature}°C`;
  const tmrTemp = `${tmr.temperature}°C`;

  const todayFeels = `${data.feels_like}°C`;
  const tmrFeels = `${tmr.feels_like}°C`;

  const todayHum = `${data.humidity}%`;
  const tmrHum = `${tmr.humidity}%`;

  const todayWind = `${data.wind_speed} km/h`;
  const tmrWind = `${tmr.wind_speed} km/h`;

  const todayRain = `${data.rain_probability}%`;
  const tmrRain = `${tmr.rain_probability}%`;

  const tempDiff = Math.round((tmr.temperature - data.temperature) * 10) / 10;
  let conclusion = '';
  if (tempDiff > 1) {
    conclusion = `Tomorrow is expected to be **${tempDiff}°C warmer** than today in ${data.location}.`;
  } else if (tempDiff < -1) {
    conclusion = `Tomorrow is expected to be **${Math.abs(tempDiff)}°C cooler** than today in ${data.location}.`;
  } else {
    conclusion = `Tomorrow will have **similar temperature conditions** to today in ${data.location}.`;
  }

  if (tmr.rain_probability >= 50 && data.rain_probability < 50) {
    conclusion += ` Note that rain probability increases significantly tomorrow to **${tmr.rain_probability}%**.`;
  }

  return `### Weather Comparison (Today vs Tomorrow)

| Metric | Today (${data.location}) | Tomorrow |
| :--- | :--- | :--- |
| **Temperature** | ${todayTemp} | ${tmrTemp} |
| **Feels Like** | ${todayFeels} | ${tmrFeels} |
| **Rain Probability** | ${todayRain} | ${tmrRain} |
| **Humidity** | ${todayHum} | ${tmrHum} |
| **Wind Speed** | ${todayWind} | ${tmrWind} |
| **Condition** | ${data.weather_description || data.weather_condition} | ${tmr.description || tmr.condition} |

**Conclusion:** ${conclusion}`;
}

function generateOutdoorTimeRecommendation(data, actions) {
  const temp = data.temperature;
  const humidity = data.humidity;
  const rainProb = data.rain_probability;

  if (temp >= 35) {
    return `### Outdoor Activity Guidance for ${data.location}

**Current Recommendation:** Unfavorable for intensive outdoor activity right now.

**Reasoning:**
• Current actual temperature is **${temp}°C** (feels like **${data.feels_like}°C**).
• High solar radiation and temperature can lead to rapid heat fatigue.

**Best Time Windows:**
• **Early Morning (6:00 AM - 8:30 AM):** Lowest daily temperature and most comfortable air.
• **Late Evening (after 6:30 PM):** Sun intensity drops, making walking or exercise far more pleasant.`;
  }

  if (rainProb >= 60) {
    return `### Outdoor Activity Guidance for ${data.location}

**Current Recommendation:** Exercise caution due to rain.

**Reasoning:**
• High rain probability (**${rainProb}%**) with wet outdoor conditions.

**Best Time Windows:**
• Check radar updates for brief dry spells between shower bands, or carry a light waterproof jacket.`;
  }

  return `### Outdoor Activity Guidance for ${data.location}

**Current Recommendation:** Favorable for outdoor activities!

**Reasoning:**
• Temperature is comfortable at **${temp}°C** (feels like **${data.feels_like}°C**).
• Humidity is at **${humidity}%** and rain chance is low (**${rainProb}%**).

Enjoy your outdoor time!`;
}

function generateRainExplanation(data) {
  const pop = data.rain_probability;
  const precip = data.precipitation;

  let answer = '';
  if (pop >= 60 || (precip && precip > 0)) {
    answer = `**Yes, rain is very likely or currently active in ${data.location}.**\n\n• **Rain Probability:** ${pop}%\n• **Status:** ${precip > 0 ? `Active precipitation (${precip} mm)` : 'High likelihood of downpours'}\n\n**Recommendation:** Definitely carry an umbrella or raincoat before heading outside.`;
  } else if (pop >= 30) {
    answer = `**Rain is possible, but not guaranteed in ${data.location}.**\n\n• **Rain Probability:** ${pop}%\n\n**Recommendation:** It is advisable to keep a compact umbrella in your bag just in case of localized showers.`;
  } else {
    answer = `**Rain is unlikely in ${data.location} today.**\n\n• **Rain Probability:** ${pop}%\n• **Current Cloud Cover:** ${data.cloud_cover}%\n\nYou generally do not need an umbrella right now.`;
  }

  return answer;
}

function generateTemperatureExplanation(data) {
  const temp = data.temperature;
  const feels = data.feels_like;
  const humidity = data.humidity;
  const diff = Math.round((feels - temp) * 10) / 10;

  if (diff >= 2) {
    return `### Temperature & Perceived Heat Analysis for ${data.location}

**Actual Temperature:** ${temp}°C  
**Feels Like:** ${feels}°C (Apparent Temperature is **+${diff}°C higher**)

**Why does it feel hotter?**
The high relative humidity (**${humidity}%**) saturates the air with moisture. Because the air already contains significant water vapor, your body's natural cooling mechanism — sweat evaporation — is slowed down. Consequently, your body retains more heat, causing the weather to feel like **${feels}°C**.`;
  } else if (diff <= -2) {
    return `### Temperature Analysis for ${data.location}

**Actual Temperature:** ${temp}°C  
**Feels Like:** ${feels}°C (**${Math.abs(diff)}°C cooler**)

**Why does it feel cooler?**
Wind speed of **${data.wind_speed} km/h** accelerates convective cooling from exposed skin, making conditions feel crisper than the static thermometer reading.`;
  } else {
    return `### Temperature Analysis for ${data.location}

**Actual Temperature:** ${temp}°C  
**Feels Like:** ${feels}°C

The apparent temperature closely matches the actual temperature because relative humidity (**${humidity}%**) and wind speed (**${data.wind_speed} km/h**) are balanced.`;
  }
}

function generateRiskExplanation(data, actions) {
  if (actions.risks && actions.risks.length > 0) {
    const list = actions.risks.map(r => `• **[${r.level}] ${r.title}:** ${r.message}`).join('\n\n');
    return `### Notable Weather Concerns & Risks for ${data.location}

${list}

*Always check updated local weather bulletins during rapid atmospheric changes.*`;
  }

  return `### Weather Risks for ${data.location}

**No significant severe weather alerts or risks are currently active.**

• Temperature: ${data.temperature}°C (Feels like ${data.feels_like}°C)
• Wind Speed: ${data.wind_speed} km/h
• Visibility: ${data.visibility} km (Clear)
• Rain Chance: ${data.rain_probability}%`;
}

function generateTravelExplanation(data, actions) {
  const travelRecs = actions.recommendations.travel.map(t => `• ${t}`).join('\n');
  return `### Travel & Driving Conditions for ${data.location}

${travelRecs}

**Key Metrics:**
• **Road Visibility:** ${data.visibility} km
• **Wind Turbulence:** ${data.wind_speed} km/h
• **Precipitation Risk:** ${data.rain_probability}%`;
}

function generateForecastExplanation(data, forecastTrends) {
  return `### 24-Hour Weather Outlook for ${data.location}

• **Expected Temperature Range:** ${forecastTrends.minTemp24h}°C to ${forecastTrends.maxTemp24h}°C
• **Rain Chance:** ${forecastTrends.maxRain24h}%
• **Trend:** ${forecastTrends.trendMessage}

For multi-day planning, use the **Forecast** tab in the top navigation bar.`;
}

function generateAirQualityExplanation(data) {
  if (!data.air_quality || data.air_quality.aqi === null) {
    return `Air quality index (AQI) data is currently unavailable for ${data.location}.`;
  }
  const aq = data.air_quality;
  return `### Air Quality Analysis for ${data.location}

• **Air Quality Index (AQI):** Level ${aq.aqi} — **${aq.label}**
• **PM2.5 Level:** ${aq.pm2_5 ? `${aq.pm2_5} µg/m³` : 'N/A'}
• **PM10 Level:** ${aq.pm10 ? `${aq.pm10} µg/m³` : 'N/A'}

**Interpretation:**
${aq.aqi <= 2 ? 'Air quality is satisfactory and poses little to no risk for outdoor exercise.' : 'Air quality is degraded. Sensitive individuals should consider limiting prolonged outdoor exertion.'}`;
}

function generateDefaultResponse(question, data, actions) {
  return `### Weather Update for ${data.location}

Currently **${data.temperature}°C** with **${data.weather_description || data.weather_condition}** (Feels like **${data.feels_like}°C**).

• **Humidity:** ${data.humidity}%
• **Wind:** ${data.wind_speed} km/h
• **Rain Chance:** ${data.rain_probability}%

**Quick Recommendation:**  
${actions.recommendations.daily_planning[0] || 'Conditions are normal for daily activities.'}

*Feel free to ask specific questions like "Will it rain?", "Compare today and tomorrow", or "Best time to go outside".*`;
}

/**
 * Optional external LLM connector (Gemini API)
 */
async function queryGeminiAPI({ question, weatherData, history }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey.startsWith('AQ.')) {
    // Return null silently if key is missing or non-standard format
    return null;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    const promptText = `${SYSTEM_PROMPT}

VERIFIED OPENWEATHER API DATA FOR ${weatherData.location || 'Location'}:
${JSON.stringify(weatherData, null, 2)}

USER QUESTION: "${question}"`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }]
      })
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
      return json.candidates[0].content.parts[0].text;
    }
  } catch (err) {
    // Non-critical fallback
  }
  return null;
}


module.exports = {
  generateAIInsightsPackage,
  processChatbotQuery
};
