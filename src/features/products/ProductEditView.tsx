import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import {
  ProductVariant,
  Brand,
  Category,
  Collection,
  Season,
  Color,
  Size,
  Warehouse,
  WarehouseLocation,
} from '../../types';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Save, ArrowRight, RefreshCw } from 'lucide-react';

// Sub-components
import { ProductGeneralSpecsCard, ProductStatus } from './components/ProductGeneralSpecsCard';
import { ProductVariantMatrixSelector } from './components/ProductVariantMatrixSelector';
import { ProductVariantTable } from './components/ProductVariantTable';
import { ProductAttributeModals } from './components/ProductAttributeModals';

const normalizeId = (id: any): number | undefined => {
  if (id === undefined || id === null || id === '') return undefined;
  if (typeof id === 'number') return id;
  if (typeof id === 'object' && id !== null && 'id' in id) return normalizeId((id as any).id);
  const parsed = Number(id);
  return isNaN(parsed) ? undefined : parsed;
};

interface ProductEditViewProps {
  productId?: string | number;
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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // General specs state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [brandId, setBrandId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [collectionId, setCollectionId] = useState<number | ''>('');
  const [seasonId, setSeasonId] = useState<number | ''>('');
  const [sizeGuideTemplateId, setSizeGuideTemplateId] = useState<number | ''>('');
  const [mainImage, setMainImage] = useState<string>('');
  const [tags, setTags] = useState('');
  const [sort, setSort] = useState<number | ''>(0);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProductStatus>('published');

  // Related options
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [sizeGuides, setSizeGuides] = useState<any[]>([]);

  // Selection & Matrix State
  const [selectedColorIds, setSelectedColorIds] = useState<number[]>([]);
  const [selectedSizeIds, setSelectedSizeIds] = useState<number[]>([]);
  const [colorSearchQuery, setColorSearchQuery] = useState('');
  const [sizeSearchQuery, setSizeSearchQuery] = useState('');

