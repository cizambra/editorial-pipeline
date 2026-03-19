import { ReactNode, ButtonHTMLAttributes } from 'react';
import { LucideIcon } from 'lucide-react';
import { MobileSpinner } from '../feedback/MobileSpinner';

interface MobileButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'large' | 'medium' | 'small';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  type?: 'button' | 'submit' | 'reset';
}

/**
 * Consistent button component for mobile
 * 
 * @example
 * <MobileButton
 *   variant="primary"
 *   size="large"
 *   fullWidth
 *   loading={isSubmitting}
 *   icon={Check}
 *   onClick={handleSubmit}
 * >
 *   Save Changes
 * </MobileButton>
 */
export function MobileButton({
  children,
  variant = 'primary',
  size = 'large',
  fullWidth = false,
  disabled = false,
  loading = false,
  icon: Icon,
  iconPosition = 'left',
  type = 'button',
  className = '',
  onClick,
  ...props
}: MobileButtonProps) {
  const baseStyles = `
    lg:hidden
    inline-flex items-center justify-center gap-2
    font-semibold rounded-xl
    transition-all duration-100
    active:scale-[0.96]
    disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
    ${fullWidth ? 'w-full' : ''}
  `;

  const sizeStyles = {
    large: 'h-12 px-6 text-[15px]',
    medium: 'h-10 px-5 text-[14px]',
    small: 'h-9 px-4 text-[13px]',
  };

  const variantStyles = {
    primary: `
      text-white
      ${loading || disabled ? '' : 'shadow-[0_2px_8px_rgba(var(--primary-rgb),0.25)]'}
    `,
    secondary: 'text-[#6e6256]',
    ghost: 'text-[#c4522a]',
    destructive: 'text-[#dc2626]',
  };

  const getBackground = () => {
    if (variant === 'primary') return 'var(--primary)';
    if (variant === 'secondary') return 'var(--secondary)';
    if (variant === 'destructive') return 'rgba(220, 38, 38, 0.1)';
    return 'transparent';
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      style={{ background: getBackground() }}
      {...props}
    >
      {loading ? (
        <>
          <MobileSpinner size="small" color={variant === 'primary' ? '#ffffff' : 'var(--primary)'} />
          <span>{children}</span>
        </>
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="w-5 h-5" />}
          <span>{children}</span>
          {Icon && iconPosition === 'right' && <Icon className="w-5 h-5" />}
        </>
      )}
    </button>
  );
}
