import React from 'react';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action, actions }) => {
  const headerAction = action || actions;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-200/80 dark:border-neutral-800/80 mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 font-normal">{subtitle}</p>}
      </div>
      {headerAction && <div className="shrink-0">{headerAction}</div>}
    </div>
  );
};
