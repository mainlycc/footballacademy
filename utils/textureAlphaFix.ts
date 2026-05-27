/**
 * Naprawa białych/szarych kresek przy skalowaniu tekstur PNG z alphą.
 *
 * Przyczyna: w PNG piksele „przezroczyste” często mają RGB=biały/czarny przy A=0.
 * Filtr liniowy miesza te wartości z krawędzią → halo przy zmniejszaniu (repeat/UV).
 *
 * Kroki:
 * 1) defringe — popraw RGB przy półprzezroczystych pikselach (un-premultiply)
 * 2) bleed — skopiuj kolor z sąsiada do w pełni przezroczystych (RGB tylko, A=0)
 * 3) opcjonalnie premultiply na CPU + CustomBlending w materiale
 */

import * as THREE from 'three';

const SANITIZED_FLAG = '_faAlphaSanitized';

/** Piksele prawie przezroczyste → w pełni przezroczyste (zero RGB). */
export function defringeImageData(imageData: ImageData, alphaCutoff = 8): void {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a <= alphaCutoff) {
      d[i] = 0;
      d[i + 1] = 0;
      d[i + 2] = 0;
      d[i + 3] = 0;
      continue;
    }
  }

  // Drugi przebieg: un-premultiply krawędzi (usuwa białe w RGB pod alphą)
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    if (a <= 0.01 || a >= 0.999) continue;
    d[i] = Math.min(255, Math.round(d[i] / a));
    d[i + 1] = Math.min(255, Math.round(d[i + 1] / a));
    d[i + 2] = Math.min(255, Math.round(d[i + 2] / a));
  }
}

/**
 * Wypełnij RGB przy A=0 kolorem z najbliższego nieprzezroczystego sąsiada.
 * GPU przy filtrowaniu nie „wciągnie” wtedy białego tła z przezroczystych pikseli.
 */
export function bleedFillTransparentRgb(imageData: ImageData, passes = 2): void {
  const { width, height, data } = imageData;
  const src = new Uint8ClampedArray(data);

  const neighbors = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ];

  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (src[i + 3] > 0) continue;

        let bestA = 0;
        let r = 0;
        let g = 0;
        let b = 0;

        for (const [dx, dy] of neighbors) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = (ny * width + nx) * 4;
          const a = src[j + 3];
          if (a > bestA) {
            bestA = a;
            r = src[j];
            g = src[j + 1];
            b = src[j + 2];
          }
        }

        if (bestA > 0) {
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = 0;
        }
      }
    }
    src.set(data);
  }
}

/** Premultiply RGB przez alpha (do renderingu z One / OneMinusSrcAlpha). */
export function premultiplyImageData(imageData: ImageData): void {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] / 255;
    d[i] = Math.round(d[i] * a);
    d[i + 1] = Math.round(d[i + 1] * a);
    d[i + 2] = Math.round(d[i + 2] * a);
  }
}

const getImageSize = (
  image: THREE.Texture['image']
): { width: number; height: number } | null => {
  if (!image) return null;
  if (image instanceof HTMLImageElement) {
    const w = image.naturalWidth || image.width;
    const h = image.naturalHeight || image.height;
    return w && h ? { width: w, height: h } : null;
  }
  if (image instanceof HTMLCanvasElement || image instanceof ImageBitmap) {
    return image.width && image.height ? { width: image.width, height: image.height } : null;
  }
  if (typeof (image as { width?: number }).width === 'number') {
    const im = image as { width: number; height: number };
    if (im.width && im.height) return { width: im.width, height: im.height };
  }
  return null;
};

const drawSourceToCanvas = (
  image: THREE.Texture['image'],
  width: number,
  height: number
): HTMLCanvasElement | null => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  try {
    if (image instanceof ImageBitmap) {
      ctx.drawImage(image, 0, 0, width, height);
    } else if (image instanceof HTMLImageElement) {
      ctx.drawImage(image, 0, 0, width, height);
    } else if (image instanceof HTMLCanvasElement) {
      ctx.drawImage(image, 0, 0);
    } else if (
      typeof (image as { data?: Uint8ClampedArray }).data !== 'undefined' &&
      (image as { data: Uint8ClampedArray }).data
    ) {
      const im = image as { data: Uint8ClampedArray; width: number; height: number };
      const tmp = new ImageData(new Uint8ClampedArray(im.data), im.width, im.height);
      ctx.putImageData(tmp, 0, 0);
    } else {
      return null;
    }
  } catch {
    return null;
  }
  return canvas;
};

export type SanitizeTextureOptions = {
  /** Premultiply na CPU (zalecane z CustomBlending). */
  premultiply?: boolean;
  /** Wymuś ponowne przetworzenie. */
  force?: boolean;
};

/**
 * Przetwarza obraz mapy diffuse: defringe + bleed (+ opcjonalnie premultiply).
 * Zwraca true jeśli tekstura została zmieniona.
 */
export const sanitizeBadgeMapTexture = (
  tex: THREE.Texture,
  options: SanitizeTextureOptions = {}
): boolean => {
  if (!tex?.image) return false;
  if (tex.userData[SANITIZED_FLAG] && !options.force) return false;

  const size = getImageSize(tex.image);
  if (!size) return false;

  const canvas = drawSourceToCanvas(tex.image, size.width, size.height);
  if (!canvas) return false;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;

  const imageData = ctx.getImageData(0, 0, size.width, size.height);
  defringeImageData(imageData);
  bleedFillTransparentRgb(imageData, 2);
  if (options.premultiply !== false) {
    premultiplyImageData(imageData);
  }
  ctx.putImageData(imageData, 0, 0);

  tex.image = canvas;
  tex.needsUpdate = true;
  tex.userData[SANITIZED_FLAG] = true;
  return true;
};

export const sanitizeBadgeMapTextureWhenReady = (
  tex: THREE.Texture,
  options?: SanitizeTextureOptions
): void => {
  const img = tex.image;
  if (img instanceof HTMLImageElement && !img.complete) {
    img.addEventListener(
      'load',
      () => {
        sanitizeBadgeMapTexture(tex, options);
        tex.needsUpdate = true;
      },
      { once: true }
    );
    return;
  }
  sanitizeBadgeMapTexture(tex, options);
};

/** Custom blending dla tekstur z alphą po defringe (premultiply na CPU). */
export const applyPremultipliedAlphaBlending = (material: THREE.Material): void => {
  const m = material as THREE.MeshStandardMaterial;
  m.transparent = true;
  m.depthWrite = true;
  m.alphaTest = 0.02;
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.OneFactor;
  m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  m.needsUpdate = true;
};
