/**
 * main.tsx — React application entry point.
 *
 * This file is referenced by index.html as the module script entry.
 * Vite replaces the `<div id="root">` with the React tree.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import App from "./App";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error(
    "Could not find #root element. Check that index.html contains <div id='root'></div>."
  );
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
