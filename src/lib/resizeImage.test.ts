import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareBillImage } from './resizeImage';

const MB = 1024 * 1024;

function makeFile(name: string, type: string, size = 100): File {
  const file = new File(['x'], name, { type, lastModified: 1234 });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('prepareBillImage', () => {
  const drawImage = vi.fn();
  let canvases: HTMLCanvasElement[] = [];
  let bitmapMock: ReturnType<typeof vi.fn>;
  let originalCreateImageBitmap: unknown;

  function stubBitmap(width: number, height: number) {
    bitmapMock = vi.fn().mockResolvedValue({ width, height, close: vi.fn() });
    vi.stubGlobal('createImageBitmap', bitmapMock);
  }

  beforeEach(() => {
    originalCreateImageBitmap = (globalThis as Record<string, unknown>)
      .createImageBitmap;
    canvases = [];
    drawImage.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      function (this: HTMLCanvasElement) {
        canvases.push(this);
        return { drawImage } as unknown as CanvasRenderingContext2D;
      }
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) =>
      cb(new Blob(['x'], { type: 'image/jpeg' }))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    if (originalCreateImageBitmap) {
      (globalThis as Record<string, unknown>).createImageBitmap =
        originalCreateImageBitmap;
    }
  });

  it('returns the same file when under 2.5 MB and long side ≤ 3000', async () => {
    stubBitmap(3000, 2000);
    const file = makeFile('a.jpg', 'image/jpeg');
    expect(await prepareBillImage(file)).toBe(file);
    expect(drawImage).not.toHaveBeenCalled();
  });

  it('resizes a 4000×3000 image to 3000×2250 JPEG named *.jpg', async () => {
    stubBitmap(4000, 3000);
    const file = makeFile('photo.png', 'image/png');
    const out = await prepareBillImage(file);
    expect(canvases[0]?.width).toBe(3000);
    expect(canvases[0]?.height).toBe(2250);
    expect(drawImage).toHaveBeenCalled();
    expect(out.type).toBe('image/jpeg');
    expect(out.name).toBe('photo.jpg');
    expect(out.lastModified).toBe(1234);
  });

  it('resizes a 3 MB 2000×1500 image without upscaling', async () => {
    stubBitmap(2000, 1500);
    const out = await prepareBillImage(
      makeFile('big.jpg', 'image/jpeg', 3 * MB)
    );
    expect(canvases[0]?.width).toBe(2000);
    expect(canvases[0]?.height).toBe(1500);
    expect(out.type).toBe('image/jpeg');
  });

  it('returns the original when createImageBitmap rejects', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockRejectedValue(new Error('x'))
    );
    const file = makeFile('a.jpg', 'image/jpeg', 3 * MB);
    expect(await prepareBillImage(file)).toBe(file);
  });

  it('returns the original for image/heic without decoding', async () => {
    stubBitmap(4000, 3000);
    const file = makeFile('a.heic', 'image/heic', 3 * MB);
    expect(await prepareBillImage(file)).toBe(file);
    expect(bitmapMock).not.toHaveBeenCalled();
  });
});
