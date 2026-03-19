import { ReactNode } from 'react';
import { MobileBottomSheet } from '../feedback/MobileBottomSheet';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  position?: 'bottom' | 'left' | 'right';
  snapPoints?: number[];
  dismissible?: boolean;
  showHandle?: boolean;
  title?: string;
}

/**
 * Slide-in panel for menus, filters, forms
 * 
 * @example
 * <MobileDrawer
 *   isOpen={showFilter}
 *   onClose={() => setShowFilter(false)}
 *   position="bottom"
 *   snapPoints={[0.5, 0.9]}
 *   title="Filter Posts"
 * >
 *   <div className="p-4">
 *     <FilterForm />
 *   </div>
 * </MobileDrawer>
 */
export function MobileDrawer({
  isOpen,
  onClose,
  children,
  position = 'bottom',
  snapPoints,
  dismissible = true,
  showHandle = true,
  title,
}: MobileDrawerProps) {
  if (position !== 'bottom') {
    // For now, only bottom position is supported
    // TODO: Implement left/right slide-in drawers
    console.warn('Only bottom position is currently supported');
  }

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      snapPoints={snapPoints}
      dismissible={dismissible && showHandle}
    >
      {/* Title */}
      {title && (
        <div 
          className="px-4 pb-3 border-b"
          style={{ borderColor: 'rgba(var(--border-rgb), 0.14)' }}
        >
          <h3 
            className="text-lg font-bold"
            style={{ color: 'var(--foreground)' }}
          >
            {title}
          </h3>
        </div>
      )}

      {/* Content */}
      {children}
    </MobileBottomSheet>
  );
}
