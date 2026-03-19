interface PageHeaderProps {
  kicker: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function PageHeader({
  kicker,
  title,
  description,
  action,
}: PageHeaderProps) {
  return (
    <div
      className="lg:mb-3.5 pb-3 lg:pb-3 border-b -mx-4 px-4 lg:mx-0 lg:px-0"
      style={{ borderBottomColor: "rgba(var(--border-rgb), 0.14)" }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div
            className="text-xs lg:text-[11px] tracking-[0.14em] uppercase mb-1 lg:mb-2.5"
            style={{ color: "var(--muted-foreground)" }}
          >
            {kicker}
          </div>
          <div
            className="text-[22px] lg:text-[26px] leading-tight -tracking-[0.05em] lg:mb-2"
            style={{
              fontFamily: '"Montserrat", "Avenir Next", "Segoe UI", sans-serif',
              fontWeight: 800,
              color: "var(--foreground)",
            }}
          >
            {title}
          </div>
          <div
            className="hidden lg:block text-[13px] max-w-[700px] leading-relaxed mt-1"
            style={{ color: "var(--muted-foreground)" }}
          >
            {description}
          </div>
        </div>
        {action && (
          <div className="flex-shrink-0">{action}</div>
        )}
      </div>
    </div>
  );
}