import { useEffect, useRef, useState } from 'react';

interface MobileSegment {
  value: string;
  label: string;
  badge?: number;
}

interface MobileSegmentedControlProps {
  segments: MobileSegment[];
  value: string;
  onChange: (value: string) => void;
  sticky?: boolean;
  smartPadding?: boolean;
  fullWidth?: boolean;
}

/**
 * 2-3 option toggle control (like Publishing's Queue/Published)
 * 
 * @example
 * <MobileSegmentedControl
 *   segments={[
 *     { value: 'queue', label: 'Queue' },
 *     { value: 'published', label: 'Published', badge: 12 },
 *   ]}
 *   value={selectedSegment}
 *   onChange={setSelectedSegment}
 *   sticky
 *   smartPadding
 * />
 */
export function MobileSegmentedControl({
  segments,
  value,
  onChange,
  sticky = false,
  smartPadding = false,
  fullWidth = true,
}: MobileSegmentedControlProps) {
  const [isStuck, setIsStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for smart padding
  useEffect(() => {
    if (!smartPadding || !sticky) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStuck(!entry.isIntersecting);
      },
      { threshold: [1], rootMargin: '0px 0px 0px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [smartPadding, sticky]);

  return (
    <>
      {/* Sentinel for intersection observer */}
      {smartPadding && sticky && (
        <div
          ref={sentinelRef}
          className="lg:hidden h-px -mt-px"
          style={{ position: 'absolute', top: '-24px' }}
        />
      )}

      <div
        ref={controlRef}
        className={`
          lg:hidden
          -mx-4 px-4 pb-4
          transition-all duration-200
          ${sticky ? 'sticky' : ''}
        `}
        style={{
          paddingTop: smartPadding && isStuck ? '16px' : '4px',
          top: sticky ? '-24px' : undefined,
          background: 'var(--background)',
          zIndex: 10,
        }}
      >
        <div
          className={`flex gap-1 p-1 rounded-xl ${fullWidth ? '' : 'inline-flex'}`}
          style={{
            background: 'var(--secondary)',
          }}
        >
          {segments.map((segment) => {
            const isActive = value === segment.value;
            return (
              <button
                key={segment.value}
                onClick={() => onChange(segment.value)}
                className={`
                  flex-1 py-2 px-4 rounded-lg
                  text-[14px] font-bold
                  transition-all duration-200
                  relative
                `}
                style={{
                  background: isActive ? 'white' : 'transparent',
                  color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {segment.label}
                {segment.badge !== undefined && segment.badge > 0 && (
                  <span
                    className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold"
                    style={{
                      background: isActive ? 'var(--primary)' : 'rgba(110, 98, 86, 0.2)',
                      color: isActive ? 'white' : 'var(--muted-foreground)',
                    }}
                  >
                    {segment.badge > 99 ? '99+' : segment.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}