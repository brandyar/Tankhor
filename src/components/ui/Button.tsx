import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-neutral-900/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]';

  const variantStyles = {
    primary: 'bg-[#171717] hover:bg-black text-white rounded-full shadow-vercel-sm focus:ring-neutral-900',
    secondary: 'bg-white hover:bg-neutral-50 text-[#171717] border border-neutral-200/90 rounded-full shadow-vercel-sm focus:ring-neutral-400',
    danger: 'bg-[#ee0000] hover:bg-[#c50000] text-white rounded-full shadow-vercel-sm focus:ring-red-500',
    outline: 'border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 rounded-lg focus:ring-neutral-400',
    ghost: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80 rounded-lg focus:ring-neutral-300',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2.5',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin me-1.5" />
      ) : (
        icon && <span className="inline-flex shrink-0">{icon}</span>
      )}
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
};
