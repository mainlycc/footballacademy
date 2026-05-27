import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutMarqueeBridgeHandle } from './LayoutMarqueeBridge';
import type { PixelRect } from '../utils/marqueeSelection';

interface Props {
  bridgeRef: React.RefObject<LayoutMarqueeBridgeHandle | null>;
  enabled: boolean;
}

type DragPoint = { x: number; y: number };

const LayoutMarqueeOverlay: React.FC<Props> = ({ bridgeRef, enabled }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<DragPoint | null>(null);
  const [dragCurrent, setDragCurrent] = useState<DragPoint | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getLocalPoint = useCallback((e: React.MouseEvent | MouseEvent): DragPoint | null => {
    const el = overlayRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const finishDrag = useCallback(
    (end: DragPoint, additive: boolean) => {
      if (!dragStart) return;
      const pixelRect: PixelRect = {
        x0: dragStart.x,
        y0: dragStart.y,
        x1: end.x,
        y1: end.y
      };
      bridgeRef.current?.selectInRect(pixelRect, additive);
      setDragStart(null);
      setDragCurrent(null);
      setIsDragging(false);
    },
    [bridgeRef, dragStart]
  );

  const onMouseDown = (e: React.MouseEvent) => {
    if (!enabled || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = getLocalPoint(e);
    if (!pt) return;
    setDragStart(pt);
    setDragCurrent(pt);
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (e: MouseEvent) => {
      const pt = getLocalPoint(e);
      if (pt) setDragCurrent(pt);
    };

    const onUp = (e: MouseEvent) => {
      const pt = getLocalPoint(e);
      if (pt) finishDrag(pt, e.shiftKey);
      else setIsDragging(false);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, getLocalPoint, finishDrag]);

  useEffect(() => {
    if (!enabled) {
      setDragStart(null);
      setDragCurrent(null);
      setIsDragging(false);
    }
  }, [enabled]);

  if (!enabled) return null;

  let boxStyle: React.CSSProperties | undefined;
  if (dragStart && dragCurrent) {
    const left = Math.min(dragStart.x, dragCurrent.x);
    const top = Math.min(dragStart.y, dragCurrent.y);
    const width = Math.abs(dragCurrent.x - dragStart.x);
    const height = Math.abs(dragCurrent.y - dragStart.y);
    boxStyle = {
      left,
      top,
      width,
      height
    };
  }

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-40 cursor-crosshair touch-none"
      onMouseDown={onMouseDown}
      title="Przeciągnij prostokąt · Shift = dodać do zaznaczenia"
    >
      {boxStyle && (
        <div
          className="absolute border-2 border-amber-400 bg-amber-400/15 pointer-events-none rounded-sm"
          style={boxStyle}
        />
      )}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-black/70 border border-amber-400/40 text-amber-200 text-[9px] font-bold uppercase tracking-widest pointer-events-none">
        Zaznacz prostokątem · Shift dodaje
      </div>
    </div>
  );
};

export default LayoutMarqueeOverlay;
