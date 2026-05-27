/**
 * Układ elementów odznaki GLB — tryb admina.
 * Grupuje po hierarchii: najgłębsza nazwana „liść” lub rodzeństwo z meshami
 * (np. 4 piłki = 4 grupy po 20 meshów), bez zwijania całej odznaki w jeden wpis.
 */

import * as THREE from 'three';

export type LayoutAxis = 'x' | 'y' | 'z';
export type AlignMode = 'min' | 'max' | 'center' | 'avg';

/** @deprecated Użyj LayoutNodeRef */
export type MeshRef = LayoutNodeRef;

export interface LayoutNodeRef {
  nodePath: string;
  name: string;
  childMeshCount: number;
  position: [number, number, number];
}

export interface MeshTransformChange {
  meshPath: string;
  position: [number, number, number];
}

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

export const countMeshDescendants = (node: THREE.Object3D): number => {
  let count = 0;
  node.traverse((c) => {
    if (c instanceof THREE.Mesh) count++;
  });
  return count;
};

const childHasMeshes = (node: THREE.Object3D): boolean =>
  node instanceof THREE.Mesh || countMeshDescendants(node) > 0;

/** Ma nazwanego potomka (nie mesha), który też zawiera meshe. */
const hasNamedDescendantWithMeshes = (node: THREE.Object3D): boolean => {
  let found = false;
  node.traverse((c) => {
    if (c === node) return;
    if (c.name?.trim() && childHasMeshes(c)) found = true;
  });
  return found;
};

/** Ma podgrupę (nie sam mesh) z meshami — np. piłka wewnątrz „Sceny”. */
const hasStructuralChildWithMeshes = (node: THREE.Object3D): boolean =>
  node.children.some((c) => !(c instanceof THREE.Mesh) && childHasMeshes(c));

/** Wiele bezpośrednich meshów (kontener, nie pojedynczy element). */
const isMeshOnlyContainer = (node: THREE.Object3D): boolean => {
  const withMeshes = node.children.filter(childHasMeshes);
  return withMeshes.length >= 2 && withMeshes.every((c) => c instanceof THREE.Mesh);
};

/**
 * Nazwana grupa będąca pojedynczym elementem układu (nie opakowaniem całej odznaki).
 */
const isNamedLayoutLeaf = (node: THREE.Object3D): boolean => {
  if (!node.name?.trim() || !childHasMeshes(node)) return false;
  if (hasNamedDescendantWithMeshes(node)) return false;
  if (hasStructuralChildWithMeshes(node)) return false;
  if (isMeshOnlyContainer(node)) return false;
  return true;
};

/**
 * Najgłębszy węzeł do przesuwania dla danego mesha.
 */
const getLayoutNodeForMesh = (mesh: THREE.Mesh, sceneRoot: THREE.Object3D): THREE.Object3D => {
  // 1) Najbliższa nazwana „liść” (np. Ball_1), nie korzeń sceny
  let current: THREE.Object3D | null = mesh.parent;
  while (current && current !== sceneRoot) {
    if (isNamedLayoutLeaf(current)) return current;
    current = current.parent;
  }

  // 2) Najgłębszy podział rodzeństwa z meshami (np. 4 grupy piłek bez nazw)
  current = mesh;
  let splitUnit: THREE.Object3D | null = null;

  while (current && current !== sceneRoot) {
    const parent = current.parent;
    if (!parent || parent === sceneRoot) break;

    const peers = parent.children.filter(childHasMeshes);

    if (peers.length >= 2) {
      const allPeersAreMeshes = peers.every((p) => p instanceof THREE.Mesh);
      if (current instanceof THREE.Mesh && allPeersAreMeshes) {
        current = parent;
        continue;
      }
      splitUnit = current;
      break;
    }

    current = parent;
  }

  if (splitUnit) return splitUnit;

  // 3) Najgłębsza Group nad meshem (bez wchodzenia w korzeń z jednym dzieckiem)
  current = mesh.parent;
  let deepestGroup: THREE.Object3D | null = null;
  while (current && current !== sceneRoot) {
    if (current instanceof THREE.Group) deepestGroup = current;
    const parent = current.parent;
    if (!parent || parent === sceneRoot) break;
    if (parent.children.filter(childHasMeshes).length <= 1) break;
    current = parent;
  }
  if (deepestGroup) return deepestGroup;

  return mesh;
};

export const findObjectByPath = (
  root: THREE.Object3D,
  nodePath: string
): THREE.Object3D | null => {
  if (!nodePath) return root;
  const parts = nodePath.split('/');
  let current: THREE.Object3D = root;
  for (const part of parts) {
    const idx = parseInt(part, 10);
    if (Number.isNaN(idx) || idx < 0 || idx >= current.children.length) return null;
    current = current.children[idx];
  }
  return current;
};

