import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initSession } from "./utils/session";

import "./assets/styles/global.css";
import "./assets/styles/components.css";
import "./assets/styles/auth.css";
import "./assets/styles/customer.css";
import "./assets/styles/operator.css";
import "./assets/styles/master.css";

// Bug #3: adopt any pre tab-scoping session and clear stale slots.
initSession();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);