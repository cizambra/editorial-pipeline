import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface MobileEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Consistent empty states
 * 
 * @example
 * <MobileEmptyState
 *   icon={Calendar}
 *   title="No posts scheduled"
 *   description="Create a campaign or compose a new post to get started"
 *   action={
 *     <MobileButton variant="primary" onClick={handleCreate}>
 *       Create Campaign
 *     </MobileButton>
 *   }
 * />
 */
export function MobileEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}: MobileEmptyStateProps) {
  return (
    <div className={`lg:hidden flex flex-col items-center justify-center text-center py-12 px-6 ${className}`}>
      {/* Icon */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'rgba(var(--primary-rgb), 0.1)' }}
      >
        <Icon className="w-8 h-8" style={{ color: 'var(--primary)' }} />
      </div>

      {/* Title */}
      <h3
        className="text-[17px] font-bold mb-2"
        style={{ color: 'var(--foreground)' }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className="text-[14px] mb-6 max-w-sm"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {description}
      </p>

      {/* Action */}
      {action && (
        <div>
          {action}
        </div>
      )}
    </div>
  );
}
