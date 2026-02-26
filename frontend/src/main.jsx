import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "./index.css";
import "./App.css";
import "./styles/responsive.css";

import App from "./App.jsx";

const applyUiPrefs = () => {
  const motion = localStorage.getItem("pp_ui_motion") || "medium";
  const contrast = localStorage.getItem("pp_ui_contrast") || "normal";
  document.documentElement.dataset.motion = motion;
  document.documentElement.dataset.contrast = contrast;
};

applyUiPrefs();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
