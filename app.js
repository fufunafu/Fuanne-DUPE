// ============================================
// Fuanne DUPE - Hybrid ChatKit + Glass Shell
// ============================================

// Configuration
const CONFIG = {
    // Your Cloudflare Worker URL (update after deploying the worker)
    WORKER_URL: 'https://fuanne-dupe-proxy.fuannegao25.workers.dev',

    // OpenAI Workflow ID from Agent Builder
    WORKFLOW_ID: 'wf_6993855a26d4819091b1bba88fc45c580afdc0b8f95265d1',
};

// ---- ChatKit Integration ----

// Generate a simple device/session ID for the user parameter
function getDeviceId() {
    let id = sessionStorage.getItem('fuanne-dupe-device-id');
    if (!id) {
        id = 'user_' + Math.random().toString(36).substring(2, 15);
        sessionStorage.setItem('fuanne-dupe-device-id', id);
    }
    return id;
}

// Wait for ChatKit library to load, then initialize
function initChatKit() {
    const root = document.getElementById('chatkit-root');
    
    console.log('🔍 Checking ChatKit availability...');
    console.log('  - window.ChatKit:', typeof window.ChatKit !== 'undefined' ? '✅ Available' : '❌ Not available');
    console.log('  - window.React:', typeof window.React !== 'undefined' ? '✅ Available' : '❌ Not available');
    console.log('  - window.ReactDOM:', typeof window.ReactDOM !== 'undefined' ? '✅ Available' : '❌ Not available');
    console.log('  - window.ChatKitReact:', typeof window.ChatKitReact !== 'undefined' ? '✅ Available' : '❌ Not available');
    
    // Debug: Log all window properties that contain "chat" or "Chat"
    const chatRelated = Object.keys(window).filter(k => 
        k.toLowerCase().includes('chat') || k.toLowerCase().includes('openai')
    );
    if (chatRelated.length > 0) {
        console.log('  - Chat-related globals found:', chatRelated);
    }

    // Check multiple possible ways ChatKit might be exposed
    const chatKitAvailable = 
        typeof window.ChatKit !== 'undefined' ||
        typeof window.ChatKitReact !== 'undefined' ||
        (window.OpenAI && window.OpenAI.ChatKit) ||
        (window.openai && window.openai.ChatKit);
    
    if (chatKitAvailable && window.React && window.ReactDOM) {
        console.log('✅ ChatKit and React detected, attempting to mount ChatKit widget...');
        mountChatKit();
        return;
    }

    // If ChatKit React bindings aren't available via CDN globals,
    // fall back to the manual integration approach
    console.log('⚠️ ChatKit widget not available, falling back to manual chat (workflow will not be used)');
    console.log('💡 To use your Agent Builder workflow, ChatKit needs to load. Check Network tab for script loading errors.');
    mountManualChat(root);
}

// ---- ChatKit Widget Integration ----
// Uses ChatKit React component to connect to Agent Builder workflow

function mountChatKit() {
    const root = document.getElementById('chatkit-root');
    if (!root) {
        console.error('❌ ChatKit root element not found');
        return;
    }

    console.log('🔧 Attempting to mount ChatKit widget...');
    console.log('  - Workflow ID:', CONFIG.WORKFLOW_ID);
    console.log('  - Worker URL:', CONFIG.WORKER_URL);

    // Check if React and ChatKit are available
    if (!window.React || !window.ReactDOM) {
        console.error('❌ React or ReactDOM not available');
        console.warn('⚠️ Falling back to manual chat (workflow will not be used)');
        mountManualChat(root);
        return;
    }

    // Check for ChatKit React bindings
    // The CDN might expose it differently - let's check multiple possibilities
    let ChatKitComponent, useChatKitHook;
    
    if (window.ChatKitReact && window.ChatKitReact.ChatKit && window.ChatKitReact.useChatKit) {
        console.log('✅ Found ChatKitReact from CDN');
        ChatKitComponent = window.ChatKitReact.ChatKit;
        useChatKitHook = window.ChatKitReact.useChatKit;
    } else if (window.ChatKit && window.ChatKit.ChatKit && window.ChatKit.useChatKit) {
        console.log('✅ Found ChatKit from window.ChatKit');
        ChatKitComponent = window.ChatKit.ChatKit;
        useChatKitHook = window.ChatKit.useChatKit;
    } else {
        console.error('❌ ChatKit React bindings not found');
        console.log('Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('chat')));
        console.warn('⚠️ Falling back to manual chat (workflow will not be used)');
        mountManualChat(root);
        return;
    }

    const { useState, useEffect } = window.React;
    const { createRoot } = window.ReactDOM;

    // ChatKit component that connects to your workflow
    function ChatKitWrapper() {
        console.log('🎨 Creating ChatKit component...');
        
        const { control } = useChatKitHook({
            api: {
                async getClientSecret(existing) {
                    console.log('🔑 Requesting ChatKit session...', existing ? '(refreshing)' : '(new)');
                    
                    if (existing) {
                        // Implement session refresh if needed
                        // For now, create a new session
                    }

                    // Get client secret from our worker
                    const res = await fetch(CONFIG.WORKER_URL + '/chatkit/session', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            workflowId: CONFIG.WORKFLOW_ID,
                            userId: getDeviceId(),
                        }),
                    });

                    if (!res.ok) {
                        const errorText = await res.text();
                        console.error('❌ Failed to create ChatKit session:', errorText);
                        throw new Error('Failed to create ChatKit session: ' + errorText);
                    }

                    const { client_secret } = await res.json();
                    console.log('✅ ChatKit session created successfully');
                    return client_secret;
                },
            },
        });

        return window.React.createElement(ChatKitComponent, {
            control: control,
            className: 'chatkit-widget',
            style: {
                height: '100%',
                width: '100%',
            },
        });
    }

    // Mount ChatKit using React
    try {
        console.log('🚀 Mounting ChatKit React component...');
        const reactRoot = createRoot(root);
        reactRoot.render(window.React.createElement(ChatKitWrapper));
        console.log('✅ ChatKit widget mounted successfully!');
    } catch (error) {
        console.error('❌ Failed to mount ChatKit:', error);
        console.error('Error details:', error.stack);
        console.warn('⚠️ Falling back to manual chat (workflow will not be used)');
        mountManualChat(root);
    }
}

