/**
 * AI Weather Agent - Main Server File
 * Entry point for Node.js Express backend.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// Register API router
app.use('/api', apiRoutes);

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server (Only when run directly, e.g. node server/index.js)
if (require.main === module) {
  const hasOpenWeatherKey = Boolean(process.env.OPENWEATHER_API_KEY && process.env.OPENWEATHER_API_KEY.trim());
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim());

  app.listen(PORT, () => {
    console.log(`===================================================`);
    console.log(` AI Weather Agent running at: http://localhost:${PORT}`);
    console.log(` OpenWeather API Key Configured: ${hasOpenWeatherKey ? 'YES' : 'NO (Using demo engine)'}`);
    console.log(` Gemini LLM API Key Configured: ${hasGeminiKey ? 'YES' : 'NO (Using heuristic engine)'}`);
    console.log(`===================================================`);
  });
}

// Export Express app for Vercel Serverless Functions & tests
module.exports = app;
