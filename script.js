document.addEventListener('DOMContentLoaded', () => {
    const THEME_STORAGE_KEY = 'civicpath-theme';
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeToggleLabel = themeToggleBtn?.querySelector('.theme-toggle-label');
    // --- Navigation Logic ---
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');

    function readStoredTheme() {
        try {
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            return savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : null;
        } catch (error) {
            return null;
        }
    }

    function detectPreferredTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function updateThemeToggle(theme) {
        if (!themeToggleBtn || !themeToggleLabel) return;

        const isDark = theme === 'dark';
        themeToggleBtn.setAttribute('aria-pressed', String(isDark));
        themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to day mode' : 'Switch to night mode');
        themeToggleLabel.textContent = isDark ? 'Day mode' : 'Night mode';
    }

    function applyTheme(theme) {
        document.body.dataset.theme = theme;
        updateThemeToggle(theme);
    }

    function persistTheme(theme) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch (error) {
            // Ignore storage issues and keep the in-memory theme state.
        }
    }

    const initialTheme = readStoredTheme() || detectPreferredTheme();
    applyTheme(initialTheme);

    themeToggleBtn?.addEventListener('click', () => {
        const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(nextTheme);
        persistTheme(nextTheme);
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
        if (!readStoredTheme()) {
            applyTheme(event.matches ? 'dark' : 'light');
        }
    });
    
    function switchView(targetId) {
        // Update active nav
        navItems.forEach(item => {
            if (item.dataset.target === targetId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Show target view
        views.forEach(view => {
            if (view.id === targetId) {
                view.classList.remove('hidden');
                // Retrigger animation
                view.style.animation = 'none';
                view.offsetHeight; /* trigger reflow */
                view.style.animation = null; 
            } else {
                view.classList.add('hidden');
            }
        });
    }

    // Nav Click Event
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchView(item.dataset.target);
        });
    });

    // Topbar Assistant Button
    document.getElementById('topbar-assistant-btn').addEventListener('click', () => {
        switchView('assistant-view');
    });

    // --- Chat & Server Logic ---
    const API_URLS = buildApiUrls();
    
    const dashboardAskInput = document.getElementById('dashboard-ask-input');
    const dashboardAskBtn = document.getElementById('dashboard-ask-btn');
    const dashboardChips = document.querySelectorAll('#dashboard-view .chip');

    const chatMessagesContainer = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const assistantChips = document.querySelectorAll('#assistant-chips .chip');

    let isTyping = false;

    function buildApiUrls() {
        const urls = [];

        if (window.location.origin.startsWith('http')) {
            urls.push(new URL('/ask', window.location.origin).toString());
        }

        urls.push('http://127.0.0.1:8080/ask', 'http://localhost:8080/ask');

        return [...new Set(urls)];
    }

    async function parseApiResponse(response) {
        const rawText = await response.text();

        if (!rawText.trim()) {
            throw new Error('The server returned an empty response.');
        }

        try {
            return JSON.parse(rawText);
        } catch (error) {
            const contentType = response.headers.get('content-type') || '';

            if (contentType.includes('text/html') || rawText.includes('<!DOCTYPE html')) {
                throw new Error('The chat request reached a static file server instead of the CivicPath API. Start `npm start` and open http://127.0.0.1:8080.');
            }

            throw new Error('The server returned invalid JSON.');
        }
    }

    async function requestAssistant(prompt) {
        let lastError = new Error('Unable to reach the CivicPath API.');

        for (const apiUrl of API_URLS) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt })
                });

                const data = await parseApiResponse(response);

                if (!response.ok) {
                    throw new Error(data.error || `Request failed with status ${response.status}.`);
                }

                return data;
            } catch (error) {
                if (error instanceof TypeError) {
                    lastError = new Error('Cannot reach the CivicPath API. Start `npm start` and open http://127.0.0.1:8080.');
                } else {
                    lastError = error;
                }
            }
        }

        throw lastError;
    }

    // Markdown Parser
    function parseMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br/>');
    }

    // Scroll to bottom
    function scrollToBottom() {
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }

    // Add Message to Chat UI
    function appendMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}`;
        
        let innerHTML = '';
        if (role === 'assistant') {
            innerHTML += `
                <div class="icon-box" style="background-color: var(--primary-500); color: white; border-radius: 50%; width: 32px; height: 32px; flex-shrink: 0;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
                </div>
            `;
        }

        innerHTML += `
            <div class="message-bubble">
                ${parseMarkdown(content)}
            </div>
        `;
        
        msgDiv.innerHTML = innerHTML;
        chatMessagesContainer.appendChild(msgDiv);
        scrollToBottom();
    }

    function appendSources(sources) {
        if (!Array.isArray(sources) || sources.length === 0) return;

        const sourceBlock = document.createElement('div');
        sourceBlock.className = 'assistant-sources';
        sourceBlock.innerHTML = `
            <p class="assistant-sources-title">Official sources</p>
            <div class="assistant-sources-list">
                ${sources.map((source) => `
                    <a class="assistant-source-link" href="${source.url}" target="_blank" rel="noopener noreferrer">
                        ${source.label}
                    </a>
                `).join('')}
            </div>
        `;

        chatMessagesContainer.appendChild(sourceBlock);
        scrollToBottom();
    }

    function appendCivicContext(civicContext) {
        if (!civicContext?.pollingLocation?.address) return;

        const infoBlock = document.createElement('div');
        infoBlock.className = 'assistant-civic-context';
        infoBlock.innerHTML = `
            <p class="assistant-sources-title">${civicContext.source}</p>
            <div class="assistant-civic-card">
                <strong>${civicContext.electionName || 'Election context'}</strong>
                <p>${civicContext.pollingLocation.address}</p>
            </div>
        `;

        chatMessagesContainer.appendChild(infoBlock);
        scrollToBottom();
    }

    // Add Loading Indicator
    function appendLoading() {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message assistant loading-msg`;
        msgDiv.innerHTML = `
            <div class="icon-box" style="background-color: var(--primary-500); color: white; border-radius: 50%; width: 32px; height: 32px; flex-shrink: 0;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
            </div>
            <div class="message-bubble" style="display: flex; align-items: center; gap: 0.5rem;">
                <div class="spinner"></div> <span style="color: var(--slate-500); font-size: 0.875rem;">Thinking...</span>
            </div>
        `;
        chatMessagesContainer.appendChild(msgDiv);
        scrollToBottom();
        return msgDiv;
    }

    // Handle Sending Message
    async function sendMessage(text) {
        if (!text.trim() || isTyping) return;

        // Switch to assistant view if we are sending from dashboard
        switchView('assistant-view');

        // Add user message
        appendMessage('user', text);
        chatInput.value = '';
        dashboardAskInput.value = '';
        isTyping = true;

        const loadingMsg = appendLoading();

        try {
            const data = await requestAssistant(
                `You are CivicPath, an expert AI assistant for Indian elections. Answer the following question clearly and helpfully. Use markdown formatting like **bold** for emphasis. Keep the answer concise but informative.\n\nQuestion: ${text}`
            );

            const aiText = data.steps?.[0]?.content || 'Sorry, I could not generate an answer.';
            
            loadingMsg.remove();
            appendMessage('assistant', aiText);
            appendSources(data.sources);
            appendCivicContext(data.civicContext);
            
            // Append source
            const sourceDiv = document.createElement('div');
            sourceDiv.style.marginLeft = '44px'; // align with bubble
            sourceDiv.style.marginTop = '-16px';
            sourceDiv.innerHTML = `<span class="badge badge-success" style="font-size: 0.65rem;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:2px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Verified Source</span>`;
            chatMessagesContainer.appendChild(sourceDiv);
            scrollToBottom();

        } catch (error) {
            console.error('Fetch Error:', error);
            loadingMsg.remove();
            appendMessage('assistant', `Sorry, I couldn't complete that request. ${error.message || 'Please check that the JavaScript server is running and GEMINI_API_KEY is set.'}`);
        } finally {
            isTyping = false;
        }
    }

    // --- Event Listeners for Input ---

    // Dashboard Ask
    dashboardAskBtn.addEventListener('click', () => sendMessage(dashboardAskInput.value));
    dashboardAskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage(dashboardAskInput.value);
    });

    dashboardChips.forEach(chip => {
        chip.addEventListener('click', () => {
            // Extract text without the SVG
            const text = chip.textContent.trim();
            sendMessage(text);
        });
    });

    // Assistant Chat
    chatSendBtn.addEventListener('click', () => sendMessage(chatInput.value));
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage(chatInput.value);
    });

    assistantChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const text = chip.textContent.trim();
            sendMessage(text);
        });
    });

});
