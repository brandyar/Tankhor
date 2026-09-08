import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Brand } from '../../types';
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
import { Award, Plus, Search, Edit, Trash2 } from 'lucide-react';

export const BrandsView: React.FC = () => {
  const { t } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [logo, setLogo] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);

  const loadBrands = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const list = await adapter.getBrands({ organization_id: activeOrganization?.id });
      setBrands(list);
    } catch (err) {
      console.error('[BrandsView] Error loading brands:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
  }, [activeOrganization]);

  const handleOpenModal = (brand?: Brand) => {
    if (brand) {
      setEditingBrand(brand);
      setName(brand.name);
      setCode(brand.code || '');
      setLogo(brand.logo || '');
      setDescription(brand.description || '');
      setStatus(brand.status === 'inactive' ? 'inactive' : 'active');
    } else {
      setEditingBrand(null);
      setName('');
      setCode('');
      setLogo('');
      setDescription('');
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

      await adapter.saveBrand({
        id: editingBrand?.id,
        organization_id: orgId,
        name,
        code,
        logo,
        description,
        status,
      });

      setIsModalOpen(false);
      await loadBrands();
    } catch (err) {
      console.error('[BrandsView] Error saving brand:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (await confirmAction(t('products.confirmDeleteBrand'))) {
      const adapter = storageManager.getAdapter();
      await adapter.deleteBrand(id);
      await loadBrands();
    }
  };

  const filtered = search.trim()
    ? brands.filter(
        (b) =>
          b.name.toLowerCase().includes(search.toLowerCase()) ||
          (b.code && b.code.toLowerCase().includes(search.toLowerCase()))
      )
    : brands;

  const columns: Column<Brand>[] = [
    {
      key: 'name',
      header: t('products.brandNameHeader'),
      render: (brand) => (
        <div className="flex items-center gap-3">
          {brand.logo ? (
            <img
              src={directusClient.getAssetUrl(brand.logo)}
              alt={brand.name}
              className="w-10 h-10 rounded-xl object-contain border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#181a20] p-1"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
          )}
          <div>
            <p className="font-extrabold text-slate-900 dark:text-neutral-100 text-sm">{brand.name}</p>
            {brand.code && <p className="text-xs text-slate-400 dark:text-neutral-500 font-mono">{t('products.brandCode')}: {brand.code}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: t('products.brandDescHeader'),
      render: (brand) => (
        <span className="text-xs text-slate-600 dark:text-neutral-300 line-clamp-1 max-w-xs">{brand.description || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: t('products.productStatus'),
      render: (brand) => (
        <Badge variant={brand.status === 'active' ? 'success' : 'neutral'}>
          {brand.status === 'active' ? t('products.statusActive') : t('products.statusInactive')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('products.brandsTitle')}
        subtitle={t('products.brandsSubtitle')}
        actions={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            {t('products.createBrand')}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder={t('products.searchBrands')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(brand) => brand.id}
          isLoading={isLoading}
          actions={(brand) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(brand)}
                icon={<Edit className="w-4 h-4 text-slate-600 dark:text-neutral-300" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                onClick={() => handleDelete(brand.id)}
                icon={<Trash2 className="w-4 h-4" />}
              />
            </div>
          )}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBrand ? t('products.editBrand') : t('products.createBrand')}
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="brand-form" isLoading={isSaving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="brand-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label={`${t('products.brandName')} *`}
            placeholder="مثال: Zara"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('products.brandCode')}
              placeholder="TNK"
              value={code}
              onChange={(e) => setCode(e.target.value)}
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

          <ImageUpload
            label={t('products.brandLogo')}
            value={logo}
            onChange={setLogo}
            helperText={t('products.brandLogoHelper')}
          />

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300">{t('products.brandDescLabel')}</label>
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
