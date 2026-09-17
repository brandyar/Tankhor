import React from 'react';
import { useTranslation } from '../../../i18n';
import { Brand, Collection, Season } from '../../../types';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { Plus, Tag } from 'lucide-react';

export type ProductStatus = 'published' | 'draft' | 'archived';

interface ProductGeneralSpecsCardProps {
  productId?: string | number;
  title: string;
  setTitle: (val: string) => void;
  slug: string;
  setSlug: (val: string) => void;
  categoryId: number | '';
  setCategoryId: (val: number | '') => void;
  categoryOptions: { value: number; label: string }[];
  onOpenAddCategory: () => void;
  collectionId: number | '';
  setCollectionId: (val: number | '') => void;
  collections: Collection[];
  onOpenAddCollection: () => void;
  seasonId: number | '';
  setSeasonId: (val: number | '') => void;
  seasons: Season[];
  onOpenAddSeason: () => void;
  brandId: number | '';
  setBrandId: (val: number | '') => void;
  brands: Brand[];
  onOpenAddBrand: () => void;
  sizeGuideTemplateId: number | '';
  setSizeGuideTemplateId: (val: number | '') => void;
  sizeGuides: any[];
  status: ProductStatus;
  setStatus: (val: ProductStatus) => void;
  tags: string;
  setTags: (val: string) => void;
  sort: number | '';
  setSort: (val: number | '') => void;
  description: string;
  setDescription: (val: string) => void;
  mainImage: string;
  setMainImage: (val: string) => void;
}

export const ProductGeneralSpecsCard: React.FC<ProductGeneralSpecsCardProps> = ({
  productId,
  title,
  setTitle,
  slug,
  setSlug,
  categoryId,
  setCategoryId,
  categoryOptions,
  onOpenAddCategory,
  collectionId,
  setCollectionId,
  collections,
  onOpenAddCollection,
  seasonId,
  setSeasonId,
  seasons,
  onOpenAddSeason,
  brandId,
  setBrandId,
  brands,
  onOpenAddBrand,
  sizeGuideTemplateId,
  setSizeGuideTemplateId,
  sizeGuides,
  status,
  setStatus,
  tags,
  setTags,
  sort,
  setSort,
  description,
  setDescription,
  mainImage,
  setMainImage,
}) => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';

  return (
    <Card title={t('products.productGeneralSpecs')}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={`${t('products.name')} *`}
              placeholder={t('products.productTitlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Input
              label={`${t('products.slugHeader')} *`}
              placeholder={t('products.slugPlaceholder')}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  {t('products.category')}
                </label>
                <button
                  type="button"
                  onClick={onOpenAddCategory}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t('products.newBadge')}</span>
                </button>
              </div>
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                options={[
                  { value: '', label: t('products.selectOption') },
                  ...categoryOptions,
                ]}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  {t('products.collection')}
                </label>
                <button
                  type="button"
                  onClick={onOpenAddCollection}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t('products.newBadge')}</span>
                </button>
              </div>
              <Select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value ? Number(e.target.value) : '')}
                options={[
                  { value: '', label: t('products.noCollection') },
                  ...collections.map((col) => ({ value: col.id, label: col.name })),
                ]}
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  {t('products.season')}
                </label>
                <button
                  type="button"
                  onClick={onOpenAddSeason}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t('products.newBadge')}</span>
                </button>
              </div>
              <Select
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value ? Number(e.target.value) : '')}
                options={[
                  { value: '', label: t('products.allSeasonsLabel') },
                  ...seasons.map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  {t('products.brand')}
                </label>
                <button
                  type="button"
                  onClick={onOpenAddBrand}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{t('products.newBadge')}</span>
                </button>
              </div>
              <Select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : '')}
                options={[
                  { value: '', label: t('products.noBrand') },
                  ...brands.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
            </div>
            <Select
              label={t('products.sizeGuide')}
              value={sizeGuideTemplateId}
              onChange={(e) => setSizeGuideTemplateId(e.target.value ? Number(e.target.value) : '')}
              options={[
                { value: '', label: t('products.noSizeGuide') },
                ...sizeGuides.map((sg: any) => ({
                  value: sg.id,
                  label: sg.name || sg.title || sg.template_name || `${isPersian ? 'قالب شماره' : 'Template #'} ${sg.id}`,
                })),
              ]}
            />
            <Select
              label={t('products.productStatus')}
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              options={[
                { value: 'published', label: t('products.statusPublished') },
                { value: 'draft', label: t('products.statusDraft') },
                { value: 'archived', label: t('products.statusArchived') },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('products.tags')}
              placeholder={t('products.tagsPlaceholder')}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              icon={<Tag className="w-4 h-4" />}
            />
            <Input
              label={t('products.sortOrderLabel')}
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value ? Number(e.target.value) : '')}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300">
              {t('products.descriptionLabel')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-neutral-100 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={t('products.descriptionPlaceholder')}
            />
          </div>
        </div>

        {/* Main Product Image Upload */}
        <div className="space-y-3 bg-slate-50 dark:bg-[#181a20] p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 transition-colors">
          <ImageUpload
            label={t('products.mainImageCatalog')}
            value={mainImage}
            onChange={setMainImage}
            helperText={t('products.mainImageCatalogHelper')}
            productId={productId ? Number(productId) : undefined}
          />
        </div>
      </div>
    </Card>
  );
};