  // Variants and initial warehouse state
  const [variants, setVariants] = useState<(Partial<ProductVariant> & { _tempId?: string })[]>([]);
  const [deletedVariantIds, setDeletedVariantIds] = useState<number[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number>(0);
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('');

  const initialLoadDoneRef = useRef(false);

  // Inline Attribute Creation State
  const [isAddColorModalOpen, setIsAddColorModalOpen] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#000000');
  const [isCreatingColor, setIsCreatingColor] = useState(false);

  const [isAddSizeModalOpen, setIsAddSizeModalOpen] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [isCreatingSize, setIsCreatingSize] = useState(false);

  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParentId, setNewCategoryParentId] = useState<number | ''>('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [isAddCollectionModalOpen, setIsAddCollectionModalOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);

  const [isAddSeasonModalOpen, setIsAddSeasonModalOpen] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [newSeasonCode, setNewSeasonCode] = useState('');
  const [isCreatingSeason, setIsCreatingSeason] = useState(false);

  const [isAddBrandModalOpen, setIsAddBrandModalOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [isCreatingBrand, setIsCreatingBrand] = useState(false);

  // Load Reference & Product Data
  const loadData = async () => {
    setIsLoading(true);
    initialLoadDoneRef.current = false;
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [
        brandList,
        categoryList,
        collectionList,
        seasonList,
        colorList,
        sizeList,
        warehouseList,
        sizeGuideList,
      ] = await Promise.all([
        adapter.getBrands({ organization_id: orgId }),
        adapter.getCategories({ organization_id: orgId }),
        adapter.getCollections({ organization_id: orgId }),
        adapter.getSeasons({ organization_id: orgId }),
        adapter.getColors({ organization_id: orgId }),
        adapter.getSizes({ organization_id: orgId }),
        adapter.getWarehouses({ organization_id: orgId }),
        adapter.getSizeGuideTemplates ? adapter.getSizeGuideTemplates({ organization_id: orgId }) : Promise.resolve([]),
      ]);

      setBrands(brandList);
      setCategories(categoryList);
      setCollections(collectionList);
      setSeasons(seasonList);
      setColors(colorList);
      setSizes(sizeList);
      setWarehouses(warehouseList);
      setSizeGuides(sizeGuideList || []);

      if (warehouseList.length > 0) {
        setSelectedWarehouseId(warehouseList[0].id);
      }

      if (productId) {
        const numericProdId = Number(productId);
        const prod = await adapter.getProductById(numericProdId);
        if (prod) {
          setTitle(prod.title || '');
          setSlug(prod.slug || '');
          const bId = typeof prod.brand_id === 'number' ? prod.brand_id : (prod.brand_id as any)?.id || '';
          const cId = typeof prod.category_id === 'number' ? prod.category_id : (prod.category_id as any)?.id || '';
          const colId = typeof prod.collection_id === 'number' ? prod.collection_id : (prod.collection_id as any)?.id || '';
          const sId = typeof prod.season_id === 'number' ? prod.season_id : (prod.season_id as any)?.id || '';
          setBrandId(bId);
          setCategoryId(cId);
          setCollectionId(colId);
          setSeasonId(sId);
          const sgId = typeof prod.size_guide_template_id === 'number'
            ? prod.size_guide_template_id
            : (typeof prod.size_guide_template_id === 'object' && prod.size_guide_template_id !== null)
            ? (prod.size_guide_template_id as any).id || ''
            : normalizeId(prod.size_guide_template_id) || '';
          setSizeGuideTemplateId(sgId);
          const rawMainImg = prod.main_image;
          const imgRef = typeof rawMainImg === 'string'
            ? rawMainImg
            : (rawMainImg && typeof rawMainImg === 'object' && (rawMainImg as any).id)
              ? String((rawMainImg as any).id)
              : '';
          setMainImage(imgRef);
          setTags(prod.tags || '');
          setSort(prod.sort !== undefined ? prod.sort : 0);
          setDescription(prod.description || '');
          setStatus(prod.status || 'published');

          const vList = await adapter.getVariantsByProductId(numericProdId);
          const normalizedVList = vList.map((v) => {
            const rawImg = v.image;
            const vImgRef = typeof rawImg === 'string'
              ? rawImg
              : (rawImg && typeof rawImg === 'object' && (rawImg as any).id)
                ? String((rawImg as any).id)
                : (rawImg ? String(rawImg) : undefined);
            return {
              ...v,
              id: normalizeId(v.id),
              product_id: normalizeId(v.product_id),
              color_id: normalizeId(v.color_id),
              size_id: normalizeId(v.size_id),
              image: vImgRef,
            };
          });
          setVariants(normalizedVList);

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

  // Sync Variants from color and size selection
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
          price: 0,
          cost: 0,
          stock_quantity: 0,
          status: 'published',
          sort: nextVariantsList.length + 1,
        });
      }
    });

    // Track unselected variant IDs for deletion
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

  // Inline Attribute Handlers
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

