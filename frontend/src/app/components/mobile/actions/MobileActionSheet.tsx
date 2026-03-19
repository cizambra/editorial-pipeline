import { LucideIcon } from 'lucide-react';
import { MobileBottomSheet } from '../feedback/MobileBottomSheet';

interface MobileAction {
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

interface MobileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: MobileAction[];
}

/**
 * iOS-style action menu
 * 
 * @example
 * <MobileActionSheet
 *   isOpen={showActions}
 *   onClose={() => setShowActions(false)}
 *   title="Campaign Actions"
 *   actions={[
 *     { label: 'Edit', icon: Edit2, onClick: handleEdit },
 *     { label: 'Duplicate', icon: Copy, onClick: handleDuplicate },
 *     { label: 'Delete', icon: Trash2, destructive: true, onClick: handleDelete },
 *   ]}
 * />
 */
export function MobileActionSheet({
  isOpen,
  onClose,
  title,
  message,
  actions,
}: MobileActionSheetProps) {
  const handleAction = (action: MobileAction) => {
    if (!action.disabled) {
      action.onClick();
      onClose();
    }
  };

  return (
    <MobileBottomSheet isOpen={isOpen} onClose={onClose} height="auto">
      <div className="pb-4">
        {/* Title and message */}
        {(title || message) && (
          <div className="px-4 pt-2 pb-3 text-center">
            {title && (
              <h3 
                className="text-[13px] font-bold mb-1"
                style={{ color: '#6b7280' }}
              >
                {title}
              </h3>
            )}
            {message && (
              <p 
                className="text-[13px]"
                style={{ color: '#9ca3af' }}
              >
                {message}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="border-t" style={{ borderColor: 'rgba(0, 0, 0, 0.08)' }}>
          {actions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={() => handleAction(action)}
                disabled={action.disabled}
                className={`
                  w-full flex items-center gap-3 px-4 h-14
                  border-b last:border-0
                  active:bg-black active:bg-opacity-5
                  transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                style={{ 
                  borderColor: 'rgba(0, 0, 0, 0.08)',
                  color: action.destructive ? '#dc2626' : '#1f2937',
                }}
              >
                {Icon && <Icon className="w-5 h-5" />}
                <span className="text-[16px] font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>

        {/* Cancel button */}
        <div className="px-4 pt-2">
          <button
            onClick={onClose}
            className="w-full h-14 rounded-xl font-bold text-[16px] active:opacity-80 transition-opacity"
            style={{ 
              background: '#f3f4f6',
              color: '#1f2937',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </MobileBottomSheet>
  );
}