export const extractLayoutNodes = (scene: THREE.Object3D | null | undefined): LayoutNodeRef[] => {
  if (!scene) return [];

  const nodeToPath = new Map<THREE.Object3D, string>();
  walkWithPath(scene, (node, path) => nodeToPath.set(node, path));

  const byPath = new Map<string, LayoutNodeRef>();

  walkWithPath(scene, (node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const layoutNode = getLayoutNodeForMesh(node, scene);
    const layoutPath = nodeToPath.get(layoutNode);
    if (layoutPath == null) return;

    if (!byPath.has(layoutPath)) {
      const displayName = layoutNode.name?.trim();
      byPath.set(layoutPath, {
        nodePath: layoutPath,
        name: displayName || `Grupa ${layoutPath}`,
        childMeshCount: countMeshDescendants(layoutNode),
        position: [layoutNode.position.x, layoutNode.position.y, layoutNode.position.z]
      });
    }
  });

  return Array.from(byPath.values()).sort(
    (a, b) => a.name.localeCompare(b.name) || a.nodePath.localeCompare(b.nodePath)
  );
};

export const extractMeshes = extractLayoutNodes;

const getWorldPosition = (obj: THREE.Object3D): THREE.Vector3 => {
  obj.updateMatrixWorld(true);
  return new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);
};

const setWorldPosition = (obj: THREE.Object3D, worldPos: THREE.Vector3): void => {
  const parent = obj.parent;
  if (!parent) {
    obj.position.copy(worldPos);
    return;
  }
  parent.updateMatrixWorld(true);
  const local = worldPos.clone();
  parent.worldToLocal(local);
  obj.position.copy(local);
};

const getNodesByPaths = (scene: THREE.Object3D, paths: string[]): THREE.Object3D[] => {
  return paths
    .map((p) => findObjectByPath(scene, p))
    .filter((n): n is THREE.Object3D => n != null);
};