  const handleCreateCategoryInline = async () => {
    if (!newCategoryName.trim()) return;
    setIsCreatingCategory(true);
    try {
      const adapter = storageManager.getAdapter();
      const created = await adapter.saveCategory({
        organization_id: activeOrganization?.id || 1,
        name: newCategoryName.trim(),
        parent_id: newCategoryParentId ? Number(newCategoryParentId) : undefined,
      });
      setCategories((prev) => [created, ...prev]);
      setCategoryId(created.id);
      setNewCategoryName('');
      setNewCategoryParentId('');
      setIsAddCategoryModalOpen(false);
    } catch (err) {
      console.error('Error creating inline category:', err);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleCreateCollectionInline = async () => {
    if (!newCollectionName.trim()) return;
    setIsCreatingCollection(true);
    try {
      const adapter = storageManager.getAdapter();
      const created = await adapter.saveCollection({
        organization_id: activeOrganization?.id || 1,
        name: newCollectionName.trim(),
      });
      setCollections((prev) => [created, ...prev]);
      setCollectionId(created.id);
      setNewCollectionName('');
      setIsAddCollectionModalOpen(false);
    } catch (err) {
      console.error('Error creating inline collection:', err);
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const handleCreateSeasonInline = async () => {
    if (!newSeasonName.trim()) return;
    setIsCreatingSeason(true);
    try {
      const adapter = storageManager.getAdapter();
      const created = await adapter.saveSeason({
        organization_id: activeOrganization?.id || 1,
        name: newSeasonName.trim(),
        code: newSeasonCode.trim() || undefined,
        status: 'active',
        start_date: null,
        end_date: null,
      });
      setSeasons((prev) => [created, ...prev]);
      setSeasonId(created.id);
      setNewSeasonName('');
      setNewSeasonCode('');
      setIsAddSeasonModalOpen(false);
    } catch (err) {
      console.error('Error creating inline season:', err);
    } finally {
      setIsCreatingSeason(false);
    }
  };

  const handleCreateBrandInline = async () => {
    if (!newBrandName.trim()) return;
    setIsCreatingBrand(true);
    try {
      const adapter = storageManager.getAdapter();
      const created = await adapter.saveBrand({
        organization_id: activeOrganization?.id || 1,
        name: newBrandName.trim(),
        status: 'active',
      });
      setBrands((prev) => [created, ...prev]);
      setBrandId(created.id);
      setNewBrandName('');
      setIsAddBrandModalOpen(false);
    } catch (err) {
      console.error('Error creating inline brand:', err);
    } finally {
      setIsCreatingBrand(false);
    }
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

  const handleApplyBulkValues = (price: number | '', cost: number | '', stock: number | '') => {
    setVariants((prev) =>
      prev.map((v) => ({
        ...v,
        price: price !== '' ? Number(price) : v.price,
        cost: cost !== '' ? Number(cost) : v.cost,
        stock_quantity: stock !== '' ? Number(stock) : v.stock_quantity,
      }))
    );
  };

  const handleSaveProductAndVariants = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      alert(t('products.pleaseEnterProductTitle'));
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
        main_image: mainImage ? (typeof mainImage === 'string' ? mainImage.trim() : (mainImage as any).id || '') : null,
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
            price: v.price !== undefined && (v.price as any) !== '' ? Number(v.price) : 0,
            cost: v.cost !== undefined && (v.cost as any) !== '' ? Number(v.cost) : 0,
            stock_quantity: v.stock_quantity !== undefined && (v.stock_quantity as any) !== '' ? Number(v.stock_quantity) : 0,
            image: v.image ? (typeof v.image === 'string' ? v.image.trim() : (v.image as any).id || '') : null,
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
      alert(`${t('products.errorSavingProductAndVariants')}: ${errMsg}`);
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-bold text-slate-600">{t('products.fetchingProductData')}</p>
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
            {t('common.back')}
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 dark:text-neutral-100">
                {productId ? `${t('products.editProductTitle')} ${title || (isPersian ? 'بدون نام' : 'Untitled')}` : t('products.newProductTitle')}
              </h1>
              <Badge variant={status === 'published' ? 'success' : status === 'archived' ? 'neutral' : 'warning'}>
                {status === 'published' ? t('products.statusPublished') : status === 'archived' ? t('products.statusArchived') : t('products.statusDraft')}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
              {t('products.productManagementSubtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onBack}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleSaveProductAndVariants}
            isLoading={isSaving}
            icon={<Save className="w-4 h-4" />}
          >
            {t('products.saveFullProductAndVariants')}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSaveProductAndVariants} className="space-y-6">
        {/* Section 1: مشخصات عمومی کالا */}
        <ProductGeneralSpecsCard
          productId={productId}
          title={title}
          setTitle={setTitle}
          slug={slug}
          setSlug={setSlug}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
          categoryOptions={getCategoryOptions()}
          onOpenAddCategory={() => setIsAddCategoryModalOpen(true)}
          collectionId={collectionId}
          setCollectionId={setCollectionId}
          collections={collections}
          onOpenAddCollection={() => setIsAddCollectionModalOpen(true)}
          seasonId={seasonId}
          setSeasonId={setSeasonId}
          seasons={seasons}
          onOpenAddSeason={() => setIsAddSeasonModalOpen(true)}
          brandId={brandId}
          setBrandId={setBrandId}
          brands={brands}
          onOpenAddBrand={() => setIsAddBrandModalOpen(true)}
          sizeGuideTemplateId={sizeGuideTemplateId}
          setSizeGuideTemplateId={setSizeGuideTemplateId}
          sizeGuides={sizeGuides}
          status={status}
          setStatus={setStatus}
          tags={tags}
          setTags={setTags}
          sort={sort}
          setSort={setSort}
          description={description}
          setDescription={setDescription}
          mainImage={mainImage}
          setMainImage={setMainImage}
        />

        {/* Section 2: جدول تنوع‌ها و موجودی انبار */}
        <Card>
          <ProductVariantMatrixSelector
            colors={colors}
            sizes={sizes}
            selectedColorIds={selectedColorIds}
            selectedSizeIds={selectedSizeIds}
            colorSearchQuery={colorSearchQuery}
            setColorSearchQuery={setColorSearchQuery}
            sizeSearchQuery={sizeSearchQuery}
            setSizeSearchQuery={setSizeSearchQuery}
            onToggleColor={handleToggleColor}
            onToggleSize={handleToggleSize}
            onSelectAllColors={handleSelectAllColors}
            onDeselectAllColors={handleDeselectAllColors}
            onSelectAllSizes={handleSelectAllSizes}
            onDeselectAllSizes={handleDeselectAllSizes}
            onOpenAddColor={(initialName) => {
              if (initialName) setNewColorName(initialName);
              setIsAddColorModalOpen(true);
            }}
            onOpenAddSize={(initialName) => {
              if (initialName) setNewSizeName(initialName);
              setIsAddSizeModalOpen(true);
            }}
          />

          <ProductVariantTable
            productId={productId}
            variants={variants}
            colors={colors}
            sizes={sizes}
            warehouses={warehouses}
            selectedWarehouseId={selectedWarehouseId}
            setSelectedWarehouseId={setSelectedWarehouseId}
            locations={locations}
            selectedLocationId={selectedLocationId}
            setSelectedLocationId={setSelectedLocationId}
            onUpdateVariantRow={handleUpdateVariantRow}
            onDeleteVariantRow={handleDeleteVariantRow}
            currency={activeOrganization?.currency}
            onApplyBulkValues={handleApplyBulkValues}
          />
        </Card>

        {/* Bottom Floating/Fixed Save Actions */}
        <div className="flex items-center justify-end gap-3 bg-white dark:bg-[#13151a] p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm">
          <Button type="button" variant="outline" onClick={onBack}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            isLoading={isSaving}
            icon={<Save className="w-4 h-4" />}
          >
            {t('products.saveFullProductAndVariants')}
          </Button>
        </div>
      </form>

      {/* Attribute Quick Creation Modals */}
      <ProductAttributeModals
        isAddColorModalOpen={isAddColorModalOpen}
        setIsAddColorModalOpen={setIsAddColorModalOpen}
        newColorName={newColorName}
        setNewColorName={setNewColorName}
        newColorHex={newColorHex}
        setNewColorHex={setNewColorHex}
        isCreatingColor={isCreatingColor}
        onCreateColor={handleCreateColorInline}

        isAddSizeModalOpen={isAddSizeModalOpen}
        setIsAddSizeModalOpen={setIsAddSizeModalOpen}
        newSizeName={newSizeName}
        setNewSizeName={setNewSizeName}
        isCreatingSize={isCreatingSize}
        onCreateSize={handleCreateSizeInline}

        isAddCategoryModalOpen={isAddCategoryModalOpen}
        setIsAddCategoryModalOpen={setIsAddCategoryModalOpen}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        newCategoryParentId={newCategoryParentId}
        setNewCategoryParentId={setNewCategoryParentId}
        isCreatingCategory={isCreatingCategory}
        onCreateCategory={handleCreateCategoryInline}
        categoryOptions={getCategoryOptions()}

        isAddCollectionModalOpen={isAddCollectionModalOpen}
        setIsAddCollectionModalOpen={setIsAddCollectionModalOpen}
        newCollectionName={newCollectionName}
        setNewCollectionName={setNewCollectionName}
        isCreatingCollection={isCreatingCollection}
        onCreateCollection={handleCreateCollectionInline}

        isAddSeasonModalOpen={isAddSeasonModalOpen}
        setIsAddSeasonModalOpen={setIsAddSeasonModalOpen}
        newSeasonName={newSeasonName}
        setNewSeasonName={setNewSeasonName}
        newSeasonCode={newSeasonCode}
        setNewSeasonCode={setNewSeasonCode}
        isCreatingSeason={isCreatingSeason}
        onCreateSeason={handleCreateSeasonInline}

        isAddBrandModalOpen={isAddBrandModalOpen}
        setIsAddBrandModalOpen={setIsAddBrandModalOpen}
        newBrandName={newBrandName}
        setNewBrandName={setNewBrandName}
        isCreatingBrand={isCreatingBrand}
        onCreateBrand={handleCreateBrandInline}
      />
    </div>
  );
};
