import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// Register the service worker so we can receive web push notifications.
// Only in production builds — Vite's HMR doesn't play well with a SW in dev.
// To test push locally, run `npm run build && npm run preview` instead.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Force-update check on each load so a redeploy doesn't get stuck
        // on a cached worker.
        reg.update();
      })
      .catch((err) => {
        console.warn("[sw] registration failed:", err);
      });

    // Listen for navigate messages from the SW (sent on notification click)
    navigator.serviceWorker.addEventListener("message", (event) => {
      const data = event.data;
      if (data?.type === "navigate" && typeof data.url === "string") {
        // Use a hash-safe assignment so React Router catches it
        window.location.assign(data.url);
      }
    });
  });
}
