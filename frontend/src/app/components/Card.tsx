import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = "", onClick }: CardProps) {
  return (
    <>
      {/* Desktop card wrapper */}
      <div 
        className={`hidden lg:block p-5 rounded-xl ${className}`}
        onClick={onClick}
        style={{
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'rgba(var(--border-rgb), 0.08)',
          background: 'var(--card)',
          boxShadow: '0 1px 2px rgba(var(--border-rgb), 0.05)'
        }}
      >
        {children}
      </div>
      
      {/* Mobile native wrapper - transparent */}
      <div className="lg:hidden" onClick={onClick}>
        {children}
      </div>
    </>
  );
}

interface CardHeaderProps {
  children: ReactNode;
}

export function CardHeader({ children }: CardHeaderProps) {
  return (
    <div 
      className="flex items-center justify-between gap-3 mb-4 pb-3.5 pt-3.5 border-b"
      style={{ borderBottomColor: 'rgba(var(--border-rgb), 0.14)' }}
    >
      {children}
    </div>
  );
}

interface CardSectionProps {
  children: ReactNode;
  className?: string;
}

export function CardSection({ children, className = "" }: CardSectionProps) {
  return (
    <div 
      className={`pt-6 mt-6 lg:pt-5 lg:mt-5 border-t ${className}`}
      style={{ borderTopColor: 'rgba(var(--border-rgb), 0.14)' }}
    >
      {children}
    </div>
  );
}

interface EyebrowProps {
  children: ReactNode;
}

export function Eyebrow({ children }: EyebrowProps) {
  return (
    <div 
      className="text-xs lg:text-[10px] font-bold tracking-[0.12em] uppercase mb-2 lg:mb-1.5"
      style={{ color: 'var(--muted-foreground)' }}
    >
      {children}
    </div>
  );
}

interface SectionTitleProps {
  children: ReactNode;
  className?: string;
}

export function SectionTitle({ children, className = "" }: SectionTitleProps) {
  return (
    <div 
      className={`text-[20px] lg:text-[15px] leading-[1.18] -tracking-[0.02em] ${className}`}
      style={{
        fontFamily: '"Montserrat", "Inter", sans-serif',
        fontWeight: 800,
        color: 'var(--foreground)'
      }}
    >
      {children}
    </div>
  );
}