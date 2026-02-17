// ============================================
// Fuanne DUPE - Cloudflare Worker API Proxy
// ============================================
// This worker handles two things:
// 1. Creates ChatKit sessions (when ChatKit CDN is available)
// 2. Proxies direct chat requests to OpenAI Assistants API (fallback)
//
// Environment Variables (set in Cloudflare dashboard):
//   OPENAI_API_KEY  - Your OpenAI API key (sk-proj-...)
//   ALLOWED_ORIGINS - Comma-separated allowed origins
//
// Secrets (set via `wrangler secret put`):
//   OPENAI_API_KEY

const OPENAI_BASE = 'https://api.openai.com/v1';

export default {
    async fetch(request, env) {
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return handleCORS(request, env);
        }

        const corsHeaders = getCORSHeaders(request, env);

        try {
            const url = new URL(request.url);

            // ChatKit session endpoint
            if (url.pathname === '/chatkit/session' && request.method === 'POST') {
                return await handleChatKitSession(request, env, corsHeaders);
            }

            // Direct chat endpoint (fallback when ChatKit CDN isn't available)
            if (url.pathname === '/chat' && request.method === 'POST') {
                return await handleDirectChat(request, env, corsHeaders);
            }

            // Health check
            if (url.pathname === '/health') {
                return jsonResponse({ status: 'ok' }, 200, corsHeaders);
            }

            return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
        } catch (error) {
            console.error('Worker error:', error);
            return jsonResponse({ error: 'Internal server error' }, 500, corsHeaders);
        }
    },
};

// ---- ChatKit Session Creation ----
// Creates a ChatKit session and returns the client_secret for the frontend

async function handleChatKitSession(request, env, corsHeaders) {
    const { workflowId, userId } = await request.json();

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
        return jsonResponse({ error: 'API key not configured' }, 500, corsHeaders);
    }

    if (!workflowId) {
        return jsonResponse({ error: 'Workflow ID is required' }, 400, corsHeaders);
    }

    const response = await fetch(`${OPENAI_BASE}/chatkit/sessions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'OpenAI-Beta': 'chatkit_beta=v1',
        },
        body: JSON.stringify({
            workflow: { id: workflowId },
            user: userId || 'anonymous',
        }),
    });

    if (!response.ok) {
        const errorData = await response.text();
        console.error('ChatKit session error:', errorData);
        return jsonResponse(
            { error: 'Failed to create ChatKit session' },
            response.status,
            corsHeaders
        );
    }

    const data = await response.json();
    return jsonResponse({ client_secret: data.client_secret }, 200, corsHeaders);
}

// ---- Direct Chat (Assistants API fallback) ----
// Used when ChatKit CDN script isn't loaded or available
// If workflowId is provided, uses ChatKit API to run the workflow

async function handleDirectChat(request, env, corsHeaders) {
    const { message, threadId, workflowId, userId } = await request.json();

    if (!message) {
        return jsonResponse({ error: 'Message is required' }, 400, corsHeaders);
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
        return jsonResponse({ error: 'API key not configured' }, 500, corsHeaders);
    }

    // If workflowId is provided, use ChatKit API to run the workflow
    if (workflowId) {
        return await handleWorkflowChat(request, env, corsHeaders, { message, threadId, workflowId, userId });
    }

    // Fallback to Responses API if no workflow ID
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };

    const responsePayload = {
        model: 'gpt-4o',
        input: message,
    };

    // If we have a previous conversation thread, include it
    if (threadId) {
        responsePayload.previous_response_id = threadId;
    }

    const aiResponse = await fetch(`${OPENAI_BASE}/responses`, {
        method: 'POST',
        headers,
        body: JSON.stringify(responsePayload),
    });

    if (!aiResponse.ok) {
        const errorData = await aiResponse.text();
        console.error('OpenAI API error:', errorData);
        return jsonResponse(
            { error: 'Failed to get AI response' },
            aiResponse.status,
            corsHeaders
        );
    }

    const data = await aiResponse.json();

    // Extract the text response
    let responseText = 'No response received.';
    if (data.output) {
        for (const item of data.output) {
            if (item.type === 'message' && item.content) {
                for (const content of item.content) {
                    if (content.type === 'output_text') {
                        responseText = content.text;
                        break;
                    }
                }
            }
        }
    }

    return jsonResponse(
        {
            response: responseText,
            threadId: data.id, // Use the response ID for conversation continuity
        },
        200,
        corsHeaders
    );
}

// ---- Workflow Chat via ChatKit API ----
// Uses ChatKit sessions to run workflows from Agent Builder
// Agent Builder workflows must be accessed through ChatKit sessions

async function handleWorkflowChat(request, env, corsHeaders, { message, threadId, workflowId, userId }) {
    const apiKey = env.OPENAI_API_KEY;
    
    try {
        // Step 1: Create a ChatKit session with the workflow ID
        // Use threadId as a session identifier to maintain conversation state
        const sessionKey = threadId ? `session_${threadId}` : null;
        
        const sessionResponse = await fetch(`${OPENAI_BASE}/chatkit/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'OpenAI-Beta': 'chatkit_beta=v1',
            },
            body: JSON.stringify({
                workflow: { id: workflowId },
                user: userId || 'anonymous',
            }),
        });

        if (!sessionResponse.ok) {
            const errorData = await sessionResponse.text();
            console.error('ChatKit session creation error:', errorData);
            return jsonResponse(
                { error: 'Failed to create ChatKit session for workflow' },
                sessionResponse.status,
                corsHeaders
            );
        }

        const sessionData = await sessionResponse.json();
        const clientSecret = sessionData.client_secret;

        // Step 2: Use the ChatKit API to send a message through the workflow
        // Try multiple possible endpoints for ChatKit message sending
        
        // Try endpoint 1: /chatkit/messages
        let runResponse = await fetch(`${OPENAI_BASE}/chatkit/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${clientSecret}`,
                'OpenAI-Beta': 'chatkit_beta=v1',
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'user',
                        content: message,
                    },
                ],
            }),
        });

        // If that doesn't work, try /chatkit/runs
        if (!runResponse.ok) {
            console.log('Trying /chatkit/runs endpoint...');
            runResponse = await fetch(`${OPENAI_BASE}/chatkit/runs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${clientSecret}`,
                    'OpenAI-Beta': 'chatkit_beta=v1',
                },
                body: JSON.stringify({
                    messages: [
                        {
                            role: 'user',
                            content: message,
                        },
                    ],
                }),
            });
        }

        if (!runResponse.ok) {
            const errorText = await runResponse.text();
            console.error('ChatKit API error:', errorText);
            console.error('Status:', runResponse.status);
            
            // The ChatKit API might not support programmatic message sending
            // Agent Builder workflows are designed for the ChatKit widget
            // Return an informative error
            return jsonResponse(
                { 
                    error: 'Agent Builder workflows require ChatKit widget. The workflow cannot be invoked programmatically via API. Consider using the ChatKit React component instead.',
                    details: errorText
                },
                runResponse.status,
                corsHeaders
            );
        }

        const runData = await runResponse.json();
        
        // Extract the response from ChatKit run
        let responseText = 'No response received.';
        
        // ChatKit run response structure may vary
        if (runData.messages && Array.isArray(runData.messages)) {
            const assistantMsg = runData.messages.find(m => m.role === 'assistant');
            if (assistantMsg) {
                if (typeof assistantMsg.content === 'string') {
                    responseText = assistantMsg.content;
                } else if (Array.isArray(assistantMsg.content)) {
                    responseText = assistantMsg.content
                        .filter(c => c.type === 'text')
                        .map(c => c.text)
                        .join('\n');
                }
            }
        } else if (runData.output) {
            // Alternative response structure
            responseText = JSON.stringify(runData.output);
        }

        return jsonResponse(
            {
                response: responseText,
                threadId: runData.id || sessionData.id || threadId,
            },
            200,
            corsHeaders
        );
    } catch (error) {
        console.error('Workflow chat error:', error);
        return jsonResponse(
            { error: 'Failed to process workflow request: ' + error.message },
            500,
            corsHeaders
        );
    }
}

