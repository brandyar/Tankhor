import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Category, Collection, Season, Color, SizeGroup, Size, SizeCategory, Status } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable, Column } from '../../components/ui/DataTable';
import { toPersianDigits, formatDate } from '../../utils/formatters';
import { confirmAction } from '../../utils/confirm';
import { Layers, Bookmark, Sun, Palette, Tag, Plus, Trash2, Edit, Folder, CornerDownLeft, Calendar, Hash } from 'lucide-react';

interface AttributesViewProps {
  initialTab?: 'categories' | 'collections' | 'seasons' | 'colors' | 'size_groups' | 'sizes';
}

export const AttributesView: React.FC<AttributesViewProps> = ({ initialTab = 'categories' }) => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [activeTab, setActiveTab] = useState<'categories' | 'collections' | 'seasons' | 'colors' | 'size_groups' | 'sizes'>(initialTab);

  // Data States
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizeGroups, setSizeGroups] = useState<SizeGroup[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [hex, setHex] = useState('#000000');
  const [selectedParentId, setSelectedParentId] = useState<number | ''>('');
  const [selectedGroupId, setSelectedGroupId] = useState<number | ''>('');
  const [sizeCategory, setSizeCategory] = useState<SizeCategory>('apparel');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sort, setSort] = useState<number | ''>(0);
  const [status, setStatus] = useState<Status>('active');
  const [isSaving, setIsSaving] = useState(false);

  const isPersian = locale === 'fa';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [catList, colList, seaList, colorList, groupList, sizeList] = await Promise.all([
        adapter.getCategories({ organization_id: orgId }),
        adapter.getCollections({ organization_id: orgId }),
        adapter.getSeasons({ organization_id: orgId }),
        adapter.getColors({ organization_id: orgId }),
        adapter.getSizeGroups({ organization_id: orgId }),
        adapter.getSizes({ organization_id: orgId }),
      ]);
      setCategories(catList);
      setCollections(colList);
      setSeasons(seaList);
      setColors(colorList);
      setSizeGroups(groupList);
      setSizes(sizeList);
    } catch (err) {
      console.error('[AttributesView] Error loading taxonomy:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  const handleOpenModal = (itemToEdit?: any) => {
    if (itemToEdit) {
      setEditingId(itemToEdit.id);
      setName(itemToEdit.name || '');
      setCode(itemToEdit.code || '');
      setSlug(itemToEdit.slug || '');
      setDescription(itemToEdit.description || '');
      setHex(itemToEdit.hex || '#000000');
      setSelectedParentId(
        typeof itemToEdit.parent_id === 'number'
          ? itemToEdit.parent_id
          : itemToEdit.parent_id?.id || ''
      );
      setSelectedGroupId(
        typeof itemToEdit.size_group_id === 'number'
          ? itemToEdit.size_group_id
          : itemToEdit.size_group_id?.id || ''
      );
      setSizeCategory(itemToEdit.category || 'apparel');
      setStartDate(itemToEdit.start_date || '');
      setEndDate(itemToEdit.end_date || '');
      setSort(itemToEdit.sort !== undefined ? itemToEdit.sort : 0);
      setStatus(itemToEdit.status || 'active');
    } else {
      setEditingId(null);
      setName('');
      setCode('');
      setSlug('');
      setDescription('');
      setHex('#000000');
      setSelectedParentId('');
      setSelectedGroupId(sizeGroups.length > 0 ? sizeGroups[0].id : '');
      setSizeCategory('apparel');
      setStartDate('');
      setEndDate('');
      setSort(0);
      setStatus('active');
    }
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;

      if (activeTab === 'categories') {
        await adapter.saveCategory({
          id: editingId || undefined,
          organization_id: orgId,
          name,
          slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
          parent_id: selectedParentId ? Number(selectedParentId) : null,
          status,
        });
      } else if (activeTab === 'collections') {
        await adapter.saveCollection({
          id: editingId || undefined,
          organization_id: orgId,
          name,
          slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
          description,
          status,
        });
      } else if (activeTab === 'seasons') {
        await adapter.saveSeason({
          id: editingId || undefined,
          organization_id: orgId,
          name,
          code: code || name.slice(0, 3).toUpperCase(),
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          status,
        });
      } else if (activeTab === 'colors') {
        await adapter.saveColor({
          id: editingId || undefined,
          organization_id: orgId,
          name,
          code: code || name.slice(0, 3).toUpperCase(),
          hex,
          status,
        });
      } else if (activeTab === 'size_groups') {
        await adapter.saveSizeGroup({
          id: editingId || undefined,
          organization_id: orgId,
          name,
          category: sizeCategory,
          status,
        });
      } else if (activeTab === 'sizes') {
        await adapter.saveSize({
          id: editingId || undefined,
          organization_id: orgId,
          size_group_id: selectedGroupId ? Number(selectedGroupId) : undefined,
          name,
          code: code || name,
          sort: sort !== '' ? Number(sort) : 0,
          status,
        });
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('[AttributesView] Failed to save attribute:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!(await confirmAction('آیا از حذف این آیتم اطمینان دارید؟'))) return;
    const adapter = storageManager.getAdapter();

    if (activeTab === 'categories') await adapter.deleteCategory(id);
    await loadData();
  };

  // Build Hierarchical Tree for Categories
  const getCategoryTree = () => {
    const parentMap = new Map<number | null, Category[]>();
    categories.forEach((cat) => {
      const pId = typeof cat.parent_id === 'number' ? cat.parent_id : cat.parent_id?.id || null;
      if (!parentMap.has(pId)) parentMap.set(pId, []);
      parentMap.get(pId)!.push(cat);
    });

    const tree: { item: Category; level: number; parentName?: string }[] = [];

    const traverse = (pId: number | null, level: number, parentName?: string) => {
      const children = parentMap.get(pId) || [];
      children.forEach((child) => {
        tree.push({ item: child, level, parentName });
        traverse(child.id, level + 1, child.name);
      });
    };

    traverse(null, 0);
    return tree;
  };

  const categoryTreeData = getCategoryTree();

  const tabs = [
    { key: 'categories', label: t('navigation.categories'), icon: Layers },
    { key: 'collections', label: t('navigation.collections'), icon: Bookmark },
    { key: 'seasons', label: t('navigation.seasons'), icon: Sun },
    { key: 'colors', label: t('navigation.colors'), icon: Palette },
    { key: 'size_groups', label: 'گروه‌های سایزبندی', icon: Folder },
    { key: 'sizes', label: t('navigation.sizes'), icon: Tag },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="دسته‌بندی‌ها و ویژگی‌های کاتالوگ"
        subtitle="مدیریت ساختار درختی دسته‌بندی‌ها، مجموعه‌ها، فصل‌ها، رنگ‌ها و گروه‌های سایزبندی"
        action={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            تعریف آیتم جدید
          </Button>
        }
      />

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <Card>
        {/* Categories Tab with Hierarchical Tree Indentation */}
        {activeTab === 'categories' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">عنوان و درخت دسته‌بندی</th>
                  <th className="p-3">اسلاگ (Slug)</th>
                  <th className="p-3">دسته والد (Parent)</th>
                  <th className="p-3">وضعیت</th>
                  <th className="p-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categoryTreeData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center p-8 text-slate-400">
                      هیچ دسته‌بندی تعریف نشده است.
                    </td>
                  </tr>
                ) : (
                  categoryTreeData.map(({ item, level, parentName }, catIdx) => (
                    <tr key={`attr_cat_${item.id}_${catIdx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        <div
                          className="flex items-center gap-2"
                          style={{ paddingRight: `${level * 24}px` }}
                        >
                          {level > 0 ? (
                            <CornerDownLeft className="w-4 h-4 text-indigo-400 shrink-0" />
                          ) : (
                            <Folder className="w-4 h-4 text-indigo-600 shrink-0" />
                          )}
                          <span
                            className={`font-bold ${
                              level === 0
                                ? 'text-slate-900 text-sm'
                                : level === 1
                                ? 'text-slate-800'
                                : 'text-slate-600'
                            }`}
                          >
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 font-mono text-slate-500">{item.slug}</td>
                      <td className="p-3">
                        {parentName ? (
                          <Badge variant="neutral">{parentName}</Badge>
                        ) : (
                          <span className="text-slate-400 font-medium">ریشه اصلی (Root)</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant={item.status === 'active' ? 'success' : 'danger'}>
                          {item.status === 'active' ? 'فعال' : 'غیرفعال'}
                        </Badge>
                      </td>
                      <td className="p-3 text-left">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenModal(item)}
                            icon={<Edit className="w-3.5 h-3.5" />}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteItem(item.id)}
                            icon={<Trash2 className="w-3.5 h-3.5" />}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Collections Tab */}
        {activeTab === 'collections' && (
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'عنوان مجموعه',
                render: (col: Collection) => (
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{col.name}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{col.description || 'بدون توضیح'}</p>
                  </div>
                ),
              },
              { key: 'slug', header: 'اسلاگ (Slug)', render: (col) => <span className="font-mono text-slate-500">{col.slug}</span> },
              {
                key: 'status',
                header: 'وضعیت',
                render: (col) => (
                  <Badge variant={col.status === 'active' ? 'success' : 'danger'}>
                    {col.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </Badge>
                ),
              },
            ]}
            data={collections}
            keyExtractor={(col) => col.id}
            isLoading={isLoading}
            actions={(col) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(col)}
                icon={<Edit className="w-3.5 h-3.5" />}
              />
            )}
          />
        )}

        {/* Seasons Tab */}
        {activeTab === 'seasons' && (
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'نام فصل',
                render: (s: Season) => (
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{s.name}</p>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">کد: {s.code || '-'}</p>
                  </div>
                ),
              },
              {
                key: 'start_date',
                header: 'تاریخ شروع',
                render: (s) => (
                  <span className="text-slate-600 text-xs">
                    {s.start_date ? formatDate(s.start_date, isPersian) : '-'}
                  </span>
                ),
              },
              {
                key: 'end_date',
                header: 'تاریخ پایان',
                render: (s) => (
                  <span className="text-slate-600 text-xs">
                    {s.end_date ? formatDate(s.end_date, isPersian) : '-'}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'وضعیت',
                render: (s) => (
                  <Badge variant={s.status === 'active' ? 'success' : 'danger'}>
                    {s.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </Badge>
                ),
              },
            ]}
            data={seasons}
            keyExtractor={(s) => s.id}
            isLoading={isLoading}
            actions={(s) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(s)}
                icon={<Edit className="w-3.5 h-3.5" />}
              />
            )}
          />
        )}

        {/* Colors Tab */}
        {activeTab === 'colors' && (
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'نام رنگ',
                render: (col: Color) => (
                  <div className="flex items-center gap-3">
                    <span
                      className="w-5 h-5 rounded-full border border-slate-300 shadow-2xs shrink-0"
                      style={{ backgroundColor: col.hex || '#000000' }}
                    />
                    <span className="font-bold text-slate-900 text-sm">{col.name}</span>
                  </div>
                ),
              },
              { key: 'code', header: 'کد اختصاری', render: (col) => <span className="font-mono text-slate-600">{col.code || '-'}</span> },
              { key: 'hex', header: 'کد HEX', render: (col) => <span className="font-mono text-slate-500">{col.hex || '#000000'}</span> },
              {
                key: 'status',
                header: 'وضعیت',
                render: (col) => (
                  <Badge variant={col.status === 'active' ? 'success' : 'danger'}>
                    {col.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </Badge>
                ),
              },
            ]}
            data={colors}
            keyExtractor={(col) => col.id}
            isLoading={isLoading}
            actions={(col) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(col)}
                icon={<Edit className="w-3.5 h-3.5" />}
              />
            )}
          />
        )}

        {/* Size Groups Tab */}
        {activeTab === 'size_groups' && (
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'عنوان گروه سایز',
                render: (grp: SizeGroup) => <span className="font-bold text-slate-900 text-sm">{grp.name}</span>,
              },
              {
                key: 'category',
                header: 'دسته‌بندی سایز',
                render: (grp) => {
                  const labels: Record<SizeCategory, string> = {
                    apparel: 'پوشاک (Apparel)',
                    shoes: 'کفش (Footwear)',
                    accessories: 'اکسسوری و کیف',
                    other: 'سایر',
                  };
                  return <Badge variant="info">{labels[grp.category] || grp.category}</Badge>;
                },
              },
              {
                key: 'status',
                header: 'وضعیت',
                render: (grp) => (
                  <Badge variant={grp.status === 'active' ? 'success' : 'danger'}>
                    {grp.status === 'active' ? 'فعال' : 'غیرفعال'}
                  </Badge>
                ),
              },
            ]}
            data={sizeGroups}
            keyExtractor={(grp) => grp.id}
            isLoading={isLoading}
            actions={(grp) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(grp)}
                icon={<Edit className="w-3.5 h-3.5" />}
              />
            )}
          />
        )}

        {/* Sizes Tab */}
        {activeTab === 'sizes' && (
          <DataTable
            columns={[
              {
                key: 'name',
                header: 'عنوان سایز',
                render: (s: Size) => <span className="font-bold text-slate-900 text-sm">{s.name}</span>,
              },
              { key: 'code', header: 'کد اختصاری', render: (s) => <span className="font-mono text-slate-600">{s.code || '-'}</span> },
              {
                key: 'size_group_id',
                header: 'گروه سایزبندی',
                render: (s: Size) => {
                  const gId = typeof s.size_group_id === 'number' ? s.size_group_id : s.size_group_id?.id;
                  const grp = sizeGroups.find((g) => g.id === gId);
                  return <span className="font-medium text-slate-700">{grp?.name || 'استاندارد'}</span>;
                },
              },
              {
                key: 'sort',
                header: 'ترتیب نمایش',
                render: (s) => <span className="font-mono text-slate-500">{toPersianDigits(s.sort ?? 0)}</span>,
              },
            ]}
            data={sizes}
            keyExtractor={(s) => s.id}
            isLoading={isLoading}
            actions={(s) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(s)}
                icon={<Edit className="w-3.5 h-3.5" />}
              />
            )}
          />
        )}
      </Card>

      {/* Modal Form */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingId
            ? 'ویرایش ویژگی'
            : activeTab === 'categories'
            ? 'تعریف دسته‌بندی جدید'
            : activeTab === 'collections'
            ? 'تعریف مجموعه جدید'
            : activeTab === 'seasons'
            ? 'تعریف فصل جدید'
            : activeTab === 'colors'
            ? 'تعریف رنگ جدید'
            : activeTab === 'size_groups'
            ? 'تعریف گروه سایز جدید'
            : 'تعریف سایز جدید'
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="attribute-modal-form" isLoading={isSaving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="attribute-modal-form" onSubmit={handleSaveItem} className="space-y-4">
          <Input
            label="عنوان / نام *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {/* Categories Modal Options */}
          {activeTab === 'categories' && (
            <>
              <Input
                label="اسلاگ (Slug)"
                placeholder="men-jackets"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
              <Select
                label="دسته والد (Parent Category)"
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value ? Number(e.target.value) : '')}
                options={[
                  { value: '', label: 'ریشه اصلی (بدون دسته والد)' },
                  ...categories
                    .filter((c) => c.id !== editingId)
                    .map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </>
          )}

          {/* Collections Modal Options */}
          {activeTab === 'collections' && (
            <>
              <Input
                label="اسلاگ (Slug)"
                placeholder="summer-vibes"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">توضیحات مجموعه</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-white border border-slate-300 rounded-xl text-slate-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="مجموعه تابستانه محصولات چرمی..."
                />
              </div>
            </>
          )}

          {/* Seasons Modal Options */}
          {activeTab === 'seasons' && (
            <>
              <Input
                label="کد فصل"
                placeholder="SS26"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="تاریخ شروع"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  label="تاریخ پایان"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Colors Modal Options */}
          {activeTab === 'colors' && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="کد اختصاری (کد سه‌حرفی)"
                placeholder="BLK"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">انتخاب رنگ (Hex)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={hex}
                    onChange={(e) => setHex(e.target.value)}
                    className="w-12 h-10 border border-slate-300 rounded-xl cursor-pointer p-1"
                  />
                  <Input value={hex} onChange={(e) => setHex(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Size Groups Modal Options */}
          {activeTab === 'size_groups' && (
            <Select
              label="نوع و دسته‌بندی سایز *"
              value={sizeCategory}
              onChange={(e) => setSizeCategory(e.target.value as SizeCategory)}
              options={[
                { value: 'apparel', label: 'پوشاک (Apparel)' },
                { value: 'shoes', label: 'کفش (Footwear)' },
                { value: 'accessories', label: 'اکسسوری و کیف' },
                { value: 'other', label: 'سایر' },
              ]}
            />
          )}

          {/* Sizes Modal Options */}
          {activeTab === 'sizes' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="کد اختصاری (مثال: XL یا 42)"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Input
                  label="ترتیب نمایش (Sort Order)"
                  type="number"
                  value={sort}
                  onChange={(e) => setSort(e.target.value ? Number(e.target.value) : '')}
                />
              </div>
              <Select
                label="گروه سایزبندی *"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value ? Number(e.target.value) : '')}
                options={sizeGroups.map((g) => ({ value: g.id, label: g.name }))}
                required
              />
            </div>
          )}

          <Select
            label="وضعیت فعالیت *"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            options={[
              { value: 'active', label: 'فعال' },
              { value: 'inactive', label: 'غیرفعال' },
            ]}
          />
        </form>
      </Modal>
    </div>
  );
};
