import React, { useState } from 'react';
import { SizeGuideTemplate, SizeGuideMeasurement, SizeGuideValue, Size } from '../../types';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import {
  Ruler,
  X,
  Share2,
  Printer,
  Copy,
  Check,
  Sparkles,
  Info,
  Sliders,
} from 'lucide-react';

interface SizeChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: SizeGuideTemplate;
  measurements: SizeGuideMeasurement[];
  guideValues: SizeGuideValue[];
  sizes: Size[];
  productTitle?: string;
}

export const SizeChartModal: React.FC<SizeChartModalProps> = ({
  isOpen,
  onClose,
  template,
  measurements,
  guideValues,
  sizes,
  productTitle,
}) => {
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  // Build matrix lookup
  const matrixMap: Record<string, string> = {};
  guideValues.forEach((v) => {
    const key = `${v.size_id}_${v.measurement_id}`;
    if (v.value !== undefined && v.value !== null && String(v.value).trim() !== '') {
      matrixMap[key] = String(v.value);
    }
  });

  // Filter sizes that actually have values in this template
  const relevantSizes = sizes.filter((s) =>
    measurements.some((m) => matrixMap[`${s.id}_${m.id}`])
  );
  const displaySizes = relevantSizes.length > 0 ? relevantSizes : sizes;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    let text = `📏 جدول راهنمای سایز: ${productTitle ? productTitle + ' - ' : ''}${template.name}\n`;
    text += `واحد اندازه‌گیری: ${template.unit === 'in' ? 'اینچ' : 'سانتی‌متر'}\n\n`;

    displaySizes.forEach((sz) => {
      text += `• سایز ${sz.name}:\n`;
      measurements.forEach((m) => {
        const val = matrixMap[`${sz.id}_${m.id}`] || '-';
        text += `   - ${m.name}: ${val} ${m.unit}\n`;
      });
    });

    if (template.description) {
      text += `\nنکته: ${template.description}\n`;
    }
    text += `\nتهیه شده توسط سیستم هوشمند تن‌خور (TANKHOR)`;

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      id="size-chart-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs animate-fade-in print:bg-white print:p-0 print:static"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="size-chart-printable-card"
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col animate-scale-up print:shadow-none print:border-none print:rounded-none"
      >
        {/* Header Ribbon */}
        <div className="relative bg-gradient-to-r from-neutral-900 via-neutral-800 to-indigo-950 text-white p-6 print:bg-none print:text-black print:p-2">
          <button
            onClick={onClose}
            className="absolute top-4 end-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer print:hidden"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-bold shadow-md print:hidden">
              <Ruler className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold tracking-wide uppercase text-indigo-300 bg-indigo-400/10 px-2.5 py-0.5 rounded-full border border-indigo-400/20">
              کارت راهنمای سایز و مشخصات
            </span>
          </div>

          <h2 className="text-lg font-black tracking-tight text-white print:text-black mt-1">
            {productTitle ? `${productTitle} - ` : ''}{template.name}
          </h2>
          <p className="text-xs text-neutral-300 print:text-neutral-600 mt-1 flex items-center gap-2">
            <span>واحد اندازه‌گیری: <strong>{template.unit === 'in' ? 'اینچ (Inches)' : 'سانتی‌متر (cm)'}</strong></span>
            <span>•</span>
            <span>نوع قالب: <strong>{template.type}</strong></span>
          </p>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 print:p-2">
          {/* Visual Matrix Table */}
          <div className="overflow-x-auto custom-scrollbar border border-neutral-200 rounded-2xl print:border-neutral-400">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-neutral-100 border-b border-neutral-200 text-neutral-800 font-bold">
                  <th className="p-3.5 text-center font-bold">سایز</th>
                  {measurements.map((m) => (
                    <th key={m.id} className="p-3.5 text-center font-bold">
                      <div>{m.name}</div>
                      <div className="text-[10px] text-neutral-400 font-mono font-normal">
                        ({m.unit})
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {displaySizes.map((sz) => (
                  <tr key={sz.id} className="hover:bg-neutral-50/80 transition-colors">
                    <td className="p-3 text-center font-bold text-neutral-900 bg-neutral-50/50">
                      <span className="px-2.5 py-1 bg-neutral-900 text-white rounded-lg font-mono text-xs font-black shadow-2xs">
                        {sz.name}
                      </span>
                    </td>
                    {measurements.map((m) => {
                      const val = matrixMap[`${sz.id}_${m.id}`];
                      return (
                        <td key={m.id} className="p-3 text-center font-mono text-xs font-bold text-neutral-800">
                          {val ? (
                            <span className="bg-indigo-50/70 text-indigo-950 px-2 py-0.5 rounded border border-indigo-100/80">
                              {val}
                            </span>
                          ) : (
                            <span className="text-neutral-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Description and Fitment Advice */}
          {template.description && (
            <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block mb-0.5 font-bold">راهنما و نکات اندازه‌گیری:</strong>
                <p className="leading-relaxed">{template.description}</p>
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-100 print:hidden">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyText}
                icon={isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                className="text-xs font-bold"
              >
                {isCopied ? 'متن کپی شد' : 'کپی متن برای شبکه‌های اجتماعی'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                icon={<Printer className="w-3.5 h-3.5" />}
                className="text-xs font-bold"
              >
                چاپ راهنمای سایز
              </Button>
            </div>

            <Button variant="primary" size="sm" onClick={onClose}>
              بستن
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
