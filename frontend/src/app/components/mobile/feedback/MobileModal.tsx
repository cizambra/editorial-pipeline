import { ReactNode, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';

interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  showHeader?: boolean;
  closeOnBackdrop?: boolean;
}

/**
 * Full-screen modal for complex content
 * 
 * @example
 * <MobileModal
 *   isOpen={!!selectedId}
 *   onClose={handleClose}
 *   title="Campaign Details"
 *   headerRight={<Button onClick={handleSave}>Save</Button>}
 * >
 *   <div className="p-4">
 *     <CampaignDetailForm />
 *   </div>
 * </MobileModal>
 */
export function MobileModal({
  isOpen,
  onClose,
  children,
  title,
  headerLeft,
  headerRight,
  showHeader = true,
  closeOnBackdrop = false,
}: MobileModalProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes slideInFromBottom {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutToBottom {
          from {
            transform: translateY(0);
            opacity: 1;
          }
          to {
            transform: translateY(100%);
            opacity: 0;
          }
        }
      `}</style>

      <div 
        className="lg:hidden fixed inset-0 z-[1030] flex flex-col"
        style={{
          background: 'var(--background)',
          animation: 'slideInFromBottom 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
        onClick={closeOnBackdrop ? onClose : undefined}
      >
        {/* Header */}
        {showHeader && (
          <div 
            className="flex items-center gap-3 px-4 min-h-[56px] border-b flex-shrink-0"
            style={{
              background: 'white',
              borderColor: 'rgba(var(--border-rgb), 0.14)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: Back button or custom */}
            <div className="flex-shrink-0">
              {headerLeft !== undefined ? (
                headerLeft
              ) : (
                <button
                  onClick={onClose}
                  className="flex items-center justify-center -ml-2 w-11 h-11 rounded-lg active:bg-black active:bg-opacity-5 transition-colors"
                  aria-label="Close"
                >
                  <ArrowLeft className="w-6 h-6" style={{ color: 'var(--muted-foreground)' }} />
                </button>
              )}
            </div>

            {/* Center: Title */}
            {title && (
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
              </div>
            )}

            {/* Right: Actions */}
            {headerRight && (
              <div className="flex-shrink-0 flex items-center gap-2">
                {headerRight}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div 
          className="flex-1 overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </>
  );
}
