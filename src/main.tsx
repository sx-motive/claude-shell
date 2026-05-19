import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import { App } from "./App";
import { OverlayApp } from "./OverlayApp";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ThemeProvider } from "./theme/ThemeProvider";

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

const params = new URLSearchParams(window.location.search);
const hash = window.location.hash.replace(/^#/, "");
const role = hash || params.get("role") || "main";

if (role === "overlay") {
  document.documentElement.classList.add("overlay-window");
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <OverlayApp />
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
} else {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}
