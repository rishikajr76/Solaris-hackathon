import React from 'react'
import ReactDOM from 'react-dom/client'
// ✅ Add the .tsx extension to resolve the module error
import App from './App.tsx' 
import './styles/index.css'

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element. Ensure index.html has <div id="root"></div>');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)