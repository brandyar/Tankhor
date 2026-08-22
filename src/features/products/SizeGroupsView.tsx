import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { SizeGroup, SizeCategory } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Layers, Plus, Search, Edit, Trash2 } from 'lucide-react';

export const SizeGroupsView: React.FC = () => {
  const { t } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [groups, setGroups] = useState<SizeGroup[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SizeGroup | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<SizeCategory>('apparel');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);

  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const list = await adapter.getSizeGroups({ organization_id: activeOrganization?.id });
      setGroups(list);
    } catch (err) {
      console.error('[SizeGroupsView] Error loading size groups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, [activeOrganization]);

  const handleOpenModal = (group?: SizeGroup) => {
    if (group) {
      setEditingGroup(group);
      setName(group.name);
      setCategory(group.category || 'apparel');
      setStatus(group.status === 'inactive' ? 'inactive' : 'active');
    } else {
      setEditingGroup(null);
      setName('');
      setCategory('apparel');
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

      await adapter.saveSizeGroup({
        id: editingGroup?.id,
        organization_id: orgId,
        name,
        category,
        status,
      });

      setIsModalOpen(false);
      await loadGroups();
    } catch (err) {
      console.error('[SizeGroupsView] Error saving size group:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('آیا از حذف این گروه سایز مطمئن هستید؟')) {
      const adapter = storageManager.getAdapter();
      await adapter.deleteSizeGroup(id);
      await loadGroups();
    }
  };

  const filtered = search.trim()
    ? groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : groups;

  const categoryLabels: Record<SizeCategory, string> = {
    apparel: 'پوشاک و لباس',
    shoes: 'کفش و پاپوش',
    accessories: 'کیف و اکسسوری',
    other: 'سایر / متفرقه',
  };

  const columns: Column<SizeGroup>[] = [
    {
      key: 'name',
      header: 'نام گروه سایز',
      render: (group) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="font-extrabold text-slate-900 text-sm">{group.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'دسته‌بندی مرتبط',
      render: (group) => (
        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
          {categoryLabels[group.category] || group.category}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (group) => (
        <Badge variant={group.status === 'active' ? 'success' : 'neutral'}>
          {group.status === 'active' ? 'فعال' : 'غیرفعال'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت گروه‌های سایزبندی"
        subtitle="تعریف دسته‌بندی‌های کلی سایز مانند «سایز استاندارد پوشاک»، «کفش یورو»، «سایز بچگانه»"
        actions={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            افزودن گروه جدید
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder="جستجو در گروه‌های سایز..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(group) => group.id}
          isLoading={isLoading}
          actions={(group) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(group)}
                icon={<Edit className="w-4 h-4 text-slate-600" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDelete(group.id)}
                icon={<Trash2 className="w-4 h-4" />}
              />
            </div>
          )}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGroup ? 'ویرایش گروه سایز' : 'افزودن گروه سایز جدید'}
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="size-group-form" isLoading={isSaving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="size-group-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label="نام گروه سایزبندی *"
            placeholder="مثال: سایزبندی مردانه لباس یا یورو کفش"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="دسته‌بندی کلی *"
              value={category}
              onChange={(e) => setCategory(e.target.value as SizeCategory)}
              options={[
                { value: 'apparel', label: 'پوشاک و لباس' },
                { value: 'shoes', label: 'کفش و پاپوش' },
                { value: 'accessories', label: 'کیف و اکسسوری' },
                { value: 'other', label: 'سایر / متفرقه' },
              ]}
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
