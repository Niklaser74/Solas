import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProjectProvider } from "./state/projectStore.js";
import { App } from "./ui/App.js";
import "./styles/tokens.css";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("Saknar #root i index.html.");

createRoot(root).render(
  <StrictMode>
    <ProjectProvider>
      <App />
    </ProjectProvider>
  </StrictMode>,
);
