
import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, ContactShadows, Center, Environment } from '@react-three/drei';
import * as THREE from 'three';

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
  onLoadComplete?: () => void;
}

// Wewnętrzny komponent który używa useGLTF
const Badge3DInternal: React.FC<Badge3DProps> = ({ url, spinTrigger, zoomLevel = 0, isLit, hideShadows = false, onPointerDown, onLoadComplete }) => {
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
  
  // Sprawdź czy scene istnieje
  if (!scene) {
    return (
      <Group>
        <AmbientLight intensity={0.1} />
        <DirectionalLight position={[2, 5, 2]} intensity={0.2} />
      </Group>
    );
  }
  
  // Normalizacja wielkości modelu i poprawa materiałów szklanych
  // Używamy url jako zależności, aby upewnić się, że clonedScene się aktualizuje przy zmianie modelu
  const clonedScene = useMemo(() => {
    if (!scene) return null;
    
    const clone = scene.clone(true);
    
    // Reset transformacji (na wszelki wypadek)
    clone.rotation.set(0, 0, 0);
    clone.position.set(0, 0, 0);
    clone.scale.set(1, 1, 1);
    
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
            
            const mat = material.clone(); // Klonuj materiał, aby nie modyfikować oryginału
            
            // Sprawdź czy materiał ma właściwości szkła/transparentności
            const hasTransparency = mat.transparent || mat.opacity < 1.0;
            const hasTransmission = mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0;
            const isGlass = hasTransparency || hasTransmission;
            
            if (isGlass) {
              mat.transparent = true;
              mat.depthWrite = false; // Kluczowe dla poprawnych przezroczystych obiektów
              
              // Dla MeshPhysicalMaterial (efekt szkła w Spline)
              if (mat instanceof THREE.MeshPhysicalMaterial) {
                // Zapewnij, że właściwości szkła są poprawnie ustawione
                if (mat.transmission > 0 || hasTransparency) {
                  mat.side = THREE.DoubleSide; // Pokaż obie strony szkła
                  mat.thickness = mat.thickness || 0.5;
                  // Ustawienia dla lepszego efektu szkła
                  mat.ior = mat.ior || 1.5; // Index of refraction (domyślny dla szkła)
                  mat.roughness = mat.roughness || 0.1;
                  mat.metalness = mat.metalness || 0.0;
                }
              }
              
              // Poprawne renderowanie przezroczystości
              mat.alphaTest = 0;
              mat.needsUpdate = true;
              
              // Upewnij się, że przezroczystość jest włączona
              if (mat.opacity === undefined || mat.opacity === 1.0) {
                mat.opacity = mat.opacity || 1.0;
              }
            }
            
            updatedMaterials.push(mat);
          } else {
            // Dla innych typów materiałów, po prostu dodaj
            updatedMaterials.push(material);
          }
        });
        
        // Aktualizuj materiał w mesh
        if (Array.isArray(child.material)) {
          child.material = updatedMaterials;
        } else {
          child.material = updatedMaterials[0];
        }
      }
    });
    
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
  }, [scene, url]);
  
  // Jeśli clonedScene jest null, zwróć placeholder
  if (!clonedScene) {
    return (
      <Group>
        <AmbientLight intensity={0.1} />
        <DirectionalLight position={[2, 5, 2]} intensity={0.2} />
      </Group>
    );
  }

  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);
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
  
  // Pozycje światła - normalna (z boku) i oświetlona (pod kątem)
  const normalLightPosition = new THREE.Vector3(2, 5, 2);
  const litLightPosition = new THREE.Vector3(7, 3, 4); // Bardzo mocno z boku i z przodu dla wyraźnego kątowego oświetlenia

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

    // 3. System oświetlenia
    const targetAmbient = isLit ? 0.6 : 0.1;
    const targetDir     = isLit ? 1.0 : 0.2;
    const targetLightPos = isLit ? litLightPosition : normalLightPosition;

    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, targetAmbient, 0.1);
    }
    if (dirRef.current) {
      dirRef.current.intensity = THREE.MathUtils.lerp(dirRef.current.intensity, targetDir, 0.1);
      // Płynna zmiana pozycji światła
      dirRef.current.position.lerp(targetLightPos, 0.1);
    }
  });

  return (
    <Group>
      <AmbientLight ref={ambientRef} intensity={0.1} />
      <DirectionalLight 
        ref={dirRef} 
        position={[2, 5, 2]} 
        intensity={0.2} 
        castShadow 
      />
      <Environment preset="city" environmentIntensity={isLit ? 0.6 : 0.0} />
      
      <Group ref={groupRef}>
        <Group 
          ref={pivotRef} 
          onPointerDown={onPointerDown}
        >
          {/* Center wyśrodkowuje model geometrycznie (kluczowe po skalowaniu) */}
          <Center>
            <Primitive object={clonedScene} />
          </Center>
        </Group>
      </Group>

      <ContactShadows 
        opacity={hideShadows ? 0.0 : (isLit ? 0.4 : 0.0)} 
        scale={10} blur={2.5} far={10} 
        position={[0, -1.8, 0]} color="#000000" 
      />
    </Group>
  );
};

// Główny komponent z walidacją URL
const Badge3D: React.FC<Badge3DProps> = React.memo(({ url, spinTrigger, zoomLevel = 0, isLit, hideShadows = false, onPointerDown, onLoadComplete }) => {
  // Sprawdź czy URL jest poprawny - bardziej elastyczna walidacja
  const isValidUrl = url && typeof url === 'string' && url.trim().length > 0;
  
  // Jeśli URL jest nieprawidłowy, wyświetl placeholder
  if (!isValidUrl) {
    return (
      <Group>
        <AmbientLight intensity={0.1} />
        <DirectionalLight position={[2, 5, 2]} intensity={0.2} />
        {/* Placeholder - pusta grupa, ale zachowaj strukturę */}
      </Group>
    );
  }
  
  // Renderuj komponent wewnętrzny z useGLTF
  return (
    <Badge3DInternal 
      url={url} 
      spinTrigger={spinTrigger} 
      zoomLevel={zoomLevel} 
      isLit={isLit} 
      hideShadows={hideShadows}
      onPointerDown={onPointerDown}
      onLoadComplete={onLoadComplete}
    />
  );
});

export default Badge3D;
