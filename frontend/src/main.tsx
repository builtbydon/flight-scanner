import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "pandora-components-web";
import App from "./App";
import "./index.css";

window.__flightScannerSourceHash = __FS_SOURCE_HASH__;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>
);
