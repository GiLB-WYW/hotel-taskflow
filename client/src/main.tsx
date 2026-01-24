import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Clear all caches and unregister old service workers to prevent stale data
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // First, unregister ALL existing service workers to clear stale cache
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
        console.log('Unregistered old service worker:', registration.scope);
      }
      
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
          await caches.delete(cacheName);
          console.log('Deleted cache:', cacheName);
        }
      }
      
      // Register fresh service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered successfully:', registration.scope);
    } catch (error) {
      console.log('Service Worker setup failed:', error);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
