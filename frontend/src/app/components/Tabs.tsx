import { LucideIcon } from "lucide-react";

interface Tab {
  id: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  hideOnMobile?: boolean; // Hide tabs on mobile (when using bottom nav instead)
}

export function Tabs({ tabs, activeTab, onTabChange, hideOnMobile = false }: TabsProps) {
  return (
    <div className={hideOnMobile ? "hidden lg:block mb-4" : "mb-4"}>
      {/* Mobile: Scrollable horizontal tabs */}
      {!hideOnMobile && (
        <div className="lg:hidden overflow-x-auto -mx-4 px-4 pb-2 scrollbar-hide">
          <div className="flex gap-2 min-w-max">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className="px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap flex-shrink-0"
                  style={{
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: isActive ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.12)',
                    background: isActive ? 'rgba(var(--primary-rgb), 0.1)' : 'var(--secondary)',
                    color: isActive ? 'var(--primary)' : 'var(--muted-foreground)'
                  }}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  {tab.label}
                  {tab.count !== undefined && (
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-bold"
                      style={{
                        background: isActive ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(var(--border-rgb), 0.1)',
                        color: isActive ? 'var(--primary)' : 'var(--muted-foreground)'
                      }}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Desktop: Pill-style tabs with hover */}
      <div className="hidden lg:flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="px-4 py-2.5 text-[13px] font-semibold rounded-xl transition-all duration-[180ms] flex items-center gap-2 whitespace-nowrap flex-shrink-0"
              style={{
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: isActive ? 'rgba(var(--primary-rgb), 0.3)' : 'rgba(var(--border-rgb), 0.12)',
                background: isActive ? 'rgba(var(--primary-rgb), 0.1)' : 'var(--secondary)',
                color: isActive ? 'var(--primary)' : 'var(--foreground)'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.24)';
                  e.currentTarget.style.background = '#ffffff';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.12)';
                  e.currentTarget.style.background = 'var(--secondary)';
                }
              }}
            >
              {Icon && <Icon className="w-4 h-4" />}
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className="px-1.5 py-0.5 rounded text-xs font-bold"
                  style={{
                    background: isActive ? 'rgba(var(--primary-rgb), 0.15)' : 'rgba(var(--border-rgb), 0.08)',
                    color: isActive ? 'var(--primary)' : 'var(--muted-foreground)'
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}