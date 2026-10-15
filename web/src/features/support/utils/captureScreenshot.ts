import { domToJpeg } from 'modern-screenshot';

/** Largest screenshot the API accepts, decoded (bytes). */
export const SCREENSHOT_MAX_BYTES = 1_000_000;
/** Widest capture in pixels (keeps the JPEG well under the limit). */
const MAX_WIDTH = 1600;

/** Elements marked with this attribute are left out of the screenshot. */
export const SUPPORT_IGNORE_ATTR = 'data-support-ignore';
/** Left out too: the toasts ("Enviando solicitud…" is on screen while capturing). */
const IGNORED_SELECTOR = `[${SUPPORT_IGNORE_ATTR}], [data-sonner-toaster]`;

/** The base64 payload of a data URL and its decoded size in bytes. */
export function dataUrlPayload(dataUrl: string): { base64: string; bytes: number } {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return { base64, bytes: Math.floor((base64.length * 3) / 4) - padding };
}

/**
 * JPEG of the current screen as base64 (no data: prefix), or null when it can't
 * be taken or stays over 1 MB after a second, lighter attempt.
 */
export async function captureScreenshot(): Promise<string | null> {
  const scale = Math.min(1, MAX_WIDTH / window.innerWidth);
  const filter = (node: Node) => !(node instanceof Element && node.closest(IGNORED_SELECTOR));
  try {
    for (const quality of [0.7, 0.5]) {
      const { base64, bytes } = dataUrlPayload(await domToJpeg(document.body, { quality, scale, filter }));
      if (bytes <= SCREENSHOT_MAX_BYTES) return base64;
    }
  } catch {
    // Some pages (cross-origin images, canvases) can't be rendered: send without it
  }
  return null;
}
