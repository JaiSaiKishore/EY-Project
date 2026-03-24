/**
 * FoodSaver Connect — AI Guiding Chatbot (Claude-powered)
 * Initialise with: FoodSaverBot.init({ role: 'donor'|'volunteer', userName: '...' })
 */
var FoodSaverBot = (function () {
    'use strict';

    var role = 'donor';
    var userName = 'there';
    var isOpen = false;
    var conversation = []; // stores {role, content} for context

    // Quick reply suggestions per role
    var donorQuickReplies = ['How to post food?', 'Track my donation', 'What is Trust Score?', 'How to use chat?'];
    var volunteerQuickReplies = ['How to claim a rescue?', 'Mark a hotspot', 'What is Trust Score?', 'My stats & karma'];

    // ── UI helpers ──────────────────────────────────────────────
    function formatReply(text) {
        return text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
    }

    function addBubble(text, type) {
        var body = document.getElementById('chatbot-body');
        if (!body) return;
        var div = document.createElement('div');
        div.className = 'chatbot-bubble ' + type;
        if (type === 'bot') {
            div.innerHTML = '<div class="bot-label"><i class="fa-solid fa-robot"></i> FoodSaver Bot</div>' + formatReply(text);
        } else {
            div.textContent = text;
        }
        body.appendChild(div);
        body.scrollTop = body.scrollHeight;
    }

    function showTyping() {
        var body = document.getElementById('chatbot-body');
        var t = document.createElement('div');
        t.className = 'chatbot-typing';
        t.id = 'chatbot-typing';
        t.innerHTML = '<span></span><span></span><span></span>';
        body.appendChild(t);
        body.scrollTop = body.scrollHeight;
    }

    function hideTyping() {
        var t = document.getElementById('chatbot-typing');
        if (t) t.remove();
    }

    function showQuickReplies(replies) {
        var container = document.getElementById('chatbot-quick-replies');
        if (!container) return;
        container.innerHTML = '';
        if (!replies || replies.length === 0) return;
        replies.forEach(function (r) {
            var btn = document.createElement('button');
            btn.className = 'chatbot-quick-btn';
            btn.textContent = r;
            btn.addEventListener('click', function () {
                handleUserInput(r);
            });
            container.appendChild(btn);
        });
    }

    function getDefaultQuickReplies() {
        return role === 'donor' ? donorQuickReplies : volunteerQuickReplies;
    }

    function getCookie(name) {
        var v = document.cookie.match('(^|;)\\s*' + name + '=([^;]*)');
        return v ? decodeURIComponent(v[2]) : '';
    }

    // ── API call ────────────────────────────────────────────────
    function sendToBackend(userMessage, callback) {
        fetch('/api/chatbot/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                message: userMessage,
                conversation: conversation
            })
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.reply) {
                callback(null, data.reply);
            } else {
                callback(data.error || 'Something went wrong');
            }
        })
        .catch(function (err) {
            callback('Network error. Please try again.');
        });
    }

    // ── Handle user input ───────────────────────────────────────
    function handleUserInput(text) {
        if (!text.trim()) return;

        addBubble(text, 'user');
        showQuickReplies([]);
        showTyping();

        // Add to conversation history
        conversation.push({ role: 'user', content: text });

        sendToBackend(text, function (err, reply) {
            hideTyping();
            if (err) {
                addBubble("Sorry, I couldn't process that right now. " + err, 'bot');
                showQuickReplies(getDefaultQuickReplies());
            } else {
                addBubble(reply, 'bot');
                conversation.push({ role: 'assistant', content: reply });
                // Show contextual quick replies
                showQuickReplies(getDefaultQuickReplies());
            }
        });
    }

    // ── Public API ──────────────────────────────────────────────
    function init(opts) {
        role = opts.role || 'donor';
        userName = opts.userName || 'there';

        var fab = document.getElementById('chatbot-fab');
        var panel = document.getElementById('chatbot-panel');
        var closeBtn = document.getElementById('chatbot-close-btn');
        var sendBtn = document.getElementById('chatbot-send-btn');
        var input = document.getElementById('chatbot-input');

        if (!fab || !panel) return;

        fab.addEventListener('click', function () {
            isOpen = !isOpen;
            panel.classList.toggle('open', isOpen);
            fab.style.display = isOpen ? 'none' : 'flex';
            if (isOpen && conversation.length === 0) {
                // Send a greeting to Claude to get a welcome message
                showTyping();
                var greeting = 'Hello, my name is ' + userName + '. I just opened the chatbot. Give me a brief welcome and tell me what you can help me with.';
                conversation.push({ role: 'user', content: greeting });
                sendToBackend(greeting, function (err, reply) {
                    hideTyping();
                    if (err) {
                        addBubble("Hi " + userName + "! I'm your FoodSaver guide. I can help you navigate the platform, understand features, and make the most of your experience. What would you like to know?", 'bot');
                    } else {
                        addBubble(reply, 'bot');
                        conversation.push({ role: 'assistant', content: reply });
                    }
                    showQuickReplies(getDefaultQuickReplies());
                });
            }
            if (isOpen) input.focus();
        });

        closeBtn.addEventListener('click', function () {
            isOpen = false;
            panel.classList.remove('open');
            fab.style.display = 'flex';
        });

        sendBtn.addEventListener('click', function () {
            var text = input.value.trim();
            if (text) { input.value = ''; handleUserInput(text); }
        });

        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                var text = input.value.trim();
                if (text) { input.value = ''; handleUserInput(text); }
            }
        });
    }

    return { init: init };
})();
