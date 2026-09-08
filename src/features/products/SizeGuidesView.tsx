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
      const safeTpls = (Array.isArray(tplList) ? tplList : []).map((tItem) => ({
        ...tItem,
        name: tItem.name || (tItem as any).title || t('sizeguides.untitledTemplate'),
        type: (tItem.type || (tItem as any).template_type || 'apparel') as SizeGuideType,
        unit: (tItem.unit || 'cm') as SizeUnit,
      }));
      const safeSizes = Array.isArray(sizeList) ? sizeList : [];
      setTemplates(safeTpls);
      setSizes(safeSizes);

      // Default select first template if none selected or invalid
      if (safeTpls.length > 0 && (!selectedTemplate || !safeTpls.some((tItem) => tItem.id === selectedTemplate.id))) {
        handleSelectTemplate(safeTpls[0]);
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
    if (!tpl) return;
    setSelectedTemplate(tpl);
    try {
      const adapter = storageManager.getAdapter();
      const [measList, valList] = await Promise.all([
        adapter.getSizeGuideMeasurements(tpl.id),
        adapter.getSizeGuideValues(tpl.id),
      ]);
      const safeMeas = Array.isArray(measList) ? measList : [];
      const safeVals = Array.isArray(valList) ? valList : [];
      setMeasurements(safeMeas);
      setGuideValues(safeVals);

      // Build matrix dictionary
      const matrixMap: Record<string, { value: string; id?: number }> = {};
      safeVals.forEach((v) => {
        if (!v) return;
        const key = `${v.size_id}_${v.measurement_id}`;
        const val = v.value !== undefined && v.value !== null ? v.value : ((v as any).value_exact ?? '');
        matrixMap[key] = {
          value: String(val),
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
      setTplName(tpl.name || (tpl as any).title || '');
      setTplType((tpl.type || (tpl as any).template_type || 'apparel') as SizeGuideType);
      setTplUnit((tpl.unit || 'cm') as SizeUnit);
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
        { name: isPersian ? 'دور سینه' : 'Chest', code: 'chest', type: 'circumference', unit: 'cm' },
        { name: isPersian ? 'دور کمر' : 'Waist', code: 'waist', type: 'circumference', unit: 'cm' },
        { name: isPersian ? 'دور باسن' : 'Hip', code: 'hip', type: 'circumference', unit: 'cm' },
        { name: isPersian ? 'قد لباس' : 'Length', code: 'length', type: 'length', unit: 'cm' },
        { name: isPersian ? 'قد آستین' : 'Sleeve', code: 'sleeve', type: 'length', unit: 'cm' },
      ];
    } else if (type === 'footwear') {
      defaultMeas = [
        { name: isPersian ? 'طول کفی (پا)' : 'Insole Length', code: 'insole_length', type: 'length', unit: 'cm' },
        { name: isPersian ? 'عرض پنجه پا' : 'Foot Width', code: 'foot_width', type: 'width', unit: 'cm' },
      ];
    } else if (type === 'bags') {
      defaultMeas = [
        { name: isPersian ? 'ارتفاع کیف' : 'Bag Height', code: 'height', type: 'height', unit: 'cm' },
        { name: isPersian ? 'عرض کیف' : 'Bag Width', code: 'width', type: 'width', unit: 'cm' },
        { name: isPersian ? 'عمق کیف' : 'Bag Depth', code: 'depth', type: 'depth', unit: 'cm' },
      ];
    } else if (type === 'accessories') {
      defaultMeas = [
        { name: isPersian ? 'طول کل' : 'Total Length', code: 'length', type: 'length', unit: 'cm' },
        { name: isPersian ? 'دور مچ / گردن' : 'Wrist / Neck Circumference', code: 'circumference', type: 'circumference', unit: 'cm' },
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
    if (!(await confirmAction(t('sizeguides.confirmDeleteTemplate')))) return;
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
    if (!(await confirmAction(t('sizeguides.confirmDeleteMeasurement')))) return;
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
  const getTypeBadge = (type?: string) => {
    const safeType = (type || 'apparel').toLowerCase();
    switch (safeType) {
      case 'apparel':
        return <Badge variant="primary">{t('sizeguides.typeApparelBadge')}</Badge>;
      case 'footwear':
        return <Badge variant="warning">{t('sizeguides.typeFootwearBadge')}</Badge>;
      case 'bags':
        return <Badge variant="info">{t('sizeguides.typeBagsBadge')}</Badge>;
      case 'accessories':
        return <Badge variant="success">{t('sizeguides.typeAccessoriesBadge')}</Badge>;
      default:
        return <Badge variant="neutral">{t('sizeguides.typeCustomBadge')}</Badge>;
    }
  };

  const filteredTemplates = (templates || []).filter((item) => {
    if (!item) return false;
    const nameStr = String(item.name || (item as any).title || '').toLowerCase();
    const descStr = String(item.description || '').toLowerCase();
    const query = (search || '').toLowerCase();
    const matchesSearch = !query || nameStr.includes(query) || descStr.includes(query);
    const tType = item.type || (item as any).template_type || 'apparel';
    const matchesType = selectedTypeFilter === 'all' || tType === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('sizeguides.title')}
        subtitle={t('sizeguides.subtitle')}
        action={
          <Button
            onClick={() => handleOpenTemplateModal()}
            icon={<Plus className="w-4 h-4" />}
          >
            {t('sizeguides.createTemplate')}
          </Button>
        }
      />

      {/* Main Grid: Left sidebar with templates list, Right area with interactive matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Templates Sidebar / List */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-neutral-800">
              <h3 className="font-bold text-slate-900 dark:text-neutral-100 text-sm flex items-center gap-2">
                <Ruler className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {t('sizeguides.templatesList')}
              </h3>
              <span className="text-xs text-slate-500 dark:text-neutral-400 font-mono font-medium">
                {filteredTemplates.length} {t('sizeguides.templatesCountSuffix')}
              </span>
            </div>

            {/* Filter controls */}
            <div className="space-y-2">
              <Input
                placeholder={t('sizeguides.searchTemplates')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
              <Select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                options={[
                  { value: 'all', label: t('sizeguides.allCategoriesFilter') },
                  { value: 'apparel', label: t('sizeguides.typeApparelBadge') },
                  { value: 'footwear', label: t('sizeguides.typeFootwearBadge') },
                  { value: 'bags', label: t('sizeguides.typeBagsBadge') },
                  { value: 'accessories', label: t('sizeguides.typeAccessoriesBadge') },
                  { value: 'custom', label: t('sizeguides.typeCustomBadge') },
                ]}
              />
            </div>

            {/* Template Items */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pt-1">
              {isLoading ? (
                <div className="p-6 text-center text-slate-400 dark:text-neutral-500 text-xs">{t('sizeguides.loadingTemplates')}</div>
              ) : filteredTemplates.length === 0 ? (
                <div className="p-6 text-center text-slate-400 dark:text-neutral-500 text-xs">{t('sizeguides.noTemplatesFound')}</div>
              ) : (
                filteredTemplates.map((tpl, tplIdx) => {
                  const isSelected = selectedTemplate?.id === tpl.id;
                  return (
                    <div
                      key={tpl.id ? `sg_tpl_${tpl.id}_${tplIdx}` : `sg_tpl_idx_${tplIdx}`}
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`p-3 rounded-xl border text-start cursor-pointer transition-all duration-150 ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 shadow-2xs'
                          : 'bg-white dark:bg-[#181a20] border-slate-100 dark:border-neutral-800 hover:border-slate-200 dark:hover:border-neutral-700 hover:bg-slate-50/60 dark:hover:bg-neutral-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-neutral-100 text-xs sm:text-sm truncate">
                          {tpl.name || (tpl as any).title || t('sizeguides.untitledTemplate')}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTemplateModal(tpl);
                            }}
                            className="p-1 hover:bg-slate-200/60 dark:hover:bg-neutral-700/60 rounded text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200"
                            title={t('sizeguides.editTemplate')}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(tpl.id);
                            }}
                            className="p-1 hover:bg-red-50 dark:hover:bg-red-950/40 rounded text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                            title={t('common.delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2">
                        {getTypeBadge(tpl.type || (tpl as any).template_type)}
                        <span className="text-[11px] font-mono text-slate-500 dark:text-neutral-400 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                          {t('sizeguides.unitPrefix')}: {tpl.unit || 'cm'}
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
            <Card className="p-12 text-center text-slate-400 dark:text-neutral-500">
              <Ruler className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-neutral-600 stroke-[1.5]" />
              <p className="font-medium text-sm">{t('sizeguides.selectTemplateHint')}</p>
            </Card>
          ) : (
            <>
              {/* Template Header Card */}
              <Card className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-neutral-800 pb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-neutral-100">{selectedTemplate.name || (selectedTemplate as any).title || t('sizeguides.defaultTemplateTitle')}</h2>
                      {getTypeBadge(selectedTemplate.type || (selectedTemplate as any).template_type)}
                      <Badge variant="neutral">{t('sizeguides.unitPrefix')} {selectedTemplate.unit || 'cm'}</Badge>
                    </div>
                    {selectedTemplate.description && (
                      <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">{selectedTemplate.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsPreviewModalOpen(true)}
                      icon={<Eye className="w-3.5 h-3.5" />}
                    >
                      {t('sizeguides.previewAndPrintCard')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenMeasModal()}
                      icon={<Plus className="w-3.5 h-3.5" />}
                    >
                      {t('sizeguides.addMeasurementParam')}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveMatrix}
                      isLoading={isSavingMatrix}
                      icon={<Check className="w-3.5 h-3.5" />}
                    >
                      {t('sizeguides.saveSizeMatrix')}
                    </Button>
                  </div>
                </div>

                {saveSuccessMsg && (
                  <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-center gap-2 animate-fade-in">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    {t('sizeguides.matrixSavedSuccess')}
                  </div>
                )}
              </Card>

              {/* Defined Measurements List */}
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 font-mono flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {t('sizeguides.definedMeasurements')} ({measurements.length})
                  </h4>
                </div>

                {measurements.length === 0 ? (
                  <div className="p-4 bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-2">
                    <span>{t('sizeguides.noMeasurementsAlert')}</span>
                    <Button size="sm" variant="outline" onClick={() => handleOpenMeasModal()}>
                      {t('sizeguides.defineFirstParam')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {measurements.map((m, mIdx) => (
                      <div
                        key={m.id ? `meas_badge_${m.id}_${mIdx}` : `meas_badge_idx_${mIdx}`}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-neutral-800 border border-slate-200/80 dark:border-neutral-700 text-slate-800 dark:text-neutral-200 text-xs"
                      >
                        <span className="font-bold">{m.name}</span>
                        {m.code && <span className="font-mono text-[10px] text-slate-500 dark:text-neutral-400">({m.code})</span>}
                        <span className="font-mono text-[10px] bg-white dark:bg-neutral-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300">
                          {m.unit}
                        </span>
                        <div className="flex items-center gap-0.5 ms-1 ps-1 border-s border-slate-300 dark:border-neutral-700">
                          <button
                            type="button"
                            onClick={() => handleOpenMeasModal(m)}
                            className="p-0.5 text-slate-400 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMeasurement(m.id)}
                            className="p-0.5 text-slate-400 dark:text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
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
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400 font-mono flex items-center gap-1.5">
                    <Table className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {t('sizeguides.smartSizeMatrix')}
                  </h4>
                  <span className="text-[11px] text-slate-400 dark:text-neutral-500">
                    {t('sizeguides.matrixUnitHint')}
                  </span>
                </div>

                {measurements.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 dark:text-neutral-500 text-xs">
                    {t('sizeguides.defineParamsFirst')}
                  </div>
                ) : sizes.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 dark:text-neutral-500 text-xs">
                    {t('sizeguides.noSizesFound')}
                  </div>
                ) : (
                  <div className="overflow-x-auto custom-scrollbar border border-slate-200 dark:border-neutral-800 rounded-xl">
                    <table className="w-full text-start text-xs">
                      <thead>
                        <tr className="bg-slate-100/80 dark:bg-neutral-800/80 border-b border-slate-200 dark:border-neutral-800 text-slate-700 dark:text-neutral-300 font-bold">
                          <th className="p-3 w-32 sticky start-0 bg-slate-100 dark:bg-neutral-800 z-10">{t('sizeguides.sizeNameCol')}</th>
                          {measurements.map((m, mIdx) => (
                            <th key={m.id ? `th_m_${m.id}_${mIdx}` : `th_m_idx_${mIdx}`} className="p-3 text-center min-w-[110px]">
                              <div>{m.name}</div>
                              <div className="text-[10px] text-slate-400 dark:text-neutral-500 font-normal font-mono">
                                ({m.unit})
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-neutral-800 bg-white dark:bg-[#13151a]">
                        {sizes.map((sz, szIdx) => (
                          <tr key={sz.id ? `tr_sz_${sz.id}_${szIdx}` : `tr_sz_idx_${szIdx}`} className="hover:bg-slate-50/60 dark:hover:bg-neutral-800/50 transition-colors">
                            <td className="p-3 font-bold text-slate-900 dark:text-neutral-100 sticky start-0 bg-white dark:bg-[#13151a] shadow-xs z-10">
                              <span className="px-2 py-1 bg-slate-100 dark:bg-neutral-800 rounded-md font-mono text-xs text-slate-800 dark:text-neutral-200">
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
                                    className="w-20 px-2 py-1 text-center font-mono text-xs border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#181a20] text-slate-900 dark:text-neutral-100 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
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
        title={editingTemplate ? t('sizeguides.editTemplate') : t('sizeguides.newTemplateModalTitle')}
      >
        <form onSubmit={handleSaveTemplate} className="space-y-4">
          <Input
            label={t('sizeguides.templateName')}
            placeholder={t('sizeguides.templateNamePlaceholder')}
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('sizeguides.templateTypeLabel')}
              value={tplType}
              onChange={(e) => setTplType(e.target.value as SizeGuideType)}
              options={[
                { value: 'apparel', label: t('sizeguides.typeApparelBadge') },
                { value: 'footwear', label: t('sizeguides.typeFootwearBadge') },
                { value: 'bags', label: t('sizeguides.typeBagsBadge') },
                { value: 'accessories', label: t('sizeguides.typeAccessoriesBadge') },
                { value: 'custom', label: t('sizeguides.typeCustomBadge') },
              ]}
            />

            <Select
              label={t('sizeguides.defaultUnitLabel')}
              value={tplUnit}
              onChange={(e) => setTplUnit(e.target.value as SizeUnit)}
              options={[
                { value: 'cm', label: t('sizeguides.unitCm') },
                { value: 'in', label: t('sizeguides.unitInch') },
                { value: 'mm', label: t('sizeguides.unitMm') },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">{t('sizeguides.measInstructionsLabel')}</label>
            <textarea
              rows={3}
              placeholder={t('sizeguides.measInstructionsPlaceholder')}
              value={tplDesc}
              onChange={(e) => setTplDesc(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#181a20] text-slate-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <Select
            label={t('products.productStatus')}
            value={tplStatus}
            onChange={(e) => setTplStatus(e.target.value as 'active' | 'inactive')}
            options={[
              { value: 'active', label: t('products.statusActive') },
              { value: 'inactive', label: t('products.statusInactive') },
            ]}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-neutral-800">
            <Button variant="outline" type="button" onClick={() => setIsTemplateModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isSavingTpl}>
              {editingTemplate ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create/Edit Measurement Parameter */}
      <Modal
        isOpen={isMeasModalOpen}
        onClose={() => setIsMeasModalOpen(false)}
        title={editingMeas ? t('sizeguides.editMeasurement') : t('sizeguides.newMeasurementModalTitle')}
      >
        <form onSubmit={handleSaveMeasurement} className="space-y-4">
          <Input
            label={t('sizeguides.paramNameLabel')}
            placeholder={t('sizeguides.paramNamePlaceholder')}
            value={measName}
            onChange={(e) => setMeasName(e.target.value)}
            required
          />

          <Input
            label={t('sizeguides.paramCodeLabel')}
            placeholder={t('sizeguides.paramCodePlaceholder')}
            value={measCode}
            onChange={(e) => setMeasCode(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('sizeguides.dimensionType')}
              value={measType}
              onChange={(e) => setMeasType(e.target.value as MeasurementType)}
              options={[
                { value: 'length', label: t('sizeguides.typeLength') },
                { value: 'width', label: t('sizeguides.typeWidth') },
                { value: 'height', label: t('sizeguides.typeHeight') },
                { value: 'depth', label: t('sizeguides.typeDepth') },
                { value: 'circumference', label: t('sizeguides.typeCircumference') },
                { value: 'weight', label: t('sizeguides.typeWeight') },
                { value: 'diameter', label: t('sizeguides.typeDiameter') },
                { value: 'custom', label: t('sizeguides.typeCustomBadge') },
              ]}
            />

            <Select
              label={t('sizeguides.dimensionUnit')}
              value={measUnit}
              onChange={(e) => setMeasUnit(e.target.value as MeasurementUnit)}
              options={[
                { value: 'cm', label: t('sizeguides.unitCm') },
                { value: 'in', label: t('sizeguides.unitInch') },
                { value: 'mm', label: t('sizeguides.unitMm') },
                { value: 'g', label: t('sizeguides.unitGram') },
                { value: 'kg', label: t('sizeguides.unitKg') },
              ]}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-neutral-800">
            <Button variant="outline" type="button" onClick={() => setIsMeasModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">
              {editingMeas ? t('common.save') : t('sizeguides.addMeasurementParam')}
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
