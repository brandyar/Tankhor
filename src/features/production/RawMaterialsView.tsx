import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { storageManager } from '../../storage';
import { RawMaterial, RawMaterialCategory } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Tag,
} from 'lucide-react';

const MATERIAL_CATEGORIES: { key: RawMaterialCategory; label: string }[] = [
  { key: 'fabric', label: 'پارچه (متر / طاقه)' },
  { key: 'thread', label: 'نخ و دوک (عدد / کیلو)' },
  { key: 'zipper', label: 'زیپ و سرزیپ (عدد / متر)' },
  { key: 'button', label: 'دکمه (عدد / جین)' },
  { key: 'lining', label: 'لایی و آستر (متر)' },
  { key: 'label', label: 'مارک و لیبل (عدد)' },
  { key: 'packaging', label: 'کاور و بسته‌بندی (عدد)' },
  { key: 'other', label: 'سایر خرج‌کار' },
];

export const RawMaterialsView: React.FC = () => {
  const { t, isPersian } = useTranslation();
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    unit: 'متر',
    category: 'fabric' as RawMaterialCategory,
    current_stock: 0,
    min_stock: 10,
    unit_cost: 0,
    description: '',
  });

  const [stockAddAmount, setStockAddAmount] = useState<number>(10);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    setLoading(true);
    try {
      const list = await storageManager.getRawMaterials();
      setMaterials(list || []);
    } catch (err) {
      console.error('Error loading raw materials:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.code.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [materials, search, selectedCategory]);

  // Paginated slices
  const totalItems = filteredMaterials.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedMaterials = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMaterials.slice(start, start + pageSize);
  }, [filteredMaterials, currentPage, pageSize]);

  // Handle open modal for create/edit
  const handleOpenAddModal = () => {
    setSelectedMaterial(null);
    setFormData({
      name: '',
      code: `MAT-${Math.floor(100 + Math.random() * 900)}`,
      unit: 'متر',
      category: 'fabric',
      current_stock: 0,
      min_stock: 10,
      unit_cost: 0,
      description: '',
    });
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (item: RawMaterial) => {
    setSelectedMaterial(item);
    setFormData({
      name: item.name,
      code: item.code,
      unit: item.unit,
      category: item.category,
      current_stock: item.current_stock,
      min_stock: item.min_stock || 0,
      unit_cost: item.unit_cost,
      description: item.description || '',
    });
    setIsAddEditModalOpen(true);
  };

  const handleOpenStockModal = (item: RawMaterial) => {
    setSelectedMaterial(item);
    setStockAddAmount(10);
    setIsStockModalOpen(true);
  };

  const handleSaveMaterial = async () => {
    if (!formData.name.trim()) return;
    try {
      const payload: Partial<RawMaterial> = {
        id: selectedMaterial ? selectedMaterial.id : undefined,
        name: formData.name.trim(),
        code: formData.code.trim(),
        unit: formData.unit.trim(),
        category: formData.category,
        current_stock: Number(formData.current_stock),
        min_stock: Number(formData.min_stock),
        unit_cost: Number(formData.unit_cost),
        description: formData.description.trim(),
        status: 'active',
      };
      await storageManager.saveRawMaterial(payload);
      setIsAddEditModalOpen(false);
      await loadMaterials();
    } catch (err) {
      console.error('Error saving raw material:', err);
    }
  };

  const handleUpdateStock = async () => {
    if (!selectedMaterial) return;
    try {
      const newStock = selectedMaterial.current_stock + Number(stockAddAmount);
      await storageManager.saveRawMaterial({
        id: selectedMaterial.id,
        current_stock: Math.max(0, newStock),
      });
      setIsStockModalOpen(false);
      await loadMaterials();
    } catch (err) {
      console.error('Error updating stock:', err);
    }
  };

  const handleDeleteMaterial = async (id: number) => {
    if (window.confirm('آیا از حذف این متریال اطمینان دارید؟')) {
      try {
        await storageManager.deleteRawMaterial(id);
        await loadMaterials();
      } catch (err) {
        console.error('Error deleting material:', err);
      }
    }
  };

  const formatNum = (num: number) => (isPersian ? toPersianDigits(num) : num.toString());

  const getCategoryLabel = (catKey: string) => {
    const found = MATERIAL_CATEGORIES.find((c) => c.key === catKey);
    return found ? found.label.split(' ')[0] : catKey;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="انبار مواد اولیه و خرج‌کار"
        subtitle="ثبت موجودی پارچه، زیپ، نخ، دکمه، لایی و محاسبه بهای متریال مصرفی در تولید"
        action={
          <Button variant="primary" onClick={handleOpenAddModal} icon={<Plus className="w-4 h-4" />}>
            افزودن متریال جدید
          </Button>
        }
      />

      {/* Filter & Search Bar */}
      <Card className="p-4 bg-white dark:bg-[#13151a] border-neutral-200/80 dark:border-neutral-800/80">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input
              type="text"
              placeholder="جستجو بر اساس نام متریال یا کد شناسه..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="ps-9 w-full text-xs"
            />
          </div>

          <div className="w-full sm:w-64">
            <Select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs"
            >
              <option value="all">همه دسته‌بندی‌ها</option>
              {MATERIAL_CATEGORIES.map((cat) => (
                <option key={`mcat_opt_${cat.key}`} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Data Section */}
      {loading ? (
        <div className="py-12 text-center text-xs text-neutral-400">در حال دریافت داده‌های انبار...</div>
      ) : paginatedMaterials.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-neutral-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">هیچ متریالی یافت نشد.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Mobile Cards View (md:hidden) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {paginatedMaterials.map((mat) => {
              const isLow = mat.min_stock !== undefined && mat.current_stock <= (mat.min_stock || 0);
              return (
                <Card
                  key={`mat_mcard_${mat.id}`}
                  className={`p-4 border ${
                    isLow
                      ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20'
                      : 'border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#13151a]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-bold">
                        {mat.code}
                      </span>
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white mt-1">{mat.name}</h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5">{getCategoryLabel(mat.category)}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenStockModal(mat)}
                        title="افزایش موجودی"
                      >
                        <Plus className="w-3.5 h-3.5 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(mat)}>
                        <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteMaterial(mat.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                    <div>
                      <span className="text-[10px] text-neutral-400 block">موجودی فعلی:</span>
                      <span className={`font-bold font-mono ${isLow ? 'text-rose-600' : 'text-neutral-900 dark:text-white'}`}>
                        {formatNum(mat.current_stock)} {mat.unit}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-neutral-400 block">فی واحد:</span>
                      <span className="font-bold font-mono text-neutral-900 dark:text-white">
                        {formatCurrency(mat.unit_cost)}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#13151a] shadow-vercel-sm">
            <table className="w-full text-start text-xs">
              <thead className="bg-neutral-50 dark:bg-[#181a20] border-b border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold">
                <tr>
                  <th className="px-4 py-3 text-start">کد متریال</th>
                  <th className="px-4 py-3 text-start">عنوان متریال</th>
                  <th className="px-4 py-3 text-start">دسته‌بندی</th>
                  <th className="px-4 py-3 text-center">موجودی فعلی</th>
                  <th className="px-4 py-3 text-center">حداقل نقطه سفارش</th>
                  <th className="px-4 py-3 text-end">فی هر واحد (تومان)</th>
                  <th className="px-4 py-3 text-end">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {paginatedMaterials.map((mat) => {
                  const isLow = mat.min_stock !== undefined && mat.current_stock <= (mat.min_stock || 0);
                  return (
                    <tr key={`mat_drow_${mat.id}`} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40">
                      <td className="px-4 py-3 font-mono font-bold text-neutral-600 dark:text-neutral-400">
                        {mat.code}
                      </td>
                      <td className="px-4 py-3 font-bold text-neutral-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{mat.name}</span>
                          {isLow && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> کسری
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                        {getCategoryLabel(mat.category)}
                      </td>
                      <td className="px-4 py-3 text-center font-bold font-mono">
                        <span className={isLow ? 'text-rose-600 font-bold' : 'text-neutral-900 dark:text-white'}>
                          {formatNum(mat.current_stock)} {mat.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-neutral-500">
                        {formatNum(mat.min_stock || 0)} {mat.unit}
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-bold text-neutral-900 dark:text-white">
                        {formatCurrency(mat.unit_cost)}
                      </td>
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenStockModal(mat)}
                            className="text-emerald-600 hover:bg-emerald-50"
                          >
                            + موجودی
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(mat)}>
                            ویرایش
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteMaterial(mat.id)} className="text-rose-600">
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Component */}
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

      {/* Add / Edit Material Modal */}
      {isAddEditModalOpen && (
        <Modal
          isOpen={isAddEditModalOpen}
          onClose={() => setIsAddEditModalOpen(false)}
          title={selectedMaterial ? 'ویرایش متریال' : 'افزودن متریال / خرج‌کار جدید'}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">نام متریال *</label>
                <Input
                  type="text"
                  placeholder="مثال: پارچه کرپ مازراتی مشکی"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">کد شناسه متریال</label>
                <Input
                  type="text"
                  placeholder="MAT-001"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">دسته‌بندی</label>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as RawMaterialCategory })}
                >
                  {MATERIAL_CATEGORIES.map((cat) => (
                    <option key={`mform_cat_${cat.key}`} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">واحد سنجش</label>
                <Input
                  type="text"
                  placeholder="متر، کیلو، عدد، طاقه، جین..."
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">موجودی فعلی</label>
                <Input
                  type="number"
                  value={formData.current_stock}
                  onChange={(e) => setFormData({ ...formData, current_stock: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">حداقل نقطه سفارش</label>
                <Input
                  type="number"
                  value={formData.min_stock}
                  onChange={(e) => setFormData({ ...formData, min_stock: Number(e.target.value) })}
                />
              </div>

              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">فی واحد (تومان)</label>
                <Input
                  type="number"
                  value={formData.unit_cost}
                  onChange={(e) => setFormData({ ...formData, unit_cost: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">توضیحات تکمیلی</label>
              <Input
                type="text"
                placeholder="گرماژ، عرض پارچه، کد رنگ، برند تولیدکننده..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
              <Button variant="ghost" onClick={() => setIsAddEditModalOpen(false)}>
                انصراف
              </Button>
              <Button variant="primary" onClick={handleSaveMaterial}>
                ذخیره اطلاعات
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Stock Increase Modal */}
      {isStockModalOpen && selectedMaterial && (
        <Modal
          isOpen={isStockModalOpen}
          onClose={() => setIsStockModalOpen(false)}
          title={`افزایش موجودی: ${selectedMaterial.name}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-neutral-600 dark:text-neutral-400">
              موجودی فعلی:{' '}
              <strong className="text-neutral-900 dark:text-white font-mono">
                {formatNum(selectedMaterial.current_stock)} {selectedMaterial.unit}
              </strong>
            </p>

            <div>
              <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">
                مقدار افزایشی ({selectedMaterial.unit})
              </label>
              <Input
                type="number"
                value={stockAddAmount}
                onChange={(e) => setStockAddAmount(Number(e.target.value))}
              />
            </div>

            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-emerald-800 dark:text-emerald-300">
              موجودی نهایی پس از ثبت:{' '}
              <strong className="font-mono font-bold">
                {formatNum(selectedMaterial.current_stock + Number(stockAddAmount))} {selectedMaterial.unit}
              </strong>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <Button variant="ghost" onClick={() => setIsStockModalOpen(false)}>
                انصراف
              </Button>
              <Button variant="primary" onClick={handleUpdateStock}>
                ثبت افزایش موجودی
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
