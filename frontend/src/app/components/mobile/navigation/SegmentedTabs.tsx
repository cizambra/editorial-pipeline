interface SegmentedTab {
  value: string;
  label: string;
}

interface SegmentedTabsProps {
  tabs: SegmentedTab[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

/**
 * Generic segmented tabs control for platform selection, content type filtering, etc.
 * Works on both mobile and desktop.
 * 
 * @example
 * <SegmentedTabs
 *   tabs={[
 *     { value: 'threads', label: 'Threads' },
 *     { value: 'linkedin', label: 'LinkedIn' },
 *     { value: 'instagram', label: 'Instagram' }
 *   ]}
 *   value={selectedPlatform}
 *   onChange={setSelectedPlatform}
 *   size="sm"
 * />
 */
export function SegmentedTabs({
  tabs,
  value,
  onChange,
  size = 'md',
  fullWidth = true,
  className = '',
}: SegmentedTabsProps) {
  const sizeClasses = {
    sm: 'text-xs px-3 py-2',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-5 py-2.5',
  };

  return (
    <div
      className={`flex gap-1 p-1 rounded-xl ${fullWidth ? '' : 'inline-flex'} ${className}`}
      style={{ background: 'var(--secondary)' }}
    >
      {tabs.map((tab) => {
        const isActive = value === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`
              ${fullWidth ? 'flex-1' : ''}
              ${sizeClasses[size]}
              rounded-lg font-semibold
              transition-all duration-200
            `}
            style={{
              background: isActive ? '#fff' : 'transparent',
              color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
