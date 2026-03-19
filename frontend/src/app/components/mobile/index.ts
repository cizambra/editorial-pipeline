/**
 * Mobile Component Library
 * Barrel export for clean imports
 * 
 * Usage:
 * import { MobileButton, MobileFAB, MobileModal } from './components/mobile';
 */

// Layout
export { MobilePageContainer } from './layout/MobilePageContainer';
export { MobileHeader } from './layout/MobileHeader';
export { MobileSafeArea } from './layout/MobileSafeArea';

// Navigation
export { MobileDrawer } from './navigation/MobileDrawer';
export { MobileTabBar } from './navigation/MobileTabBar';
export { MobileSegmentedControl } from './navigation/MobileSegmentedControl';
export { SegmentedTabs } from './navigation/SegmentedTabs';

// Actions
export { MobileButton } from './actions/MobileButton';
export { MobileFAB } from './actions/MobileFAB';
export { MobileActionSheet } from './actions/MobileActionSheet';

// Content
export { MobileList } from './content/MobileList';
export { MobileEmptyState } from './content/MobileEmptyState';

// Feedback
export { MobileModal } from './feedback/MobileModal';
export { MobileBottomSheet } from './feedback/MobileBottomSheet';
export { MobileSpinner } from './feedback/MobileSpinner';

// Utils
export { useMobileGestures } from './utils/useMobileGestures';
export { useMobileSafeArea } from './utils/useMobileSafeArea';
export { useMobileScrollPosition } from './utils/useMobileScrollPosition';
export * from './utils/mobileAnimations';

// Types
export type { default as MobileButtonProps } from './actions/MobileButton';
export type { default as MobileFABProps } from './actions/MobileFAB';