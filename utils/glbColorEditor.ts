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
 * Zmieniamy `material.color` oraz transformację mapy diffuse (`material.map`).
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { applyTransformChanges, type MeshTransformChange } from './glbMeshLayout';
import {
  applyPremultipliedAlphaBlending,
  sanitizeBadgeMapTexture,
  sanitizeBadgeMapTextureWhenReady
} from './textureAlphaFix';

export interface TextureTransformState {
  repeatX: number;
  repeatY: number;
  offsetX: number;
  offsetY: number;
  /** Radiany (Three.js `texture.rotation`). */
  rotation: number;
  wrapS: number;
  wrapT: number;
  flipY: boolean;
}

export const DEFAULT_TEXTURE_TRANSFORM: TextureTransformState = {
  repeatX: 1,
  repeatY: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  // Domyślnie nie powielamy (brak „dublowania logo” i brak szwów na krawędziach).
  wrapS: THREE.ClampToEdgeWrapping,
  wrapT: THREE.ClampToEdgeWrapping,
  flipY: true
};

export const TEXTURE_WRAP_LABELS: { value: number; label: string }[] = [
  // Zostawiamy tylko tryb bez powielania — „powtarzaj/lustro” powodują dublowanie logo.
  { value: THREE.ClampToEdgeWrapping, label: 'Przycinaj' }
];

type TextureSlotKey = 'map' | 'emissiveMap' | 'normalMap' | 'roughnessMap' | 'metalnessMap';

/**
 * Ustawienia anty-artefaktowe dla tekstur PNG (zwłaszcza z alphą) przy skalowaniu:
 * - clamp do krawędzi (brak „szwów”/powtórek),
 * - bez mipmap (eliminuje halo/„białe kreski” od premixu tła),
 * - linear filtering dla stabilnego downscale.
 */
export const configureBadgeTexture = (tex: THREE.Texture, slot: TextureSlotKey | string): void => {
  if (!tex) return;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  // Obraz jest premultiplied na CPU (textureAlphaFix) — nie podwajaj przy uploadzie
  tex.premultiplyAlpha = false;

  if (slot === 'map') {
    sanitizeBadgeMapTextureWhenReady(tex);
  }

  if (slot === 'map' || slot === 'emissiveMap') {
    tex.colorSpace = THREE.SRGBColorSpace;
  }

  tex.updateMatrix();
  tex.needsUpdate = true;
};

/** Materiał z mapą PNG/alpha — blending pod premultiplied RGBA. */
export const configureBadgeAlphaMaterial = (material: THREE.Material): void => {
  if (!getPrimaryTexture(material)) return;
  const m = material as THREE.MeshStandardMaterial;
  if (!m.map) return;

  sanitizeBadgeMapTextureWhenReady(m.map);
  applyPremultipliedAlphaBlending(m);
  if (typeof m.opacity === 'number' && m.opacity >= 1) {
    m.opacity = 1;
  }
};

/** Wymuś ponowną naprawę obwódki na mapie (np. po ręcznym kliknięciu w panelu). */
export const repairBadgeMapTexture = (material: THREE.Material): boolean => {
  const m = material as THREE.MeshStandardMaterial;
  if (!m.map) return false;
  const ok = sanitizeBadgeMapTexture(m.map, { force: true, premultiply: true });
  if (ok) {
    configureBadgeTexture(m.map, 'map');
    configureBadgeAlphaMaterial(m);
  }
  return ok;
};

export interface MaterialEntry {
  uuid: string;
  name: string;
  hex: string;
  hasTexture: boolean;
  texture?: TextureTransformState | null;
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
  return getPrimaryTexture(material) != null;
};

export const getPrimaryTexture = (material: THREE.Material): THREE.Texture | null => {
  const m = material as THREE.MeshStandardMaterial;
  for (const key of TEXTURE_KEYS) {
    const tex = (m as any)[key] as THREE.Texture | undefined | null;
    if (tex) return tex;
  }
  return null;
};

export const readTextureState = (texture: THREE.Texture): TextureTransformState => ({
  repeatX: texture.repeat.x,
  repeatY: texture.repeat.y,
  offsetX: texture.offset.x,
  offsetY: texture.offset.y,
  rotation: texture.rotation,
  wrapS: texture.wrapS,
  wrapT: texture.wrapT,
  flipY: texture.flipY
});

export const applyTextureState = (
  texture: THREE.Texture,
  patch: Partial<TextureTransformState>
): void => {
  if (typeof patch.repeatX === 'number') texture.repeat.x = patch.repeatX;
  if (typeof patch.repeatY === 'number') texture.repeat.y = patch.repeatY;
  if (typeof patch.offsetX === 'number') texture.offset.x = patch.offsetX;
  if (typeof patch.offsetY === 'number') texture.offset.y = patch.offsetY;
  if (typeof patch.rotation === 'number') texture.rotation = patch.rotation;
  if (typeof patch.flipY === 'boolean') texture.flipY = patch.flipY;
  // Zawsze clamp — repeat/mirror powoduje „dublowanie” i kreski na krawędziach
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.updateMatrix();
  texture.needsUpdate = true;
};

