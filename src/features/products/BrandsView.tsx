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
    if (confirm('آیا از حذف این برند مطمئن هستید؟')) {
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
      header: 'نام برند / مارک تجاری',
      render: (brand) => (
        <div className="flex items-center gap-3">
          {brand.logo ? (
            <img
              src={directusClient.getAssetUrl(brand.logo)}
              alt={brand.name}
              className="w-10 h-10 rounded-xl object-contain border border-slate-200 bg-white p-1"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
          )}
          <div>
            <p className="font-extrabold text-slate-900 text-sm">{brand.name}</p>
            {brand.code && <p className="text-xs text-slate-400 font-mono">کد: {brand.code}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'توضیحات برند',
      render: (brand) => (
        <span className="text-xs text-slate-600 line-clamp-1 max-w-xs">{brand.description || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (brand) => (
        <Badge variant={brand.status === 'active' ? 'success' : 'neutral'}>
          {brand.status === 'active' ? 'فعال' : 'غیرفعال'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت برندها و مارک‌ها (Brands)"
        subtitle="ثبت و مدیریت برندهای خارجی و داخلی تولیدی و تجاری پوشاک"
        actions={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            افزودن برند جدید
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder="جستجو در برندها..."
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
                icon={<Edit className="w-4 h-4 text-slate-600" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
        title={editingBrand ? 'ویرایش برند' : 'افزودن برند جدید'}
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
            label="نام برند *"
            placeholder="مثال: تن‌خور (TANKHOR) یا Zara"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="کد برند (Brand Code)"
              placeholder="TNK"
              value={code}
              onChange={(e) => setCode(e.target.value)}
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

          <ImageUpload
            label="لوگو / آیکون برند"
            value={logo}
            onChange={setLogo}
            helperText="تصویر لوگوی تجاری برند"
          />

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">توضیحات و اصالت برند</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-white border border-slate-300 rounded-xl text-slate-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="کشور سازنده، تاریخچه یا توضیحات برند..."
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
