/**
 * Zaznaczanie meshów prostokątem na ekranie (projekcja bbox → piksele).
 */

import * as THREE from 'three';

export interface PixelRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const normalizeRect = (r: PixelRect): { minX: number; minY: number; maxX: number; maxY: number } => ({
  minX: Math.min(r.x0, r.x1),
  minY: Math.min(r.y0, r.y1),
  maxX: Math.max(r.x0, r.x1),
  maxY: Math.max(r.y0, r.y1)
});

const rectsIntersect = (
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number }
): boolean =>
  !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);

const _box = new THREE.Box3();
const _corner = new THREE.Vector3();
const _projected = new THREE.Vector3();

/** Ekranowy prostokąt obejmujący mesh (piksele canvasu). */
export const getMeshScreenBounds = (
  mesh: THREE.Mesh,
  camera: THREE.Camera,
  width: number,
  height: number
): { minX: number; minY: number; maxX: number; maxY: number } | null => {
  _box.setFromObject(mesh);
  if (_box.isEmpty()) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let anyInFront = false;

  const { min, max } = _box;
  const corners = [
    [min.x, min.y, min.z],
    [min.x, min.y, max.z],
    [min.x, max.y, min.z],
    [min.x, max.y, max.z],
    [max.x, min.y, min.z],
    [max.x, min.y, max.z],
    [max.x, max.y, min.z],
    [max.x, max.y, max.z]
  ] as const;

  for (const [x, y, z] of corners) {
    _corner.set(x, y, z);
    _projected.copy(_corner).project(camera);
    if (_projected.z > 1) continue;
    anyInFront = true;
    const sx = (_projected.x * 0.5 + 0.5) * width;
    const sy = (-_projected.y * 0.5 + 0.5) * height;
    minX = Math.min(minX, sx);
    minY = Math.min(minY, sy);
    maxX = Math.max(maxX, sx);
    maxY = Math.max(maxY, sy);
  }

  if (!anyInFront || !Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
};

const walkMeshes = (
  node: THREE.Object3D,
  cb: (mesh: THREE.Mesh, path: string) => void,
  path = ''
) => {
  node.children.forEach((child, idx) => {
    const nextPath = path ? `${path}/${idx}` : String(idx);
    if (child instanceof THREE.Mesh) cb(child, nextPath);
    walkMeshes(child, cb, nextPath);
  });
};

/** Wszystkie ścieżki meshów w scenie. */
export const extractAllMeshPaths = (scene: THREE.Object3D): string[] => {
  const paths: string[] = [];
  walkMeshes(scene, (_m, p) => paths.push(p));
  return paths;
};

/** Meshe, których projekcja na ekran przecina prostokąt (piksele względem canvasu). */
export const getMeshPathsInScreenRect = (
  scene: THREE.Object3D,
  camera: THREE.Camera,
  width: number,
  height: number,
  rect: PixelRect,
  minRectSize = 4
): string[] => {
  const sel = normalizeRect(rect);
  if (sel.maxX - sel.minX < minRectSize && sel.maxY - sel.minY < minRectSize) {
    return [];
  }

  const hits: string[] = [];
  walkMeshes(scene, (mesh, path) => {
    const bounds = getMeshScreenBounds(mesh, camera, width, height);
    if (bounds && rectsIntersect(sel, bounds)) {
      hits.push(path);
    }
  });
  return hits;
};
