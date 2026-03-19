import { FileText, BookOpen, Image, TrendingUp, LayoutDashboard, Users, History, Lightbulb, Settings, Sun, Moon, X } from "lucide-react";
import { useState, useEffect } from "react";
import { usePipeline } from "../../lib/pipeline-context";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onClose?: () => void;
}

export function Sidebar({ activeSection, onSectionChange, onClose }: SidebarProps) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("theme") as "light" | "dark") ?? "light";
  });
  const { running } = usePipeline();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const sections = [
    // Create
    { id: "pipeline", label: "Pipeline", description: "Reflection to full campaign", icon: FileText, group: "Create" },
    { id: "companion", label: "Companion", description: "Paid companion only", icon: BookOpen, group: "Create" },
    { id: "thumbnail", label: "Thumbnail", description: "Concepts, renders, library", icon: Image, group: "Create" },
    
    // Review
    { id: "marketing", label: "Marketing", description: "Current run, studio, library", icon: TrendingUp, group: "Review" },
    { id: "dashboard", label: "Dashboard", description: "Coverage, cost, queue", icon: LayoutDashboard, group: "Review" },
    { id: "audience", label: "Audience", description: "Subscriber browser", icon: Users, group: "Review" },
    
    // Manage
    { id: "history", label: "History", description: "Runs and re-open flow", icon: History, group: "Manage" },
    { id: "ideas", label: "Ideas", description: "Research and article prompts", icon: Lightbulb, group: "Manage" },
    { id: "settings", label: "Settings", description: "Template, prompts, index", icon: Settings, group: "Manage" },
  ];

  const groups = ["Create", "Review", "Manage"];

  return (
    <aside className="w-full h-full flex flex-col border-r" style={{
      background: 'radial-gradient(circle at top right, rgba(238, 127, 69, 0.18), transparent 28%), linear-gradient(180deg, #171d23, #243241)',
      borderRightColor: 'rgba(255, 255, 255, 0.08)',
      color: '#d6dfeb'
    }}>
      {/* Brand */}
      <div className="px-5 lg:px-[22px] py-6 lg:py-5 border-b" style={{ borderBottomColor: 'rgba(255, 255, 255, 0.08)' }}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="text-xs lg:text-[10px] tracking-[0.16em] uppercase mb-2 lg:mb-1.5" style={{ color: '#8192a7' }}>
              Editorial System
            </div>
            <div className="font-extrabold text-[28px] lg:text-[22px] leading-[0.92] -tracking-[0.06em] lowercase mb-1">
              <span style={{ color: '#d6dfeb' }}>self</span>
              <span style={{ color: 'var(--primary)' }}>disciplined</span>
            </div>
            <div className="text-xs lg:text-[10px] italic mt-1" style={{ color: '#8192a7' }}>
              Your writing, amplified
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-2 -mr-1 rounded-lg transition-colors flex-shrink-0"
              style={{ 
                color: '#8192a7',
                background: 'rgba(255, 255, 255, 0.05)'
              }}
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 lg:px-3.5 py-5 lg:py-4 space-y-4 lg:space-y-3.5 overflow-y-auto">
        {groups.map((group) => {
          const groupSections = sections.filter(s => s.group === group);
          return (
            <div key={group} className="pt-4 lg:pt-3.5 border-t" style={{ borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
              <div className="text-[11px] lg:text-[9px] tracking-[0.15em] uppercase px-2.5 lg:px-2 pb-2 lg:pb-1.5 font-bold opacity-70" style={{ color: '#8192a7' }}>
                {group}
              </div>
              <div className="space-y-1.5 lg:space-y-1">
                {groupSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => onSectionChange(section.id)}
                      className="w-full flex items-center gap-3 lg:gap-2.5 px-3.5 lg:px-2.5 py-3.5 lg:py-2.5 rounded-[10px] transition-all duration-[180ms]"
                      style={{
                        background: isActive 
                          ? 'rgba(238, 127, 69, 0.14)' 
                          : 'transparent',
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        borderColor: isActive 
                          ? 'rgba(238, 127, 69, 0.3)' 
                          : 'transparent',
                        boxShadow: isActive 
                          ? 'inset 3px 0 0 rgba(238, 127, 69, 0.8)' 
                          : 'none',
                        color: 'inherit'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.borderColor = 'transparent';
                        }
                      }}
                    >
                      <div 
                        className="w-[28px] h-[28px] lg:w-[22px] lg:h-[22px] flex items-center justify-center rounded-lg flex-shrink-0"
                        style={{
                          background: 'rgba(255, 255, 255, 0.07)',
                          color: 'rgba(255, 255, 255, 0.86)'
                        }}
                      >
                        <Icon className="w-5 h-5 lg:w-4 lg:h-4" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-base lg:text-[13px] font-bold leading-none -tracking-[0.02em]" style={{ fontFamily: '"Montserrat", "Inter", sans-serif' }}>
                            {section.label}
                          </div>
                          {section.id === "pipeline" && running && (
                            <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--primary)" }} />
                          )}
                        </div>
                        <div className="text-xs lg:text-[10px] mt-1 lg:mt-0.5" style={{ color: '#8192a7', fontFamily: '"Inter", sans-serif' }}>
                          {section.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 lg:p-3.5 border-t" style={{ borderTopColor: 'rgba(255, 255, 255, 0.08)' }}>
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-center gap-2.5 lg:gap-2 px-4 lg:px-3 py-3 lg:py-2 rounded-lg text-base lg:text-sm transition-colors"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#d6dfeb',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'rgba(255, 255, 255, 0.12)'
          }}
        >
          {theme === "light" ? (
            <Moon className="w-5 h-5 lg:w-4 lg:h-4" />
          ) : (
            <Sun className="w-5 h-5 lg:w-4 lg:h-4" />
          )}
          <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
        </button>
      </div>
    </aside>
  );
}