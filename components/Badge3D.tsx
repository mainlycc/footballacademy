
import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, ContactShadows, Center, Environment } from '@react-three/drei';
import * as THREE from 'three';
import type { BadgeLightingConfig } from '../utils/badgeLightingConfig';
import { DEFAULT_BADGE_LIGHTING } from '../utils/badgeLightingConfig';
import { configureBadgeAlphaMaterial, configureBadgeTexture } from '../utils/glbColorEditor';

const Group = 'group' as any;
const Primitive = 'primitive' as any;
const AmbientLight = 'ambientLight' as any;
const DirectionalLight = 'directionalLight' as any;

interface Badge3DProps {
  url: string;
  spinTrigger: number;
  zoomLevel: number;
  isLit: boolean;
  hideShadows?: boolean;
  onPointerDown?: (e: any) => void;
  onPointerMove?: (e: any) => void;
  onPointerUp?: (e: any) => void;
  onPointerLeave?: (e: any) => void;
  onLoadComplete?: () => void;
  /**
   * Tryb admina: klonuje WSZYSTKIE materiały (nie tylko szklane), pomija
   * glass-enhancement i udostępnia scenę przez `onSceneReady`. Dzięki temu
   * panel kolorów może modyfikować `material.color` na żywo bez wpływu na cache useGLTF.
   */
  adminMode?: boolean;
  onSceneReady?: (scene: THREE.Object3D) => void;
  /** Ustawienia światła (localStorage); domyślnie z `DEFAULT_BADGE_LIGHTING`. */
  lightingConfig?: BadgeLightingConfig;
}

