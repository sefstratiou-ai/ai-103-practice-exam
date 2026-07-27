import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "../app/globals.css";
import ExamSimulator from "../app/ExamSimulator";

const container = document.getElementById("root");

if (!container) {
  throw new Error("The exam application root element was not found.");
}

createRoot(container).render(
  <StrictMode>
    <ExamSimulator />
  </StrictMode>,
);
