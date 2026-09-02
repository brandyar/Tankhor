import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import {
  SizeGuideTemplate,
  SizeGuideMeasurement,
  SizeGuideValue,
  Size,
  SizeGuideType,
  SizeUnit,
  MeasurementUnit,
  MeasurementType,
} from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable } from '../../components/ui/DataTable';
import { SizeChartModal } from '../../components/modals/SizeChartModal';
import { confirmAction } from '../../utils/confirm';
import {
  Ruler,
  Plus,
  Search,
  Edit,
  Trash2,
  Table,
  Sliders,
  ChevronRight,
  Check,
  Info,
  Sparkles,
  Eye,
} from 'lucide-react';

export const SizeGuidesView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [templates, setTemplates] = useState<SizeGuideTemplate[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [search, setSearch] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Selected Template for Matrix & Measurement Management
  const [selectedTemplate, setSelectedTemplate] = useState<SizeGuideTemplate | null>(null);
  const [measurements, setMeasurements] = useState<SizeGuideMeasurement[]>([]);
  const [guideValues, setGuideValues] = useState<SizeGuideValue[]>([]);

  // Preview Chart Modal State
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Modals state
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SizeGuideTemplate | null>(null);

  // Template Form state
  const [tplName, setTplName] = useState('');
  const [tplType, setTplType] = useState<SizeGuideType>('apparel');
  const [tplUnit, setTplUnit] = useState<SizeUnit>('cm');
  const [tplDesc, setTplDesc] = useState('');
  const [tplStatus, setTplStatus] = useState<'active' | 'inactive'>('active');
  const [isSavingTpl, setIsSavingTpl] = useState(false);

  // Measurement Modal State
  const [isMeasModalOpen, setIsMeasModalOpen] = useState(false);
  const [editingMeas, setEditingMeas] = useState<SizeGuideMeasurement | null>(null);
  const [measName, setMeasName] = useState('');
  const [measCode, setMeasCode] = useState('');
  const [measUnit, setMeasUnit] = useState<MeasurementUnit>('cm');
  const [measType, setMeasType] = useState<MeasurementType>('length');

  // Matrix edit values state (matrix mapping sizeId_measId -> { value, min_value, max_value, id? })
  const [matrixState, setMatrixState] = useState<Record<string, { value: string; id?: number }>>({});
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  const isPersian = locale === 'fa';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [tplList, sizeList] = await Promise.all([
        adapter.getSizeGuideTemplates({ organization_id: orgId }),
        adapter.getSizes({ organization_id: orgId }),
      ]);
      setTemplates(tplList);
      setSizes(sizeList);

      // Default select first template if none selected or invalid
      if (tplList.length > 0 && (!selectedTemplate || !tplList.some((t) => t.id === selectedTemplate.id))) {
        handleSelectTemplate(tplList[0]);
      }
    } catch (err) {
      console.error('[SizeGuidesView] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  const handleSelectTemplate = async (tpl: SizeGuideTemplate) => {
    setSelectedTemplate(tpl);
    try {
      const adapter = storageManager.getAdapter();
      const [measList, valList] = await Promise.all([
        adapter.getSizeGuideMeasurements(tpl.id),
        adapter.getSizeGuideValues(tpl.id),
      ]);
      setMeasurements(measList);
      setGuideValues(valList);

      // Build matrix dictionary
      const matrixMap: Record<string, { value: string; id?: number }> = {};
      valList.forEach((v) => {
        const key = `${v.size_id}_${v.measurement_id}`;
        matrixMap[key] = {
          value: v.value !== undefined && v.value !== null ? String(v.value) : '',
          id: v.id,
        };
      });
      setMatrixState(matrixMap);
    } catch (err) {
      console.error('[SizeGuidesView] Error loading template details:', err);
    }
  };

  // Open Template Modal
  const handleOpenTemplateModal = (tpl?: SizeGuideTemplate) => {
    if (tpl) {
      setEditingTemplate(tpl);
      setTplName(tpl.name);
      setTplType(tpl.type || 'apparel');
      setTplUnit(tpl.unit || 'cm');
      setTplDesc(tpl.description || '');
      setTplStatus(tpl.status === 'inactive' ? 'inactive' : 'active');
    } else {
      setEditingTemplate(null);
      setTplName('');
      setTplType('apparel');
      setTplUnit('cm');
      setTplDesc('');
      setTplStatus('active');
    }
    setIsTemplateModalOpen(true);
  };

  // Save Template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim()) return;

    setIsSavingTpl(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;

      const saved = await adapter.saveSizeGuideTemplate({
        id: editingTemplate?.id,
        organization_id: orgId,
        name: tplName,
        type: tplType,
        unit: tplUnit,
        description: tplDesc,
        status: tplStatus,
      });

      // If creating new template, populate default measurements based on type
      if (!editingTemplate) {
        await createDefaultMeasurementsForType(saved.id, tplType);
      }

      setIsTemplateModalOpen(false);
      await loadData();
      handleSelectTemplate(saved);
    } catch (err) {
      console.error('[SizeGuidesView] Error saving template:', err);
    } finally {
      setIsSavingTpl(false);
    }
  };

  // Default measurement parameters for types
  const createDefaultMeasurementsForType = async (templateId: number, type: SizeGuideType) => {
    const adapter = storageManager.getAdapter();
    let defaultMeas: { name: string; code: string; type: MeasurementType; unit: MeasurementUnit }[] = [];

    if (type === 'apparel') {
      defaultMeas = [
        { name: 'دور سینه', code: 'chest', type: 'circumference', unit: 'cm' },
        { name: 'دور کمر', code: 'waist', type: 'circumference', unit: 'cm' },
        { name: 'دور باسن', code: 'hip', type: 'circumference', unit: 'cm' },
        { name: 'قد لباس', code: 'length', type: 'length', unit: 'cm' },
        { name: 'قد آستین', code: 'sleeve', type: 'length', unit: 'cm' },
      ];
    } else if (type === 'footwear') {
      defaultMeas = [
        { name: 'طول کفی (پا)', code: 'insole_length', type: 'length', unit: 'cm' },
        { name: 'عرض پنجه پا', code: 'foot_width', type: 'width', unit: 'cm' },
      ];
    } else if (type === 'bags') {
      defaultMeas = [
        { name: 'ارتفاع کیف', code: 'height', type: 'height', unit: 'cm' },
        { name: 'عرض کیف', code: 'width', type: 'width', unit: 'cm' },
        { name: 'عمق کیف', code: 'depth', type: 'depth', unit: 'cm' },
      ];
    } else if (type === 'accessories') {
      defaultMeas = [
        { name: 'طول کل', code: 'length', type: 'length', unit: 'cm' },
        { name: 'دور مچ / گردن', code: 'circumference', type: 'circumference', unit: 'cm' },
      ];
    }

    for (const m of defaultMeas) {
      await adapter.saveSizeGuideMeasurement({
        template_id: templateId,
        name: m.name,
        code: m.code,
        type: m.type,
        unit: m.unit,
        status: 'active',
      });
    }
  };

  // Delete Template
  const handleDeleteTemplate = async (id: number) => {
    if (!(await confirmAction('آیا از حذف این قالب راهنمای سایز اطمینان دارید؟'))) return;
    try {
      const adapter = storageManager.getAdapter();
      await adapter.deleteSizeGuideTemplate(id);
      if (selectedTemplate?.id === id) {
        setSelectedTemplate(null);
      }
      await loadData();
    } catch (err) {
      console.error('[SizeGuidesView] Error deleting template:', err);
    }
  };

  // Open Measurement Modal
  const handleOpenMeasModal = (meas?: SizeGuideMeasurement) => {
    if (meas) {
      setEditingMeas(meas);
      setMeasName(meas.name);
      setMeasCode(meas.code || '');
      setMeasUnit(meas.unit || 'cm');
      setMeasType(meas.type || 'length');
    } else {
      setEditingMeas(null);
      setMeasName('');
      setMeasCode('');
      setMeasUnit(selectedTemplate?.unit || 'cm');
      setMeasType('length');
    }
    setIsMeasModalOpen(true);
  };

  // Save Measurement Parameter
  const handleSaveMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!measName.trim() || !selectedTemplate) return;

    try {
      const adapter = storageManager.getAdapter();
      await adapter.saveSizeGuideMeasurement({
        id: editingMeas?.id,
        template_id: selectedTemplate.id,
        name: measName,
        code: measCode || measName.toLowerCase().replace(/\s+/g, '_'),
        unit: measUnit,
        type: measType,
        status: 'active',
      });

      setIsMeasModalOpen(false);
      await handleSelectTemplate(selectedTemplate);
    } catch (err) {
      console.error('[SizeGuidesView] Error saving measurement:', err);
    }
  };

  // Delete Measurement Parameter
  const handleDeleteMeasurement = async (measId: number) => {
    if (!(await confirmAction('آیا از حذف این پارامتر اندازه اطمینان دارید؟'))) return;
    try {
      const adapter = storageManager.getAdapter();
      await adapter.deleteSizeGuideMeasurement(measId);
      if (selectedTemplate) {
        await handleSelectTemplate(selectedTemplate);
      }
    } catch (err) {
      console.error('[SizeGuidesView] Error deleting measurement:', err);
    }
  };

  // Matrix Value Change
  const handleMatrixCellChange = (sizeId: number, measId: number, val: string) => {
    const key = `${sizeId}_${measId}`;
    setMatrixState((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: val,
      },
    }));
  };

  // Save Matrix Values
  const handleSaveMatrix = async () => {
    if (!selectedTemplate) return;
    setIsSavingMatrix(true);
    setSaveSuccessMsg(false);
    try {
      const adapter = storageManager.getAdapter();

      const promises: Promise<any>[] = [];
      Object.entries(matrixState).forEach(([key, cell]: [string, { value: string; id?: number }]) => {
        const [sizeIdStr, measIdStr] = key.split('_');
        const sizeId = Number(sizeIdStr);
        const measId = Number(measIdStr);
        const numVal = cell.value !== '' ? Number(cell.value) : undefined;

        if (numVal !== undefined) {
          promises.push(
            adapter.saveSizeGuideValue({
              id: cell.id,
              template_id: selectedTemplate.id,
              size_id: sizeId,
              measurement_id: measId,
              value: numVal,
            })
          );
        }
      });

      await Promise.all(promises);
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
      await handleSelectTemplate(selectedTemplate);
    } catch (err) {
      console.error('[SizeGuidesView] Error saving size guide matrix:', err);
    } finally {
      setIsSavingMatrix(false);
    }
  };

  // Type Translations & Badges
  const getTypeBadge = (type: SizeGuideType) => {
    switch (type) {
      case 'apparel':
        return <Badge variant="primary">پوشاک</Badge>;
      case 'footwear':
        return <Badge variant="warning">کفش و پاپوش</Badge>;
      case 'bags':
        return <Badge variant="info">کیف و کوله</Badge>;
      case 'accessories':
        return <Badge variant="success">اکسسوری</Badge>;
      default:
        return <Badge variant="neutral">سایر / سفارشی</Badge>;
    }
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
    const matchesType = selectedTypeFilter === 'all' || t.type === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="قالب‌های راهنمای سایز"
        subtitle="تعریف ماتریس اندازه و جدول راهنمای سایز هوشمند برای انواع دسته محصولات"
        action={
          <Button
            onClick={() => handleOpenTemplateModal()}
            icon={<Plus className="w-4 h-4" />}
          >
            افزودن قالب جدید
          </Button>
        }
      />

      {/* Main Grid: Left sidebar with templates list, Right area with interactive matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Templates Sidebar / List */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Ruler className="w-4 h-4 text-indigo-600" />
                لیست قالب‌های راهنمای سایز
              </h3>
              <span className="text-xs text-slate-500 font-mono font-medium">
                {filteredTemplates.length} قالب
              </span>
            </div>

            {/* Filter controls */}
            <div className="space-y-2">
              <Input
                placeholder="جستجو در قالب‌ها..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
              <Select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'همه دسته‌ها' },
                  { value: 'apparel', label: 'پوشاک' },
                  { value: 'footwear', label: 'کفش و پاپوش' },
                  { value: 'bags', label: 'کیف و کوله' },
                  { value: 'accessories', label: 'اکسسوری' },
                  { value: 'custom', label: 'سفارشی' },
                ]}
              />
            </div>

            {/* Template Items */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pt-1">
              {isLoading ? (
                <div className="p-6 text-center text-slate-400 text-xs">در حال دریافت قالب‌ها...</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">هیچ قالبی یافت نشد.</div>
              ) : (
                filteredTemplates.map((tpl, tplIdx) => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  return (
                    <div
                      key={tpl.id ? `sg_tpl_${tpl.id}_${tplIdx}` : `sg_tpl_idx_${tplIdx}`}
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`p-3 rounded-xl border text-right cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-200 shadow-2xs'
                          : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                          {tpl.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTemplateModal(tpl);
                            }}
                            className="p-1 hover:bg-slate-200/60 rounded text-slate-500 hover:text-slate-800"
                            title="ویرایش قالب"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(tpl.id);
                            }}
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"
                            title="حذف قالب"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2">
                        {getTypeBadge(tpl.type)}
                        <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          واحد: {tpl.unit}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* Matrix & Measurements Content Area */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedTemplate ? (
            <Card className="p-12 text-center text-slate-400">
              <Ruler className="w-12 h-12 mx-auto mb-3 text-slate-300 stroke-[1.5]" />
              <p className="font-medium text-sm">لطفا یک قالب راهنمای سایز را برای نمایش و ویرایش ماتریس انتخاب کنید.</p>
            </Card>
          ) : (
            <>
              {/* Template Header Card */}
              <Card className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-slate-900">{selectedTemplate.name}</h2>
                      {getTypeBadge(selectedTemplate.type)}
                      <Badge variant="neutral">واحد {selectedTemplate.unit}</Badge>
                    </div>
                    {selectedTemplate.description && (
                      <p className="text-xs text-slate-500 mt-1">{selectedTemplate.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPreviewModalOpen(true)}
                      icon={<Eye className="w-3.5 h-3.5" />}
                    >
                      پیش‌نمایش و چاپ کارت
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenMeasModal()}
                      icon={<Plus className="w-3.5 h-3.5" />}
                    >
                      افزودن پارامتر اندازه
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveMatrix}
                      isLoading={isSavingMatrix}
                      icon={<Check className="w-3.5 h-3.5" />}
                    >
                      ذخیره ماتریس سایزها
                    </Button>
                  </div>
                </div>

                {saveSuccessMsg && (
                  <div className="mt-3 p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2 animate-fade-in">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    ماتریس مقادیر راهنمای سایز با موفقیت ذخیره شد.
                  </div>
                )}
              </Card>

              {/* Defined Measurements List */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                    پارامترهای اندازه‌گیری تعریف شده ({measurements.length})
                  </h4>
                </div>

                {measurements.length === 0 ? (
                  <div className="p-4 bg-amber-50/60 border border-amber-200/60 rounded-xl text-amber-800 text-xs flex items-center justify-between gap-2">
                    <span>هیچ پارامتر اندازه‌ای (مانند دور سینه، قد، طول کفی و...) تعریف نشده است.</span>
                    <Button size="sm" variant="outline" onClick={() => handleOpenMeasModal()}>
                      تعریف اولین پارامتر
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {measurements.map((m, mIdx) => (
                      <div
                        key={m.id ? `meas_badge_${m.id}_${mIdx}` : `meas_badge_idx_${mIdx}`}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200/80 text-slate-800 text-xs"
                      >
                        <span className="font-bold">{m.name}</span>
                        {m.code && <span className="font-mono text-[10px] text-slate-500">({m.code})</span>}
                        <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border text-slate-600">
                          {m.unit}
                        </span>
                        <div className="flex items-center gap-0.5 mr-1 pr-1 border-r border-slate-300">
                          <button
                            type="button"
                            onClick={() => handleOpenMeasModal(m)}
                            className="p-0.5 text-slate-400 hover:text-slate-700"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMeasurement(m.id)}
                            className="p-0.5 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Interactive Matrix Grid */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1.5">
                    <Table className="w-3.5 h-3.5 text-indigo-600" />
                    ماتریس هوشمند اندازه‌ها (جدول راهنما)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    مقادیر به سانتی‌متر / اینچ طبق واحد قالب
                  </span>
                </div>

                {measurements.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    ابتدا پارامترهای اندازه را تعریف کنید تا جدول ماتریس تشکیل شود.
                  </div>
                ) : sizes.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    هیچ سایزی در سیستم یافت نشد. لطفا ابتدا در بخش «سایزها» سایزهای استاندارد را ایجاد کنید.
                  </div>
                ) : (
                  <div className="overflow-x-auto custom-scrollbar border border-slate-200 rounded-xl">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                          <th className="p-3 w-32 sticky right-0 bg-slate-100 z-10">نام سایز</th>
                          {measurements.map((m, mIdx) => (
                            <th key={m.id ? `th_m_${m.id}_${mIdx}` : `th_m_idx_${mIdx}`} className="p-3 text-center min-w-[110px]">
                              <div>{m.name}</div>
                              <div className="text-[10px] text-slate-400 font-normal font-mono">
                                ({m.unit})
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {sizes.map((sz, szIdx) => (
                          <tr key={sz.id ? `tr_sz_${sz.id}_${szIdx}` : `tr_sz_idx_${szIdx}`} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3 font-bold text-slate-900 sticky right-0 bg-white shadow-xs z-10">
                              <span className="px-2 py-1 bg-slate-100 rounded-md font-mono text-xs text-slate-800">
                                {sz.name}
                              </span>
                            </td>
                            {measurements.map((m, mIdx) => {
                              const cellKey = `${sz.id}_${m.id}`;
                              const cellValue = matrixState[cellKey]?.value || '';
                              return (
                                <td key={m.id ? `td_cell_${sz.id}_${m.id}_${mIdx}` : `td_cell_idx_${mIdx}`} className="p-2 text-center">
                                  <input
                                    type="number"
                                    step="0.1"
                                    placeholder="0"
                                    value={cellValue}
                                    onChange={(e) => handleMatrixCellChange(sz.id, m.id, e.target.value)}
                                    className="w-20 px-2 py-1 text-center font-mono text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Modal: Create/Edit Template */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title={editingTemplate ? 'ویرایش قالب راهنمای سایز' : 'افزودن قالب راهنمای سایز جدید'}
      >
        <form onSubmit={handleSaveTemplate} className="space-y-4">
          <Input
            label="عنوان قالب"
            placeholder="مثلا: راهنمای سایز تیشرت زنانه"
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="دسته/نوع قالب"
              value={tplType}
              onChange={(e) => setTplType(e.target.value as SizeGuideType)}
              options={[
                { value: 'apparel', label: 'پوشاک (Apparel)' },
                { value: 'footwear', label: 'کفش و پاپوش (Footwear)' },
                { value: 'bags', label: 'کیف و کوله (Bags)' },
                { value: 'accessories', label: 'اکسسوری (Accessories)' },
                { value: 'custom', label: 'سفارشی (Custom)' },
              ]}
            />

            <Select
              label="واحد اندازه‌گیری پیش‌فرض"
              value={tplUnit}
              onChange={(e) => setTplUnit(e.target.value as SizeUnit)}
              options={[
                { value: 'cm', label: 'سانتی‌متر (cm)' },
                { value: 'in', label: 'اینچ (in)' },
                { value: 'mm', label: 'میلی‌متر (mm)' },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">توضیحات / راهنمای اندازه‌گیری</label>
            <textarea
              rows={3}
              placeholder="توضیحاتی درباره نحوه‌ی اندازه‌گیری پارامترها..."
              value={tplDesc}
              onChange={(e) => setTplDesc(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <Select
            label="وضعیت"
            value={tplStatus}
            onChange={(e) => setTplStatus(e.target.value as 'active' | 'inactive')}
            options={[
              { value: 'active', label: 'فعال' },
              { value: 'inactive', label: 'غیرفعال' },
            ]}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setIsTemplateModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" isLoading={isSavingTpl}>
              {editingTemplate ? 'ذخیره تغییرات' : 'ایجاد قالب'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create/Edit Measurement Parameter */}
      <Modal
        isOpen={isMeasModalOpen}
        onClose={() => setIsMeasModalOpen(false)}
        title={editingMeas ? 'ویرایش پارامتر اندازه' : 'افزودن پارامتر اندازه جدید'}
      >
        <form onSubmit={handleSaveMeasurement} className="space-y-4">
          <Input
            label="نام پارامتر"
            placeholder="مثلا: دور سینه، قد آستین، طول کفی"
            value={measName}
            onChange={(e) => setMeasName(e.target.value)}
            required
          />

          <Input
            label="کد یکتا (تگ انگلیسی)"
            placeholder="مثلا: chest, length, insole_length"
            value={measCode}
            onChange={(e) => setMeasCode(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="نوع اندازه"
              value={measType}
              onChange={(e) => setMeasType(e.target.value as MeasurementType)}
              options={[
                { value: 'length', label: 'طول / قد' },
                { value: 'width', label: 'عرض' },
                { value: 'height', label: 'ارتفاع' },
                { value: 'depth', label: 'عمق' },
                { value: 'circumference', label: 'محیط / دور' },
                { value: 'weight', label: 'وزن' },
                { value: 'diameter', label: 'قطر' },
                { value: 'custom', label: 'سفارشی' },
              ]}
            />

            <Select
              label="واحد اندازه"
              value={measUnit}
              onChange={(e) => setMeasUnit(e.target.value as MeasurementUnit)}
              options={[
                { value: 'cm', label: 'سانتی‌متر (cm)' },
                { value: 'in', label: 'اینچ (in)' },
                { value: 'mm', label: 'میلی‌متر (mm)' },
                { value: 'g', label: 'گرم (g)' },
                { value: 'kg', label: 'کیلوگرم (kg)' },
              ]}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setIsMeasModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit">
              {editingMeas ? 'ویرایش' : 'افزودن پارامتر'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Interactive & Printable Size Chart Preview */}
      {selectedTemplate && (
        <SizeChartModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          template={selectedTemplate}
          measurements={measurements}
          guideValues={guideValues}
          sizes={sizes}
        />
      )}
    </div>
  );
};
