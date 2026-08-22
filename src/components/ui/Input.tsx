import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.replace(/\s+/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-neutral-700">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute inset-y-0 start-0 ps-3 flex items-center pointer-events-none text-neutral-400">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-white border border-neutral-200/90 rounded-md text-neutral-900 text-sm px-3.5 py-2 transition-all focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400 placeholder:text-neutral-400 ${
              icon ? 'ps-10' : ''
            } ${error ? 'border-[#ee0000] focus:ring-red-500/10 focus:border-[#ee0000]' : ''} ${className}`}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-[#ee0000] mt-1 font-mono">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
