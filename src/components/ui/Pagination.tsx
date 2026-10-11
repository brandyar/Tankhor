import React from 'react';
import { useTranslation } from '../../i18n';
import { toPersianDigits } from '../../utils/formatters';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
}) => {
  const { t, isPersian } = useTranslation();

  if (totalItems <= 0) return null;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const formatNum = (num: number) => {
    return isPersian ? toPersianDigits(num) : num.toString();
  };

  // Generate pagination buttons array with smart ellipsis
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | string)[] = [];
    pages.push(1);

    if (currentPage > 3) {
      pages.push('...');
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push('...');
    }

    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={`w-full flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-white dark:bg-[#13151a] border border-neutral-200/80 dark:border-neutral-800/80 rounded-xl shadow-vercel-sm text-xs text-neutral-600 dark:text-neutral-400 font-sans ${className}`}
    >
      {/* Items Summary & Page Size Selector */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 w-full sm:w-auto">
        <span className="text-neutral-600 dark:text-neutral-300 font-medium whitespace-nowrap">
          {isPersian ? (
            <>
              نمایش <strong className="text-neutral-900 dark:text-white font-bold">{formatNum(startItem)}</strong> تا{' '}
              <strong className="text-neutral-900 dark:text-white font-bold">{formatNum(endItem)}</strong> از{' '}
              <strong className="text-neutral-900 dark:text-white font-bold">{formatNum(totalItems)}</strong> مورد
            </>
          ) : (
            <>
              Showing <strong className="text-neutral-900 dark:text-white font-bold">{formatNum(startItem)}</strong> to{' '}
              <strong className="text-neutral-900 dark:text-white font-bold">{formatNum(endItem)}</strong> of{' '}
              <strong className="text-neutral-900 dark:text-white font-bold">{formatNum(totalItems)}</strong> entries
            </>
          )}
        </span>

        <div className="flex items-center gap-1.5">
          <label htmlFor="pageSizeSelect" className="text-neutral-500 text-[11px] whitespace-nowrap">
            {t('common.rowsPerPage')}:
          </label>
          <select
            id="pageSizeSelect"
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="bg-neutral-100 dark:bg-neutral-800/90 text-neutral-900 dark:text-neutral-100 border border-neutral-300 dark:border-neutral-700 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-colors"
          >
            {pageSizeOptions.map((option) => (
              <option key={`pg_opt_${option}`} value={option}>
                {formatNum(option)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
          {/* Previous Button */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap flex items-center gap-1 text-[11px]"
            title={t('common.previous')}
          >
            <span>«</span>
            <span className="hidden xs:inline">{t('common.previous')}</span>
          </button>

          {/* Numeric Page Buttons */}
          <div className="flex items-center gap-1 px-1">
            {pageNumbers.map((p, idx) => {
              if (typeof p === 'string') {
                return (
                  <span
                    key={`pg_dots_${idx}`}
                    className="px-1.5 py-1 text-neutral-400 dark:text-neutral-500 font-bold select-none text-xs"
                  >
                    ...
                  </span>
                );
              }

              const isCurrent = p === currentPage;
              return (
                <button
                  key={`pg_num_${p}`}
                  onClick={() => onPageChange(p)}
                  className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-sm'
                      : 'border border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {formatNum(p)}
                </button>
              );
            })}
          </div>

          {/* Next Button */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap flex items-center gap-1 text-[11px]"
            title={t('common.next')}
          >
            <span className="hidden xs:inline">{t('common.next')}</span>
            <span>»</span>
          </button>
        </div>
      )}
    </div>
  );
};
