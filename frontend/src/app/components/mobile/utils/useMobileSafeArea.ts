import { useState, useEffect } from 'react';

interface UseMobileSafeAreaReturn {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Get safe area inset values for notches, home indicators, etc.
 * 
 * @example
 * const { top, bottom } = useMobileSafeArea();
 */
export function useMobileSafeArea(): UseMobileSafeAreaReturn {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    const updateSafeArea = () => {
      const getEnvValue = (variable: string): number => {
        const value = getComputedStyle(document.documentElement).getPropertyValue(variable);
        return parseFloat(value) || 0;
      };

      setSafeArea({
        top: getEnvValue('env(safe-area-inset-top)'),
        bottom: getEnvValue('env(safe-area-inset-bottom)'),
        left: getEnvValue('env(safe-area-inset-left)'),
        right: getEnvValue('env(safe-area-inset-right)'),
      });
    };

    updateSafeArea();
    window.addEventListener('resize', updateSafeArea);
    return () => window.removeEventListener('resize', updateSafeArea);
  }, []);

  return safeArea;
}
