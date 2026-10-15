import { describe, it, expect, vi, beforeEach } from 'vitest';

const domToJpeg = vi.fn();
vi.mock('modern-screenshot', () => ({ domToJpeg: (...args: unknown[]) => domToJpeg(...args) }));

const { captureScreenshot, dataUrlPayload, SCREENSHOT_MAX_BYTES } = await import('./captureScreenshot');

const dataUrl = (bytes: number) => `data:image/jpeg;base64,${btoa('x'.repeat(bytes))}`;

describe('dataUrlPayload', () => {
  it('strips the prefix and computes the decoded size', () => {
    expect(dataUrlPayload('data:image/jpeg;base64,eHh4')).toEqual({ base64: 'eHh4', bytes: 3 });
    expect(dataUrlPayload('data:image/jpeg;base64,eHg=')).toEqual({ base64: 'eHg=', bytes: 2 });
    expect(dataUrlPayload('data:image/jpeg;base64,eA==')).toEqual({ base64: 'eA==', bytes: 1 });
  });
});

describe('captureScreenshot', () => {
  beforeEach(() => domToJpeg.mockReset());

  it('returns the first capture under 1 MB', async () => {
    domToJpeg.mockResolvedValueOnce(dataUrl(100));

    await expect(captureScreenshot()).resolves.toBe(btoa('x'.repeat(100)));
    expect(domToJpeg.mock.calls[0]?.[1]).toMatchObject({ quality: 0.7 });
  });

  it('retries lighter, then gives up when still too big', async () => {
    domToJpeg.mockResolvedValueOnce(dataUrl(SCREENSHOT_MAX_BYTES + 3)).mockResolvedValueOnce(dataUrl(SCREENSHOT_MAX_BYTES + 3));

    await expect(captureScreenshot()).resolves.toBeNull();
    expect(domToJpeg.mock.calls[1]?.[1]).toMatchObject({ quality: 0.5 });
  });

  it('leaves out marked elements and survives render errors', async () => {
    domToJpeg.mockRejectedValueOnce(new Error('tainted canvas'));
    await expect(captureScreenshot()).resolves.toBeNull();

    const filter = domToJpeg.mock.calls[0]?.[1].filter as (n: Node) => boolean;
    const drawer = document.createElement('div');
    drawer.className = 'support-ignore';
    const inside = document.createElement('span');
    drawer.appendChild(inside);
    expect(filter(inside)).toBe(false);
    expect(filter(document.createElement('p'))).toBe(true);
    const toaster = document.createElement('ol');
    toaster.setAttribute('data-sonner-toaster', '');
    expect(filter(toaster)).toBe(false);
  });
});
