/**
 * Hjälp för produktbilder i layouten. Egna produkter lagras i projekt-state
 * (och localStorage), så bilderna skalas ned till en rimlig kant innan de
 * sparas — annars spränger ett par foton snabbt localStorage-kvoten.
 */

/** Läser en fil som data-URL. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Kunde inte läsa filen."));
    reader.readAsDataURL(file);
  });
}

/** Skalar ned en data-URL så att längsta kanten blir högst `maxPx`. */
function downscaleDataUrl(src: string, maxPx: number, mime: string, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas saknas."));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL(mime, quality));
    };
    img.onerror = () => reject(new Error("Kunde inte ladda bilden."));
    img.src = src;
  });
}

/**
 * Läser en bildfil och returnerar en nedskalad data-URL (längsta kant `maxPx`).
 * PNG behåller transparens; övriga format komprimeras som JPEG. Faller tillbaka
 * på originalbilden om nedskalning inte är möjlig (t.ex. utan DOM).
 */
export async function fileToScaledDataUrl(file: File, maxPx = 600, quality = 0.82): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  try {
    return await downscaleDataUrl(dataUrl, maxPx, mime, quality);
  } catch {
    return dataUrl;
  }
}
