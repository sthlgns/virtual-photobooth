import type { StripCaption } from "@/types";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load strip image"));
    img.src = src;
  });
}

/**
 * Takes the already-generated strip PNG and burns the caption into it as
 * real pixels, for downloading. The caption itself is only ever shown as a
 * lightweight HTML overlay while previewing/dragging (see PhotoStrip.tsx) —
 * this is the one place it actually gets drawn onto the image.
 */
export async function compositeStripWithCaption(
  baseStripDataUrl: string,
  caption: StripCaption
): Promise<string> {
  const baseImg = await loadImage(baseStripDataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = baseImg.naturalWidth;
  canvas.height = baseImg.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");

  ctx.drawImage(baseImg, 0, 0);

  if (caption.text.trim()) {
    const fontSize = Math.round(canvas.width * 0.05);
    const fontSpec = `${fontSize}px "${caption.font}"`;

    try {
      await document.fonts.load(fontSpec);
      await document.fonts.ready;
    } catch {
      // Falls back to whatever font the browser picks — better than nothing.
    }

    ctx.font = fontSpec;
    ctx.fillStyle = caption.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(caption.text, canvas.width * caption.xPct, canvas.height * caption.yPct);
  }

  return canvas.toDataURL("image/png");
}
