import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { flushQueue } from "./lib/api";
import "./index.css";

window.addEventListener("online", () => flushQueue());
setInterval(() => { if (navigator.onLine) flushQueue(); }, 30000);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
