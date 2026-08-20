/**
 * AI Weather Agent - Chatbot Controller
 * Handles conversation history, natural language queries, Markdown parsing (tables, lists, headers),
 * and quick suggestion chips.
 */

document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatSubmitBtn = document.getElementById('chat-submit-btn');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const chatContextLabel = document.getElementById('chat-context-label');
  const welcomeCity = document.getElementById('welcome-city');

  const chipBtns = document.querySelectorAll('.chip-btn');

  // Conversation history memory
  let history = [];

  // Expose global callback for location updates
  window.updateChatContext = function (cityName) {
    if (chatContextLabel) {
      chatContextLabel.textContent = `Context: Verified OpenWeather Data (${cityName})`;
    }
    if (welcomeCity) {
      welcomeCity.textContent = cityName;
    }
  };

  // --- SUBMIT QUESTION ---
  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = chatInput.value.trim();
    if (!question) return;

    chatInput.value = '';
    await sendUserQuestion(question);
  });

  // --- SUGGESTION CHIPS ---
  chipBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const q = btn.getAttribute('data-question');
      if (q) {
        // Also switch to chat tab if clicked from anywhere
        const chatTabNav = document.getElementById('nav-chat-btn');
        if (chatTabNav) chatTabNav.click();

        await sendUserQuestion(q);
      }
    });
  });

  // --- CLEAR CHAT ---
  clearChatBtn.addEventListener('click', () => {
    history = [];
    chatMessages.innerHTML = `
      <div class="chat-msg assistant">
        <div class="msg-bubble">
          <div class="msg-author">Weather Assistant <span class="badge badge-ai" style="margin-left: 6px;">AI Engine</span></div>
          <div class="msg-content">
            Conversation history cleared. How else can I assist you with weather data for <strong>${window.currentWeatherData ? window.currentWeatherData.location : 'your location'}</strong>?
          </div>
        </div>
      </div>
    `;
  });

  /* ==========================================================================
     CHAT CONTROLLER LOGIC
     ========================================================================== */
  async function sendUserQuestion(questionText) {
    // 1. Render User Message
    appendMessage({ sender: 'user', content: questionText });

    // 2. Render Typing Indicator
    const typingId = appendTypingIndicator();

    // Disable input during request
    chatInput.disabled = true;
    chatSubmitBtn.disabled = true;

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          weatherData: window.currentWeatherData,
          history
        })
      });

      const payload = await response.json();
      removeMessage(typingId);

      chatInput.disabled = false;
      chatSubmitBtn.disabled = false;
      chatInput.focus();

      if (!response.ok || payload.error) {
        appendMessage({
          sender: 'assistant',
          content: payload.message || 'Sorry, I ran into an error processing your request.',
          source: 'Error'
        });
        return;
      }

      // Record history
      history.push({ role: 'user', content: questionText });
      history.push({ role: 'assistant', content: payload.reply });

      // 3. Render Assistant Reply
      appendMessage({
        sender: 'assistant',
        content: payload.reply,
        source: payload.source || 'AI Weather Agent'
      });

    } catch (err) {
      removeMessage(typingId);
      chatInput.disabled = false;
      chatSubmitBtn.disabled = false;

      appendMessage({
        sender: 'assistant',
        content: 'Unable to connect to the Weather Assistant service. Please try again.',
        source: 'Connection Error'
      });
    }
  }

  function appendMessage({ sender, content, source }) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-msg ${sender}`;

    const formattedHTML = sender === 'user'
      ? escapeHTML(content)
      : parseMarkdownToHTML(content);

    const authorLabel = sender === 'user' ? 'You' : 'Weather Assistant';
    const badgeHTML = sender === 'assistant'
      ? `<span class="badge badge-ai" style="margin-left: 6px;">${source || 'AI Engine'}</span>`
      : '';

    msgDiv.innerHTML = `
      <div class="msg-bubble">
        <div class="msg-author">${authorLabel} ${badgeHTML}</div>
        <div class="msg-content">${formattedHTML}</div>
      </div>
    `;

    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function appendTypingIndicator() {
    const id = 'typing-' + Date.now();
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg assistant';
    msgDiv.id = id;
    msgDiv.innerHTML = `
      <div class="msg-bubble">
        <div class="msg-author">Weather Assistant <span class="badge badge-ai" style="margin-left: 6px;">Thinking...</span></div>
        <div class="msg-content" style="color: var(--text-muted);">
          Analyzing OpenWeather API data and compiling response...
        </div>
      </div>
    `;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return id;
  }

  function removeMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  /* ==========================================================================
     MARKDOWN TO HTML PARSER (Tables, Headers, Lists, Bold)
     ========================================================================== */
  function parseMarkdownToHTML(md) {
    if (!md) return '';

    let text = md;

    // 1. Process Markdown Tables (| Metric | Today | Tomorrow |)
    const tableRegex = /\|(.+)\|[\r\n]+\|[-:| ]+\|[\r\n]+((?:\|.+\|[\r\n]*)+)/g;
    text = text.replace(tableRegex, (match, headerLine, bodyLines) => {
      const headers = headerLine.split('|').map(h => h.trim()).filter(h => h !== '');
      const rows = bodyLines.trim().split('\n').map(line => {
        return line.split('|').map(c => c.trim()).filter(c => c !== '');
      });

      let tableHTML = '<table><thead><tr>';
      headers.forEach(h => {
        tableHTML += `<th>${parseInlineMarkdown(h)}</th>`;
      });
      tableHTML += '</tr></thead><tbody>';

      rows.forEach(r => {
        if (r.length > 0) {
          tableHTML += '<tr>';
          r.forEach(cell => {
            tableHTML += `<td>${parseInlineMarkdown(cell)}</td>`;
          });
          tableHTML += '</tr>';
        }
      });
      tableHTML += '</tbody></table>';
      return tableHTML;
    });

    // 2. Headers
    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h3>$1</h3>');

    // 3. Bullet points (• or - or *)
    text = text.replace(/^[•\-\*] (.*$)/gim, '• $1');

    // 4. Line breaks to <br> where appropriate
    text = text.replace(/\n\n/g, '<br><br>');
    text = text.replace(/\n/g, '<br>');

    // 5. Bold & Italic
    text = parseInlineMarkdown(text);

    return text;
  }

  function parseInlineMarkdown(str) {
    if (!str) return '';
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>');
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
