import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  icon?: LucideIcon;
}

export function CustomSelect({ options, value, onChange, placeholder = "Select...", id, icon: Icon }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8, // Use viewport coordinates, not scrollY
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      // Check if click is outside both the button container AND the dropdown
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        console.log('Click outside detected, closing dropdown');
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const dropdownMenu = isOpen ? (
    <div
      className="fixed z-[9999] rounded-xl overflow-hidden"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        background: 'var(--card)',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'rgba(var(--border-rgb), 0.12)',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
        maxHeight: '240px',
        overflowY: 'auto'
      }}
      ref={dropdownRef}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => {
            console.log('Option clicked:', option.value);
            onChange(option.value);
            setIsOpen(false);
          }}
          className="w-full px-4 py-2.5 text-sm text-left flex items-center justify-between transition-all hover:bg-black/5"
          style={{
            background: value === option.value ? 'rgba(var(--primary-rgb), 0.08)' : 'transparent',
            color: value === option.value ? 'var(--primary)' : 'var(--foreground)',
            fontWeight: value === option.value ? 600 : 400
          }}
        >
          <span>{option.label}</span>
          {value === option.value && (
            <Check className="w-4 h-4" style={{ color: 'var(--primary)' }} />
          )}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        id={id}
        type="button"
        onClick={() => {
          console.log('CustomSelect button clicked, current isOpen:', isOpen);
          setIsOpen(!isOpen);
        }}
        className="w-full px-4 py-2.5 rounded-xl text-sm text-left flex items-center justify-between transition-all"
        style={{
          background: 'var(--secondary)',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: isOpen ? 'var(--primary)' : 'rgba(var(--border-rgb), 0.12)',
          color: 'var(--foreground)'
        }}
        ref={buttonRef}
      >
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />}
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          className="w-4 h-4 transition-transform" 
          style={{ 
            color: 'var(--muted-foreground)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }} 
        />
      </button>

      {typeof document !== 'undefined' && dropdownMenu && createPortal(dropdownMenu, document.body)}
    </div>
  );
}