/** Snapshots the current frame of a playing <video> element as a JPEG data URL. */
export function captureVideoFrame(video: HTMLVideoElement | null): string | null {
  if (!video || video.readyState < 2 || !video.videoWidth) return null;

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.92);
}
