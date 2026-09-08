import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Collection } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable, Column } from '../../components/ui/DataTable';
import { ImageUpload } from '../../components/ui/ImageUpload';
import { directusClient } from '../../api/directus';
import { confirmAction } from '../../utils/confirm';
import { Layers, Plus, Search, Edit, Trash2 } from 'lucide-react';

export const CollectionsView: React.FC = () => {
  const { t } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [collections, setCollections] = useState<Collection[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCol, setEditingCol] = useState<Collection | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [sort, setSort] = useState<number | ''>(0);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);

  const loadCollections = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const list = await adapter.getCollections({ organization_id: activeOrganization?.id });
      setCollections(list);
    } catch (err) {
      console.error('[CollectionsView] Error loading collections:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, [activeOrganization]);

  const handleOpenModal = (col?: Collection) => {
    if (col) {
      setEditingCol(col);
      setName(col.name);
      setSlug(col.slug || '');
      setImage(col.image || '');
      setDescription(col.description || '');
      setSort(col.sort !== undefined ? col.sort : 0);
      setStatus(col.status === 'inactive' ? 'inactive' : 'active');
    } else {
      setEditingCol(null);
      setName('');
      setSlug('');
      setImage('');
      setDescription('');
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
      const generatedSlug = slug.trim() || name.toLowerCase().replace(/\s+/g, '-');

      await adapter.saveCollection({
        id: editingCol?.id,
        organization_id: orgId,
        name,
        slug: generatedSlug,
        image,
        description,
        sort: sort !== '' ? Number(sort) : 0,
        status,
      });

      setIsModalOpen(false);
      await loadCollections();
    } catch (err) {
      console.error('[CollectionsView] Error saving collection:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (await confirmAction(t('products.confirmDeleteCollection'))) {
      const adapter = storageManager.getAdapter();
      await adapter.deleteCollection(id);
      await loadCollections();
    }
  };

  const filtered = search.trim()
    ? collections.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.slug && c.slug.toLowerCase().includes(search.toLowerCase()))
      )
    : collections;

  const columns: Column<Collection>[] = [
    {
      key: 'name',
      header: t('products.collectionNameHeader'),
      render: (col) => (
        <div className="flex items-center gap-3">
          {col.image ? (
            <img
              src={directusClient.getAssetUrl(col.image)}
              alt={col.name}
              className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-neutral-700"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
          )}
          <div>
            <p className="font-extrabold text-slate-900 dark:text-neutral-100 text-sm">{col.name}</p>
            <p className="text-xs text-slate-400 dark:text-neutral-500 font-mono">{col.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: t('products.description'),
      render: (col) => (
        <span className="text-xs text-slate-600 dark:text-neutral-300 line-clamp-1 max-w-xs">{col.description || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: t('products.productStatus'),
      render: (col) => (
        <Badge variant={col.status === 'active' ? 'success' : 'neutral'}>
          {col.status === 'active' ? t('products.statusActive') : t('products.statusInactive')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('products.collectionsTitle')}
        subtitle={t('products.collectionsSubtitle')}
        actions={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            {t('products.createCollection')}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder={t('products.searchCollections')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(col) => col.id}
          isLoading={isLoading}
          actions={(col) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(col)}
                icon={<Edit className="w-4 h-4 text-slate-600 dark:text-neutral-300" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                onClick={() => handleDelete(col.id)}
                icon={<Trash2 className="w-4 h-4" />}
              />
            </div>
          )}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCol ? t('products.editCollection') : t('products.createCollection')}
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="collection-form" isLoading={isSaving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="collection-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label={`${t('products.collectionName')} *`}
            placeholder="Spring/Summer"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('products.collectionSlug')}
              placeholder="spring-collection-2024"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <Input
              label={t('products.sizeOrder')}
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value ? Number(e.target.value) : '')}
            />
          </div>

          <ImageUpload
            label={t('products.collectionCover')}
            value={image}
            onChange={setImage}
            helperText={t('products.collectionCoverHelper')}
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

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300">{t('products.description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="..."
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
