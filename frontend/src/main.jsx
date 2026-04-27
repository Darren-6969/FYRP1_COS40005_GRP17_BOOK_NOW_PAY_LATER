import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import "./assets/styles/global.css";
import "./assets/styles/components.css";
import "./assets/styles/auth.css";
import "./assets/styles/master.css";
import "./assets/styles/customer.css";
import "./assets/styles/operator.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);