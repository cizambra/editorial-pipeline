import { ReactNode, useState, useCallback } from 'react';

interface MobilePageContainerProps {
  children: ReactNode;
  hasBottomNav?: boolean;
  backgroundColor?: string;
  onRefresh?: () => Promise<void>;
  className?: string;
}

/**
 * Root wrapper for all mobile pages with consistent spacing and bottom nav padding
 * 
 * @example
 * <MobilePageContainer hasBottomNav onRefresh={handleRefresh}>
 *   {content}
 * </MobilePageContainer>
 */
export function MobilePageContainer({
  children,
  hasBottomNav = true,
  backgroundColor = 'var(--background)',
  onRefresh,
  className = '',
}: MobilePageContainerProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!onRefresh) return;
    const touch = e.touches[0];
    const startY = touch.clientY;
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      const currentTouch = moveEvent.touches[0];
      const distance = currentTouch.clientY - startY;
      
      // Only track if scrolled to top and pulling down
      if (window.scrollY === 0 && distance > 0) {
        setPullDistance(Math.min(distance, 100));
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance > 60 && !isRefreshing) {
        setIsRefreshing(true);
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
        }
      }
      setPullDistance(0);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  }, [onRefresh, pullDistance, isRefreshing]);

  return (
    <div 
      className={`lg:contents ${className}`}
      onTouchStart={handleTouchStart}
    >
      {/* Pull to refresh indicator */}
      {onRefresh && (
        <div 
          className="lg:hidden fixed top-0 left-0 right-0 flex items-center justify-center transition-opacity z-50"
          style={{
            height: pullDistance,
            opacity: pullDistance / 60,
            pointerEvents: 'none',
          }}
        >
          <div className="w-8 h-8 border-3 border-[#c4522a] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Main content */}
      <div
        className={`lg:contents ${hasBottomNav ? 'pb-20' : ''}`}
        style={{ background: backgroundColor }}
      >
        {children}
      </div>
    </div>
  );
}
