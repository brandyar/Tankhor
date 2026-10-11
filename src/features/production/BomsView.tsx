import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { storageManager } from '../../storage';
import { BillOfMaterials, BomItem, RawMaterial, Product } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Edit2,
  Eye,
  Layers,
  Calculator,
  Shirt,
  Percent,
} from 'lucide-react';

export const BomsView: React.FC = () => {
  const { t, isPersian } = useTranslation();
  const [boms, setBoms] = useState<BillOfMaterials[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal & Drawer states
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedBom, setSelectedBom] = useState<BillOfMaterials | null>(null);

  // Form states for BOM Editor
  const [formData, setFormData] = useState({
    product_id: 0,
    name: '',
    version: 'v1.0',
    waste_percentage: 5,
    notes: '',
  });

  const [bomItems, setBomItems] = useState<{ raw_material_id: number; quantity_required: number; notes: string }[]>([
    { raw_material_id: 0, quantity_required: 1, notes: '' },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bomList, matList, prodList] = await Promise.all([
        storageManager.getBillOfMaterials(),
        storageManager.getRawMaterials(),
        storageManager.getProducts(),
      ]);
      setBoms(bomList || []);
      setMaterials(matList || []);
      setProducts(prodList || []);
    } catch (err) {
      console.error('Error loading BOMs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered BOM list
  const filteredBoms = useMemo(() => {
    return boms.filter((b) => {
      const pName = b.product_name || '';
      const bName = b.name || '';
      return (
        pName.toLowerCase().includes(search.toLowerCase()) ||
        bName.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [boms, search]);

  // Paginated BOMs
  const totalItems = filteredBoms.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedBoms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBoms.slice(start, start + pageSize);
  }, [filteredBoms, currentPage, pageSize]);

  // Open Editor Modal
  const handleOpenCreateModal = () => {
    setSelectedBom(null);
    setFormData({
      product_id: products[0]?.id || 0,
      name: products[0] ? `فرمول ساخت - ${products[0].title}` : 'فرمول ساخت جدید',
      version: 'v1.0',
      waste_percentage: 5,
      notes: '',
    });
    setBomItems([
      { raw_material_id: materials[0]?.id || 0, quantity_required: 1.5, notes: 'پارچه اصلی' },
    ]);
    setIsEditorModalOpen(true);
  };

  const handleOpenEditModal = (bom: BillOfMaterials) => {
    setSelectedBom(bom);
    setFormData({
      product_id: bom.product_id,
      name: bom.name,
      version: bom.version || 'v1.0',
      waste_percentage: bom.waste_percentage || 5,
      notes: bom.notes || '',
    });
    const items = bom.items && bom.items.length > 0
      ? bom.items.map((i) => ({
          raw_material_id: i.raw_material_id,
          quantity_required: i.quantity_required,
          notes: i.notes || '',
        }))
      : [{ raw_material_id: materials[0]?.id || 0, quantity_required: 1, notes: '' }];
    setBomItems(items);
    setIsEditorModalOpen(true);
  };

  const handleOpenDetails = (bom: BillOfMaterials) => {
    setSelectedBom(bom);
    setIsDetailsModalOpen(true);
  };

  // Calculate estimated unit cost live
  const calculatedEstimatedCost = useMemo(() => {
    let rawTotal = 0;
    bomItems.forEach((item) => {
      const mat = materials.find((m) => m.id === Number(item.raw_material_id));
      if (mat) {
        rawTotal += (mat.unit_cost || 0) * (Number(item.quantity_required) || 0);
      }
    });
    const wasteFactor = 1 + (Number(formData.waste_percentage) || 0) / 100;
    return rawTotal * wasteFactor;
  }, [bomItems, materials, formData.waste_percentage]);

  const handleAddItemRow = () => {
    setBomItems([
      ...bomItems,
      { raw_material_id: materials[0]?.id || 0, quantity_required: 1, notes: '' },
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (bomItems.length <= 1) return;
    setBomItems(bomItems.filter((_, idx) => idx !== index));
  };

  const handleSaveBom = async () => {
    if (!formData.product_id || !formData.name.trim()) return;
    try {
      const payload: Partial<BillOfMaterials> = {
        id: selectedBom ? selectedBom.id : undefined,
        product_id: Number(formData.product_id),
        name: formData.name.trim(),
        version: formData.version.trim(),
        waste_percentage: Number(formData.waste_percentage),
        notes: formData.notes.trim(),
        status: 'active',
      };
      await storageManager.saveBillOfMaterials(payload, bomItems);
      setIsEditorModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Error saving BOM:', err);
    }
  };

  const handleDeleteBom = async (id: number) => {
    if (window.confirm('آیا از حذف این فرمول ساخت اطمینان دارید؟')) {
      try {
        await storageManager.deleteBillOfMaterials(id);
        await loadData();
      } catch (err) {
        console.error('Error deleting BOM:', err);
      }
    }
  };

  const formatNum = (num: number) => (isPersian ? toPersianDigits(num) : num.toString());

  return (
    <div className="space-y-6">
      <PageHeader
        title="شناسنامه الگوی تولید و فرمول ساخت (BOM)"
        subtitle="تعریف متریال، پارچه و خرج‌کار لازم برای تولید هر عدد محصول همراه با محاسبه خودکار هزینه تولید"
        action={
          <Button variant="primary" onClick={handleOpenCreateModal} icon={<Plus className="w-4 h-4" />}>
            ایجاد فرمول ساخت جدید
          </Button>
        }
      />

      {/* Search Bar */}
      <Card className="p-4 bg-white dark:bg-[#13151a] border-neutral-200/80 dark:border-neutral-800/80">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            type="text"
            placeholder="جستجو بر اساس نام محصول یا فرمول ساخت..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="ps-9 w-full text-xs"
          />
        </div>
      </Card>

      {/* Data Section */}
      {loading ? (
        <div className="py-12 text-center text-xs text-neutral-400">در حال دریافت اطلاعات فرمول‌های ساخت...</div>
      ) : paginatedBoms.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-neutral-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">هیچ فرمول ساخت ثبت‌شده‌ای یافت نشد.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Mobile Cards View (md:hidden) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {paginatedBoms.map((bom) => (
              <Card
                key={`bom_mcard_${bom.id}`}
                className="p-4 bg-white dark:bg-[#13151a] border-neutral-200/80 dark:border-neutral-800/80"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 font-bold">
                      {bom.version || 'v1.0'}
                    </span>
                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white mt-1">{bom.name}</h4>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      محصول: {bom.product_name || `محصول کد ${bom.product_id}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenDetails(bom)} title="مشاهده جزییات">
                      <Eye className="w-3.5 h-3.5 text-neutral-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(bom)}>
                      <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteBom(bom.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                  <div>
                    <span className="text-[10px] text-neutral-400 block">درصد ضایعات:</span>
                    <span className="font-bold font-mono text-neutral-900 dark:text-white">
                      {formatNum(bom.waste_percentage || 0)}٪
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-neutral-400 block">هزینه تخمینی متریال:</span>
                    <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(bom.estimated_cost || 0)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#13151a] shadow-vercel-sm">
            <table className="w-full text-start text-xs">
              <thead className="bg-neutral-50 dark:bg-[#181a20] border-b border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold">
                <tr>
                  <th className="px-4 py-3 text-start">نسخه</th>
                  <th className="px-4 py-3 text-start">عنوان فرمول ساخت</th>
                  <th className="px-4 py-3 text-start">محصول مرتبط</th>
                  <th className="px-4 py-3 text-center">تعداد قلم متریال</th>
                  <th className="px-4 py-3 text-center">ضایعات</th>
                  <th className="px-4 py-3 text-end">هزینه متریال ۱ عدد</th>
                  <th className="px-4 py-3 text-end">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {paginatedBoms.map((bom) => (
                  <tr key={`bom_drow_${bom.id}`} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-neutral-600 dark:text-neutral-400">
                      {bom.version || 'v1.0'}
                    </td>
                    <td className="px-4 py-3 font-bold text-neutral-900 dark:text-white">{bom.name}</td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                      {bom.product_name || `محصول کد ${bom.product_id}`}
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold">
                      {formatNum(bom.items?.length || 0)} آیتم
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-neutral-500">
                      {formatNum(bom.waste_percentage || 0)}٪
                    </td>
                    <td className="px-4 py-3 text-end font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(bom.estimated_cost || 0)}
                    </td>
                    <td className="px-4 py-3 text-end whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenDetails(bom)}>
                          جزییات
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(bom)}>
                          ویرایش
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteBom(bom.id)} className="text-rose-600">
                          حذف
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* BOM Editor Modal */}
      {isEditorModalOpen && (
        <Modal
          isOpen={isEditorModalOpen}
          onClose={() => setIsEditorModalOpen(false)}
          title={selectedBom ? 'ویرایش فرمول ساخت (BOM)' : 'تعریف فرمول ساخت جدید (BOM)'}
        >
          <div className="space-y-4 text-xs max-h-[80vh] overflow-y-auto pe-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">محصول مرتبط *</label>
                <Select
                  value={formData.product_id}
                  onChange={(e) => {
                    const pid = Number(e.target.value);
                    const prod = products.find((p) => p.id === pid);
                    setFormData({
                      ...formData,
                      product_id: pid,
                      name: prod ? `فرمول ساخت - ${prod.title}` : formData.name,
                    });
                  }}
                >
                  {products.map((p) => (
                    <option key={`bform_p_${p.id}`} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">عنوان فرمول *</label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">نسخه / کد شناسه</label>
                <Input
                  type="text"
                  placeholder="v1.0"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">درصد ضایعات استاندارد (٪)</label>
                <Input
                  type="number"
                  placeholder="5"
                  value={formData.waste_percentage}
                  onChange={(e) => setFormData({ ...formData, waste_percentage: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Material Items Builder */}
            <div className="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <label className="block text-neutral-900 dark:text-white font-bold">
                  جدول متریال و خرج‌کار مصرفی (به ازای ۱ عدد لباس)
                </label>
                <Button variant="outline" size="sm" onClick={handleAddItemRow} icon={<Plus className="w-3 h-3" />}>
                  افزودن ردیف متریال
                </Button>
              </div>

              <div className="space-y-2">
                {bomItems.map((item, idx) => {
                  const selectedMat = materials.find((m) => m.id === Number(item.raw_material_id));
                  return (
                    <div
                      key={`bom_item_row_${idx}`}
                      className="p-3 bg-neutral-50 dark:bg-neutral-900/60 rounded-xl border border-neutral-200/80 dark:border-neutral-800 flex flex-col sm:flex-row items-center gap-2"
                    >
                      <div className="flex-1 w-full">
                        <label className="text-[10px] text-neutral-400 block mb-0.5">متریال / پارچه</label>
                        <Select
                          value={item.raw_material_id}
                          onChange={(e) => {
                            const newArr = [...bomItems];
                            newArr[idx].raw_material_id = Number(e.target.value);
                            setBomItems(newArr);
                          }}
                        >
                          {materials.map((m) => (
                            <option key={`bom_mopt_${m.id}`} value={m.id}>
                              {m.name} ({m.unit} - {formatCurrency(m.unit_cost)})
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div className="w-full sm:w-32">
                        <label className="text-[10px] text-neutral-400 block mb-0.5">
                          مقدار مصرف ({selectedMat?.unit || 'واحد'})
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity_required}
                          onChange={(e) => {
                            const newArr = [...bomItems];
                            newArr[idx].quantity_required = Number(e.target.value);
                            setBomItems(newArr);
                          }}
                        />
                      </div>

                      <div className="flex-1 w-full">
                        <label className="text-[10px] text-neutral-400 block mb-0.5">یادداشت کاربری</label>
                        <Input
                          type="text"
                          placeholder="مثال: آستر یا خرج‌کار یقه"
                          value={item.notes}
                          onChange={(e) => {
                            const newArr = [...bomItems];
                            newArr[idx].notes = e.target.value;
                            setBomItems(newArr);
                          }}
                        />
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="text-rose-600 self-end sm:self-center"
                        title="حذف ردیف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Estimated Total Live Calculation Box */}
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300 font-bold">
                  محاسبه تخمینی بهای متریال برای ۱ عدد لباس:
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                  شامل ضایعات {formatNum(formData.waste_percentage)}٪
                </p>
              </div>
              <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-300">
                {formatCurrency(calculatedEstimatedCost)}
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <Button variant="ghost" onClick={() => setIsEditorModalOpen(false)}>
                انصراف
              </Button>
              <Button variant="primary" onClick={handleSaveBom}>
                ذخیره فرمول ساخت
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* BOM Details Modal */}
      {isDetailsModalOpen && selectedBom && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={`شناسنامه تولید: ${selectedBom.name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-neutral-50 dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800">
              <div>
                <span className="text-neutral-400 block text-[10px]">محصول:</span>
                <span className="font-bold text-neutral-900 dark:text-white">
                  {selectedBom.product_name || `محصول کد ${selectedBom.product_id}`}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">هزینه تخمینی متریال:</span>
                <span className="font-bold font-mono text-emerald-600">
                  {formatCurrency(selectedBom.estimated_cost || 0)}
                </span>
              </div>
            </div>

            <h4 className="font-bold text-neutral-900 dark:text-white">ریز آیتم‌های مصرفی فرمول ساخت:</h4>

            <div className="space-y-2">
              {selectedBom.items?.map((item) => (
                <div
                  key={`bom_det_item_${item.id}`}
                  className="p-3 bg-white dark:bg-[#13151a] border border-neutral-200/80 dark:border-neutral-800 rounded-xl flex items-center justify-between"
                >
                  <div>
                    <h5 className="font-bold text-neutral-900 dark:text-white">
                      {item.raw_material?.name || `متریال کد ${item.raw_material_id}`}
                    </h5>
                    {item.notes && <p className="text-[10px] text-neutral-500 mt-0.5">{item.notes}</p>}
                  </div>
                  <span className="font-bold font-mono text-neutral-900 dark:text-white">
                    {formatNum(item.quantity_required)} {item.raw_material?.unit || 'واحد'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <Button variant="primary" onClick={() => setIsDetailsModalOpen(false)}>
                بستن
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
