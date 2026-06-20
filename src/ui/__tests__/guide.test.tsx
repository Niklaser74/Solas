/** E2E-ish UI-test (brief §8 lager 4): guiden renderar och når BOM-steget. */

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjectProvider } from "../../state/projectStore.js";
import { App } from "../App.js";

function renderApp() {
  return render(
    <ProjectProvider>
      <App />
    </ProjectProvider>,
  );
}

describe("Guide", () => {
  beforeEach(() => localStorage.clear());

  it("visar lastresultat för stuga-mallen i steg 1", () => {
    renderApp();
    // Stuga-mallen ger 1445 Wh/dygn (handräknat facit).
    expect(screen.getByText("1445 Wh/dygn")).toBeInTheDocument();
  });

  it("når BOM-steget med rader och total", () => {
    renderApp();
    fireEvent.click(screen.getByText("BOM & offert"));
    expect(screen.getByText("Komponent")).toBeInTheDocument();
    // Stuga (AGM) väljer Phoenix-växelriktaren och visar en total.
    expect(screen.getByText("Phoenix Inverter 12/1200")).toBeInTheDocument();
    expect(screen.getByText("Totalt")).toBeInTheDocument();
  });

  it("kan placera en komponent i layout-steget", () => {
    renderApp();
    fireEvent.click(screen.getByText("Layout"));
    fireEvent.click(screen.getByRole("button", { name: "+ Cerbo GX" }));
    // Den placerade komponentens etikett renderas i SVG-canvasen.
    expect(screen.getByText("Cerbo GX", { exact: true })).toBeInTheDocument();
  });
});
