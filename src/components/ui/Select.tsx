import React from 'react';

interface Option {
  value: string | number;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.replace(/\s+/g, '-')}` : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
            {label}
          </label>
        )}
        <select
          id={selectId}
          ref={ref}
          className={`w-full bg-white dark:bg-[#181a20] border border-neutral-200/90 dark:border-neutral-700/80 rounded-md text-neutral-900 dark:text-neutral-100 text-sm px-3.5 py-2 transition-all focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-neutral-200/20 focus:border-neutral-900 dark:focus:border-neutral-400 cursor-pointer ${
            error ? 'border-[#ee0000]' : ''
          } ${className}`}
          {...props}
        >
          {options.map((opt, idx) => (
            <option key={`${opt.value}_${idx}`} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
