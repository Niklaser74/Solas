/** Hook som genererar och laddar ner BOM-PDF:en i webbläsaren. */

import { useState } from "react";
import type { DesignSystemResult } from "../engine/index.js";
import type { Bom } from "../bom/assembleBom.js";

export interface ExportInput {
  namn: string;
  typ: string;
  design: DesignSystemResult;
  bom: Bom;
  watermark?: boolean;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "dimensas";
}

export function usePdfExport() {
  const [exporting, setExporting] = useState(false);

  const exportPdf = async (input: ExportInput) => {
    setExporting(true);
    try {
      // Lazy-ladda den tunga PDF-motorn först vid export (egen chunk).
      const [{ pdf }, { BomDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./BomDocument.js"),
      ]);
      const blob = await pdf(
        BomDocument({
          namn: input.namn,
          typ: input.typ,
          design: input.design,
          bom: input.bom,
          watermark: input.watermark ?? true,
        }),
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dimensas-${slugify(input.namn)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return { exportPdf, exporting };
}
