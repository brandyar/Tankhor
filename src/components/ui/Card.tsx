import React from 'react';

interface CardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  id?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  className = '',
  id,
}) => {
  return (
    <div id={id} className={`bg-white dark:bg-[#13151a] border border-neutral-200/80 dark:border-neutral-800/80 rounded-xl shadow-vercel-sm overflow-hidden transition-all text-neutral-900 dark:text-neutral-100 ${className}`}>
      {(title || action) && (
        <div className="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between gap-4">
          <div>
            {title && <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 font-normal">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};
