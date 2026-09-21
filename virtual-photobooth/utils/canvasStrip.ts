import { TOTAL_PHOTOS } from "@/lib/constants";
import type { CapturedPhoto, StripBackground } from "@/types";

const CELL_W = 180;
const CELL_H = 160;
const COLUMN_GAP = 0; // between the two people in the same capture
const ROW_GAP = 14; // thin separator between different captures
const CARD_PAD = 26;
const FOOTER_H = 90;
const CORNER_RADIUS = 0;
const CELL_RADIUS = 0;

export const DEFAULT_STRIP_BACKGROUND: StripBackground = { type: "color", value: "#FFFFFF" };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (r <= 0) {
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.closePath();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Computes the source crop rect for an "object-fit: cover" style draw. */
function getCoverSourceRect(img: HTMLImageElement, w: number, h: number) {
  const imgRatio = img.width / img.height;
  const cellRatio = w / h;
  let sx = 0,
    sy = 0,
    sw = img.width,
    sh = img.height;

  if (imgRatio > cellRatio) {
    sw = img.height * cellRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / cellRatio;
    sy = (img.height - sh) / 2;
  }
  return { sx, sy, sw, sh };
}

/** Draws a captured photo, mirrored, cropped ("cover") into the given cell rect. */
function drawPhotoCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const { sx, sy, sw, sh } = getCoverSourceRect(img, w, h);

  ctx.save();
  roundedRectPath(ctx, x, y, w, h, CELL_RADIUS);
  ctx.clip();
  // Mirror horizontally so the strip matches what people saw in their own
  // camera preview (a natural "mirror" selfie view) rather than a flipped feed.
  ctx.translate(x + w, y);
  ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  ctx.restore();
}

/** Draws a background image, unmirrored, cropped ("cover") to fill the whole card. */
function drawBackgroundImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const { sx, sy, sw, sh } = getCoverSourceRect(img, w, h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

/** True if a hex color reads as visually dark (so we use light text/lines on it). */
function isDarkColor(hex: string): boolean {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16) || 0;
  const g = parseInt(c.substring(2, 4), 16) || 0;
  const b = parseInt(c.substring(4, 6), 16) || 0;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance < 140;
}

/**
 * Composites the captured photos (grouped host|guest per shot) into a single
 * vertical photobooth strip PNG and returns it as a data URL. `background`
 * controls what shows through the card's borders and the gaps between
 * captures — either a solid color or an uploaded image.
 */
export async function generatePhotoStrip(
  photos: CapturedPhoto[],
  background: StripBackground = DEFAULT_STRIP_BACKGROUND
): Promise<string> {
  const gridW = CELL_W * 2 + COLUMN_GAP;
  const gridH = CELL_H * TOTAL_PHOTOS + ROW_GAP * (TOTAL_PHOTOS - 1);
  const cardW = gridW + CARD_PAD * 2;
  const cardH = gridH + CARD_PAD * 2 + FOOTER_H;

  const scale = 2; // render at 2x for crisp downloads
  const canvas = document.createElement("canvas");
  canvas.width = cardW * scale;
  canvas.height = cardH * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.scale(scale, scale);

  ctx.clearRect(0, 0, cardW, cardH);

  // Drop shadow caster, kept separate from the visible fill below so the
  // shadow doesn't get clipped away along with a background image.
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = "#000000";
  roundedRectPath(ctx, 0, 0, cardW, cardH, CORNER_RADIUS);
  ctx.fill();
  ctx.restore();

  // The actual visible background: a flat color, or an uploaded image.
  let separatorColor = "rgba(18, 15, 23, 0.08)";
  let footerTextColor = "#8C88A6";
  let footerNeedsBacking = false;

  ctx.save();
  roundedRectPath(ctx, 0, 0, cardW, cardH, CORNER_RADIUS);
  ctx.clip();

  if (background.type === "image") {
    const bgImg = await loadImage(background.dataUrl);
    drawBackgroundImage(ctx, bgImg, cardW, cardH);
    separatorColor = "rgba(128, 128, 128, 0.18)";
    footerTextColor = "#3A3742";
    footerNeedsBacking = true;
  } else {
    ctx.fillStyle = background.value;
    ctx.fillRect(0, 0, cardW, cardH);
    const dark = isDarkColor(background.value);
    separatorColor = dark ? "rgba(255, 255, 255, 0.14)" : "rgba(18, 15, 23, 0.08)";
    footerTextColor = dark ? "rgba(255, 255, 255, 0.8)" : "#8C88A6";
  }

  ctx.restore();

  const gridX = CARD_PAD;
  const gridY = CARD_PAD;

  // Thin separators between each capture (not between the two people in one shot).
  ctx.fillStyle = separatorColor;
  for (let shot = 1; shot < TOTAL_PHOTOS; shot++) {
    const sepY = gridY + shot * CELL_H + (shot - 1) * ROW_GAP;
    ctx.fillRect(gridX, sepY, gridW, ROW_GAP);
  }

  // The photos themselves, on top of the background.
  const bySlotAndShot = new Map<string, CapturedPhoto>();
  photos.forEach((p) => bySlotAndShot.set(`${p.slot}:${p.shotIndex}`, p));

  for (let shot = 0; shot < TOTAL_PHOTOS; shot++) {
    const rowY = gridY + shot * (CELL_H + ROW_GAP);
    const host = bySlotAndShot.get(`host:${shot}`);
    const guest = bySlotAndShot.get(`guest:${shot}`);

    if (host) {
      const img = await loadImage(host.dataUrl);
      drawPhotoCover(ctx, img, gridX, rowY, CELL_W, CELL_H);
    }
    if (guest) {
      const img = await loadImage(guest.dataUrl);
      drawPhotoCover(ctx, img, gridX + CELL_W + COLUMN_GAP, rowY, CELL_W, CELL_H);
    }
  }

  // Footer: just the timestamp, vertically centered in the footer band.
  const footerCenterY = gridY + gridH + FOOTER_H / 2;
  ctx.font = "400 14px Helvetica, Arial, sans-serif";
  const timestamp = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  if (footerNeedsBacking) {
    const textWidth = ctx.measureText(timestamp).width;
    const padX = 14;
    const padY = 8;
    const boxW = textWidth + padX * 2;
    const boxH = 14 + padY * 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillRect(cardW / 2 - boxW / 2, footerCenterY - boxH / 2, boxW, boxH);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = footerTextColor;
  ctx.fillText(timestamp, cardW / 2, footerCenterY);

  return canvas.toDataURL("image/png");
}