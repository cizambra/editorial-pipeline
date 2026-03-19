import { LucideIcon } from "lucide-react";
import { Card } from "./Card";

interface PlaceholderViewProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

export function PlaceholderView({ title, description, icon: Icon }: PlaceholderViewProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(var(--primary-rgb), 0.1)'
            }}
          >
            <Icon className="w-10 h-10" style={{ color: 'var(--primary)' }} />
          </div>
        </div>
        <h2 
          className="text-2xl mb-2"
          style={{
            fontFamily: '"Montserrat", "Inter", sans-serif',
            fontWeight: 800,
            color: 'var(--foreground)'
          }}
        >
          {title}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          {description}
        </p>
      </Card>
    </div>
  );
}