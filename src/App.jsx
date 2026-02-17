import React, { useState, useEffect } from 'react';
import { ChatKit, useChatKit } from '@openai/chatkit-react';

const CONFIG = {
  WORKER_URL: 'https://fuanne-dupe-proxy.fuannegao25.workers.dev',
  WORKFLOW_ID: 'wf_6993855a26d4819091b1bba88fc45c580afdc0b8f95265d1',
};

// Generate a simple device/session ID for the user parameter
function getDeviceId() {
  let id = sessionStorage.getItem('fuanne-dupe-device-id');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('fuanne-dupe-device-id', id);
  }
  return id;
}

function ChatKitApp() {
  // Load ChatKit base script if not already loaded
  useEffect(() => {
    if (!document.querySelector('script[src*="chatkit.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://cdn.platform.openai.com/deployments/chatkit/chatkit.js';
      script.async = true;
      document.head.appendChild(script);
      console.log('📦 Loading ChatKit base script...');
    }
  }, []);
  const { control } = useChatKit({
    api: {
      async getClientSecret(existing) {
        console.log('🔑 Requesting ChatKit session...', existing ? '(refreshing)' : '(new)');
        
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

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <ChatKit 
        control={control} 
        className="chatkit-widget"
        style={{
          height: '100%',
          width: '100%',
        }}
      />
    </div>
  );
}

export default ChatKitApp;
