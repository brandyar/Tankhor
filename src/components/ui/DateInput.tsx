import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronRight, ChevronLeft, Check, Clock } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { toPersianDigits } from '../../utils/formatters';
import {
  isoToJalali,
  jalaliToIsoString,
  getJalaliMonthDays,
  getFirstDayOfJalaliMonth,
  PERSIAN_MONTH_NAMES,
  PERSIAN_WEEKDAYS,
  getTodayIso,
  formatJalaliDateString,
  JalaliDate,
} from '../../utils/dateUtils';

export interface DateInputProps {
  label?: string;
  value?: string; // Standard YYYY-MM-DD
  onChange: (isoDate: string) => void; // Emits standard YYYY-MM-DD
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  placeholder?: string;
  isPersian?: boolean; // Force mode, otherwise auto-detected from locale
}

export const DateInput: React.FC<DateInputProps> = ({
  label,
  value,
  onChange,
  error,
  required,
  disabled,
  className = '',
  id,
  placeholder,
  isPersian: explicitIsPersian,
}) => {
  const { locale, t } = useTranslation();
  const isPersian = explicitIsPersian !== undefined ? explicitIsPersian : locale === 'fa';

  // Ensure standard date string or today
  const currentIso = value ? value.slice(0, 10) : getTodayIso();
  const currentJalali = isoToJalali(currentIso);

  // Popover state
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Picker view state (year and month currently being viewed)
  const [viewYear, setViewYear] = useState<number>(currentJalali.jy);
  const [viewMonth, setViewMonth] = useState<number>(currentJalali.jm);

  // Direct manual input state for Persian mode
  const [manualText, setManualText] = useState<string>(() => {
    return formatJalaliDateString(currentJalali.jy, currentJalali.jm, currentJalali.jd);
  });

  // Sync internal view when value changes externally
  useEffect(() => {
    const j = isoToJalali(currentIso);
    setViewYear(j.jy);
    setViewMonth(j.jm);
    setManualText(formatJalaliDateString(j.jy, j.jm, j.jd));
  }, [currentIso]);

  // Close popup on outside click
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

  const inputId = id || (label ? `date-input-${label.replace(/\s+/g, '-')}` : undefined);

  // English (Gregorian) mode: native clean date input
  if (!isPersian) {
    return (
      <div className={`w-full space-y-1 ${className}`}>
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            type="date"
            id={inputId}
            value={currentIso}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            required={required}
            className={`w-full bg-white dark:bg-[#181a20] border border-neutral-200/90 dark:border-neutral-700/80 rounded-md text-neutral-900 dark:text-neutral-100 text-sm px-3.5 py-2 transition-all focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-neutral-200/20 focus:border-neutral-900 dark:focus:border-neutral-400 cursor-pointer ${
              error ? 'border-[#ee0000]' : ''
            }`}
          />
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  // Persian (Jalali) mode
  const daysInMonth = getJalaliMonthDays(viewYear, viewMonth);
  const firstDayWeekday = getFirstDayOfJalaliMonth(viewYear, viewMonth); // 0 = Sat, 6 = Fri
  const todayJalali = isoToJalali(getTodayIso());

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const selected: JalaliDate = { jy: viewYear, jm: viewMonth, jd: day };
    const iso = jalaliToIsoString(selected);
    onChange(iso);
    setManualText(formatJalaliDateString(viewYear, viewMonth, day));
    setIsOpen(false);
  };

  const handleSetToday = () => {
    const todayIso = getTodayIso();
    onChange(todayIso);
    const j = isoToJalali(todayIso);
    setViewYear(j.jy);
    setViewMonth(j.jm);
    setManualText(formatJalaliDateString(j.jy, j.jm, j.jd));
    setIsOpen(false);
  };

  const handleManualTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setManualText(text);

    // Auto-parse if complete (YYYY/MM/DD)
    const normalized = text.replace(/[/\\-]/g, '-').trim();
    const parts = normalized.split('-');
    if (parts.length === 3) {
      const jy = Number(parts[0]);
      const jm = Number(parts[1]);
      const jd = Number(parts[2]);
      if (jy >= 1300 && jy <= 1499 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= 31) {
        const iso = jalaliToIsoString({ jy, jm, jd });
        onChange(iso);
        setViewYear(jy);
        setViewMonth(jm);
      }
    }
  };

  // Generate years list for dropdown (e.g. 1380 to 1420)
  const yearsList = [];
  for (let y = todayJalali.jy + 5; y >= todayJalali.jy - 15; y--) {
    yearsList.push(y);
  }

  const formattedDisplay = `${toPersianDigits(currentJalali.jd, true)} ${PERSIAN_MONTH_NAMES[currentJalali.jm - 1]} ${toPersianDigits(currentJalali.jy, true)}`;

  return (
    <div className={`w-full space-y-1 relative ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={inputId} className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Trigger Field */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-white dark:bg-[#181a20] border border-neutral-200/90 dark:border-neutral-700/80 rounded-md text-neutral-900 dark:text-neutral-100 text-sm px-3.5 py-2 flex items-center justify-between transition-all focus:outline-none focus:ring-2 focus:ring-neutral-900/10 dark:focus:ring-neutral-200/20 cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed bg-neutral-100 dark:bg-neutral-900' : ''
        } ${error ? 'border-[#ee0000]' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar className="w-4 h-4 text-neutral-400 shrink-0" />
          <span className="font-medium text-neutral-900 dark:text-white">
            {formattedDisplay}
          </span>
          <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
            ({toPersianDigits(manualText, true)})
          </span>
        </div>
        <span className="text-[10px] text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
          شمسی
        </span>
      </div>

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

      {/* Jalali Floating Calendar Popover */}
      {isOpen && (
        <div className="absolute z-50 mt-1 start-0 w-80 bg-white dark:bg-[#15171e] border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl p-3.5 animate-in fade-in zoom-in-95 duration-150 select-none">
          {/* Calendar Header with Selectors & Nav */}
          <div className="flex items-center justify-between gap-1 mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="ماه قبل"
              className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              {/* Month Dropdown */}
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold rounded-md px-2 py-1 border-0 cursor-pointer focus:ring-1 focus:ring-neutral-400"
              >
                {PERSIAN_MONTH_NAMES.map((name, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold rounded-md px-2 py-1 border-0 cursor-pointer focus:ring-1 focus:ring-neutral-400"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {toPersianDigits(y, true)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              title="ماه بعد"
              className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {PERSIAN_WEEKDAYS.map((wd) => (
              <div
                key={wd.key}
                className={`text-[11px] font-medium py-1 ${
                  wd.key === 'fr' ? 'text-red-500 font-bold' : 'text-neutral-400 dark:text-neutral-500'
                }`}
              >
                {wd.short}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayWeekday }).map((_, i) => (
              <div key={`empty-${i}`} className="h-7 w-7" />
            ))}

            {/* Days of current month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isSelected =
                currentJalali.jy === viewYear &&
                currentJalali.jm === viewMonth &&
                currentJalali.jd === day;
              const isToday =
                todayJalali.jy === viewYear &&
                todayJalali.jm === viewMonth &&
                todayJalali.jd === day;

              // Check if Friday (weekend in Iran)
              const weekdayIndex = (firstDayWeekday + i) % 7;
              const isFriday = weekdayIndex === 6;

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-7 w-7 rounded-lg text-xs font-medium flex items-center justify-center transition-all mx-auto ${
                    isSelected
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold shadow-xs'
                      : isToday
                      ? 'border border-neutral-900/40 dark:border-white/40 text-neutral-900 dark:text-white font-bold'
                      : isFriday
                      ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30'
                      : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  {toPersianDigits(day, true)}
                </button>
              );
            })}
          </div>

          {/* Manual Input & Today Action Footer */}
          <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-neutral-400">تایپ:</span>
              <input
                type="text"
                value={manualText}
                onChange={handleManualTextChange}
                placeholder="1405/06/19"
                className="w-24 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-1.5 py-0.5 text-center text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSetToday}
                className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded text-neutral-800 dark:text-neutral-200 text-xs font-medium transition-colors"
              >
                امروز
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2 py-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-white text-xs transition-colors"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
