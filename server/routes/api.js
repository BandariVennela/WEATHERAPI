/**
 * Express API Router for AI Weather Agent
 * Secure backend layer ensuring API keys are never exposed to the client browser.
 */

const express = require('express');
const router = express.Router();
const { fetchRawWeatherData } = require('../services/openweather');
const { normalizeWeatherData } = require('../services/normalizer');
const { generateAIInsightsPackage, processChatbotQuery } = require('../services/aiEngine');

/**
 * GET /api/weather
 * Query Params: ?city=Hyderabad OR ?lat=17.38&lon=78.48
 */
router.get('/weather', async (req, res) => {
  try {
    const { city, lat, lon } = req.query;

    if (!city && (!lat || !lon)) {
      return res.status(400).json({
        error: true,
        message: 'Please provide a city name or latitude/longitude coordinates.'
      });
    }

    const rawData = await fetchRawWeatherData({
      city: city ? String(city).trim() : null,
      lat: lat ? parseFloat(lat) : null,
      lon: lon ? parseFloat(lon) : null
    });

    const normalizedData = normalizeWeatherData(rawData);
    const aiInsights = generateAIInsightsPackage(normalizedData);

    res.json({
      success: true,
      data: normalizedData,
      ai_insights: aiInsights,
      meta: {
        provider: 'OpenWeather API',
        is_demo: normalizedData.is_demo,
        demo_reason: normalizedData.demo_reason
      }
    });

  } catch (error) {
    console.error('[API /weather Error]:', error.message);
    res.status(400).json({
      error: true,
      message: error.message || 'Unable to retrieve weather data at this time.'
    });
  }
});

/**
 * POST /api/chat
 * Body: { question: string, weatherData: Object, history: Array }
 */
router.post('/chat', async (req, res) => {
  try {
    const { question, weatherData, history } = req.body;

    if (!question || typeof question !== 'string' || question.trim() === '') {
      return res.status(400).json({
        error: true,
        message: 'Please provide a valid question string.'
      });
    }

    const result = await processChatbotQuery({
      question: question.trim(),
      weatherData,
      history: Array.isArray(history) ? history : []
    });

    res.json({
      success: true,
      reply: result.reply,
      source: result.source
    });

  } catch (error) {
    console.error('[API /chat Error]:', error.message);
    res.status(500).json({
      error: true,
      message: 'The Weather Assistant encountered an error processing your question.'
    });
  }
});

/**
 * GET /api/health
 */
router.get('/health', (req, res) => {
  const hasOpenWeatherKey = !!(process.env.OPENWEATHER_API_KEY && process.env.OPENWEATHER_API_KEY.trim() !== '' && process.env.OPENWEATHER_API_KEY !== 'your_openweather_api_key_here');
  const hasGeminiKey = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');

  res.json({
    status: 'online',
    app: 'AI Weather Agent',
    keys_configured: {
      openweather: hasOpenWeatherKey,
      gemini: hasGeminiKey
    }
  });
});

module.exports = router;
