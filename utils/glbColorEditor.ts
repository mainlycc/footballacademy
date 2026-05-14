/**
 * Edytor kolorów odznak GLB.
 *
 * - `extractMaterials(scene)` — chodzi po scenie i zbiera unikalne materiały
 *   (po `material.uuid`) zwracając ich aktualne kolory + flagę `hasTexture`.
 * - `applyColorChange(scene, uuid, hex)` — natychmiast (live preview) podmienia
 *   `material.color` we wszystkich meshach używających danego materiału.
 * - `exportGLB(originalUrl, colorChanges)` — pobiera świeży GLB z URL,
 *   parsuje przez `GLTFLoader`, aplikuje zmiany kolorów i zwraca binarny GLB
 *   (Blob `model/gltf-binary`) gotowy do uploadu.
 *
 * Zmieniamy WYŁĄCZNIE `material.color`. Tekstury są zostawiane bez zmian
 * (kolor zaszyty w pikselach jest traktowany jako "nie do edycji").
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export interface MaterialEntry {
  uuid: string;
  name: string;
  hex: string;
  hasTexture: boolean;
  meshNames: string[];
  type: string;
  metalness?: number;
  roughness?: number;
  opacity?: number;
  transparent?: boolean;
  transmission?: number;
  ior?: number;
  thickness?: number;
}

const MATERIAL_TYPES_WITH_COLOR = [
  'MeshStandardMaterial',
  'MeshPhysicalMaterial',
  'MeshLambertMaterial',
  'MeshPhongMaterial',
  'MeshBasicMaterial',
  'MeshToonMaterial'
];

const TEXTURE_KEYS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap'];

const colorToHex = (color: THREE.Color | undefined | null): string => {
  if (!color) return '#FFFFFF';
  return '#' + color.getHexString().toUpperCase();
};

const hasMaterialTexture = (material: THREE.Material): boolean => {
  const m = material as any;
  return TEXTURE_KEYS.some((k) => m[k] != null);
};

const isColorMaterial = (material: THREE.Material): boolean => {
  return MATERIAL_TYPES_WITH_COLOR.includes(material.type);
};

export const extractMaterials = (scene: THREE.Object3D | null | undefined): MaterialEntry[] => {
  if (!scene) return [];

  const map = new Map<string, MaterialEntry>();

  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      if (!mat || !isColorMaterial(mat)) return;
      const colorMat = mat as THREE.MeshStandardMaterial;
      const anyMat = mat as any;
      const existing = map.get(mat.uuid);
      if (existing) {
        if (child.name && !existing.meshNames.includes(child.name)) {
          existing.meshNames.push(child.name);
        }
        return;
      }
      map.set(mat.uuid, {
        uuid: mat.uuid,
        name: mat.name || colorMat.type || 'Material',
        hex: colorToHex(colorMat.color),
        hasTexture: hasMaterialTexture(mat),
        meshNames: child.name ? [child.name] : [],
        type: mat.type,
        metalness: typeof anyMat.metalness === 'number' ? anyMat.metalness : undefined,
        roughness: typeof anyMat.roughness === 'number' ? anyMat.roughness : undefined,
        opacity: typeof anyMat.opacity === 'number' ? anyMat.opacity : undefined,
        transparent: typeof anyMat.transparent === 'boolean' ? anyMat.transparent : undefined,
        transmission: typeof anyMat.transmission === 'number' ? anyMat.transmission : undefined,
        ior: typeof anyMat.ior === 'number' ? anyMat.ior : undefined,
        thickness: typeof anyMat.thickness === 'number' ? anyMat.thickness : undefined
      });
    });
  });

  return Array.from(map.values());
};

/**
 * Live preview — patchuje `material.color` w aktualnie wyświetlanej scenie.
 * Działa tylko dla materiałów typu standard/physical/lambert/phong/basic/toon.
 */
export const applyColorChange = (
  scene: THREE.Object3D | null | undefined,
  materialUuid: string,
  hex: string
): void => {
  if (!scene) return;
  const target = new THREE.Color(hex);
  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      if (mat.uuid !== materialUuid) return;
      if (!isColorMaterial(mat)) return;
      const colorMat = mat as THREE.MeshStandardMaterial;
      colorMat.color = target.clone();
      colorMat.needsUpdate = true;
    });
  });
};

export interface MaterialColorChange {
  /** Nazwa materiału (opcjonalnie; używana jako fallback). */
  name?: string;
  /** Oryginalny kolor (hex) widoczny przed edycją — fallback. */
  originalHex?: string;
  /** Docelowy kolor (hex). */
  nextHex?: string;
  /** Materiał: metaliczność (0..1) */
  metalness?: number;
  /** Materiał: chropowatość (0..1) */
  roughness?: number;
  /** Materiał: przezroczystość (0..1) */
  opacity?: number;
  /** Materiał: czy transparent */
  transparent?: boolean;
  /** Materiał: szkło (0..1) - tylko MeshPhysicalMaterial */
  transmission?: number;
  /** Materiał: ior (np. 1.0..2.5) - MeshPhysicalMaterial */
  ior?: number;
  /** Materiał: thickness - MeshPhysicalMaterial */
  thickness?: number;
  /**
   * Najpewniejsze dopasowanie: ścieżka w drzewie sceny + indeks materiału w danym mesh-u.
   * `meshPath` jest budowane z indeksów dzieci, np. "0/3/2".
   * Jeżeli mesh ma pojedynczy materiał, `materialIndex` powinien być 0.
   */
  meshPath?: string;
  materialIndex?: number;
}

const getMaterialKey = (mat: THREE.Material): string => {
  const anyMat = mat as any;
  return (mat.name && mat.name.trim()) || anyMat.type || 'Material';
};

