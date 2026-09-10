import { desktopCapturer, screen, app } from "electron";
import path from "path";
import fs from "fs";

export interface CaptureResult {
  png: Buffer;
  width: number;
  height: number;
  savedPath: string | null;
}

/**
 * CaptureService — silent, selective screen capture for the coding solver.
 *
 * The copilot overlay window is excluded from DWM captures via
 * SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE), so a full-screen grab
 * through desktopCapturer NEVER includes the copilot itself. The capture is
 * downscaled to a vision-friendly width to keep time-to-first-token low.
 *
 * Screenshots are kept strictly local (temp dir) and fed directly to the
 * user's chosen provider — they are never persisted or uploaded elsewhere.
 */
export class CaptureService {
  /** Capture the primary display, downscaled to `maxWidth`. */
  async captureDisplay(maxWidth = 1536): Promise<CaptureResult> {
    const display = screen.getPrimaryDisplay();
    const area = display.size;

    // Use the display's physical resolution as the thumbnail size scale such
    // that desktopCapturer does not upscale.
    const thumbnailSize = {
      width: Math.max(area.width, 2),
      height: Math.max(area.height, 2),
    };

    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize,
      fetchWindowIcons: false,
    });

    if (!sources.length) {
      throw new Error("No screen sources available for capture");
    }

    let image = sources[0].thumbnail;

    // Downscale for latency — a ~1500px-wide PNG is plenty for OCR/vision.
    const imgSize = image.getSize();
    if (imgSize.width > maxWidth) {
      image = image.resize({
        width: maxWidth,
        quality: "good",
      });
    }

    const png = image.toPNG();
    const size = image.getSize();

    // Local-only artifact (temp dir); auto-cleaned by the OS.
    let savedPath: string | null = null;
    try {
      const dir = app.getPath("temp");
      const file = path.join(dir, `orbit-snip-${Date.now()}.png`);
      fs.writeFileSync(file, png);
      savedPath = file;
    } catch {
      // non-fatal
    }

    return { png, width: size.width, height: size.height, savedPath };
  }
}