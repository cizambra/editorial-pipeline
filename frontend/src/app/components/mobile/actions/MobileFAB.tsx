import { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface MobileFABProps {
  icon: LucideIcon;
  label?: string;
  onClick: () => void;
  position?: 'bottom-right' | 'bottom-center' | 'bottom-left';
  hideOnScroll?: boolean;
  variant?: 'primary' | 'secondary';
}

/**
 * Floating action button for primary actions
 * 
 * @example
 * <MobileFAB
 *   icon={Plus}
 *   label="Create campaign"
 *   onClick={handleCreate}
 *   hideOnScroll
 * />
 */
export function MobileFAB({
  icon: Icon,
  label,
  onClick,
  position = 'bottom-right',
  hideOnScroll = true,
  variant = 'primary',
}: MobileFABProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    if (!hideOnScroll) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Show when scrolling up, hide when scrolling down
      if (currentScrollY < lastScrollY || currentScrollY < 100) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hideOnScroll, lastScrollY]);

  const getPositionStyles = () => {
    const base = { bottom: '80px' }; // Above bottom nav
    
    switch (position) {
      case 'bottom-center':
        return { ...base, left: '50%', transform: 'translateX(-50%)' };
      case 'bottom-left':
        return { ...base, left: '16px' };
      case 'bottom-right':
      default:
        return { ...base, right: '16px' };
    }
  };

  const backgroundColor = variant === 'primary' ? 'var(--primary)' : 'var(--secondary)';
  const iconColor = variant === 'primary' ? 'white' : 'var(--primary)';

  return (
    <button
      onClick={onClick}
      aria-label={label || 'Primary action'}
      className={`
        lg:hidden
        fixed w-14 h-14 rounded-full
        flex items-center justify-center
        active:scale-[0.92]
        transition-all duration-200
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
      `}
      style={{
        ...getPositionStyles(),
        background: backgroundColor,
        boxShadow: '0 4px 20px rgba(var(--primary-rgb), 0.4)',
        zIndex: 1015,
      }}
    >
      <Icon className="w-6 h-6" style={{ color: iconColor }} />
    </button>
  );
}
