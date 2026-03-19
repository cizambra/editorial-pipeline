import { useEffect, useRef, useState } from 'react';

interface MobileTab {
  id: string;
  label: string;
  badge?: number;
  disabled?: boolean;
}

interface MobileTabBarProps {
  tabs: MobileTab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  sticky?: boolean;
  scrollable?: boolean;
  showBorder?: boolean;
  smartPadding?: boolean;
}

/**
 * Horizontal tabs for section-level navigation (like Marketing's 5 tabs)
 * 
 * @example
 * <MobileTabBar
 *   tabs={[
 *     { id: 'campaigns', label: 'Campaigns' },
 *     { id: 'repurpose', label: 'Repurpose' },
 *     { id: 'compose', label: 'Compose' },
 *   ]}
 *   activeTab={activeTab}
 *   onChange={setActiveTab}
 *   sticky
 *   smartPadding
 * />
 */
export function MobileTabBar({
  tabs,
  activeTab,
  onChange,
  sticky = false,
  scrollable = true,
  showBorder = true,
  smartPadding = false,
}: MobileTabBarProps) {
  const [isStuck, setIsStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Intersection Observer for smart padding
  useEffect(() => {
    if (!smartPadding || !sticky) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStuck(!entry.isIntersecting);
      },
      { threshold: [1] }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [smartPadding, sticky]);

  // Auto-scroll active tab into view
  useEffect(() => {
    if (activeTabRef.current && tabsRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeTab]);

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
        className={`
          lg:hidden
          ${sticky ? 'sticky' : ''}
          ${showBorder ? 'border-b' : ''}
          transition-all duration-200
        `}
        style={{
          top: sticky ? '-24px' : undefined,
          paddingTop: smartPadding && isStuck ? '16px' : '4px',
          background: 'var(--background)',
          borderColor: showBorder ? 'rgba(var(--border-rgb), 0.14)' : 'transparent',
          zIndex: 1010,
        }}
      >
        <div
          ref={tabsRef}
          className={`
            flex gap-2 pb-2
            ${scrollable ? 'overflow-x-auto scrollbar-hide -mx-4 px-4' : ''}
          `}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={isActive ? activeTabRef : null}
                onClick={() => !tab.disabled && onChange(tab.id)}
                disabled={tab.disabled}
                className={`
                  relative flex-shrink-0 py-3 px-4
                  text-[14px] font-semibold
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                style={{
                  color: isActive ? 'var(--primary)' : 'var(--text-subtle)',
                  minWidth: scrollable ? 'auto' : undefined,
                }}
              >
                <span className="flex items-center gap-2">
                  {tab.label}
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold"
                      style={{
                        background: isActive ? 'var(--primary)' : 'rgba(158, 143, 127, 0.2)',
                        color: isActive ? 'white' : 'var(--text-subtle)',
                      }}
                    >
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </span>

                {/* Active indicator */}
                {isActive && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-full"
                    style={{ background: 'var(--primary)' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
