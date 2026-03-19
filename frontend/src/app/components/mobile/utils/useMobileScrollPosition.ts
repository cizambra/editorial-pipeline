import { useState, useEffect } from 'react';

interface UseMobileScrollPositionReturn {
  scrollY: number;
  scrollDirection: 'up' | 'down' | null;
  isAtTop: boolean;
  isAtBottom: boolean;
}

/**
 * Track scroll position and direction
 * 
 * @example
 * const { scrollY, scrollDirection } = useMobileScrollPosition();
 * const showFAB = scrollDirection !== 'down';
 */
export function useMobileScrollPosition(): UseMobileScrollPositionReturn {
  const [scrollY, setScrollY] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | null>(null);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const direction = currentScrollY > lastScrollY ? 'down' : 'up';
      
      setScrollY(currentScrollY);
      setScrollDirection(direction);
      setIsAtTop(currentScrollY < 10);
      setIsAtBottom(
        window.innerHeight + currentScrollY >= document.documentElement.scrollHeight - 10
      );
      
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return { scrollY, scrollDirection, isAtTop, isAtBottom };
}
