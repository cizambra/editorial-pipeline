import { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Upload, Check } from "lucide-react";

interface FieldProps {
  children: ReactNode;
  className?: string;
}

export function Field({ children, className = "" }: FieldProps) {
  return (
    <div className={`relative z-10 mb-6 lg:mb-3.5 last:mb-0 ${className}`}>
      {children}
    </div>
  );
}

interface LabelProps {
  htmlFor?: string;
  children: ReactNode;
}

export function Label({ htmlFor, children }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className="block mb-2 lg:mb-1.5 text-base lg:text-xs font-bold tracking-[0.08em] uppercase"
      style={{ color: 'var(--muted-foreground)' }}
    >
      {children}
    </label>
  );
}

interface DescriptionProps {
  children: ReactNode;
}

export function Description({ children }: DescriptionProps) {
  return (
    <p 
      className="text-sm mb-3 lg:mb-2.5 leading-relaxed"
      style={{ color: 'var(--muted-foreground)' }}
    >
      {children}
    </p>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full px-3.5 py-3 lg:py-2.5 rounded-2xl text-base lg:text-sm outline-none transition-all duration-[180ms] ${className}`}
      style={{
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(var(--border-rgb), 0.24)',
        color: 'var(--foreground)',
        background: 'var(--card)'
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--primary-rgb), 0.12)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.24)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      {...props}
    />
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function TextArea({ className = "", ...props }: TextAreaProps) {
  return (
    <textarea
      className={`w-full px-3.5 py-3 lg:py-2.5 rounded-2xl text-base lg:text-sm outline-none transition-all duration-[180ms] resize-y ${className}`}
      style={{
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(var(--border-rgb), 0.24)',
        color: 'var(--foreground)',
        background: 'var(--card)',
        minHeight: '150px'
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(var(--primary-rgb), 0.12)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.24)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      {...props}
    />
  );
}

interface DropzoneProps {
  label: string;
  description?: string;
  fileName?: string;
  onFileSelect?: (file: File) => void;
  onFileUpload?: (file: File) => void;
  uploadedFileName?: string;
}

export function Dropzone({ label, description, fileName, onFileSelect = () => {}, onFileUpload, uploadedFileName }: DropzoneProps) {
  const displayFileName = uploadedFileName || fileName;
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (onFileUpload) onFileUpload(file);
      if (onFileSelect) onFileSelect(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (onFileUpload) onFileUpload(file);
      if (onFileSelect) onFileSelect(file);
    }
  };

  return (
    <div className="relative">
      <input
        type="file"
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        accept=".md,.txt"
      />
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="relative rounded-2xl lg:rounded-xl transition-all duration-180 cursor-pointer overflow-hidden min-h-[140px] lg:min-h-[100px] flex flex-col items-center justify-center p-6 lg:p-5"
        style={{
          borderWidth: displayFileName ? '1px' : '2px',
          borderStyle: displayFileName ? 'solid' : 'dashed',
          borderColor: displayFileName ? 'rgba(var(--primary-rgb), 0.3)' : 'rgba(var(--border-rgb), 0.2)',
          background: displayFileName ? 'rgba(var(--primary-rgb), 0.05)' : 'rgba(255, 255, 255, 0.4)',
        }}
      >
        <div className="text-center">
          {displayFileName ? (
            <Check className="w-8 h-8 lg:w-6 lg:h-6 mx-auto mb-3 lg:mb-2" style={{ color: 'var(--primary)' }} />
          ) : (
            <Upload className="w-8 h-8 lg:w-6 lg:h-6 mx-auto mb-3 lg:mb-2" style={{ color: 'var(--primary)' }} />
          )}
          <div className="text-[15px] lg:text-sm font-bold mb-1.5 lg:mb-1" style={{ color: 'var(--foreground)' }}>
            {label}
          </div>
          <div className="text-[13px] lg:text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}

export function Button({ variant = 'secondary', children, className = "", disabled, style, ...props }: ButtonProps) {
  const getStyles = () => {
    if (variant === 'primary') {
      return {
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(var(--primary-rgb), 0.24)',
        color: '#fff',
        background: 'var(--primary)',
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer'
      };
    }
    
    if (variant === 'ghost') {
      return {
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(var(--border-rgb), 0.14)',
        color: 'var(--muted-foreground)',
        background: 'transparent'
      };
    }
    
    return {
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'rgba(var(--border-rgb), 0.14)',
      color: 'var(--foreground)',
      background: 'rgba(255, 255, 255, 0.42)'
    };
  };

  return (
    <button
      className={`px-6 lg:px-5 py-4 lg:py-2.5 rounded-2xl lg:rounded-xl text-[17px] lg:text-sm font-semibold transition-all duration-[180ms] ${className}`}
      style={{ ...getStyles(), ...style }}
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled) {
          if (variant === 'primary') {
            e.currentTarget.style.background = '#a63e1f';
            e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.4)';
          } else {
            e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.24)';
            e.currentTarget.style.background = variant === 'ghost' ? 'rgba(0, 0, 0, 0.05)' : 'var(--secondary)';
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          Object.assign(e.currentTarget.style, { ...getStyles(), ...style });
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}

interface SegmentedControlProps {
  options: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, value, onChange }: SegmentedControlProps) {
  return (
    <div
      className="inline-flex rounded-[14px] lg:rounded-[10px] overflow-hidden w-full lg:w-auto"
      style={{
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(var(--primary-rgb), 0.18)',
        background: 'rgba(255, 255, 255, 0.22)'
      }}
    >
      {options.map((option, index) => {
        const isActive = value === option.id;
        const isLast = index === options.length - 1;
        
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className="flex-1 px-5 py-3 lg:px-3 lg:py-2 text-base lg:text-xs font-semibold transition-all duration-[180ms]"
            style={{
              borderRight: isLast ? 'none' : '1px solid rgba(var(--border-rgb), 0.14)',
              color: isActive ? '#fff' : 'var(--muted-foreground)',
              background: isActive ? 'var(--primary)' : 'transparent'
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <div 
      className="flex items-center justify-between p-5 rounded-2xl transition-all"
      style={{
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: checked ? 'rgba(var(--primary-rgb), 0.24)' : 'rgba(var(--border-rgb), 0.14)',
        background: checked ? 'rgba(var(--primary-rgb), 0.06)' : 'rgba(255, 250, 241, 0.4)'
      }}
    >
      <div className="flex-1 pr-4">
        <div className="font-semibold text-base lg:text-sm mb-1.5" style={{ color: 'var(--foreground)' }}>
          {label}
        </div>
        <div className="text-sm lg:text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
          {description}
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className="w-12 h-7 lg:w-10 lg:h-6 rounded-full transition-all duration-200 flex-shrink-0"
        style={{
          background: checked ? 'var(--primary)' : '#efe3cf',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: checked ? 'rgba(var(--primary-rgb), 0.3)' : 'rgba(var(--border-rgb), 0.2)'
        }}
      >
        <div
          className="w-5 h-5 lg:w-4 lg:h-4 rounded-full transition-all duration-200"
          style={{
            background: '#fff',
            transform: checked ? 'translateX(24px)' : 'translateX(2px)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        />
      </button>
    </div>
  );
}

interface CardButtonProps {
  icon: ReactNode;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}

export function CardButton({ icon, label, isActive = false, onClick }: CardButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-2.5 lg:gap-2 p-5 lg:px-4 lg:py-2.5 rounded-[18px] lg:rounded-xl transition-all duration-[180ms] min-h-[90px] lg:min-h-0"
      style={{
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: isActive ? 'rgba(var(--primary-rgb), 0.3)' : 'rgba(var(--border-rgb), 0.14)',
        background: isActive ? 'var(--primary)' : 'rgba(255, 255, 255, 0.6)',
        color: isActive ? '#fff' : 'var(--primary)',
        boxShadow: isActive ? '0 4px 14px rgba(var(--primary-rgb), 0.25)' : '0 2px 8px rgba(var(--border-rgb), 0.06)'
      }}
    >
      <div className="w-9 h-9 lg:w-5 lg:h-5 flex items-center justify-center">
        {icon}
      </div>
      <div className="text-base lg:text-sm font-bold -tracking-[0.01em] sr-only lg:not-sr-only">
        {label}
      </div>
    </button>
  );
}