import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Not using StrictMode — double-invoked effects would create duplicate
// audio streams / LLM connections in development.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);