// ---- Manual Chat (Fallback / Pre-ChatKit-CDN) ----
// This provides the full chat experience using direct API calls
// through the Cloudflare Worker, matching the ChatKit flow.

function mountManualChat(root) {
    root.innerHTML = `
        <div class="chat-wrapper">
            <!-- Welcome / Empty state -->
            <div class="welcome-state" id="welcomeState">
                <div class="welcome-glass-card">
                    <div class="welcome-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#welcomeGrad)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            <defs>
                                <linearGradient id="welcomeGrad" x1="0" y1="0" x2="24" y2="24">
                                    <stop offset="0%" stop-color="#60a5fa"/>
                                    <stop offset="100%" stop-color="#a78bfa"/>
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <h1>Welcome to Fuanne DUPE</h1>
                    <p>Your internal knowledge assistant. Ask any question about company policies, procedures, or guidelines.</p>
                </div>

                <div class="quick-prompts">
                    <button class="prompt-chip" onclick="sendQuickPrompt(this)">
                        <span class="chip-icon">📋</span>
                        What is the vacation policy?
                    </button>
                    <button class="prompt-chip" onclick="sendQuickPrompt(this)">
                        <span class="chip-icon">💼</span>
                        How do I submit an expense report?
                    </button>
                    <button class="prompt-chip" onclick="sendQuickPrompt(this)">
                        <span class="chip-icon">🏥</span>
                        What are the health benefits?
                    </button>
                    <button class="prompt-chip" onclick="sendQuickPrompt(this)">
                        <span class="chip-icon">📅</span>
                        What are the company holidays?
                    </button>
                </div>
            </div>

            <!-- Chat messages area -->
            <div class="messages-area" id="messagesArea"></div>

            <!-- Input area -->
            <div class="input-area">
                <div class="input-wrapper">
                    <textarea
                        id="messageInput"
                        placeholder="Ask DUPE anything about company policies..."
                        rows="1"
                        onkeydown="handleKeyDown(event)"
                        oninput="autoResize(this)"
                    ></textarea>
                    <button class="send-btn" id="sendBtn" onclick="sendMessage()" disabled>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
                <div class="input-footer">
                    <span>Fuanne DUPE may make mistakes. Verify important information.</span>
                </div>
            </div>
        </div>
    `;

    // Set up input listener
    const input = document.getElementById('messageInput');
    const btn = document.getElementById('sendBtn');
    input.addEventListener('input', () => {
        btn.disabled = input.value.trim() === '';
    });
}

// ---- Chat State ----
let threadId = null;
let isLoading = false;

// ---- Input handling ----

function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
}

function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const btn = document.getElementById('sendBtn');
        if (btn && !btn.disabled && !isLoading) {
            sendMessage();
        }
    }
}

// ---- Quick prompts ----

function sendQuickPrompt(btn) {
    const text = btn.textContent.trim();
    const input = document.getElementById('messageInput');
    if (input) {
        input.value = text;
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn) sendBtn.disabled = false;
        sendMessage();
    }
}

// ---- Chat UI helpers ----

function showChatMode() {
    const welcome = document.getElementById('welcomeState');
    const messages = document.getElementById('messagesArea');
    if (welcome) welcome.style.display = 'none';
    if (messages) messages.classList.add('active');
}

function addMessage(role, content) {
    showChatMode();
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    const isUser = role === 'user';
    const avatar = isUser ? 'Y' : 'D';
    const sender = isUser ? 'You' : 'DUPE';
    const avatarClass = isUser ? 'user' : 'assistant';

    messageDiv.innerHTML = `
        <div class="message-inner">
            <div class="message-header">
                <div class="message-avatar ${avatarClass}">${avatar}</div>
                <span class="message-sender">${sender}</span>
            </div>
            <div class="message-body">${formatMessage(content)}</div>
        </div>
    `;

    messagesArea.appendChild(messageDiv);
    scrollToBottom();
    return messageDiv;
}