// Fallback to Responses API (without workflow)
async function fallbackToResponsesAPI(apiKey, message, threadId, corsHeaders) {
    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };

    const responsePayload = {
        model: 'gpt-4o',
        input: message,
    };

    if (threadId) {
        responsePayload.previous_response_id = threadId;
    }

    const aiResponse = await fetch(`${OPENAI_BASE}/responses`, {
        method: 'POST',
        headers,
        body: JSON.stringify(responsePayload),
    });

    if (!aiResponse.ok) {
        const errorData = await aiResponse.text();
        console.error('Fallback API error:', errorData);
        return jsonResponse(
            { error: 'Failed to get AI response' },
            aiResponse.status,
            corsHeaders
        );
    }

    const data = await aiResponse.json();
    return extractResponse(data, threadId, corsHeaders);
}

// Helper function to extract response from API data
function extractResponse(data, threadId, corsHeaders) {
    let responseText = 'No response received.';
    
    if (data.output) {
        for (const item of data.output) {
            if (item.type === 'message' && item.content) {
                for (const content of item.content) {
                    if (content.type === 'output_text') {
                        responseText = content.text;
                        break;
                    }
                }
            }
        }
    }

    return jsonResponse(
        {
            response: responseText,
            threadId: data.id || threadId,
        },
        200,
        corsHeaders
    );
}


// ---- CORS Helpers ----

function getCORSHeaders(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
    // Allow null origin (file:// protocol) for local testing
    const isAllowed = allowed.includes('*') || allowed.includes(origin) || allowed.includes('null') || origin === 'null' || origin === '';

    return {
        'Access-Control-Allow-Origin': isAllowed ? (origin || '*') : '',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    };
}

function handleCORS(request, env) {
    return new Response(null, {
        status: 204,
        headers: getCORSHeaders(request, env),
    });
}

function jsonResponse(data, status, corsHeaders) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
}
