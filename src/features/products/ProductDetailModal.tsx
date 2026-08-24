import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Product, ProductVariant, Category, Collection, Season, SizeGuideTemplate, Brand } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { ImageUpload } from '../../components/ui/ImageUpload';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import { Image, Shirt, Plus, Trash2, Tag, Layers, Sun } from 'lucide-react';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  categories: Category[];
  collections: Collection[];
  seasons: Season[];
  sizeGuides: SizeGuideTemplate[];
  onSaved: () => void;
  onOpenMatrix: (product: Product) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  product,
  categories,
  collections,
  seasons,
  sizeGuides,
  onSaved,
  onOpenMatrix,
}) => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [brandId, setBrandId] = useState<number | ''>('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [collectionId, setCollectionId] = useState<number | ''>('');
  const [seasonId, setSeasonId] = useState<number | ''>('');
  const [sizeGuideTemplateId, setSizeGuideTemplateId] = useState<number | ''>('');
  const [mainImage, setMainImage] = useState('');
  const [tags, setTags] = useState('');
  const [sort, setSort] = useState<number | ''>(0);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'published' | 'draft' | 'archived'>('published');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const isPersian = locale === 'fa';

  useEffect(() => {
    const loadInitialData = async () => {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const bList = await adapter.getBrands({ organization_id: orgId });
      setBrands(bList);

      if (product) {
        setTitle(product.title || '');
        setSlug(product.slug || '');
        const bId = typeof product.brand_id === 'number' ? product.brand_id : product.brand_id?.id || '';
        setBrandId(bId);
        setCategoryId(product.category_id || '');
        setCollectionId(product.collection_id || '');
        setSeasonId(product.season_id || '');
        setSizeGuideTemplateId(product.size_guide_template_id || '');
        setMainImage(product.main_image || '');
        setTags(product.tags || '');
        setSort(product.sort !== undefined ? product.sort : 0);
        setDescription(product.description || '');
        setStatus(product.status || 'published');

        const vList = await adapter.getVariantsByProductId(product.id);
        setVariants(vList);
      } else {
        setTitle('');
        setSlug('');
        setBrandId('');
        setCategoryId('');
        setCollectionId('');
        setSeasonId('');
        setSizeGuideTemplateId('');
        setMainImage('');
        setTags('');
        setSort(0);
        setDescription('');
        setStatus('published');
        setVariants([]);
      }
    };

    if (isOpen) {
      loadInitialData();
    }
  }, [product, isOpen, activeOrganization]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;

      const generatedSlug = slug.trim() || title.toLowerCase().replace(/\s+/g, '-');

      await adapter.saveProduct({
        id: product?.id,
        organization_id: orgId,
        title,
        slug: generatedSlug,
        brand_id: brandId ? Number(brandId) : undefined,
        category_id: categoryId ? Number(categoryId) : undefined,
        collection_id: collectionId ? Number(collectionId) : undefined,
        season_id: seasonId ? Number(seasonId) : undefined,
        size_guide_template_id: sizeGuideTemplateId ? Number(sizeGuideTemplateId) : undefined,
        main_image: mainImage,
        tags,
        sort: sort !== '' ? Number(sort) : 0,
        description,
        status,
      });

      onSaved();
      onClose();
    } catch (err) {
      console.error('[ProductDetailModal] Error saving product:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVariant = async (variantId: number) => {
    if (confirm('آیا از حذف این تنوع مطمئن هستید؟')) {
      const adapter = storageManager.getAdapter();
      await adapter.deleteVariant(variantId);
      if (product) {
        const list = await adapter.getVariantsByProductId(product.id);
        setVariants(list);
        await adapter.saveProduct({ id: product.id, variants_count: list.length });
        onSaved();
      }
    }
  };

  // Helper to build category tree labels for select
  const getCategoryOptions = () => {
    const parentMap = new Map<number | null, Category[]>();
    categories.forEach((cat) => {
      const pId = typeof cat.parent_id === 'number' ? cat.parent_id : cat.parent_id?.id || null;
      if (!parentMap.has(pId)) parentMap.set(pId, []);
      parentMap.get(pId)!.push(cat);
    });

    const options: { value: number; label: string }[] = [];

    const traverse = (pId: number | null, prefix: string) => {
      const children = parentMap.get(pId) || [];
      children.forEach((child) => {
        options.push({ value: child.id, label: `${prefix}${child.name}` });
        traverse(child.id, `${prefix}${child.name} > `);
      });
    };

    traverse(null, '');
    return options;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'ویرایش و مدیریت محصول' : 'تعریف محصول جدید'}
      maxWidth="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="product-detail-form"
            isLoading={isSaving}
          >
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="product-detail-form" onSubmit={handleSave} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="نام محصول / عنوان کالا *"
            placeholder="مثال: کت چرم مردانه VIP"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Input
            label="اسلاگ (Slug)"
            placeholder="men-leather-jacket-vip"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="دسته‌بندی اصلی"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
            options={[
              { value: '', label: 'انتخاب کنید...' },
              ...getCategoryOptions(),
            ]}
          />
          <Select
            label="مجموعه (Collection)"
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value ? Number(e.target.value) : '')}
            options={[
              { value: '', label: 'بدون مجموعه' },
              ...collections.map((col) => ({ value: col.id, label: col.name })),
            ]}
          />
          <Select
            label="فصل (Season)"
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value ? Number(e.target.value) : '')}
            options={[
              { value: '', label: 'چهارفصل' },
              ...seasons.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            label="برند / مارک تجاری"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value ? Number(e.target.value) : '')}
            options={[
              { value: '', label: 'بدون برند' },
              ...brands.map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
          <Select
            label="جدول راهنمای سایز مرتبط"
            value={sizeGuideTemplateId}
            onChange={(e) => setSizeGuideTemplateId(e.target.value ? Number(e.target.value) : '')}
            options={[
              { value: '', label: 'بدون جدول سایز' },
              ...sizeGuides.map((sg) => ({ value: sg.id, label: sg.name })),
            ]}
          />
          <Input
            label="ترتیب نمایش (Sort)"
            type="number"
            value={sort}
            onChange={(e) => setSort(e.target.value ? Number(e.target.value) : '')}
          />
        </div>

        <ImageUpload
          label="تصویر اصلی محصول *"
          value={mainImage}
          onChange={setMainImage}
          helperText="تصویر کاتالوگ باکیفیت برای نمایش محصول"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="برچسب‌ها / تگ‌ها"
            placeholder="مردانه, چرم, زمستانه, VIP"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            icon={<Tag className="w-4 h-4" />}
          />
          <Select
            label="وضعیت انتشار"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            options={[
              { value: 'published', label: 'منتشر شده' },
              { value: 'draft', label: 'پیش‌نویس' },
              { value: 'archived', label: 'بایگانی شده' },
            ]}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700">توضیحات و مشخصات فنی لباس</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-white border border-slate-300 rounded-xl text-slate-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="جنس پارچه، درصد پنبه، نحوه شستشو..."
          />
        </div>

        {/* Existing Variants list for this product if editing */}
        {product && (
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                <Shirt className="w-4 h-4 text-indigo-600" />
                <span>تنوع‌های فعال کالا ({toPersianDigits(variants.length)})</span>
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenMatrix(product);
                }}
                icon={<Plus className="w-3.5 h-3.5 text-indigo-600" />}
              >
                ایجاد تنوع با ماتریس
              </Button>
            </div>

            {variants.length === 0 ? (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-xl">
                هیچ تنوعی (رنگ/سایز) برای این محصول ثبت نشده است. دکمه ساخت با ماتریس را بفشارید.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {variants.map((v, vIdx) => (
                  <div
                    key={`pdm_var_${v.id || 'temp'}_${vIdx}`}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">{v.sku}</p>
                      <p className="text-slate-500 text-[11px]">
                        رنگ: {v.color_name || 'اصلی'} | سایز: {v.size_name || 'استاندارد'} | بارکد: {v.barcode || '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-900">
                        {formatCurrency(v.price, activeOrganization?.currency, isPersian)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(v.id)}
                        className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
};
