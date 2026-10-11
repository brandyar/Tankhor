import React, { useState, useRef, useEffect, useMemo } from 'react';
import { RawMaterial } from '../../types';
import { useTranslation } from '../../i18n';
import { Search, Check, ChevronDown, Boxes, X } from 'lucide-react';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';

export interface SearchableRawMaterialSelectProps {
  rawMaterials: RawMaterial[];
  value: number | '' | undefined;
  onChange: (materialId: number) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  currency?: string;
}

export const SearchableRawMaterialSelect: React.FC<SearchableRawMaterialSelectProps> = ({
  rawMaterials,
  value,
  onChange,
  label,
  placeholder,
  required,
  error,
  disabled,
  className = '',
  id,
  currency = 'TOMAN',
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected raw material
  const selectedMaterial = useMemo(() => {
    if (!value) return null;
    return rawMaterials.find((r) => r.id === Number(value)) || null;
  }, [rawMaterials, value]);

  // Normalize search helper
  const normalize = (str?: string | null) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/ي/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/ة/g, 'ه')
      .trim();
  };

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    const term = normalize(searchTerm);
    if (!term) return rawMaterials;

    return rawMaterials.filter((r) => {
      const name = normalize(r.name);
      const code = normalize(r.code);
      const unit = normalize(r.unit);
      const category = normalize(r.category);

      return (
        name.includes(term) ||
        code.includes(term) ||
        unit.includes(term) ||
        category.includes(term)
      );
    });
  }, [rawMaterials, searchTerm]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const handleSelect = (matId: number) => {
    onChange(matId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`w-full space-y-1 relative ${className}`} id={id}>
      {label && (
        <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          {label}
          {required && <span className="text-rose-500 ms-1">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] px-3 py-2 bg-white dark:bg-[#181a20] border text-start rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer shadow-2xs ${
          error
            ? 'border-rose-500 ring-1 ring-rose-500'
            : isOpen
            ? 'border-indigo-600 dark:border-indigo-500 ring-2 ring-indigo-500/20'
            : 'border-neutral-200/90 dark:border-neutral-700/80 hover:border-neutral-300 dark:hover:border-neutral-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-neutral-50 dark:bg-neutral-900' : ''}`}
      >
        {selectedMaterial ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200/80 dark:border-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Boxes className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                  {selectedMaterial.name}
                </span>
                <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-200/60 dark:border-amber-900/60">
                  {selectedMaterial.code}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                <span>واحد: {selectedMaterial.unit}</span>
                {selectedMaterial.unit_cost > 0 && (
                  <>
                    <span>•</span>
                    <span>فی: {formatCurrency(selectedMaterial.unit_cost, currency, isPersian)}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <span className="text-xs text-neutral-400 dark:text-neutral-500">
            {placeholder || 'انتخاب متریال اولیه یا خرج‌کار...'}
          </span>
        )}

        <ChevronDown
          className={`w-4 h-4 text-neutral-400 shrink-0 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {error && <p className="text-[11px] text-rose-500 mt-1">{error}</p>}

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute z-50 top-full start-0 end-0 mt-1 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700/80 rounded-2xl shadow-xl overflow-hidden max-h-80 flex flex-col">
          {/* Search Bar Header */}
          <div className="p-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center gap-2">
            <Search className="w-4 h-4 text-neutral-400 ms-1 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو در نام متریال، کد یا واحد..."
              className="w-full bg-transparent border-0 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none py-1.5"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md text-neutral-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* List Items */}
          <div className="overflow-y-auto p-1.5 space-y-1 divide-y divide-neutral-100 dark:divide-neutral-800/60 flex-1">
            {filteredMaterials.length === 0 ? (
              <div className="p-4 text-center text-xs text-neutral-400 dark:text-neutral-500">
                متریال اولیه‌ای یافت نشد.
              </div>
            ) : (
              filteredMaterials.map((mat) => {
                const isSelected = selectedMaterial?.id === mat.id;

                return (
                  <button
                    key={`mat_opt_${mat.id}`}
                    type="button"
                    onClick={() => handleSelect(mat.id)}
                    className={`w-full text-start p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-100 font-medium'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200/70 dark:border-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                        <Boxes className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs truncate">{mat.name}</span>
                          <span className="text-[10px] font-mono text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                            {mat.code}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5">
                          <span>واحد: {mat.unit}</span>
                          <span>•</span>
                          <span>موجودی: {toPersianDigits(mat.current_stock)}</span>
                          {mat.unit_cost > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-600 dark:text-emerald-400">
                                فی: {formatCurrency(mat.unit_cost, currency, isPersian)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
