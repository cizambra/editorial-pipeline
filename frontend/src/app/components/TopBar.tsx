import { Menu } from "lucide-react";
import { useAuth } from "../../lib/auth-context";

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { user, logout } = useAuth();
  const displayName = user?.display_name || user?.email || "Not signed in";
  const roleLabel = user?.role || "guest";

  return (
    <div 
      className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b"
      style={{ 
        borderBottomColor: 'rgba(var(--border-rgb), 0.14)',
        background: 'transparent'
      }}
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ml-2 rounded-lg transition-colors"
        style={{ color: 'var(--muted-foreground)' }}
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6 lg:w-5 lg:h-5" />
      </button>

      {/* Right side content */}
      <div className="flex items-center justify-end gap-2 sm:gap-3 ml-auto">
        <div className="hidden sm:block text-sm lg:text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Cost <span style={{ color: 'var(--foreground)' }}>$0.7052</span> / <span style={{ color: 'var(--foreground)' }}>83.9k</span> tokens
        </div>
        <div className="hidden md:block text-sm lg:text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {displayName}
        </div>
        <div 
          className="text-[11px] lg:text-[10px] font-bold tracking-[0.08em] uppercase px-2 py-0.5 rounded"
          style={{
            background: 'rgba(var(--primary-rgb), 0.1)',
            color: '#8b3519'
          }}
        >
          <span className="hidden sm:inline">{roleLabel}</span>
          <span className="sm:hidden">{roleLabel}</span>
        </div>
        <button 
          onClick={() => void logout()}
          className="text-sm lg:text-xs hover:underline hidden sm:block"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Log out
        </button>
      </div>
    </div>
  );
}
