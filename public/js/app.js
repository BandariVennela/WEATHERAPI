/**
 * AI Weather Agent - Main Application JS
 * Handles UI interactions, API fetching, DOM rendering, geolocation, and tab navigation.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  window.currentWeatherData = null;
  let activeTab = 'weather-tab';

  // Alert Notifications Preference State (default: enabled unless saved as 'false')
  let alertsEnabled = localStorage.getItem('weather_alerts_enabled') !== 'false';

  // DOM Elements
  const searchForm = document.getElementById('search-form');
  const locationInput = document.getElementById('location-input');
  const geoLocationBtn = document.getElementById('geo-location-btn');
  const cityChips = document.querySelectorAll('.city-chip');

  const demoNotice = document.getElementById('demo-notice');
  const errorBanner = document.getElementById('error-banner');
  const errorMessage = document.getElementById('error-message');
  const weatherAlertBox = document.getElementById('weather-alert-box');
  const alertBoxMuteBtn = document.getElementById('alert-box-mute-btn');

  const alertToggleBtn = document.getElementById('alert-toggle-btn');
  const alertToggleText = document.getElementById('alert-toggle-text');
  const toastContainer = document.getElementById('toast-container');

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeToggleText = document.getElementById('theme-toggle-text');

  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  const quickAskAiBtn = document.getElementById('quick-ask-ai-btn');

  // --- INITIALIZATION ---
  initThemeManager();
  initNavigation();
  initSearch();
  initAlertToggle();

  // Load default initial city: Hyderabad
  fetchWeatherData('Hyderabad');

  /* ==========================================================================
     LIGHT / DARK THEME MANAGER
     ========================================================================== */
  function initThemeManager() {
    let savedTheme = localStorage.getItem('theme');
    if (!savedTheme) {
      savedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    applyTheme(savedTheme);

    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        showToast(newTheme === 'dark' ? '🌙 Dark Mode enabled' : '☀️ Light Mode enabled');
      });
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);

    if (!themeToggleBtn || !themeToggleText) return;

    const sunIcon = themeToggleBtn.querySelector('.theme-icon-sun');
    const moonIcon = themeToggleBtn.querySelector('.theme-icon-moon');

    if (theme === 'dark') {
      themeToggleText.textContent = 'Light';
      themeToggleBtn.title = 'Switch to Light Mode';
      if (sunIcon) sunIcon.classList.remove('hidden');
      if (moonIcon) moonIcon.classList.add('hidden');
    } else {
      themeToggleText.textContent = 'Dark';
      themeToggleBtn.title = 'Switch to Dark Mode';
      if (sunIcon) sunIcon.classList.add('hidden');
      if (moonIcon) moonIcon.classList.remove('hidden');
    }
  }


  /* ==========================================================================
     ALERT NOTIFICATIONS ENGINE (ENABLE / DISABLE TOGGLE)
     ========================================================================== */
  function initAlertToggle() {
    updateAlertToggleUI();

    if (alertToggleBtn) {
      alertToggleBtn.addEventListener('click', () => {
        alertsEnabled = !alertsEnabled;
        localStorage.setItem('weather_alerts_enabled', alertsEnabled ? 'true' : 'false');
        
        updateAlertToggleUI();

        if (alertsEnabled) {
          showToast('🔔 Weather alert notifications enabled');
          requestWebNotificationPermission();
        } else {
          showToast('🔕 Weather alert notifications muted');
        }

        // Re-evaluate alert banner display
        if (window.currentWeatherData && window.currentWeatherData.risks) {
          renderAlerts(window.currentWeatherData.risks);
        } else if (!alertsEnabled) {
          weatherAlertBox.classList.add('hidden');
        }
      });
    }

    if (alertBoxMuteBtn) {
      alertBoxMuteBtn.addEventListener('click', () => {
        alertsEnabled = false;
        localStorage.setItem('weather_alerts_enabled', 'false');
        updateAlertToggleUI();
        weatherAlertBox.classList.add('hidden');
        showToast('🔕 Weather alert notifications muted');
      });
    }
  }

  function updateAlertToggleUI() {
    if (!alertToggleBtn || !alertToggleText) return;

    if (alertsEnabled) {
      alertToggleBtn.classList.add('active');
      alertToggleBtn.classList.remove('muted');
      alertToggleText.textContent = 'Alerts: Enabled';
    } else {
      alertToggleBtn.classList.add('muted');
      alertToggleBtn.classList.remove('active');
      alertToggleText.textContent = 'Alerts: Muted';
    }
  }

  function requestWebNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          showToast('Browser Push Notifications permission granted!');
        }
      });
    }
  }

  function showToast(message, isAlert = false) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast-msg ${isAlert ? 'toast-alert' : ''}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  /* ==========================================================================
     TAB NAVIGATION
     ========================================================================== */
  function initNavigation() {
    navTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetTab = tab.getAttribute('data-tab');
        switchTab(targetTab);
      });
    });

    if (quickAskAiBtn) {
      quickAskAiBtn.addEventListener('click', () => {
        switchTab('chat-tab');
      });
    }
  }

  function switchTab(tabId) {
    activeTab = tabId;
    navTabs.forEach(t => {
      if (t.getAttribute('data-tab') === tabId) {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });

    tabPanes.forEach(pane => {
      if (pane.id === tabId) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });
  }

  /* ==========================================================================
     SEARCH & GEOLOCATION
     ========================================================================== */
  function initSearch() {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const city = locationInput.value.trim();
      if (city) {
        fetchWeatherData(city);
      }
    });

    cityChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const city = chip.getAttribute('data-city');
        locationInput.value = city;
        fetchWeatherData(city);
      });
    });

    geoLocationBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser.');
        return;
      }

      geoLocationBtn.disabled = true;
      geoLocationBtn.innerHTML = `Locating...`;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          geoLocationBtn.disabled = false;
          geoLocationBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><crosshair cx="12" cy="12" r="10"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg> Use My Location`;
          fetchWeatherDataByCoords(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          geoLocationBtn.disabled = false;
          geoLocationBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><crosshair cx="12" cy="12" r="10"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg> Use My Location`;
          showError('Unable to retrieve your location. Please type your city manually.');
        }
      );
    });
  }

  /* ==========================================================================
     API FETCHING & ROBUST JSON PARSING
     ========================================================================== */
  async function safeFetchJson(url) {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';
    
    let payload;
    if (contentType.includes('application/json')) {
      payload = await response.json();
    } else {
      const text = await response.text();
      console.error('Non-JSON API response:', text.slice(0, 200));
      throw new Error('Unable to parse server response. If deploying on Vercel, please verify serverless routing.');
    }

    if (!response.ok || payload.error) {
      throw new Error(payload.message || 'Failed to retrieve weather data.');
    }

    return payload;
  }

  async function fetchWeatherData(city) {
    hideError();
    setLoadingState(true);

    try {
      const payload = await safeFetchJson(`/api/weather?city=${encodeURIComponent(city)}`);
      setLoadingState(false);
      processWeatherPayload(payload);
    } catch (err) {
      setLoadingState(false);
      showError(err.message);
    }
  }

  async function fetchWeatherDataByCoords(lat, lon) {
    hideError();
    setLoadingState(true);

    try {
      const payload = await safeFetchJson(`/api/weather?lat=${lat}&lon=${lon}`);
      setLoadingState(false);
      processWeatherPayload(payload);
    } catch (err) {
      setLoadingState(false);
      showError(err.message);
    }
  }


  /* ==========================================================================
     DATA PROCESSING & DOM RENDERING
     ========================================================================== */
  function processWeatherPayload(payload) {
    const data = payload.data;
    const insights = payload.ai_insights;
    const meta = payload.meta;

    // Store in global state for chatbot assistant
    window.currentWeatherData = data;

    // Check demo notice
    if (meta.is_demo) {
      demoNotice.classList.remove('hidden');
    } else {
      demoNotice.classList.add('hidden');
    }

    // Render components
    renderHero(data);
    renderMetrics(data);
    renderForecast(data);
    renderActionsAndInsights(insights);
    renderAlerts(insights.actions.risks);

    // Update chatbot context indicator
    if (window.updateChatContext) {
      window.updateChatContext(data.location);
    }
  }

  function renderHero(data) {
    document.getElementById('hero-location').textContent = `${data.location}${data.country ? ', ' + data.country : ''}`;
    
    const formattedDate = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('hero-time').textContent = `Updated: Today, ${formattedDate}`;

    document.getElementById('hero-temp').textContent = data.temperature !== null ? Math.round(data.temperature) : '--';
    document.getElementById('hero-feels').textContent = data.feels_like !== null ? `${data.feels_like}°C` : '--';

    document.getElementById('hero-condition').textContent = data.weather_description || data.weather_condition || 'N/A';

    if (data.temp_max !== null && data.temp_min !== null) {
      document.getElementById('hero-high').textContent = `${data.temp_max}°C`;
      document.getElementById('hero-low').textContent = `${data.temp_min}°C`;
    }

    if (data.weather_icon) {
      document.getElementById('hero-icon').src = `https://openweathermap.org/img/wn/${data.weather_icon}@2x.png`;
    }
  }

  function renderMetrics(data) {
    document.getElementById('m-humidity').textContent = data.humidity !== null ? `${data.humidity}%` : 'N/A';
    document.getElementById('m-humidity-desc').textContent = data.humidity >= 70 ? 'High moisture levels' : 'Comfortable levels';

    document.getElementById('m-wind').textContent = data.wind_speed !== null ? `${data.wind_speed} km/h` : 'N/A';
    document.getElementById('m-wind-desc').textContent = data.wind_direction !== null ? `Direction (${data.wind_direction}°)` : 'Normal flow';

    document.getElementById('m-rain').textContent = `${data.rain_probability}%`;
    document.getElementById('m-rain-desc').textContent = data.rain_probability >= 50 ? 'Rain showers likely' : 'Low precipitation risk';

    document.getElementById('m-pressure').textContent = data.pressure !== null ? `${data.pressure} hPa` : 'N/A';
    document.getElementById('m-visibility').textContent = data.visibility !== null ? `${data.visibility} km` : 'N/A';
    document.getElementById('m-clouds').textContent = data.cloud_cover !== null ? `${data.cloud_cover}%` : 'N/A';

    // Sunrise / Sunset
    if (data.sunrise && data.sunset) {
      const sr = new Date(data.sunrise).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const ss = new Date(data.sunset).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      document.getElementById('m-sun').textContent = `${sr} / ${ss}`;
    } else {
      document.getElementById('m-sun').textContent = 'N/A';
    }

    // Air Quality
    if (data.air_quality && data.air_quality.label) {
      document.getElementById('m-aqi').textContent = `Level ${data.air_quality.aqi} (${data.air_quality.label})`;
      document.getElementById('m-aqi-desc').textContent = `PM2.5: ${data.air_quality.pm2_5 || 'N/A'} µg/m³`;
    } else {
      document.getElementById('m-aqi').textContent = 'Unavailable';
      document.getElementById('m-aqi-desc').textContent = 'OpenWeather AQI feed not active';
    }
  }

  function renderForecast(data) {
    const hourlyBar = document.getElementById('hourly-forecast-bar');
    const dailyGrid = document.getElementById('daily-forecast-grid');

    hourlyBar.innerHTML = '';
    dailyGrid.innerHTML = '';

    if (!data.forecast || data.forecast.length === 0) {
      hourlyBar.innerHTML = '<p class="text-muted">No hourly forecast data available.</p>';
      dailyGrid.innerHTML = '<p class="text-muted">No daily forecast data available.</p>';
      return;
    }

    // 1. Render Hourly Bar (Next 24h: 8 slots)
    const next24 = data.forecast.slice(0, 8);
    next24.forEach(item => {
      const card = document.createElement('div');
      card.className = 'hourly-card';
      card.innerHTML = `
        <div class="hourly-time">${item.formatted_time}</div>
        <img class="hourly-icon" src="https://openweathermap.org/img/wn/${item.icon || '01d'}.png" alt="${item.description}">
        <div class="hourly-temp">${item.temperature}°C</div>
        <div class="hourly-pop">${item.rain_probability}% rain</div>
      `;
      hourlyBar.appendChild(card);
    });

    // 2. Aggregate Daily Forecast Cards (Group by Date)
    const daysMap = {};
    data.forecast.forEach(item => {
      const dateKey = item.formatted_date;
      if (!daysMap[dateKey]) {
        daysMap[dateKey] = {
          date: dateKey,
          temps: [],
          icons: [],
          pops: [],
          conditions: []
        };
      }
      if (item.temperature !== null) daysMap[dateKey].temps.push(item.temperature);
      if (item.icon) daysMap[dateKey].icons.push(item.icon);
      if (item.rain_probability !== undefined) daysMap[dateKey].pops.push(item.rain_probability);
      if (item.description) daysMap[dateKey].conditions.push(item.description);
    });

    const dayKeys = Object.keys(daysMap).slice(0, 5);
    dayKeys.forEach(key => {
      const day = daysMap[key];
      const maxTemp = Math.max(...day.temps);
      const minTemp = Math.min(...day.temps);
      const maxPop = Math.max(...day.pops);
      const icon = day.icons[Math.floor(day.icons.length / 2)] || '01d';
      const cond = day.conditions[0] || 'Clear';

      const card = document.createElement('div');
      card.className = 'daily-card';
      card.innerHTML = `
        <div class="daily-date">${day.date}</div>
        <div class="daily-desc">${cond}</div>
        <img class="daily-icon" src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${cond}">
        <div class="daily-temp-range">${maxTemp}° / ${minTemp}°C</div>
        <div class="daily-rain">${maxPop}% rain chance</div>
      `;
      dailyGrid.appendChild(card);
    });
  }

  function renderActionsAndInsights(insights) {
    if (!insights) return;

    // Quick text in Hero section
    document.getElementById('ai-quick-text').textContent = insights.headline || 'Analyzing weather trends...';

    // Actions
    const rec = insights.actions.recommendations;
    fillList('rec-clothing', rec.clothing);
    fillList('rec-travel', rec.travel);
    fillList('rec-outdoor', rec.outdoor_activities);
    fillList('rec-planning', rec.daily_planning);

    // Deep Analysis Blocks
    const a = insights.analyses;
    document.getElementById('analysis-temp').innerHTML = formatMarkdownText(a.temperature);
    document.getElementById('analysis-humidity').innerHTML = formatMarkdownText(a.humidity);
    document.getElementById('analysis-wind').innerHTML = formatMarkdownText(a.wind);
    document.getElementById('analysis-precip').innerHTML = formatMarkdownText(a.precipitation);
  }

  function renderAlerts(risks) {
    // If user disabled/muted alerts, hide alert banner completely
    if (!alertsEnabled) {
      weatherAlertBox.classList.add('hidden');
      return;
    }

    if (risks && risks.length > 0 && (risks[0].level === 'HIGH' || risks[0].level === 'MODERATE')) {
      weatherAlertBox.classList.remove('hidden');
      document.getElementById('alert-title').textContent = risks[0].title;
      document.getElementById('alert-desc').textContent = risks[0].message;

      // Trigger Web Browser Notification if permission granted and alerts enabled
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`Weather Alert: ${risks[0].title}`, {
            body: risks[0].message,
            icon: '/favicon.ico'
          });
        } catch (e) {
          // Ignore notification errors in unsecure contexts
        }
      }
    } else {
      weatherAlertBox.classList.add('hidden');
    }
  }

  /* ==========================================================================
     UTILITIES
     ========================================================================== */
  function fillList(elementId, items) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = '';
    if (items && items.length > 0) {
      items.forEach(txt => {
        const li = document.createElement('li');
        li.textContent = txt;
        el.appendChild(li);
      });
    } else {
      el.innerHTML = '<li>Conditions are normal.</li>';
    }
  }

  function formatMarkdownText(txt) {
    if (!txt) return '';
    return txt.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  function setLoadingState(isLoading) {
    const searchBtn = document.getElementById('search-submit-btn');
    if (isLoading) {
      searchBtn.disabled = true;
      searchBtn.textContent = 'Searching...';
    } else {
      searchBtn.disabled = false;
      searchBtn.textContent = 'Search';
    }
  }

  function showError(msg) {
    errorBanner.classList.remove('hidden');
    errorMessage.textContent = msg;
  }

  function hideError() {
    errorBanner.classList.add('hidden');
  }
});
