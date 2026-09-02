import React from 'react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index?: number) => string | number;
  isLoading?: boolean;
  emptyMessage?: string;
  actions?: (item: T) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyMessage = 'داده‌ای یافت نشد',
  actions,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="w-full py-12 flex flex-col items-center justify-center text-neutral-400">
        <div className="w-7 h-7 border-2 border-neutral-900 border-t-transparent rounded-full animate-spin mb-3" />
        <span className="text-xs font-mono text-neutral-500">در حال دریافت داده‌ها...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full py-12 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col items-center justify-center text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-900/40">
        <p className="text-xs font-mono text-neutral-500 dark:text-neutral-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#13151a] shadow-vercel-sm">
      <table className="w-full text-start text-xs text-neutral-800 dark:text-neutral-200">
        <thead className="bg-[#fafafa] dark:bg-[#181a20] border-b border-neutral-200/80 dark:border-neutral-800/80 text-neutral-500 dark:text-neutral-400 font-mono text-[11px] uppercase tracking-wider">
          <tr>
            {columns.map((col, colIdx) => (
              <th key={col.key || `col_hdr_${colIdx}`} className={`px-4 py-3 text-start font-semibold ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
            {actions && <th className="px-4 py-3 text-end font-semibold">عملیات</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
          {data.map((item, index) => {
            const rawKey = keyExtractor ? keyExtractor(item, index) : index;
            const key = rawKey !== undefined && rawKey !== null && rawKey !== '' ? `dt_row_${rawKey}_${index}` : `dt_row_idx_${index}`;
            return (
              <tr key={key} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/50 transition-colors">
                {columns.map((col, colIdx) => (
                  <td key={`${key}_col_${col.key || colIdx}`} className={`px-4 py-3 text-neutral-800 dark:text-neutral-200 ${col.className || ''}`}>
                    {col.render ? col.render(item) : (item as any)[col.key] ?? '-'}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-3 text-end whitespace-nowrap">
                    {actions(item)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
