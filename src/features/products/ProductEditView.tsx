import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Product, ProductVariant, Category, Collection, Season, SizeGuideTemplate, Brand, Color, Size, Warehouse, WarehouseLocation } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { ImageUpload } from '../../components/ui/ImageUpload';
import { formatCurrency, toPersianDigits, normalizeId } from '../../utils/formatters';
import {
  ArrowRight, Save, Plus, Trash2, Grid, Tag, Shirt, Package, Layers,
  CheckCircle2, Sliders, RefreshCw, Sparkles, DollarSign, Archive,
  Palette, Ruler, Check, X, Search
} from 'lucide-react';

interface ProductEditViewProps {
  productId: number | null; // null means creating a new product
  onBack: () => void;
  onSaved: () => void;
}

export const ProductEditView: React.FC<ProductEditViewProps> = ({
  productId,
  onBack,
  onSaved,
}) => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();
  const isPersian = locale === 'fa';

  // Master product state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [brandId, setBrandId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [collectionId, setCollectionId] = useState<number | ''>('');
  const [seasonId, setSeasonId] = useState<number | ''>('');
  const [sizeGuideTemplateId, setSizeGuideTemplateId] = useState<number | ''>('');
  const [mainImage, setMainImage] = useState('');
  const [tags, setTags] = useState('');
  const [sort, setSort] = useState<number | ''>(0);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'published' | 'draft' | 'archived'>('published');

  // Related lookup lists
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [sizeGuides, setSizeGuides] = useState<SizeGuideTemplate[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number>(1);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('');

  // Selected Colors & Sizes for real-time variant generation
  const [selectedColorIds, setSelectedColorIds] = useState<number[]>([]);
  const [selectedSizeIds, setSelectedSizeIds] = useState<number[]>([]);
  const [colorSearchQuery, setColorSearchQuery] = useState('');
  const [sizeSearchQuery, setSizeSearchQuery] = useState('');
  const initialLoadDoneRef = useRef(false);

  // Inline Add Color state
  const [isAddColorModalOpen, setIsAddColorModalOpen] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#171717');
  const [isCreatingColor, setIsCreatingColor] = useState(false);

  // Inline Add Size state
  const [isAddSizeModalOpen, setIsAddSizeModalOpen] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [isCreatingSize, setIsCreatingSize] = useState(false);

  // Variants in editable table
  const [variants, setVariants] = useState<(Partial<ProductVariant> & { _tempId?: string })[]>([]);
  const [deletedVariantIds, setDeletedVariantIds] = useState<number[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Bulk Apply modal state
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkPrice, setBulkPrice] = useState<number | ''>('');
  const [bulkCost, setBulkCost] = useState<number | ''>('');
  const [bulkStock, setBulkStock] = useState<number | ''>('');

  const loadData = async () => {
    setIsLoading(true);
    initialLoadDoneRef.current = false;
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;

      const [bList, cList, colList, seaList, sgList, colorList, sizeList, whList] = await Promise.all([
        adapter.getBrands({ organization_id: orgId }),
        adapter.getCategories({ organization_id: orgId }),
        adapter.getCollections({ organization_id: orgId }),
        adapter.getSeasons({ organization_id: orgId }),
        adapter.getSizeGuideTemplates({ organization_id: orgId }),
        adapter.getColors({ organization_id: orgId }),
        adapter.getSizes({ organization_id: orgId }),
        adapter.getWarehouses({ organization_id: orgId }),
      ]);

      const normalizedSgList = (Array.isArray(sgList) ? sgList : []).map((sg: any) => ({
        ...sg,
        id: normalizeId(sg.id) || sg.id,
        name: sg.name || sg.title || sg.template_name || `راهنمای سایز #${sg.id}`,
      }));

      setBrands(bList);
      setCategories(cList);
      setCollections(colList);
      setSeasons(seaList);
      setSizeGuides(normalizedSgList);
      setColors(colorList);
      setSizes(sizeList);
      setWarehouses(whList);
      if (whList.length > 0) {
        setSelectedWarehouseId(whList[0].id);
      }

      if (productId) {
        const prod = await adapter.getProductById(productId);
        if (prod) {
          setTitle(prod.title || '');
          setSlug(prod.slug || '');
          const bId = typeof prod.brand_id === 'number' ? prod.brand_id : (prod.brand_id as any)?.id || '';
          setBrandId(bId);
          setCategoryId(prod.category_id || '');
          setCollectionId(prod.collection_id || '');
          setSeasonId(prod.season_id || '');
          const sgId = typeof prod.size_guide_template_id === 'number' 
            ? prod.size_guide_template_id 
            : (typeof prod.size_guide_template_id === 'object' && prod.size_guide_template_id !== null)
            ? (prod.size_guide_template_id as any).id || ''
            : normalizeId(prod.size_guide_template_id) || '';
          setSizeGuideTemplateId(sgId);
          setMainImage(prod.main_image || '');
          setTags(prod.tags || '');
          setSort(prod.sort !== undefined ? prod.sort : 0);
          setDescription(prod.description || '');
          setStatus(prod.status || 'published');

          const vList = await adapter.getVariantsByProductId(productId);
          const normalizedVList = vList.map((v) => ({
            ...v,
            id: normalizeId(v.id),
            product_id: normalizeId(v.product_id),
            color_id: normalizeId(v.color_id),
            size_id: normalizeId(v.size_id),
          }));
          setVariants(normalizedVList);

          // Extract colors and sizes present in loaded variants
          const existingColorIds = Array.from(
            new Set(
              normalizedVList
                .map((v) => v.color_id)
                .filter((id): id is number => id !== undefined)
            )
          );

          const existingSizeIds = Array.from(
            new Set(
              normalizedVList
                .map((v) => v.size_id)
                .filter((id): id is number => id !== undefined)
            )
          );

          setSelectedColorIds(existingColorIds);
          setSelectedSizeIds(existingSizeIds);
        }
      } else {
        // Default new product
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
        setSelectedColorIds([]);
        setSelectedSizeIds([]);
      }
    } catch (err) {
      console.error('[ProductEditView] Error loading data:', err);
    } finally {
      setIsLoading(false);
      initialLoadDoneRef.current = true;
    }
  };

  useEffect(() => {
    loadData();
  }, [productId, activeOrganization]);

  // Load warehouse locations when selected warehouse changes
  useEffect(() => {
    if (!selectedWarehouseId) {
      setLocations([]);
      return;
    }
    const adapter = storageManager.getAdapter();
    adapter.getWarehouseLocations({ warehouse_id: Number(selectedWarehouseId) })
      .then((locList) => {
        setLocations(locList);
      })
      .catch((err) => {
        console.warn('[ProductEditView] Error loading locations:', err);
        setLocations([]);
      });
  }, [selectedWarehouseId]);

  // Real-time synchronization of variant matrix from color and size selection
  const syncVariantsFromSelection = (
    nextColorIds: number[],
    nextSizeIds: number[],
    currentVariants: (Partial<ProductVariant> & { _tempId?: string })[],
    currentColors: Color[],
    currentSizes: Size[]
  ) => {
    if (!initialLoadDoneRef.current) return;

    const targetPairs: { colorId?: number; sizeId?: number }[] = [];

    if (nextColorIds.length > 0 && nextSizeIds.length > 0) {
      for (const cId of nextColorIds) {
        for (const sId of nextSizeIds) {
          targetPairs.push({ colorId: cId, sizeId: sId });
        }
      }
    } else if (nextColorIds.length > 0) {
      for (const cId of nextColorIds) {
        targetPairs.push({ colorId: cId, sizeId: undefined });
      }
    } else if (nextSizeIds.length > 0) {
      for (const sId of nextSizeIds) {
        targetPairs.push({ colorId: undefined, sizeId: sId });
      }
    }

    const existingMap = new Map<string, Partial<ProductVariant> & { _tempId?: string }>();
    currentVariants.forEach((v) => {
      const cVal = normalizeId(v.color_id) ?? 'none';
      const sVal = normalizeId(v.size_id) ?? 'none';
      existingMap.set(`${cVal}_${sVal}`, v);
    });

    const nextVariantsList: (Partial<ProductVariant> & { _tempId?: string })[] = [];
    const activeKeys = new Set<string>();

    targetPairs.forEach(({ colorId, sizeId }) => {
      const key = `${colorId || 'none'}_${sizeId || 'none'}`;
      activeKeys.add(key);

      if (existingMap.has(key)) {
        nextVariantsList.push(existingMap.get(key)!);
      } else {
        const colorObj = currentColors.find((c) => c.id === colorId);
        const sizeObj = currentSizes.find((s) => s.id === sizeId);

        const slugClean = (slug || title || 'PROD')
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 5) || 'PROD';
        const cCode = colorObj?.code || (colorId ? `C${colorId}` : '');
        const sCode = sizeObj?.code || (sizeId ? `S${sizeId}` : '');
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).slice(2, 6);

        const skuParts = ['TNK', slugClean];
        if (cCode) skuParts.push(cCode);
        if (sCode) skuParts.push(sCode);
        const generatedSku = skuParts.join('-');

        const barcode = `626${Math.floor(100000000 + Math.random() * 900000000)}`;

        nextVariantsList.push({
          _tempId: `temp_${timestamp}_${randomSuffix}`,
          organization_id: activeOrganization?.id || 1,
          color_id: colorId,
          size_id: sizeId,
          sku: generatedSku,
          barcode,
          price: bulkPrice !== '' ? Number(bulkPrice) : 0,
          cost: bulkCost !== '' ? Number(bulkCost) : 0,
          stock_quantity: bulkStock !== '' ? Number(bulkStock) : 0,
          status: 'published',
          sort: nextVariantsList.length + 1,
        });
      }
    });

    // Track unselected variant IDs for database deletion
    currentVariants.forEach((v) => {
      const cVal = normalizeId(v.color_id) ?? 'none';
      const sVal = normalizeId(v.size_id) ?? 'none';
      const key = `${cVal}_${sVal}`;
      if (!activeKeys.has(key) && (v.color_id || v.size_id)) {
        const vId = normalizeId(v.id);
        if (vId) {
          setDeletedVariantIds((prev) => [...prev, vId]);
        }
      }
    });

    // Keep custom manual rows with neither color nor size
    currentVariants.forEach((v) => {
      if (!v.color_id && !v.size_id) {
        if (!nextVariantsList.includes(v)) {
          nextVariantsList.push(v);
        }
      }
    });

    setVariants(nextVariantsList);
  };

  const handleToggleColor = (colorId: number) => {
    const nextColorIds = selectedColorIds.includes(colorId)
      ? selectedColorIds.filter((id) => id !== colorId)
      : [...selectedColorIds, colorId];

    setSelectedColorIds(nextColorIds);
    syncVariantsFromSelection(nextColorIds, selectedSizeIds, variants, colors, sizes);
  };

  const handleToggleSize = (sizeId: number) => {
    const nextSizeIds = selectedSizeIds.includes(sizeId)
      ? selectedSizeIds.filter((id) => id !== sizeId)
      : [...selectedSizeIds, sizeId];

    setSelectedSizeIds(nextSizeIds);
    syncVariantsFromSelection(selectedColorIds, nextSizeIds, variants, colors, sizes);
  };

  const handleSelectAllColors = () => {
    const allIds = colors.map((c) => c.id);
    setSelectedColorIds(allIds);
    syncVariantsFromSelection(allIds, selectedSizeIds, variants, colors, sizes);
  };

  const handleDeselectAllColors = () => {
    setSelectedColorIds([]);
    syncVariantsFromSelection([], selectedSizeIds, variants, colors, sizes);
  };

  const handleSelectAllSizes = () => {
    const allIds = sizes.map((s) => s.id);
    setSelectedSizeIds(allIds);
    syncVariantsFromSelection(selectedColorIds, allIds, variants, colors, sizes);
  };

  const handleDeselectAllSizes = () => {
    setSelectedSizeIds([]);
    syncVariantsFromSelection(selectedColorIds, [], variants, colors, sizes);
  };

  const handleCreateColorInline = async () => {
    if (!newColorName.trim()) return;
    setIsCreatingColor(true);
    try {
      const adapter = storageManager.getAdapter();
      const created = await adapter.saveColor({
        organization_id: activeOrganization?.id || 1,
        name: newColorName.trim(),
        hex: newColorHex,
        status: 'published',
      });
      const updatedColors = [...colors, created];
      setColors(updatedColors);
      setNewColorName('');
      setIsAddColorModalOpen(false);

      const nextColorIds = [...selectedColorIds, created.id];
      setSelectedColorIds(nextColorIds);
      syncVariantsFromSelection(nextColorIds, selectedSizeIds, variants, updatedColors, sizes);
    } catch (err) {
      console.error('Error creating inline color:', err);
    } finally {
      setIsCreatingColor(false);
    }
  };

  const handleCreateSizeInline = async () => {
    if (!newSizeName.trim()) return;
    setIsCreatingSize(true);
    try {
      const adapter = storageManager.getAdapter();
      const created = await adapter.saveSize({
        organization_id: activeOrganization?.id || 1,
        name: newSizeName.trim(),
        status: 'published',
      });
      const updatedSizes = [...sizes, created];
      setSizes(updatedSizes);
      setNewSizeName('');
      setIsAddSizeModalOpen(false);

      const nextSizeIds = [...selectedSizeIds, created.id];
      setSelectedSizeIds(nextSizeIds);
      syncVariantsFromSelection(selectedColorIds, nextSizeIds, variants, colors, updatedSizes);
    } catch (err) {
      console.error('Error creating inline size:', err);
    } finally {
      setIsCreatingSize(false);
    }
  };

  const handleAddVariantRow = () => {
    const defaultColor = colors.length > 0 ? colors[0].id : undefined;
    const defaultSize = sizes.length > 0 ? sizes[0].id : undefined;
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 7);

    const newRow: Partial<ProductVariant> & { _tempId: string } = {
      _tempId: `temp_${timestamp}_${randomSuffix}`,
      organization_id: activeOrganization?.id || 1,
      sku: `SKU-${timestamp.toString().slice(-6)}`,
      barcode: '',
      color_id: defaultColor,
      size_id: defaultSize,
      price: 0,
      cost: 0,
      stock_quantity: 0,
      status: 'published',
      sort: variants.length + 1,
    };

    setVariants((prev) => [...prev, newRow]);
  };

  const handleUpdateVariantRow = (index: number, field: keyof ProductVariant, value: any) => {
    setVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleDeleteVariantRow = (index: number) => {
    const target = variants[index];
    if (target.id) {
      setDeletedVariantIds((prev) => [...prev, target.id!]);
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApplyBulkValues = () => {
    setVariants((prev) =>
      prev.map((v) => ({
        ...v,
        price: bulkPrice !== '' ? Number(bulkPrice) : v.price,
        cost: bulkCost !== '' ? Number(bulkCost) : v.cost,
        stock_quantity: bulkStock !== '' ? Number(bulkStock) : v.stock_quantity,
      }))
    );
    setIsBulkModalOpen(false);
    setBulkPrice('');
    setBulkCost('');
    setBulkStock('');
  };

  const handleSaveProductAndVariants = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      alert(isPersian ? 'لطفاً عنوان محصول را وارد کنید.' : 'Please enter a product title.');
      return;
    }

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;
      const generatedSlug = slug.trim() || title.toLowerCase().replace(/\s+/g, '-');

      // 1. Save main Product record to Directus / Storage
      const savedProduct = await adapter.saveProduct({
        id: productId ? Number(productId) : undefined,
        organization_id: orgId,
        title: title.trim(),
        slug: generatedSlug,
        brand_id: brandId && !isNaN(Number(brandId)) && Number(brandId) > 0 ? Number(brandId) : undefined,
        category_id: categoryId && !isNaN(Number(categoryId)) && Number(categoryId) > 0 ? Number(categoryId) : undefined,
        collection_id: collectionId && !isNaN(Number(collectionId)) && Number(collectionId) > 0 ? Number(collectionId) : undefined,
        season_id: seasonId && !isNaN(Number(seasonId)) && Number(seasonId) > 0 ? Number(seasonId) : undefined,
        size_guide_template_id: sizeGuideTemplateId && !isNaN(Number(sizeGuideTemplateId)) && Number(sizeGuideTemplateId) > 0 ? Number(sizeGuideTemplateId) : undefined,
        main_image: mainImage && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mainImage.trim()) ? mainImage.trim() : undefined,
        tags: tags ? tags.trim() : undefined,
        sort: sort !== '' ? Number(sort) : 0,
        description: description ? description.trim() : undefined,
        status,
      });

      // 2. Process deletions first
      for (const dId of deletedVariantIds) {
        const normDId = normalizeId(dId);
        if (normDId) {
          await adapter.deleteVariant(normDId).catch((delErr) => {
            console.warn('[ProductEditView] Delete variant warning:', delErr);
          });
        }
      }

      // 3. Save / Update all variant rows in table
      for (const v of variants) {
        const vId = normalizeId(v.id);
        const colorId = normalizeId(v.color_id);
        const sizeId = normalizeId(v.size_id);

        await adapter.saveVariant(
          {
            id: vId,
            organization_id: orgId,
            product_id: savedProduct.id,
            color_id: colorId,
            size_id: sizeId,
            sku: v.sku ? v.sku.trim() : `SKU-${Date.now().toString().slice(-6)}`,
            barcode: v.barcode ? v.barcode.trim() : undefined,
            price: v.price !== undefined && v.price !== '' ? Number(v.price) : 0,
            cost: v.cost !== undefined && v.cost !== '' ? Number(v.cost) : 0,
            stock_quantity: v.stock_quantity !== undefined && v.stock_quantity !== '' ? Number(v.stock_quantity) : 0,
            image: v.image && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.image.trim()) ? v.image.trim() : undefined,
            status: v.status || 'published',
            sort: v.sort !== undefined ? Number(v.sort) : 0,
          },
          selectedWarehouseId,
          selectedLocationId ? Number(selectedLocationId) : undefined
        );
      }

      onSaved();
      onBack();
    } catch (err: any) {
      console.error('[ProductEditView] Error saving product & variants:', err);
      const errMsg = err?.message || (isPersian ? 'خطای ناشناخته در ذخیره‌سازی' : 'Unknown error');
      alert(`${isPersian ? 'خطا در ذخیره‌سازی محصول و واریانت‌ها' : 'Error saving product and variants'}: ${errMsg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryOptions = () => {
    const parentMap = new Map<number | null, Category[]>();
    categories.forEach((cat) => {
      const pId = typeof cat.parent_id === 'number' ? cat.parent_id : (cat.parent_id as any)?.id || null;
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

  // Calculate table summary
  const totalVariants = variants.length;
  const totalStockSum = variants.reduce((acc, v) => acc + (Number(v.stock_quantity) || 0), 0);
  const avgPrice = totalVariants > 0 ? variants.reduce((acc, v) => acc + (Number(v.price) || 0), 0) / totalVariants : 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-bold text-slate-600">در حال دریافت اطلاعات کامل محصول از دایرکتوس...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#13151a] p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-xs transition-colors">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            icon={<ArrowRight className="w-4 h-4" />}
          >
            بازگشت
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-neutral-100">
                {productId ? `ویرایش محصول: ${title || 'بدون نام'}` : 'ایجاد محصول جدید'}
              </h1>
              <Badge variant={status === 'published' ? 'success' : 'warning'}>
                {status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              مدیریت تمام مشخصات کالا و جدول کامل واریانت‌ها، قیمت‌ها و موجودی انبار
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            انصراف
          </Button>
          <Button
            onClick={handleSaveProductAndVariants}
            isLoading={isSaving}
            icon={<Save className="w-4 h-4" />}
          >
            ذخیره کامل محصول و واریانت‌ها
          </Button>
        </div>
      </div>

      <form onSubmit={handleSaveProductAndVariants} className="space-y-6">
        {/* Section 1: مشخصات عمومی کالا */}
        <Card title="۱. مشخصات عمومی و برند کالا">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="نام محصول / عنوان کالا *"
                  placeholder="مثال: کت چرم مردانه یقه ایستاده"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
                <Input
                  label="اسلاگ (Slug) *"
                  placeholder="men-leather-jacket"
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
                  label="جدول راهنمای سایز"
                  value={sizeGuideTemplateId}
                  onChange={(e) => setSizeGuideTemplateId(e.target.value ? Number(e.target.value) : '')}
                  options={[
                    { value: '', label: 'بدون جدول سایز' },
                    ...sizeGuides.map((sg: any) => ({
                      value: sg.id,
                      label: sg.name || sg.title || sg.template_name || `قالب شماره ${sg.id}`,
                    })),
                  ]}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="برچسب‌ها / تگ‌ها"
                  placeholder="مردانه, چرم, زمستانه, VIP"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  icon={<Tag className="w-4 h-4" />}
                />
                <Input
                  label="ترتیب نمایش (Sort)"
                  type="number"
                  value={sort}
                  onChange={(e) => setSort(e.target.value ? Number(e.target.value) : '')}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300">توضیحات و مشخصات تکمیلی</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-neutral-100 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="توضیحات جنس پارچه، نحوه نگهداری، شستشو..."
                />
              </div>
            </div>

            {/* Main Product Image Upload */}
            <div className="space-y-3 bg-slate-50 dark:bg-[#181a20] p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 transition-colors">
              <ImageUpload
                label="تصویر اصلی کاتالوگ"
                value={mainImage}
                onChange={setMainImage}
                helperText="فشرده‌سازی خودکار و ذخیره‌سازی محلی سریع با همگام‌سازی ابری"
                productId={productId ? Number(productId) : undefined}
              />
            </div>
          </div>
        </Card>

        {/* Section 2: جدول تنوع‌ها و موجودی انبار */}
        <Card>
          {/* Interactive Color & Size Selector Card */}
          <div className="bg-[#fafafa] dark:bg-[#181a20] border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4 sm:p-5 mb-6 space-y-5 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200/60 dark:border-neutral-800 pb-3">
              <div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>انتخاب رنگ‌ها و سایزهای محصول (تولید همزمان واریانت‌ها)</span>
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  با انتخاب هر رنگ و سایز، سطر واریانت آن به‌صورت همزمان و هوشمند در جدول پایین ایجاد می‌شود.
                </p>
              </div>

              {/* Dynamic Combination Counter Badge */}
              {(selectedColorIds.length > 0 || selectedSizeIds.length > 0) && (
                <div className="font-mono text-xs px-3 py-1 rounded-full bg-neutral-900 text-white font-medium flex items-center gap-1.5 self-start sm:self-auto shadow-xs">
                  <span>تعداد ترکیب‌ها:</span>
                  <span className="font-bold text-amber-300">
                    {toPersianDigits(
                      selectedColorIds.length > 0 && selectedSizeIds.length > 0
                        ? selectedColorIds.length * selectedSizeIds.length
                        : selectedColorIds.length + selectedSizeIds.length
                    )}{' '}
                    SKU
                  </span>
                </div>
              )}
            </div>

            {/* Color Chips Selector */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-neutral-600" />
                  <span>انتخاب رنگ‌های کالا ({toPersianDigits(selectedColorIds.length)} از {toPersianDigits(colors.length)} رنگ انتخاب شده)</span>
                </label>

                <div className="flex items-center gap-2">
                  <div className="relative w-44 sm:w-56">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="جستجوی رنگ..."
                      value={colorSearchQuery}
                      onChange={(e) => setColorSearchQuery(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg text-xs pr-8 pl-6 py-1 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                    {colorSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setColorSearchQuery('')}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllColors}
                      className="text-neutral-600 hover:text-neutral-900 hover:underline cursor-pointer"
                    >
                      انتخاب همه
                    </button>
                    <span className="text-neutral-300">•</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllColors}
                      className="text-neutral-500 hover:text-red-600 hover:underline cursor-pointer"
                    >
                      حذف همه
                    </button>
                    <span className="text-neutral-300">•</span>
                    <button
                      type="button"
                      onClick={() => setIsAddColorModalOpen(true)}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>جدید</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable Container for Color Chips */}
              <div className="max-h-36 overflow-y-auto p-2 bg-neutral-50/60 rounded-xl border border-neutral-200/80">
                {colors.filter((c) =>
                  !colorSearchQuery.trim() ||
                  c.name.toLowerCase().includes(colorSearchQuery.toLowerCase()) ||
                  (c.hex && c.hex.toLowerCase().includes(colorSearchQuery.toLowerCase()))
                ).length === 0 ? (
                  <div className="text-center py-3 text-xs text-neutral-500">
                    <span>رنگی با عبارت «{colorSearchQuery}» یافت نشد.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewColorName(colorSearchQuery);
                        setIsAddColorModalOpen(true);
                      }}
                      className="ms-2 text-blue-600 font-bold hover:underline"
                    >
                      + افزودن همین رنگ
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {colors
                      .filter((c) =>
                        !colorSearchQuery.trim() ||
                        c.name.toLowerCase().includes(colorSearchQuery.toLowerCase()) ||
                        (c.hex && c.hex.toLowerCase().includes(colorSearchQuery.toLowerCase()))
                      )
                      .map((color, idx) => {
                        const isSelected = selectedColorIds.includes(color.id);
                        return (
                          <button
                            key={`color_${color.id}_${idx}`}
                            type="button"
                            onClick={() => handleToggleColor(color.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs ring-1 ring-neutral-900'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                            }`}
                          >
                            <span
                              className="w-3 h-3 rounded-full border border-black/20 shrink-0 shadow-2xs"
                              style={{ backgroundColor: color.hex || '#000000' }}
                            />
                            <span>{color.name}</span>
                            {isSelected && <Check className="w-3 h-3 ms-0.5 shrink-0 text-amber-300" />}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Size Chips Selector */}
            <div className="space-y-2 pt-3 border-t border-neutral-200/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-neutral-600" />
                  <span>انتخاب سایزهای کالا ({toPersianDigits(selectedSizeIds.length)} از {toPersianDigits(sizes.length)} سایز انتخاب شده)</span>
                </label>

                <div className="flex items-center gap-2">
                  <div className="relative w-44 sm:w-56">
                    <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="جستجوی سایز..."
                      value={sizeSearchQuery}
                      onChange={(e) => setSizeSearchQuery(e.target.value)}
                      className="w-full bg-white border border-neutral-200 rounded-lg text-xs pr-8 pl-6 py-1 text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                    {sizeSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSizeSearchQuery('')}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllSizes}
                      className="text-neutral-600 hover:text-neutral-900 hover:underline cursor-pointer"
                    >
                      انتخاب همه
                    </button>
                    <span className="text-neutral-300">•</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllSizes}
                      className="text-neutral-500 hover:text-red-600 hover:underline cursor-pointer"
                    >
                      حذف همه
                    </button>
                    <span className="text-neutral-300">•</span>
                    <button
                      type="button"
                      onClick={() => setIsAddSizeModalOpen(true)}
                      className="text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>جدید</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Scrollable Container for Size Chips */}
              <div className="max-h-36 overflow-y-auto p-2 bg-neutral-50/60 rounded-xl border border-neutral-200/80">
                {sizes.filter((s) =>
                  !sizeSearchQuery.trim() ||
                  s.name.toLowerCase().includes(sizeSearchQuery.toLowerCase())
                ).length === 0 ? (
                  <div className="text-center py-3 text-xs text-neutral-500">
                    <span>سایزی با عبارت «{sizeSearchQuery}» یافت نشد.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewSizeName(sizeSearchQuery);
                        setIsAddSizeModalOpen(true);
                      }}
                      className="ms-2 text-blue-600 font-bold hover:underline"
                    >
                      + افزودن همین سایز
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {sizes
                      .filter((s) =>
                        !sizeSearchQuery.trim() ||
                        s.name.toLowerCase().includes(sizeSearchQuery.toLowerCase())
                      )
                      .map((size, idx) => {
                        const isSelected = selectedSizeIds.includes(size.id);
                        return (
                          <button
                            key={`size_${size.id}_${idx}`}
                            type="button"
                            onClick={() => handleToggleSize(size.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-neutral-900 text-white border-neutral-900 shadow-2xs ring-1 ring-neutral-900'
                                : 'bg-white text-neutral-700 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                            }`}
                          >
                            <span>{size.name}</span>
                            {isSelected && <Check className="w-3 h-3 text-amber-300 shrink-0" />}
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Warehouse & Shelf Location Selector for Initial Stock */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-5">
            <Select
              label="انبار ثبت موجودی اولیه *"
              value={selectedWarehouseId}
              onChange={(e) => {
                const whId = Number(e.target.value);
                setSelectedWarehouseId(whId);
                setSelectedLocationId('');
              }}
              options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            />
            <Select
              label="قفسه / جایگاه دقیق در انبار (وابسته به انبار انتخابی)"
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value ? Number(e.target.value) : '')}
              options={[
                { value: '', label: locations.length === 0 ? 'بدون جایگاه تعریف‌شده (موجودی عمومی انبار)' : 'انتخاب قفسه یا جایگاه انبار...' },
                ...locations.map((loc) => ({
                  value: loc.id,
                  label: `${loc.name}${loc.code ? ` (${loc.code})` : ''}`,
                })),
              ]}
            />
          </div>

          {/* Table Header: تیتر جدول تنوع‌ها، قیمت‌ها و موجودی انبار */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <Shirt className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-extrabold text-slate-900">
                  ۲. جدول تنوع‌ها، قیمت‌ها و موجودی انبار ({toPersianDigits(variants.length)} تنوع)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                هر واریانت شامل رنگ، سایز، کد SKU، بارکد، قیمت فروش، قیمت خرید و موجودی انبار است.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {variants.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBulkModalOpen(true)}
                  icon={<Sliders className="w-3.5 h-3.5" />}
                >
                  تغییر گروهی قیمت/موجودی
                </Button>
              )}
            </div>
          </div>

          {/* Variants Editable Table */}
          {variants.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 dark:bg-[#181a20] rounded-2xl border-2 border-dashed border-slate-200 dark:border-neutral-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <Shirt className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-neutral-200">هیچ تنوعی برای این محصول انتخاب نشده است</h4>
              <p className="text-xs text-slate-500 dark:text-neutral-400 max-w-md mx-auto">
                برای ایجاد تنوع‌های کالا، رنگ‌ها و سایزهای مورد نظر را از کادر بالا انتخاب کنید.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-neutral-800">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 dark:bg-[#181a20] text-slate-700 dark:text-neutral-300 font-bold border-b border-slate-200 dark:border-neutral-800">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">رنگ</th>
                    <th className="py-3 px-3">سایز</th>
                    <th className="py-3 px-3 min-w-[130px]">کد شناسه (SKU)</th>
                    <th className="py-3 px-3 min-w-[120px]">بارکد</th>
                    <th className="py-3 px-3 min-w-[130px]">قیمت فروش ({activeOrganization?.currency === 'TOMAN' ? 'تومان' : 'ریال'})</th>
                    <th className="py-3 px-3 min-w-[120px]">قیمت خرید / تمام‌شده</th>
                    <th className="py-3 px-3 min-w-[110px]">موجودی انبار</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-neutral-800 bg-white dark:bg-[#13151a]">
                  {variants.map((v, index) => (
                    <tr key={`pe_vrow_${v.id || v._tempId || 'idx'}_${index}`} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-400">
                        {toPersianDigits(index + 1)}
                      </td>

                      {/* Color Select */}
                      <td className="py-2.5 px-3">
                        <select
                          value={v.color_id || ''}
                          onChange={(e) => handleUpdateVariantRow(index, 'color_id', e.target.value ? Number(e.target.value) : undefined)}
                          className="bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-800 dark:text-neutral-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        >
                          <option value="">بدون رنگ</option>
                          {colors.map((c, cIdx) => (
                            <option key={`pe_c_opt_${c.id}_${cIdx}`} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Size Select */}
                      <td className="py-2.5 px-3">
                        <select
                          value={v.size_id || ''}
                          onChange={(e) => handleUpdateVariantRow(index, 'size_id', e.target.value ? Number(e.target.value) : undefined)}
                          className="bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-800 dark:text-neutral-100 text-xs px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        >
                          <option value="">بدون سایز</option>
                          {sizes.map((s, sIdx) => (
                            <option key={`pe_s_opt_${s.id}_${sIdx}`} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* SKU Input */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={v.sku || ''}
                          onChange={(e) => handleUpdateVariantRow(index, 'sku', e.target.value)}
                          placeholder="SKU-1001"
                          className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-900 dark:text-neutral-100 text-xs px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Barcode Input */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={v.barcode || ''}
                          onChange={(e) => handleUpdateVariantRow(index, 'barcode', e.target.value)}
                          placeholder="62600000000"
                          className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-900 dark:text-neutral-100 text-xs px-2.5 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Price Input */}
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          value={v.price !== undefined ? v.price : ''}
                          onChange={(e) => handleUpdateVariantRow(index, 'price', e.target.value !== '' ? Number(e.target.value) : 0)}
                          placeholder="0"
                          className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-900 dark:text-neutral-100 text-xs px-2.5 py-1.5 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Cost Input */}
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          value={v.cost !== undefined ? v.cost : ''}
                          onChange={(e) => handleUpdateVariantRow(index, 'cost', e.target.value !== '' ? Number(e.target.value) : 0)}
                          placeholder="0"
                          className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-700 dark:text-neutral-200 text-xs px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Stock Input */}
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          value={v.stock_quantity !== undefined ? v.stock_quantity : ''}
                          onChange={(e) => handleUpdateVariantRow(index, 'stock_quantity', e.target.value !== '' ? Number(e.target.value) : 0)}
                          placeholder="0"
                          className="w-full bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-amber-950 dark:text-amber-200 font-extrabold text-xs px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        <select
                          value={v.status || 'published'}
                          onChange={(e) => handleUpdateVariantRow(index, 'status', e.target.value)}
                          className="bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-800 dark:text-neutral-100 text-[11px] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="published">فعال</option>
                          <option value="draft">غیرفعال</option>
                        </select>
                      </td>

                      {/* Action Delete */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteVariantRow(index)}
                          className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer transition-colors"
                          title="حذف این واریانت"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Table Footer Summary */}
              <div className="bg-slate-100 dark:bg-[#181a20] p-3.5 border-t border-slate-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-xs font-bold text-slate-800 dark:text-neutral-200 gap-3">
                <div className="flex items-center gap-4">
                  <span>مجموع کل تنوع‌ها: {toPersianDigits(totalVariants)} SKU</span>
                  <span className="text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg">
                    مجموع موجودی انبار: {toPersianDigits(totalStockSum)} عدد
                  </span>
                </div>
                <div>
                  ممیانگین قیمت فروش: {formatCurrency(avgPrice, activeOrganization?.currency, isPersian)}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Bottom Floating/Fixed Save Actions */}
        <div className="flex items-center justify-end gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <Button type="button" variant="outline" onClick={onBack}>
            انصراف
          </Button>
          <Button
            type="submit"
            isLoading={isSaving}
            icon={<Save className="w-4 h-4" />}
          >
            ذخیره کامل محصول و واریانت‌ها
          </Button>
        </div>
      </form>

      {/* Bulk Price / Stock Applicator Modal */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#13151a] rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-neutral-800 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-neutral-100 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>تغییر گروهی قیمت و موجودی تمام تنوع‌ها</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400">
              مقادیر وارد شده به تمامی {toPersianDigits(totalVariants)} واریانت جدول اعمال خواهد شد (هرکدام را که نمی‌خواهید خالی بگذارید).
            </p>

            <div className="space-y-3">
              <Input
                label="قیمت فروش گروهی (تومان/ریال)"
                type="number"
                placeholder="مثال: 450000"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
              />
              <Input
                label="قیمت خرید/تمام‌شده گروهی"
                type="number"
                placeholder="مثال: 300000"
                value={bulkCost}
                onChange={(e) => setBulkCost(e.target.value)}
              />
              <Input
                label="موجودی انبار گروهی (تعداد)"
                type="number"
                placeholder="مثال: 10"
                value={bulkStock}
                onChange={(e) => setBulkStock(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsBulkModalOpen(false)}>
                انصراف
              </Button>
              <Button size="sm" onClick={handleApplyBulkValues}>
                اعمال به همه واریانت‌ها
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Add Color Modal */}
      {isAddColorModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#13151a] rounded-xl p-5 max-w-sm w-full shadow-vercel-lg border border-neutral-200/80 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Palette className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>تعریف رنگ جدید</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddColorModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <Input
                label="نام رنگ (مثال: سبز زیتونی)"
                value={newColorName}
                onChange={(e) => setNewColorName(e.target.value)}
                placeholder="نام رنگ"
              />
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">کد رنگ (HEX)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newColorHex}
                    onChange={(e) => setNewColorHex(e.target.value)}
                    className="w-10 h-10 rounded-md border border-neutral-200 dark:border-neutral-700 cursor-pointer p-0.5 bg-white dark:bg-[#181a20]"
                  />
                  <input
                    type="text"
                    value={newColorHex}
                    onChange={(e) => setNewColorHex(e.target.value)}
                    className="flex-1 bg-white dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-md text-xs px-3 py-2 font-mono uppercase text-neutral-900 dark:text-neutral-100"
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <Button variant="outline" size="sm" onClick={() => setIsAddColorModalOpen(false)}>
                انصراف
              </Button>
              <Button size="sm" isLoading={isCreatingColor} onClick={handleCreateColorInline}>
                ایجاد و انتخاب رنگ
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Add Size Modal */}
      {isAddSizeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-[#13151a] rounded-xl p-5 max-w-sm w-full shadow-vercel-lg border border-neutral-200/80 dark:border-neutral-800 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>تعریف سایز جدید</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddSizeModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <Input
                label="نام یا کد سایز (مثال: XXL یا 44)"
                value={newSizeName}
                onChange={(e) => setNewSizeName(e.target.value)}
                placeholder="مثال: XXL"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
              <Button variant="outline" size="sm" onClick={() => setIsAddSizeModalOpen(false)}>
                انصراف
              </Button>
              <Button size="sm" isLoading={isCreatingSize} onClick={handleCreateSizeInline}>
                ایجاد و انتخاب سایز
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
