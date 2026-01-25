import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

console.log("Renderer: main.tsx initialized");

const rootElement = document.getElementById('root');
if (!rootElement) {
    console.error("Renderer: Root element not found!");
} else {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
}
