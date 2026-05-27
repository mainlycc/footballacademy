import { forwardRef, useImperativeHandle } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getMeshPathsInScreenRect, type PixelRect } from '../utils/marqueeSelection';

export type LayoutMarqueeBridgeHandle = {
  selectInRect: (rect: PixelRect, additive: boolean) => string[];
};

interface Props {
  scene: THREE.Object3D | null;
  onSelection: (paths: string[], additive: boolean) => void;
}

const LayoutMarqueeBridge = forwardRef<LayoutMarqueeBridgeHandle, Props>(
  ({ scene, onSelection }, ref) => {
    const { camera, size } = useThree();

    useImperativeHandle(
      ref,
      () => ({
        selectInRect: (rect: PixelRect, additive: boolean) => {
          if (!scene) return [];
          const paths = getMeshPathsInScreenRect(
            scene,
            camera as THREE.Camera,
            size.width,
            size.height,
            rect
          );
          onSelection(paths, additive);
          return paths;
        }
      }),
      [scene, camera, size.width, size.height, onSelection]
    );

    return null;
  }
);

LayoutMarqueeBridge.displayName = 'LayoutMarqueeBridge';

export default LayoutMarqueeBridge;