export const distributeAlongAxis = (
  scene: THREE.Object3D,
  nodePaths: string[],
  axis: LayoutAxis
): void => {
  const nodes = getNodesByPaths(scene, nodePaths);
  if (nodes.length < 2) return;

  scene.updateMatrixWorld(true);
  const items = nodes.map((node) => ({
    node,
    world: getWorldPosition(node)
  }));
  items.sort((a, b) => a.world[axis] - b.world[axis]);

  const values = items.map((i) => i.world[axis]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const n = items.length;
  const step = n > 1 ? (max - min) / (n - 1) : 0;

  items.forEach((item, i) => {
    const target = item.world.clone();
    target[axis] = min + step * i;
    setWorldPosition(item.node, target);
  });
};

export const alignAlongAxis = (
  scene: THREE.Object3D,
  nodePaths: string[],
  axis: LayoutAxis,
  mode: AlignMode
): void => {
  const nodes = getNodesByPaths(scene, nodePaths);
  if (nodes.length < 2) return;

  scene.updateMatrixWorld(true);
  const worlds = nodes.map((n) => getWorldPosition(n));
  const values = worlds.map((w) => w[axis]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  let target: number;
  switch (mode) {
    case 'min':
      target = min;
      break;
    case 'max':
      target = max;
      break;
    case 'center':
      target = (min + max) / 2;
      break;
    case 'avg':
      target = values.reduce((a, b) => a + b, 0) / values.length;
      break;
  }

  nodes.forEach((node, i) => {
    const w = worlds[i].clone();
    w[axis] = target;
    setWorldPosition(node, w);
  });
};

export const collectTransformChanges = (
  scene: THREE.Object3D,
  baseline: Record<string, [number, number, number]>,
  layoutPaths?: Set<string>
): MeshTransformChange[] => {
  const tracked = layoutPaths ?? new Set(Object.keys(baseline));
  const changes: MeshTransformChange[] = [];
  const eps = 1e-5;

  walkWithPath(scene, (node, path) => {
    if (!tracked.has(path)) return;
    const base = baseline[path];
    if (!base) return;
    const p = node.position;
    if (
      Math.abs(p.x - base[0]) > eps ||
      Math.abs(p.y - base[1]) > eps ||
      Math.abs(p.z - base[2]) > eps
    ) {
      changes.push({
        meshPath: path,
        position: [p.x, p.y, p.z]
      });
    }
  });
  return changes;
};

export const buildBaselinePositions = (
  scene: THREE.Object3D,
  layoutNodes?: LayoutNodeRef[]
): Record<string, [number, number, number]> => {
  const nodes = layoutNodes ?? extractLayoutNodes(scene);
  const baseline: Record<string, [number, number, number]> = {};
  nodes.forEach((n) => {
    const obj = findObjectByPath(scene, n.nodePath);
    if (obj) {
      baseline[n.nodePath] = [obj.position.x, obj.position.y, obj.position.z];
    }
  });
  return baseline;
};

export const applyTransformChanges = (
  root: THREE.Object3D,
  changes: MeshTransformChange[]
): void => {
  if (!changes.length) return;
  const byPath = new Map(changes.map((c) => [c.meshPath, c]));
  walkWithPath(root, (node, path) => {
    const change = byPath.get(path);
    if (!change?.position) return;
    node.position.set(change.position[0], change.position[1], change.position[2]);
  });
};

export const getMeshDescendants = (node: THREE.Object3D): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  node.traverse((c) => {
    if (c instanceof THREE.Mesh) meshes.push(c);
  });
  return meshes;
};

/** Grupa utworzona ręcznie (zaznaczenie prostokątem). */
export type CustomLayoutGroup = {
  id: string;
  name: string;
  meshPaths: string[];
};

const _delta = new THREE.Vector3();

export const getMeshGroupWorldCenter = (
  scene: THREE.Object3D,
  meshPaths: string[]
): THREE.Vector3 | null => {
  const pts: THREE.Vector3[] = [];
  meshPaths.forEach((p) => {
    const node = findObjectByPath(scene, p);
    if (node instanceof THREE.Mesh) pts.push(getWorldPosition(node));
  });
  if (!pts.length) return null;
  const c = new THREE.Vector3();
  pts.forEach((v) => c.add(v));
  return c.divideScalar(pts.length);
};

export const translateMeshGroup = (
  scene: THREE.Object3D,
  meshPaths: string[],
  worldDelta: THREE.Vector3
): void => {
  meshPaths.forEach((p) => {
    const node = findObjectByPath(scene, p);
    if (!(node instanceof THREE.Mesh)) return;
    const w = getWorldPosition(node).add(worldDelta);
    setWorldPosition(node, w);
  });
};

/** Przesunięcie wielu meshów w płaszczyźnie XY (świat), np. lewo/prawo. */
export const nudgeMeshesInPlane = (
  scene: THREE.Object3D,
  meshPaths: string[],
  axis: 'x' | 'y',
  direction: -1 | 1,
  step: number
): void => {
  if (!meshPaths.length || step <= 0) return;
  _delta.set(0, 0, 0);
  _delta[axis] = direction * step;
  translateMeshGroup(scene, meshPaths, _delta);
};

/** Równy odstęp między grupami meshów (środki grup). */
export const distributeMeshGroups = (
  scene: THREE.Object3D,
  groups: string[][],
  axis: LayoutAxis
): void => {
  if (groups.length < 2) return;
  scene.updateMatrixWorld(true);

  const items = groups
    .map((paths) => ({
      paths,
      world: getMeshGroupWorldCenter(scene, paths)
    }))
    .filter((i): i is { paths: string[]; world: THREE.Vector3 } => i.world != null);

  if (items.length < 2) return;
  items.sort((a, b) => a.world[axis] - b.world[axis]);

  const values = items.map((i) => i.world[axis]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = items.length > 1 ? (max - min) / (items.length - 1) : 0;

  items.forEach((item, i) => {
    const target = min + step * i;
    _delta.set(0, 0, 0);
    _delta[axis] = target - item.world[axis];
    translateMeshGroup(scene, item.paths, _delta);
  });
};

export const alignMeshGroups = (
  scene: THREE.Object3D,
  groups: string[][],
  axis: LayoutAxis,
  mode: AlignMode
): void => {
  if (groups.length < 2) return;
  scene.updateMatrixWorld(true);

  const items = groups
    .map((paths) => ({
      paths,
      world: getMeshGroupWorldCenter(scene, paths)
    }))
    .filter((i): i is { paths: string[]; world: THREE.Vector3 } => i.world != null);

  if (items.length < 2) return;
  const values = items.map((i) => i.world[axis]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  let target: number;
  switch (mode) {
    case 'min':
      target = min;
      break;
    case 'max':
      target = max;
      break;
    case 'center':
      target = (min + max) / 2;
      break;
    case 'avg':
      target = values.reduce((a, b) => a + b, 0) / values.length;
      break;
  }

  items.forEach((item) => {
    _delta.set(0, 0, 0);
    _delta[axis] = target - item.world[axis];
    translateMeshGroup(scene, item.paths, _delta);
  });
};

export const buildAllMeshBaseline = (scene: THREE.Object3D): Record<string, [number, number, number]> => {
  const baseline: Record<string, [number, number, number]> = {};
  walkWithPath(scene, (node, path) => {
    if (!(node instanceof THREE.Mesh)) return;
    baseline[path] = [node.position.x, node.position.y, node.position.z];
  });
  return baseline;
};

export const collectAllMeshTransformChanges = (
  scene: THREE.Object3D,
  baseline: Record<string, [number, number, number]>
): MeshTransformChange[] => {
  const changes: MeshTransformChange[] = [];
  const eps = 1e-5;
  walkWithPath(scene, (node, path) => {
    if (!(node instanceof THREE.Mesh)) return;
    const base = baseline[path];
    if (!base) return;
    const p = node.position;
    if (
      Math.abs(p.x - base[0]) > eps ||
      Math.abs(p.y - base[1]) > eps ||
      Math.abs(p.z - base[2]) > eps
    ) {
      changes.push({ meshPath: path, position: [p.x, p.y, p.z] });
    }
  });
  return changes;
};
