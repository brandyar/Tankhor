import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Size, SizeGroup } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Tag, Plus, Search, Edit, Trash2 } from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';

export const SizesView: React.FC = () => {
  const { t } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [sizes, setSizes] = useState<Size[]>([]);
  const [sizeGroups, setSizeGroups] = useState<SizeGroup[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<Size | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sizeGroupId, setSizeGroupId] = useState<number | ''>('');
  const [sort, setSort] = useState<number | ''>(0);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [sList, gList] = await Promise.all([
        adapter.getSizes({ organization_id: orgId }),
        adapter.getSizeGroups({ organization_id: orgId }),
      ]);
      setSizes(sList);
      setSizeGroups(gList);
    } catch (err) {
      console.error('[SizesView] Error loading sizes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  const handleOpenModal = (size?: Size) => {
    if (size) {
      setEditingSize(size);
      setName(size.name);
      setCode(size.code || '');
      const sgId = typeof size.size_group_id === 'number' ? size.size_group_id : size.size_group_id?.id || '';
      setSizeGroupId(sgId);
      setSort(size.sort !== undefined ? size.sort : 0);
      setStatus(size.status === 'inactive' ? 'inactive' : 'active');
    } else {
      setEditingSize(null);
      setName('');
      setCode('');
      setSizeGroupId(selectedGroupFilter || (sizeGroups[0]?.id || ''));
      setSort(0);
      setStatus('active');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;

      await adapter.saveSize({
        id: editingSize?.id,
        organization_id: orgId,
        name,
        code: code || name,
        size_group_id: sizeGroupId ? Number(sizeGroupId) : undefined,
        sort: sort !== '' ? Number(sort) : 0,
        status,
      });

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('[SizesView] Error saving size:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('آیا از حذف این سایز مطمئن هستید؟')) {
      const adapter = storageManager.getAdapter();
      await adapter.deleteSize(id);
      await loadData();
    }
  };

  const filtered = sizes.filter((s) => {
    const sgId = typeof s.size_group_id === 'number' ? s.size_group_id : s.size_group_id?.id;
    if (selectedGroupFilter && sgId !== Number(selectedGroupFilter)) {
      return false;
    }
    if (search.trim()) {
      const term = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(term) ||
        (s.code && s.code.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const columns: Column<Size>[] = [
    {
      key: 'name',
      header: 'عنوان سایز',
      render: (size) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
            <Tag className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <p className="font-extrabold text-slate-900 text-sm">{size.name}</p>
            {size.code && <p className="text-xs text-slate-400 font-mono">کد: {size.code}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'size_group_id',
      header: 'گروه سایز مرتبط',
      render: (size) => {
        const sgId = typeof size.size_group_id === 'number' ? size.size_group_id : size.size_group_id?.id;
        const group = sizeGroups.find((g) => g.id === sgId);
        return (
          <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
            {group?.name || '-'}
          </span>
        );
      },
    },
    {
      key: 'sort',
      header: 'ترتیب نمایش',
      render: (size) => (
        <span className="font-mono text-xs font-bold text-slate-600">
          {toPersianDigits(size.sort || 0)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (size) => (
        <Badge variant={size.status === 'active' ? 'success' : 'neutral'}>
          {size.status === 'active' ? 'فعال' : 'غیرفعال'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت مقادیر سایز (Sizes)"
        subtitle="تعریف سایزهای انفرادی نظیر S, M, L, XL یا ۴۰، ۴۱، ۴۲ و تخصیص به گروه‌های سایز"
        actions={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            افزودن سایز جدید
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder="جستجو در سایزها..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="w-full sm:w-64">
            <Select
              value={selectedGroupFilter}
              onChange={(e) => setSelectedGroupFilter(e.target.value ? Number(e.target.value) : '')}
              options={[
                { value: '', label: 'همه گروه‌های سایز' },
                ...sizeGroups.map((g) => ({ value: g.id, label: g.name })),
              ]}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(size) => size.id}
          isLoading={isLoading}
          actions={(size) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(size)}
                icon={<Edit className="w-4 h-4 text-slate-600" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDelete(size.id)}
                icon={<Trash2 className="w-4 h-4" />}
              />
            </div>
          )}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSize ? 'ویرایش سایز' : 'افزودن سایز جدید'}
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="size-form" isLoading={isSaving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="size-form" onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="عنوان سایز *"
              placeholder="مثال: Medium یا 42"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="کد سایز (Short Code)"
              placeholder="M"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <Select
            label="گروه سایز مرتبط *"
            value={sizeGroupId}
            onChange={(e) => setSizeGroupId(e.target.value ? Number(e.target.value) : '')}
            options={[
              { value: '', label: 'انتخاب گروه سایز...' },
              ...sizeGroups.map((g) => ({ value: g.id, label: g.name })),
            ]}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="ترتیب نمایش (Sort)"
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value ? Number(e.target.value) : '')}
            />
            <Select
              label="وضعیت"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              options={[
                { value: 'active', label: 'فعال' },
                { value: 'inactive', label: 'غیرفعال' },
              ]}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
