import React from 'react';
import ReactDOM from 'react-dom/client';
import ChatKitApp from './App.jsx';
import '../styles.css';

// Mount ChatKit in the chatkit-root div
const rootElement = document.getElementById('chatkit-root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ChatKitApp />
    </React.StrictMode>
  );
} else {
  console.error('❌ chatkit-root element not found');
}