// Wewnętrzny komponent który używa useGLTF
const Badge3DInternal: React.FC<Badge3DProps> = ({
  url,
  spinTrigger,
  zoomLevel = 0,
  isLit,
  hideShadows = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onLoadComplete,
  adminMode = false,
  onSceneReady,
  lightingConfig: lightingConfigProp,
}) => {
  const lightingConfig = lightingConfigProp ?? DEFAULT_BADGE_LIGHTING;
  const lightingRef = useRef(lightingConfig);
  lightingRef.current = lightingConfig;
  // useGLTF musi być zawsze wywołany (to hook)
  // Używamy cache'owania aby uniknąć wielokrotnego ładowania tego samego modelu
  // useGLTF automatycznie obsługuje błędy przez Suspense
  const { scene } = useGLTF(url, true);
  
  // Wywołaj callback po załadowaniu
  useEffect(() => {
    if (scene && onLoadComplete) {
      // Małe opóźnienie, aby upewnić się, że wszystko jest gotowe
      const timer = setTimeout(() => {
        onLoadComplete();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scene, onLoadComplete]);

  // Normalizacja wielkości modelu i poprawa materiałów szklanych
  // Używamy url jako zależności, aby upewnić się, że clonedScene się aktualizuje przy zmianie modelu
  const clonedScene = useMemo(() => {
    if (!scene) return null;
    
    const clone = scene.clone(true);
    
    // Reset transformacji (na wszelki wypadek)
    clone.rotation.set(0, 0, 0);
    clone.position.set(0, 0, 0);
    clone.scale.set(1, 1, 1);
    
    // Tryb admina: klonujemy WSZYSTKIE materiały (każdy mesh dostaje własny
    // klon), pomijamy glass-enhancement, żeby kolory wyglądały dokładnie tak
    // jak w pliku GLB i nie wpływały na cache useGLTF.
    if (adminMode) {
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const cloneMat = (m: THREE.Material) => {
            if (!m || !(m as any).clone) return m;
            const cloned = m.clone() as THREE.MeshStandardMaterial;
            const texKeys = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap'] as const;
            texKeys.forEach((key) => {
              const tex = cloned[key];
              if (tex) {
                const t = tex.clone();
                delete t.userData._faAlphaSanitized;
                configureBadgeTexture(t, key);
                cloned[key] = t;
              }
            });
            if (
              cloned.map &&
              !(
                cloned instanceof THREE.MeshPhysicalMaterial &&
                cloned.transmission > 0
              )
            ) {
              configureBadgeAlphaMaterial(cloned);
            }
            return cloned;
          };
          if (Array.isArray(child.material)) {
            child.material = child.material.map((m) => cloneMat(m));
          } else {
            child.material = cloneMat(child.material);
          }
        }
      });
    } else {
      // Poprawa materiałów dla efektu szkła (jak w Spline)
      clone.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          const updatedMaterials: THREE.Material[] = [];

          materials.forEach((material) => {
            // Obsługuj wszystkie typy materiałów, które mogą mieć efekt szkła
            if (material instanceof THREE.MeshStandardMaterial ||
                material instanceof THREE.MeshPhysicalMaterial ||
                material instanceof THREE.MeshLambertMaterial ||
                material instanceof THREE.MeshPhongMaterial ||
                material instanceof THREE.MeshBasicMaterial) {

              const mat = material.clone();
              // Ujednolicenie tekstur (eliminuje szwy/halo na PNG przy skalowaniu).
              const texKeys = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap'] as const;
              texKeys.forEach((key) => {
                const tex = (mat as any)[key] as THREE.Texture | undefined;
                if (!tex) return;
                const t = tex.clone();
                delete t.userData._faAlphaSanitized;
                configureBadgeTexture(t, key);
                (mat as any)[key] = t;
              });
              const stdMat = mat as THREE.MeshStandardMaterial;
              if (
                stdMat.map &&
                !(
                  mat instanceof THREE.MeshPhysicalMaterial &&
                  (mat as THREE.MeshPhysicalMaterial).transmission > 0
                )
              ) {
                configureBadgeAlphaMaterial(mat);
              }

              const hasTransparency = mat.transparent || mat.opacity < 1.0;
              const hasTransmission = mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0;
              const isGlass = hasTransparency || hasTransmission;

              if (isGlass) {
                mat.transparent = true;
                mat.depthWrite = false;

                if (mat instanceof THREE.MeshPhysicalMaterial) {
                  if (mat.transmission > 0 || hasTransparency) {
                    mat.side = THREE.DoubleSide;
                    mat.thickness = mat.thickness || 0.5;
                    mat.ior = mat.ior || 1.5;
                    mat.roughness = mat.roughness || 0.1;
                    mat.metalness = mat.metalness || 0.0;
                  }
                }

                mat.alphaTest = 0;
                mat.needsUpdate = true;

                if (mat.opacity === undefined || mat.opacity === 1.0) {
                  mat.opacity = mat.opacity || 1.0;
                }
              }

              updatedMaterials.push(mat);
            } else {
              updatedMaterials.push(material);
            }
          });

          if (Array.isArray(child.material)) {
            child.material = updatedMaterials;
          } else {
            child.material = updatedMaterials[0];
          }
        }
      });
    }
    
    // Oblicz bounding box całego obiektu
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    // Znajdź największy wymiar (X, Y lub Z)
    const maxDim = Math.max(size.x, size.y, size.z);
    
    // Docelowa wielkość w jednostkach Three.js.
    // Przy kamerze na Z=4 i FOV 45, widoczna wysokość to ok 3.3.
    // Ustawiamy mniejszą wartość (2.2), aby odznaka miała marginesy i nie była za duża.
    const targetSize = 2.2;
    
    if (maxDim > 0 && maxDim < 1000) { // Walidacja - jeśli model jest zbyt duży, może być błąd
      const scaleFactor = targetSize / maxDim;
      clone.scale.set(scaleFactor, scaleFactor, scaleFactor);
      
      // Wyśrodkuj model po skalowaniu - przenieś centrum do (0, 0, 0)
      // Użyj nowego obiektu Vector3, aby uniknąć mutacji
      const scaledCenter = center.clone().multiplyScalar(scaleFactor);
      // Przesuń model, aby jego środek był w (0, 0, 0)
      clone.position.sub(scaledCenter);
    }
    
    // Wyzeruj rotację (pozycja została już ustawiona przez wyśrodkowanie)
    clone.rotation.set(0, 0, 0);
    
    return clone;
  }, [scene, url, adminMode]);

  // Powiadom rodzica (np. panel kolorów) o gotowej scenie po każdym przebudowaniu.
  useEffect(() => {
    if (clonedScene && onSceneReady) {
      onSceneReady(clonedScene);
    }
  }, [clonedScene, onSceneReady]);

  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);
  const fillDirRef = useRef<THREE.DirectionalLight>(null);
  const contactShadowRef = useRef<THREE.Group>(null);
  const { scene: fiberScene } = useThree();
  const rotationProgress = useRef(0);
  const isRotating = useRef(false);
  
  // Reset pozycji Z przy zmianie odznaki
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.z = 0;
    }
    if (pivotRef.current) {
      pivotRef.current.rotation.y = 0;
    }
    isRotating.current = false;
    rotationProgress.current = 0;
  }, [url]);

  const targetKeyPos = useMemo(() => new THREE.Vector3(), []);
  const targetFillPos = useMemo(() => new THREE.Vector3(), []);

  // Obsługa rotacji (Spin)
  useEffect(() => {
    if (spinTrigger > 0) {
      isRotating.current = true;
      rotationProgress.current = 0;
    }
  }, [spinTrigger]);

  useFrame((state, delta) => {
    // 1. Obsługa Zoomu
    // zoomLevel: 0 (Normal), 1 (Oddal), 2 (Przybliż)
    // Kamera (Viewer) jest na stałej pozycji Z=4. Obiekt domyślnie na Z=0.
    let targetZ = 0;
    if (zoomLevel === 1) targetZ = -1.5; // Oddalenie - zmniejszone z -2.0
    if (zoomLevel === 2) targetZ = 0.8;  // Przybliżenie - zmniejszone z 1.2

    if (groupRef.current) {
      // Ogranicz zakres pozycji Z, aby zapobiec zbytniemu oddaleniu
      const currentZ = groupRef.current.position.z;
      const newZ = THREE.MathUtils.lerp(currentZ, targetZ, 0.1);
      
      // Walidacja - upewnij się, że pozycja Z jest w rozsądnym zakresie
      if (newZ >= -3 && newZ <= 3) {
        groupRef.current.position.z = newZ;
      } else {
        groupRef.current.position.z = THREE.MathUtils.clamp(newZ, -3, 3);
      }
    }

    // 2. Obsługa Rotacji (Spin)
    if (pivotRef.current && isRotating.current) {
      const speed = 6;
      pivotRef.current.rotation.y += delta * speed;
      rotationProgress.current += delta * speed;
      if (rotationProgress.current >= Math.PI * 2) {
        pivotRef.current.rotation.y = 0;
        isRotating.current = false;
      }
    }

    // 3. System oświetlenia (konfiguracja z localStorage + drugie światło wypełniające)
    const cfg = lightingRef.current;
    const targetAmbient = isLit ? cfg.ambientLit : cfg.ambientDark;
    const targetDir = isLit ? cfg.dirIntensityLit : cfg.dirIntensityDark;
    const targetFill = isLit ? cfg.fillIntensityLit : cfg.fillIntensityDark;
    const dp = isLit ? cfg.dirPosLit : cfg.dirPosDark;
    const fp = isLit ? cfg.fillPosLit : cfg.fillPosDark;
    targetKeyPos.set(dp[0], dp[1], dp[2]);
    targetFillPos.set(fp[0], fp[1], fp[2]);
    const targetEnv = isLit ? cfg.envLit : cfg.envDark;
    const targetContact = hideShadows ? 0 : isLit ? cfg.contactOpacityLit : cfg.contactOpacityDark;

    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, targetAmbient, 0.1);
    }
    if (dirRef.current) {
      dirRef.current.intensity = THREE.MathUtils.lerp(dirRef.current.intensity, targetDir, 0.1);
      dirRef.current.position.lerp(targetKeyPos, 0.1);
    }
    if (fillDirRef.current) {
      fillDirRef.current.intensity = THREE.MathUtils.lerp(fillDirRef.current.intensity, targetFill, 0.1);
      fillDirRef.current.position.lerp(targetFillPos, 0.1);
    }

    const curEnv =
      typeof fiberScene.environmentIntensity === 'number' && Number.isFinite(fiberScene.environmentIntensity)
        ? fiberScene.environmentIntensity
        : targetEnv;
    fiberScene.environmentIntensity = THREE.MathUtils.lerp(curEnv, targetEnv, 0.1);

    const root = contactShadowRef.current;
    if (root) {
      root.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material && !Array.isArray(o.material)) {
          const m = o.material as THREE.MeshBasicMaterial;
          if ('opacity' in m) {
            const cur = m.opacity;
            const next = THREE.MathUtils.lerp(cur, targetContact, 0.12);
            m.opacity = next;
            m.transparent = next > 0 && next < 1;
          }
        }
      });
    }
  });

  const c0 = lightingConfig;
  if (!clonedScene) {
    return (
      <Group>
        <AmbientLight intensity={c0.ambientDark} />
        <DirectionalLight position={[c0.dirPosDark[0], c0.dirPosDark[1], c0.dirPosDark[2]]} intensity={c0.dirIntensityDark} />
      </Group>
    );
  }

  return (
    <Group>
      <AmbientLight ref={ambientRef} intensity={c0.ambientDark} />
      <DirectionalLight
        ref={dirRef}
        position={[c0.dirPosDark[0], c0.dirPosDark[1], c0.dirPosDark[2]]}
        intensity={c0.dirIntensityDark}
        castShadow
      />
      <DirectionalLight
        ref={fillDirRef}
        position={[c0.fillPosDark[0], c0.fillPosDark[1], c0.fillPosDark[2]]}
        intensity={c0.fillIntensityDark}
      />
      <Environment preset="city" />

      <Group ref={groupRef}>
        <Group 
          ref={pivotRef} 
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
        >
          {/* Center wyśrodkowuje model geometrycznie (kluczowe po skalowaniu) */}
          <Center>
            <Primitive object={clonedScene} />
          </Center>
        </Group>
      </Group>

      <ContactShadows
        ref={contactShadowRef}
        opacity={hideShadows ? 0 : c0.contactOpacityDark}
        scale={10}
        blur={2.5}
        far={10}
        position={[0, -1.8, 0]}
        color="#000000"
      />
    </Group>
  );
};

// Główny komponent z walidacją URL
const Badge3D: React.FC<Badge3DProps> = React.memo(
  ({
    url,
    spinTrigger,
    zoomLevel = 0,
    isLit,
    hideShadows = false,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onLoadComplete,
    adminMode = false,
    onSceneReady,
    lightingConfig,
  }) => {
    const isValidUrl = url && typeof url === 'string' && url.trim().length > 0;
    const lc = lightingConfig ?? DEFAULT_BADGE_LIGHTING;

    if (!isValidUrl) {
      return (
        <Group>
          <AmbientLight intensity={lc.ambientDark} />
          <DirectionalLight position={[lc.dirPosDark[0], lc.dirPosDark[1], lc.dirPosDark[2]]} intensity={lc.dirIntensityDark} />
        </Group>
      );
    }

    return (
      <Badge3DInternal
        url={url}
        spinTrigger={spinTrigger}
        zoomLevel={zoomLevel}
        isLit={isLit}
        hideShadows={hideShadows}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onLoadComplete={onLoadComplete}
        adminMode={adminMode}
        onSceneReady={onSceneReady}
        lightingConfig={lc}
      />
    );
  }
);

export default Badge3D;
