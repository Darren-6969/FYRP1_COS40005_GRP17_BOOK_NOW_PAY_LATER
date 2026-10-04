import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App";
import { initSession } from "./utils/session";

import "./assets/styles/global.css";
import "./assets/styles/components.css";
import "./assets/styles/auth.css";
import "./assets/styles/customer.css";
import "./assets/styles/operator.css";
import "./assets/styles/master.css";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || undefined,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
  enabled: Boolean(import.meta.env.VITE_SENTRY_DSN),
  sendDefaultPii: false,
  beforeSend(event) {
    if (typeof window !== "undefined") {
      const requestId = window.__BNPL_LAST_REQUEST_ID;
      if (requestId) event.tags = { ...event.tags, request_id: requestId };
    }
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
      if (event.request.url) event.request.url = event.request.url.split("?")[0];
    }
    return event;
  },
});

// Bug #3: adopt any pre tab-scoping session and clear stale slots.
initSession();

ReactDOM.createRoot(document.getElementById("root")).render(
  <Sentry.ErrorBoundary fallback={<main role="alert">An unexpected error occurred. Reload the page to continue.</main>}>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </Sentry.ErrorBoundary>
);
