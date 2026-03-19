import { ReactNode, useState } from "react";

interface MobileSectionProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  loading?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  header?: ReactNode;
  footer?: ReactNode;
}

/**
 * Mobile-native section component that creates edge-to-edge sections
 * on mobile and is transparent on desktop (desktop styling comes from Card wrapper)
 */
export function MobileSection({ 
  children, 
  className = "", 
  noPadding = false,
  loading = false,
  collapsible = false,
  collapsed = false,
  onToggle,
  header,
  footer,
}: MobileSectionProps) {
  return (
    <>
      <style>{`
        @media (min-width: 1024px) {
          .mobile-section-wrapper {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
        
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <div 
        className={`
          mobile-section-wrapper
          mb-4 lg:mb-0
          ${noPadding ? 'p-0' : 'p-5'}
          lg:p-0
          rounded-2xl lg:rounded-none
          ${className}
        `}
        style={{
          background: 'var(--card)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'rgba(var(--border-rgb), 0.08)',
          boxShadow: '0 1px 3px rgba(var(--border-rgb), 0.06)'
        }}
      >
        {/* Header slot */}
        {header && (
          <div 
            className={`${noPadding ? 'p-5 pb-0' : '-m-5 mb-4 p-5'}`}
            onClick={collapsible ? onToggle : undefined}
          >
            {header}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            <div 
              className="h-4 rounded"
              style={{ 
                background: 'rgba(var(--border-rgb), 0.1)',
                animation: 'skeleton-pulse 1.5s ease-in-out infinite',
              }}
            />
            <div 
              className="h-4 rounded w-3/4"
              style={{ 
                background: 'rgba(var(--border-rgb), 0.1)',
                animation: 'skeleton-pulse 1.5s ease-in-out infinite 0.2s',
              }}
            />
            <div 
              className="h-4 rounded w-1/2"
              style={{ 
                background: 'rgba(var(--border-rgb), 0.1)',
                animation: 'skeleton-pulse 1.5s ease-in-out infinite 0.4s',
              }}
            />
          </div>
        ) : (
          <>
            {(!collapsible || !collapsed) && children}
          </>
        )}

        {/* Footer slot */}
        {footer && !collapsed && (
          <div className={`${noPadding ? 'p-5 pt-0' : '-m-5 mt-4 p-5'}`}>
            {footer}
          </div>
        )}
      </div>
    </>
  );
}