import { ReactNode, useEffect, useState } from 'react';

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  sticky?: boolean;
  showBorder?: boolean;
  blurOnScroll?: boolean;
}

/**
 * Consistent top bar for all mobile pages
 * 
 * @example
 * <MobileHeader
 *   title="Campaigns"
 *   left={<BackButton />}
 *   right={<IconButton icon={Search} />}
 *   sticky
 *   blurOnScroll
 * />
 */
export function MobileHeader({
  title,
  subtitle,
  left,
  right,
  sticky = false,
  showBorder = true,
  blurOnScroll = false,
}: MobileHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    if (!blurOnScroll) return;

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [blurOnScroll]);

  const shouldBlur = blurOnScroll && isScrolled;

  return (
    <div
      className={`
        lg:hidden
        flex items-center gap-3 px-4
        min-h-[56px]
        ${sticky ? 'sticky top-0 z-[1010]' : ''}
        ${showBorder ? 'border-b' : ''}
        transition-all duration-200
      `}
      style={{
        background: shouldBlur ? 'rgba(245, 239, 227, 0.9)' : 'var(--background)',
        backdropFilter: shouldBlur ? 'blur(10px)' : 'none',
        borderColor: showBorder ? 'rgba(var(--border-rgb), 0.14)' : 'transparent',
      }}
    >
      {/* Left slot */}
      {left && (
        <div className="flex-shrink-0">
          {left}
        </div>
      )}

      {/* Title and subtitle */}
      <div className="flex-1 min-w-0">
        <h1 
          className="text-[16px] font-bold truncate"
          style={{ 
            fontFamily: 'Montserrat, sans-serif',
            color: 'var(--foreground)' 
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p 
            className="text-[12px] truncate"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Right slot */}
      {right && (
        <div className="flex-shrink-0 flex items-center gap-2">
          {right}
        </div>
      )}
    </div>
  );
}