function addTypingIndicator() {
    showChatMode();
    const messagesArea = document.getElementById('messagesArea');
    if (!messagesArea) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant-message';
    messageDiv.id = 'typingIndicator';

    messageDiv.innerHTML = `
        <div class="message-inner">
            <div class="message-header">
                <div class="message-avatar assistant">D</div>
                <span class="message-sender">DUPE</span>
            </div>
            <div class="message-body">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;

    messagesArea.appendChild(messageDiv);
    scrollToBottom();
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

function formatMessage(text) {
    return text
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
}

function scrollToBottom() {
    const container = document.querySelector('.chat-wrapper') || document.getElementById('chatkit-root');
    if (container) container.scrollTop = container.scrollHeight;

    const messagesArea = document.getElementById('messagesArea');
    if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
}

function showError(msg) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// ---- API Communication ----
// Uses the Cloudflare Worker which proxies to OpenAI's ChatKit session API
// and the Assistants/Responses API

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const content = input.value.trim();
    if (!content || isLoading) return;

    // Reset input
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    isLoading = true;

    // Show user message
    addMessage('user', content);

    // Show typing
    addTypingIndicator();

    try {
        const response = await fetch(CONFIG.WORKER_URL + '/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: content,
                threadId: threadId,
                workflowId: CONFIG.WORKFLOW_ID,
                userId: getDeviceId(), // Include user ID for workflow sessions
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Request failed (${response.status})`);
        }

        const data = await response.json();

        // Save thread ID for conversation continuity
        threadId = data.threadId;

        // Show assistant response
        removeTypingIndicator();
        addMessage('assistant', data.response);
    } catch (error) {
        removeTypingIndicator();
        console.error('Error:', error);

        if (CONFIG.WORKER_URL.includes('YOUR_SUBDOMAIN')) {
            addMessage('assistant',
                "Thanks for your question! I'm currently in demo mode because the API proxy hasn't been configured yet. " +
                "Once your Cloudflare Worker is deployed and the configuration is updated, I'll be able to answer your questions using the company knowledge base.\n\n" +
                "To set me up, follow the instructions in the README.md file."
            );
        } else {
            showError('Failed to get a response. Please try again.');
            addMessage('assistant', 'Sorry, I encountered an error processing your request. Please try again.');
        }
    } finally {
        isLoading = false;
    }
}

// ---- Initialize on load ----

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded, waiting for ChatKit scripts...');
    
    // Wait for scripts to load, check multiple times
    let attempts = 0;
    const maxAttempts = 20; // 10 seconds total
    
    const checkChatKit = setInterval(() => {
        attempts++;
        
        // Check multiple possible ways ChatKit might be exposed
        const hasChatKit = 
            typeof window.ChatKit !== 'undefined' ||
            typeof window.ChatKitReact !== 'undefined' ||
            (window.OpenAI && typeof window.OpenAI.ChatKit !== 'undefined') ||
            (window.openai && typeof window.openai.ChatKit !== 'undefined');
        
        const hasReact = typeof window.React !== 'undefined';
        const hasReactDOM = typeof window.ReactDOM !== 'undefined';
        
        // Debug: Log what we find
        if (attempts === 1 || attempts % 4 === 0) {
            console.log(`🔍 Check ${attempts} (${attempts * 500}ms):`, {
                'window.ChatKit': typeof window.ChatKit,
                'window.ChatKitReact': typeof window.ChatKitReact,
                'window.OpenAI': typeof window.OpenAI,
                'window.openai': typeof window.openai,
                'window.React': typeof window.React,
                'window.ReactDOM': typeof window.ReactDOM,
            });
            
            // Check all window properties that might be ChatKit-related
            const chatRelated = Object.keys(window).filter(k => 
                k.toLowerCase().includes('chat') || 
                k.toLowerCase().includes('openai') ||
                k.toLowerCase().includes('kit')
            );
            if (chatRelated.length > 0 && attempts <= 4) {
                console.log('  Found Chat-related globals:', chatRelated);
            }
        }
        
        if (hasChatKit && hasReact && hasReactDOM) {
            console.log(`✅ All required libraries loaded after ${attempts * 500}ms`);
            clearInterval(checkChatKit);
            initChatKit();
        } else if (attempts >= maxAttempts) {
            console.warn(`⚠️ Timeout waiting for ChatKit (${attempts * 500}ms), initializing fallback...`);
            console.log('💡 The chatkit.js script loaded, but ChatKit React bindings may not be available via CDN.');
            console.log('💡 Consider installing @openai/chatkit-react via npm instead.');
            clearInterval(checkChatKit);
            initChatKit(); // Will fall back to manual chat
        }
    }, 500);
});
