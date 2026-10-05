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
import { confirmAction } from '../../utils/confirm';

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
    if (await confirmAction(t('products.confirmDeleteSizeGroup'))) {
      const adapter = storageManager.getAdapter();
      await adapter.deleteSizeGroup(id);
      await loadGroups();
    }
  };

  const filtered = search.trim()
    ? groups.filter((g) => g.name.toLowerCase().includes(search.toLowerCase()))
    : groups;

  const categoryLabels: Record<SizeCategory, string> = {
    apparel: t('products.apparelCategory'),
    shoes: t('products.shoesCategory'),
    accessories: t('products.accessoriesCategory'),
    other: t('products.otherCategory'),
  };

  const columns: Column<SizeGroup>[] = [
    {
      key: 'name',
      header: t('products.groupName'),
      render: (group) => (
        <div>
          <p className="font-extrabold text-slate-900 dark:text-neutral-100 text-sm">{group.name}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: t('products.generalCategory'),
      render: (group) => (
        <span className="text-xs font-bold text-slate-700 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg">
          {categoryLabels[group.category] || group.category}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('products.productStatus'),
      render: (group) => (
        <Badge variant={group.status === 'active' ? 'success' : 'neutral'}>
          {group.status === 'active' ? t('products.statusActive') : t('products.statusInactive')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('products.sizeGroupsTitle')}
        subtitle={t('products.sizeGroupsSubtitle')}
        actions={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            {t('products.createSizeGroup')}
          </Button>
        }
      />

      <Card className="border-0 sm:border bg-transparent sm:bg-white dark:sm:bg-[#181a20] shadow-none sm:shadow-sm p-0 sm:p-5 md:p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder={t('products.searchSizeGroups')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* 1. Desktop Tabular View */}
        <div className="hidden md:block">
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
                  icon={<Edit className="w-4 h-4 text-slate-600 dark:text-neutral-300" />}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                  onClick={() => handleDelete(group.id)}
                  icon={<Trash2 className="w-4 h-4" />}
                />
              </div>
            )}
          />
        </div>

        {/* 2. Mobile Responsive Cards View */}
        <div className="block md:hidden space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 dark:text-neutral-500 text-sm">
              {t('common.loading')}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-neutral-500 text-sm">
              {t('common.noData')}
            </div>
          ) : (
            filtered.map((group) => (
              <div
                key={`mob_sgroup_${group.id}`}
                className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#13151a] p-4 shadow-sm space-y-3 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-neutral-100 text-sm">{group.name}</h3>
                  <Badge variant={group.status === 'active' ? 'success' : 'neutral'} className="shrink-0 text-[10px]">
                    {group.status === 'active' ? t('products.statusActive') : t('products.statusInactive')}
                  </Badge>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
                  <span className="font-semibold text-slate-700 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg">
                    {categoryLabels[group.category] || group.category}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-neutral-700 dark:text-neutral-300"
                      onClick={() => handleOpenModal(group)}
                      icon={<Edit className="w-3.5 h-3.5" />}
                    >
                      {t('common.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                      onClick={() => handleDelete(group.id)}
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingGroup ? t('products.editSizeGroup') : t('products.createSizeGroup')}
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
            label={`${t('products.groupName')} *`}
            placeholder="Men Clothing, EU Shoes..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label={`${t('products.generalCategory')} *`}
              value={category}
              onChange={(e) => setCategory(e.target.value as SizeCategory)}
              options={[
                { value: 'apparel', label: t('products.apparelCategory') },
                { value: 'shoes', label: t('products.shoesCategory') },
                { value: 'accessories', label: t('products.accessoriesCategory') },
                { value: 'other', label: t('products.otherCategory') },
              ]}
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