const ensureEditableTexture = (material: THREE.Material): THREE.Texture | null => {
  const m = material as THREE.MeshStandardMaterial;
  const tex = getPrimaryTexture(material);
  if (!tex) return null;
  const slot = TEXTURE_KEYS.find((k) => (m as any)[k] === tex) || 'map';
  if (!(tex as any).userData?._faEditClone) {
    const cloned = tex.clone();
    cloned.userData._faEditClone = true;
    delete cloned.userData._faAlphaSanitized;
    configureBadgeTexture(cloned, slot);
    (m as any)[slot] = cloned;
    if (slot === 'map') configureBadgeAlphaMaterial(m);
    m.needsUpdate = true;
  }
  return getPrimaryTexture(material);
};

export const applyTextureChange = (
  scene: THREE.Object3D | null | undefined,
  materialUuid: string,
  patch: Partial<TextureTransformState>
): void => {
  if (!scene) return;
  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      if (mat.uuid !== materialUuid) return;
      const tex = ensureEditableTexture(mat);
      if (!tex) return;
      applyTextureState(tex, patch);
      const slot = TEXTURE_KEYS.find((k) => (mat as any)[k] === tex) || 'map';
      configureBadgeTexture(tex, slot);
      if (slot === 'map') configureBadgeAlphaMaterial(mat);
      mat.needsUpdate = true;
    });
  });
};

export const textureStatesEqual = (
  a: TextureTransformState | null | undefined,
  b: TextureTransformState | null | undefined,
  epsilon = 0.0001
): boolean => {
  if (!a || !b) return !a && !b;
  return (
    Math.abs(a.repeatX - b.repeatX) < epsilon &&
    Math.abs(a.repeatY - b.repeatY) < epsilon &&
    Math.abs(a.offsetX - b.offsetX) < epsilon &&
    Math.abs(a.offsetY - b.offsetY) < epsilon &&
    Math.abs(a.rotation - b.rotation) < epsilon &&
    a.wrapS === b.wrapS &&
    a.wrapT === b.wrapT &&
    a.flipY === b.flipY
  );
};

/** Ustaw repeat według proporcji obrazu (często koryguje rozciągnięcie). */
export const applyImageAspectTextureFix = (material: THREE.Material): boolean => {
  const tex = ensureEditableTexture(material);
  if (!tex) return false;
  const img = tex.image as { width?: number; height?: number } | undefined;
  const w = img?.width;
  const h = img?.height;
  if (!w || !h) return false;
  const aspect = w / h;
  if (!Number.isFinite(aspect) || aspect <= 0) return false;
  applyTextureState(tex, { repeatX: 1, repeatY: aspect });
  return true;
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
      const primaryTex = getPrimaryTexture(mat);
      map.set(mat.uuid, {
        uuid: mat.uuid,
        name: mat.name || colorMat.type || 'Material',
        hex: colorToHex(colorMat.color),
        hasTexture: primaryTex != null,
        texture: primaryTex ? readTextureState(primaryTex) : null,
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
  /** Transformacja mapy diffuse (`material.map`). */
  texture?: Partial<TextureTransformState>;
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

      if (change.texture) {
        const tex = getPrimaryTexture(mat);
        if (tex) applyTextureState(tex, change.texture);
      }

      (mat as any).needsUpdate = true;
    });
  });
};

/** Wczytuje PNG/WebP jako teksturę mapy diffuse (z defringe). */
export const createBadgeMapTextureFromFile = async (file: File): Promise<THREE.Texture> => {
  const url = URL.createObjectURL(file);
  try {
    const loader = new THREE.TextureLoader();
    const tex = await loader.loadAsync(url);
    delete tex.userData._faAlphaSanitized;
    configureBadgeTexture(tex, 'map');
    return tex;
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Podmienia `material.map` na nową teksturę (live preview). */
export const applyMapTextureToMaterial = (
  scene: THREE.Object3D,
  materialUuid: string,
  texture: THREE.Texture,
  options?: { disposePreviousMap?: boolean }
): void => {
  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      if (mat.uuid !== materialUuid) return;
      const m = mat as THREE.MeshStandardMaterial;
      const prev = m.map;
      if (prev && prev !== texture && options?.disposePreviousMap !== false) {
        prev.dispose();
      }
      m.map = texture;
      configureBadgeAlphaMaterial(m);
      m.needsUpdate = true;
    });
  });
};

/** Eksport GLB z aktualnej sceny edycji (kolory, tekstury, wgrane PNG). */
export const exportGLBFromScene = async (
  scene: THREE.Object3D,
  animations: THREE.AnimationClip[] = []
): Promise<Blob> => {
  const exporter = new GLTFExporter();
  const result = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
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
        animations
      }
    );
  });
  return new Blob([result], { type: 'model/gltf-binary' });
};

export interface ExportArgs {
  /** URL oryginalnego GLB (np. z Supabase Public URL). */
  originalUrl: string;
  /** Zmiany kolorów (podpis: name + originalHex). */
  changes: MaterialColorChange[];
  /** Zmiany pozycji meshów (po meshPath). */
  transformChanges?: MeshTransformChange[];
}

/**
 * Eksportuje binarny GLB z naniesionymi zmianami kolorów.
 * Pobiera świeży plik (omijając cache), żeby nie nadpisać sceny przerobionej
 * przez `Badge3D` (klonowanie materiałów).
 */
export const exportGLB = async ({
  originalUrl,
  changes,
  transformChanges = []
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

  // 3b) Pozycje meshów (układ elementów).
  applyTransformChanges(gltf.scene, transformChanges);

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
