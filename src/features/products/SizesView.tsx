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
import { confirmAction } from '../../utils/confirm';

export const SizesView: React.FC = () => {
  const { t, isPersian } = useTranslation();
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
    if (await confirmAction(t('products.confirmDeleteSize'))) {
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
      header: t('products.sizeNameHeader'),
      render: (size) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 flex items-center justify-center font-bold text-xs">
            <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="font-extrabold text-slate-900 dark:text-neutral-100 text-sm">{size.name}</p>
            {size.code && <p className="text-xs text-slate-400 dark:text-neutral-500 font-mono">{t('products.sizeCode')}: {size.code}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'size_group_id',
      header: t('products.sizeGroupHeader'),
      render: (size) => {
        const sgId = typeof size.size_group_id === 'number' ? size.size_group_id : size.size_group_id?.id;
        const group = sizeGroups.find((g) => g.id === sgId);
        return (
          <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
            {group?.name || '-'}
          </span>
        );
      },
    },
    {
      key: 'sort',
      header: t('products.sizeOrder'),
      render: (size) => (
        <span className="font-mono text-xs font-bold text-slate-600 dark:text-neutral-300">
          {isPersian ? toPersianDigits(size.sort || 0) : size.sort || 0}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('products.productStatus'),
      render: (size) => (
        <Badge variant={size.status === 'active' ? 'success' : 'neutral'}>
          {size.status === 'active' ? t('products.statusActive') : t('products.statusInactive')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('products.sizesTitle')}
        subtitle={t('products.sizesSubtitle')}
        actions={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            {t('products.createSize')}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder={t('products.searchSizes')}
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
                { value: '', label: t('products.allSizeGroups') },
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
                icon={<Edit className="w-4 h-4 text-slate-600 dark:text-neutral-300" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
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
        title={editingSize ? t('products.editSize') : t('products.createSize')}
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
              label={`${t('products.sizeName')} *`}
              placeholder="Medium, 42, XL..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label={t('products.sizeCode')}
              placeholder="M"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <Select
            label={`${t('products.sizeGroupHeader')} *`}
            value={sizeGroupId}
            onChange={(e) => setSizeGroupId(e.target.value ? Number(e.target.value) : '')}
            options={[
              { value: '', label: t('products.selectSizeGroup') },
              ...sizeGroups.map((g) => ({ value: g.id, label: g.name })),
            ]}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('products.sizeOrder')}
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value ? Number(e.target.value) : '')}
            />
            <Select
              label={t('products.productStatus')}
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              options={[
                { value: 'active', label: t('products.statusActive') },
                { value: 'inactive', label: t('products.statusInactive') },
              ]}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
