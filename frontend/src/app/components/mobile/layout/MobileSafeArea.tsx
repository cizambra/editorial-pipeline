import { ReactNode } from 'react';

interface MobileSafeAreaProps {
  children: ReactNode;
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
}

/**
 * Handle safe area insets for notches, home indicators, and curved edges
 * 
 * @example
 * <MobileSafeArea top bottom>
 *   {content}
 * </MobileSafeArea>
 */
export function MobileSafeArea({ 
  children, 
  top = false, 
  bottom = false, 
  left = false, 
  right = false 
}: MobileSafeAreaProps) {
  const style: React.CSSProperties = {
    paddingTop: top ? 'env(safe-area-inset-top)' : undefined,
    paddingBottom: bottom ? 'env(safe-area-inset-bottom)' : undefined,
    paddingLeft: left ? 'env(safe-area-inset-left)' : undefined,
    paddingRight: right ? 'env(safe-area-inset-right)' : undefined,
  };

  return (
    <div className="lg:contents" style={style}>
      {children}
    </div>
  );
}
