import { ReactNode, useEffect, useRef, useState } from 'react';

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  height?: number | string | 'auto';
  snapPoints?: number[];
  initialSnap?: number;
  dismissible?: boolean;
  backdrop?: boolean;
  onSnapChange?: (index: number) => void;
}

/**
 * Base bottom sheet component (used internally by MobileDrawer and MobileActionSheet)
 * 
 * @example
 * <MobileBottomSheet
 *   isOpen={isOpen}
 *   onClose={onClose}
 *   height="auto"
 *   snapPoints={[0.5, 0.9]}
 * >
 *   {content}
 * </MobileBottomSheet>
 */
export function MobileBottomSheet({
  isOpen,
  onClose,
  children,
  height = 'auto',
  snapPoints = [],
  initialSnap = 0,
  dismissible = true,
  backdrop = true,
  onSnapChange,
}: MobileBottomSheetProps) {
  const [currentSnap, setCurrentSnap] = useState(initialSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleDragStart = (clientY: number) => {
    if (!dismissible && snapPoints.length === 0) return;
    setIsDragging(true);
    setDragStartY(clientY);
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const offset = clientY - dragStartY;
    if (offset > 0) {
      setDragOffset(offset);
    }
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // If dragged down more than 100px, close
    if (dragOffset > 100 && dismissible) {
      onClose();
    } else if (snapPoints.length > 0) {
      // Snap to nearest point
      const vh = window.innerHeight;
      const currentHeight = snapPoints[currentSnap] * vh;
      const newHeight = currentHeight - dragOffset;
      const newSnapIndex = snapPoints.reduce((closest, point, index) => {
        const pointHeight = point * vh;
        const closestHeight = snapPoints[closest] * vh;
        return Math.abs(pointHeight - newHeight) < Math.abs(closestHeight - newHeight) 
          ? index 
          : closest;
      }, 0);
      
      setCurrentSnap(newSnapIndex);
      onSnapChange?.(newSnapIndex);
    }

    setDragOffset(0);
    setDragStartY(0);
  };

  const getSheetHeight = () => {
    if (snapPoints.length > 0) {
      return `${snapPoints[currentSnap] * 100}vh`;
    }
    if (typeof height === 'number') {
      return `${height}px`;
    }
    return height;
  };

  if (!isOpen) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-[1030]">
      {/* Backdrop */}
      {backdrop && (
        <div
          className="absolute inset-0 transition-opacity duration-200"
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={dismissible ? onClose : undefined}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 flex flex-col transition-transform duration-300"
        style={{
          background: 'white',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.15)',
          maxHeight: '90vh',
          height: getSheetHeight(),
          transform: `translateY(${isDragging ? dragOffset : 0}px)`,
          transitionProperty: isDragging ? 'none' : 'transform',
        }}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
        onTouchEnd={handleDragEnd}
        onMouseDown={(e) => handleDragStart(e.clientY)}
        onMouseMove={(e) => isDragging && handleDragMove(e.clientY)}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        {/* Drag handle */}
        {dismissible && (
          <div className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing">
            <div
              className="w-10 h-1 rounded-full"
              style={{ background: '#d1d5db' }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