const walkWithPath = (
  node: THREE.Object3D,
  cb: (node: THREE.Object3D, path: string) => void,
  path = ''
) => {
  cb(node, path);
  node.children.forEach((child, idx) => {
    const nextPath = path ? `${path}/${idx}` : String(idx);
    walkWithPath(child, cb, nextPath);
  });
};

/**
 * Wczytuje świeży GLB z URL i podmienia kolory materiałów.
 *
 * Nie polegamy wyłącznie na `material.name`, bo w wielu GLB nazwy są puste albo powtarzalne.
 * Stosujemy dopasowanie:
 * - 1) po `name` + `originalHex` (najpewniej),
 * - 2) po samym `name` (gdy brak originalHex),
 * - 3) po samym `originalHex` (gdy brak name).
 */
const applyChanges = (root: THREE.Object3D, changes: MaterialColorChange[]): void => {
  if (!changes.length) return;

  // 0) Najpierw spróbuj dopasowania po meshPath + materialIndex (najbardziej stabilne).
  const byPathAndIndex = new Map<string, MaterialColorChange>(); // key: `${path}__${idx}`
  const byNameAndOrig = new Map<string, MaterialColorChange>();
  const byName = new Map<string, MaterialColorChange>();
  const byOrig = new Map<string, MaterialColorChange>();

  changes.forEach((c) => {
    const name = (c.name || '').trim();
    const orig = (c.originalHex || '').trim().toUpperCase();

    if (c.meshPath && typeof c.materialIndex === 'number') {
      byPathAndIndex.set(`${c.meshPath}__${c.materialIndex}`, c);
    }
    if (name && orig) byNameAndOrig.set(`${name}__${orig}`, c);
    if (name && !orig) byName.set(name, c);
    if (!name && orig) byOrig.set(orig, c);
  });

  walkWithPath(root, (node, path) => {
    if (!(node instanceof THREE.Mesh) || !(node as any).material) return;
    const mesh = node as THREE.Mesh;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((mat, idx) => {
      if (!mat || !isColorMaterial(mat)) return;
      const colorMat = mat as THREE.MeshStandardMaterial;
      const currentOrig = colorToHex(colorMat.color).toUpperCase();
      const name = getMaterialKey(mat);

      const key = `${path}__${idx}`;
      const change =
        byPathAndIndex.get(key) ||
        (name ? byNameAndOrig.get(`${name}__${currentOrig}`) : undefined) ||
        (name ? byName.get(name) : undefined) ||
        byOrig.get(currentOrig);

      if (!change) return;

      const anyMat = mat as any;
      if (typeof change.nextHex === 'string') {
        colorMat.color = new THREE.Color(change.nextHex);
      }
      if (typeof change.metalness === 'number' && typeof anyMat.metalness === 'number') {
        anyMat.metalness = change.metalness;
      }
      if (typeof change.roughness === 'number' && typeof anyMat.roughness === 'number') {
        anyMat.roughness = change.roughness;
      }
      if (typeof change.opacity === 'number' && typeof anyMat.opacity === 'number') {
        anyMat.opacity = change.opacity;
      }
      if (typeof change.transparent === 'boolean' && typeof anyMat.transparent === 'boolean') {
        anyMat.transparent = change.transparent;
      }
      if (typeof change.transmission === 'number' && typeof anyMat.transmission === 'number') {
        anyMat.transmission = change.transmission;
      }
      if (typeof change.ior === 'number' && typeof anyMat.ior === 'number') {
        anyMat.ior = change.ior;
      }
      if (typeof change.thickness === 'number' && typeof anyMat.thickness === 'number') {
        anyMat.thickness = change.thickness;
      }

      (mat as any).needsUpdate = true;
    });
  });
};

export interface ExportArgs {
  /** URL oryginalnego GLB (np. z Supabase Public URL). */
  originalUrl: string;
  /** Zmiany kolorów (podpis: name + originalHex). */
  changes: MaterialColorChange[];
}

/**
 * Eksportuje binarny GLB z naniesionymi zmianami kolorów.
 * Pobiera świeży plik (omijając cache), żeby nie nadpisać sceny przerobionej
 * przez `Badge3D` (klonowanie materiałów).
 */
export const exportGLB = async ({
  originalUrl,
  changes
}: ExportArgs): Promise<Blob> => {
  // 1) Pobierz świeży GLB jako ArrayBuffer (omijając cache useGLTF/przeglądarki).
  const cacheBuster = `${originalUrl.includes('?') ? '&' : '?'}_export=${Date.now()}`;
  const res = await fetch(originalUrl + cacheBuster, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Nie udało się pobrać oryginalnego GLB (${res.status})`);
  }
  const buffer = await res.arrayBuffer();

  // 2) Sparsuj GLB do sceny Three.js.
  const loader = new GLTFLoader();
  const gltf = await new Promise<any>((resolve, reject) => {
    loader.parse(buffer, '', resolve, reject);
  });

  // 3) Nanieś zmiany kolorów (po stabilnym podpisie).
  applyChanges(gltf.scene, changes);

  // 4) Eksport jako GLB binary.
  const exporter = new GLTFExporter();
  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      gltf.scene,
      (out) => {
        if (out instanceof ArrayBuffer) {
          resolve(out);
        } else {
          reject(new Error('GLTFExporter zwrócił JSON zamiast ArrayBuffer'));
        }
      },
      (err) => reject(err),
      {
        binary: true,
        embedImages: true,
        animations: gltf.animations || []
      }
    );
  });

  return new Blob([result], { type: 'model/gltf-binary' });
};
