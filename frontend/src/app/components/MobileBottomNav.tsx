import { LucideIcon } from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface MobileBottomNavProps {
  items: NavItem[];
  activeItem: string;
  onItemChange: (itemId: string) => void;
}

export function MobileBottomNav({ items, activeItem, onItemChange }: MobileBottomNavProps) {
  return (
    <div 
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 safe-area-inset-bottom"
      style={{
        background: 'var(--card)',
        borderTop: '1px solid rgba(var(--border-rgb), 0.12)',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.04)'
      }}
    >
      <div className="flex items-center justify-around">
        {items.map((item) => {
          const isActive = activeItem === item.id;
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => onItemChange(item.id)}
              className="flex-1 flex flex-col items-center justify-center py-2 px-1 relative transition-all duration-200"
              style={{
                minHeight: '64px'
              }}
            >
              {/* Icon with badge */}
              <div className="relative mb-1">
                <Icon 
                  className="w-6 h-6 transition-all duration-200" 
                  style={{ 
                    color: isActive ? 'var(--primary)' : 'var(--text-subtle)',
                    strokeWidth: isActive ? 2.5 : 2
                  }} 
                />
                {item.badge !== undefined && item.badge > 0 && (
                  <div 
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: 'var(--primary)',
                      color: '#ffffff',
                      padding: '0 4px'
                    }}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </div>
                )}
              </div>
              
              {/* Label */}
              <span 
                className="text-[11px] font-semibold transition-all duration-200"
                style={{ 
                  color: isActive ? 'var(--primary)' : 'var(--text-subtle)'
                }}
              >
                {item.label}
              </span>
              
              {/* Active indicator */}
              {isActive && (
                <div 
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-200"
                  style={{
                    width: '32px',
                    background: 'var(--primary)'
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
