import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { Product, Category, Collection, Season, SizeGuideTemplate, Color, Size, Brand, ProductVariant } from '../../types';
import { toPersianDigits, formatDate, normalizeId, matchesSearchQuery, normalizeSearchText } from '../../utils/formatters';
import { ProductEditView } from './ProductEditView';
import { ProductVariantsModal } from './ProductVariantsModal';
import { ProductImage } from '../../components/ui/ProductImage';
import { WebcamScanButton } from '../../components/ui/WebcamScanButton';
import { WebcamBarcodeScannerModal } from '../../components/modals/WebcamBarcodeScannerModal';
import { directusClient } from '../../api/directus';
import { confirmAction } from '../../utils/confirm';
import { Plus, Search, Trash2, Edit, Layers, Filter, X, RefreshCw, FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { exportProductsToExcel, parseProductsFromExcel } from '../../utils/excelUtils';
import { useSwrRefresh } from '../../hooks/useSwrRefresh';

interface ProductsViewProps {
  initialCreateMode?: boolean;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ initialCreateMode = false }) => {
  const { t, locale } = useTranslation();
  const { activeOrganization, permissions } = useOrganization();

  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [sizeGuides, setSizeGuides] = useState<SizeGuideTemplate[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [allVariants, setAllVariants] = useState<ProductVariant[]>([]);

  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<number | ''>('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState<string | ''>('');
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<number | ''>('');
  const [selectedSeasonFilter, setSelectedSeasonFilter] = useState<number | ''>('');
  const [selectedColorFilter, setSelectedColorFilter] = useState<number | ''>('');

  const [isLoading, setIsLoading] = useState(true);

  // View mode: 'list' | 'edit'
  const [viewMode, setViewMode] = useState<'list' | 'edit'>(initialCreateMode ? 'edit' : 'list');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalServerCount, setTotalServerCount] = useState(0);

  // Product Variants Modal
  const [activeProductForVariants, setActiveProductForVariants] = useState<Product | null>(null);
  const [isVariantsModalOpen, setIsVariantsModalOpen] = useState(false);

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);
  const [isWebcamScannerOpen, setIsWebcamScannerOpen] = useState(false);
  const [excelFeedback, setExcelFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    details?: string[];
  } | null>(null);

  const isPersian = locale === 'fa';

  const loadAttributes = async () => {
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [cList, colList, seaList, bList, sgList, colorList, sizeList, vList] = await Promise.all([
        adapter.getCategories({ organization_id: orgId }),
        adapter.getCollections({ organization_id: orgId }),
        adapter.getSeasons({ organization_id: orgId }),
        adapter.getBrands({ organization_id: orgId }),
        adapter.getSizeGuideTemplates({ organization_id: orgId }),
        adapter.getColors({ organization_id: orgId }),
        adapter.getSizes({ organization_id: orgId }),
        adapter.getVariants({ organization_id: orgId }),
      ]);
      setCategories(cList);
      setCollections(colList);
      setSeasons(seaList);
      setBrands(bList);
      setSizeGuides(sgList);
      setColors(colorList);
      setSizes(sizeList);
      setAllVariants(vList);
    } catch (err) {
      console.error('[ProductsView] Error loading attributes:', err);
    }
  };

  const loadProducts = async (silent: boolean | unknown = false) => {
    if (silent !== true) setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;

      if (adapter.getPaginatedProducts) {
        const res = await adapter.getPaginatedProducts({
          organization_id: orgId,
          page: currentPage,
          limit: pageSize,
          search: search.trim() || undefined,
          category_id: selectedCategoryFilter ? Number(selectedCategoryFilter) : undefined,
        });
        setRawProducts(res.items);
        setTotalServerCount(res.totalCount);
      } else {
        const pList = await adapter.getProducts({ organization_id: orgId });
        setRawProducts(pList);
        setTotalServerCount(pList.length);
      }
    } catch (err) {
      console.error('[ProductsView] Error loading products data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = loadProducts;

  useEffect(() => {
    loadAttributes();
  }, [activeOrganization]);

  useEffect(() => {
    loadProducts();
  }, [activeOrganization, currentPage, pageSize, search, selectedCategoryFilter]);

  useSwrRefresh(
    ['products', 'product_variants', 'inventory_items', 'categories', 'collections', 'seasons', 'brands', 'colors', 'sizes'],
    () => {
      loadAttributes();
      loadProducts(true);
    }
  );

  useEffect(() => {
    const handleProductsChange = (e: any) => {
      const deletedId = e?.detail?.deletedId;
      if (deletedId !== undefined) {
        const normDelId = normalizeId(deletedId) || Number(deletedId);
        setRawProducts((prev) => prev.filter((p) => (normalizeId(p.id) || Number(p.id)) !== normDelId && p.id !== deletedId));
      }
      loadProducts();
    };
    window.addEventListener('tankhor_products_changed', handleProductsChange);
    return () => {
      window.removeEventListener('tankhor_products_changed', handleProductsChange);
    };
  }, [activeOrganization, currentPage, pageSize, search, selectedCategoryFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategoryFilter, selectedBrandFilter, selectedCollectionFilter, selectedSeasonFilter, selectedColorFilter]);

  // Client-side search and filtering using high-precision Persian/Arabic normalization
  const filteredProducts = useMemo(() => {
    let list = rawProducts;

    // 1. Search Query
    if (search && search.trim()) {
      const term = search.trim();
      list = list.filter((p) => {
        const pId = normalizeId(p.id) || Number(p.id);

        // Brand name resolution
        const brandName =
          typeof p.brand === 'string'
            ? p.brand
            : p.brand?.name ||
              (typeof p.brand_id === 'object' ? (p.brand_id as any)?.name : '') ||
              (typeof p.brand_id === 'number' ? brands.find((b) => b.id === p.brand_id)?.name : '') ||
              '';

        // Category name resolution
        const catId = normalizeId(p.category_id) || Number(p.category_id);
        const catName = categories.find((c) => (normalizeId(c.id) || Number(c.id)) === catId)?.name || '';

        // Collection name resolution
        const colId = normalizeId(p.collection_id) || Number(p.collection_id);
        const colName = collections.find((c) => (normalizeId(c.id) || Number(c.id)) === colId)?.name || '';

        // Season name resolution
        const seaId = normalizeId(p.season_id) || Number(p.season_id);
        const seaName = seasons.find((s) => (normalizeId(s.id) || Number(s.id)) === seaId)?.name || '';

        // Variants info (SKU, barcode, color name, size name)
        const pVariants = allVariants.filter((v) => (normalizeId(v.product_id) || Number(v.product_id)) === pId);
        const variantTexts = pVariants
          .map((v) => {
            const colorName =
              colors.find((c) => (normalizeId(c.id) || Number(c.id)) === (normalizeId(v.color_id) || Number(v.color_id)))?.name ||
              v.color_name ||
              '';
            const sizeName =
              sizes.find((s) => (normalizeId(s.id) || Number(s.id)) === (normalizeId(v.size_id) || Number(v.size_id)))?.name ||
              v.size_name ||
              '';
            return `${v.sku || ''} ${v.barcode || ''} ${colorName} ${sizeName}`;
          })
          .join(' ');

        return matchesSearchQuery(
          term,
          p.title,
          p.slug,
          (p as any).sku,
          (p as any).barcode,
          (p as any).code,
          p.description,
          p.tags,
          brandName,
          catName,
          colName,
          seaName,
          variantTexts
        );
      });
    }

    // 2. Category Filter
    if (selectedCategoryFilter) {
      list = list.filter((p) => (normalizeId(p.category_id) || Number(p.category_id)) === Number(selectedCategoryFilter));
    }

    // 3. Brand Filter
    if (selectedBrandFilter) {
      list = list.filter((p) => {
        const brandVal =
          typeof p.brand === 'string' ? p.brand : p.brand?.name || (typeof p.brand_id === 'object' ? (p.brand_id as any)?.name : '');
        if (typeof p.brand_id === 'number') {
          const matchedBrand = brands.find((b) => b.id === p.brand_id);
          if (matchedBrand && matchedBrand.name === selectedBrandFilter) return true;
        }
        return brandVal === selectedBrandFilter;
      });
    }

    // 4. Collection Filter
    if (selectedCollectionFilter) {
      list = list.filter((p) => (normalizeId(p.collection_id) || Number(p.collection_id)) === Number(selectedCollectionFilter));
    }

    // 5. Season Filter
    if (selectedSeasonFilter) {
      list = list.filter((p) => (normalizeId(p.season_id) || Number(p.season_id)) === Number(selectedSeasonFilter));
    }

    // 6. Color Filter
    if (selectedColorFilter) {
      const matchingProductIds = new Set<number>();
      allVariants.forEach((v) => {
        const cId = normalizeId(v.color_id);
        if (cId === Number(selectedColorFilter)) {
          const pId = normalizeId(v.product_id);
          if (pId) matchingProductIds.add(pId);
        }
      });
      list = list.filter((p) => matchingProductIds.has(normalizeId(p.id) || Number(p.id)));
    }

    return list;
  }, [
    rawProducts,
    search,
    selectedCategoryFilter,
    selectedBrandFilter,
    selectedCollectionFilter,
    selectedSeasonFilter,
    selectedColorFilter,
    allVariants,
    categories,
    brands,
    collections,
    seasons,
    colors,
    sizes,
  ]);

  const hasClientAdvancedFilters = Boolean(
    selectedBrandFilter ||
    selectedCollectionFilter ||
    selectedSeasonFilter ||
    selectedColorFilter
  );

  const totalProductsCount = hasClientAdvancedFilters ? filteredProducts.length : (totalServerCount || rawProducts.length);
  const totalPages = Math.ceil(totalProductsCount / pageSize) || 1;
  const paginatedProducts = useMemo(() => {
    if (!hasClientAdvancedFilters) {
      return rawProducts;
    }
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [hasClientAdvancedFilters, rawProducts, filteredProducts, currentPage, pageSize]);

  const handleOpenNewProduct = () => {
    setEditingProductId(null);
    setViewMode('edit');
  };

  const handleEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setViewMode('edit');
  };

  const handleOpenVariantsModal = (p: Product) => {
    setActiveProductForVariants(p);
    setIsVariantsModalOpen(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (await confirmAction(t('common.confirmDeleteMessage'))) {
      const normId = normalizeId(id) || Number(id);
      try {
        // Optimistically remove from state immediately for instant UI update on desktop & web
        setRawProducts((prev) => prev.filter((p) => (normalizeId(p.id) || Number(p.id)) !== normId && p.id !== id));
        const adapter = storageManager.getAdapter();
        await adapter.deleteProduct(normId);
        await loadData();
        window.dispatchEvent(new CustomEvent('tankhor_products_changed', { detail: { deletedId: normId } }));
      } catch (err) {
        console.error('[ProductsView] Error deleting product:', err);
        await loadData();
      }
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedCategoryFilter('');
    setSelectedBrandFilter('');
    setSelectedCollectionFilter('');
    setSelectedSeasonFilter('');
    setSelectedColorFilter('');
  };

  const hasActiveFilters =
    Boolean(search) ||
    Boolean(selectedCategoryFilter) ||
    Boolean(selectedBrandFilter) ||
    Boolean(selectedCollectionFilter) ||
    Boolean(selectedSeasonFilter) ||
    Boolean(selectedColorFilter);

  const columns: Column<Product>[] = [
    {
      key: 'title',
      header: t('products.productName'),
      render: (p) => (
        <div className="flex items-center gap-3">
          <ProductImage
            src={p.main_image}
            alt={p.title}
            fallbackText={p.title}
            containerClassName="w-10 h-10 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700 shadow-2xs"
          />
          <div>
            <p
              className="font-bold text-neutral-900 dark:text-neutral-100 text-sm hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
              onClick={() => handleEditProduct(p)}
            >
              {p.title}
            </p>
            <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
              {typeof p.brand === 'object' ? (p.brand as any)?.name : p.brand || t('products.defaultBrand')} | Slug: {p.slug || '-'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'category_id',
      header: `${t('products.category')} & ${t('products.collection')}`,
      render: (p) => {
        const cat = categories.find((c) => c.id === p.category_id);
        const col = collections.find((c) => c.id === p.collection_id);
        const parentCat = cat?.parent_id
          ? categories.find(
              (c) => c.id === (typeof cat.parent_id === 'number' ? cat.parent_id : cat.parent_id?.id)
            )
          : null;

        return (
          <div className="space-y-0.5">
            <span className="text-neutral-900 dark:text-neutral-100 font-medium block text-xs">
              {parentCat ? `${parentCat.name} > ` : ''}
              {cat?.name || '-'}
            </span>
            {col && <Badge variant="neutral">{col.name}</Badge>}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (p) => (
        <Badge variant={p.status === 'published' ? 'success' : 'warning'}>
          {p.status === 'published' ? t('common.published') : t('common.draft')}
        </Badge>
      ),
    },
    {
      key: 'variants_count',
      header: t('products.variantsCount'),
      render: (p) => (
        <button
          type="button"
          onClick={() => handleOpenVariantsModal(p)}
          className="font-mono text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 px-2.5 py-0.5 rounded-full border border-neutral-200/80 dark:border-neutral-700 cursor-pointer transition-colors inline-flex items-center gap-1"
        >
          <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
          <span>{isPersian ? toPersianDigits(p.variants_count || 0) : (p.variants_count || 0)}</span>
        </button>
      ),
    },
    {
      key: 'total_stock',
      header: t('products.totalStock'),
      render: (p) => (
        <span className="font-mono text-xs font-semibold text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 px-2.5 py-0.5 rounded-full">
          {isPersian ? toPersianDigits(p.total_stock || 0) : (p.total_stock || 0)}
        </span>
      ),
    },
    {
      key: 'date_created',
      header: t('common.date'),
      render: (p) => <span className="text-slate-500 dark:text-neutral-400">{formatDate(p.date_created, isPersian)}</span>,
    },
  ];

  const getCategoryFilterOptions = () => {
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

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    setExcelFeedback(null);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [allProds, freshVars] = await Promise.all([
        adapter.getProducts({ organization_id: orgId }),
        adapter.getVariants({ organization_id: orgId }),
      ]);

      let list = allProds;
      if (search && search.trim()) {
        const term = search.trim();
        list = list.filter((p) => {
          const pId = normalizeId(p.id) || Number(p.id);
          const brandName =
            typeof p.brand === 'string'
              ? p.brand
              : p.brand?.name ||
                (typeof p.brand_id === 'object' ? (p.brand_id as any)?.name : '') ||
                (typeof p.brand_id === 'number' ? brands.find((b) => b.id === p.brand_id)?.name : '') ||
                '';
          const catId = normalizeId(p.category_id) || Number(p.category_id);
          const catName = categories.find((c) => (normalizeId(c.id) || Number(c.id)) === catId)?.name || '';
          const colId = normalizeId(p.collection_id) || Number(p.collection_id);
          const colName = collections.find((c) => (normalizeId(c.id) || Number(c.id)) === colId)?.name || '';
          const seaId = normalizeId(p.season_id) || Number(p.season_id);
          const seaName = seasons.find((s) => (normalizeId(s.id) || Number(s.id)) === seaId)?.name || '';
          const pVariants = freshVars.filter((v) => (normalizeId(v.product_id) || Number(v.product_id)) === pId);
          const variantTexts = pVariants
            .map((v) => {
              const colorName =
                colors.find((c) => (normalizeId(c.id) || Number(c.id)) === (normalizeId(v.color_id) || Number(v.color_id)))?.name ||
                v.color_name ||
                '';
              const sizeName =
                sizes.find((s) => (normalizeId(s.id) || Number(s.id)) === (normalizeId(v.size_id) || Number(v.size_id)))?.name ||
                v.size_name ||
                '';
              return `${v.sku || ''} ${v.barcode || ''} ${colorName} ${sizeName}`;
            })
            .join(' ');
          return matchesSearchQuery(
            term,
            p.title,
            p.slug,
            (p as any).sku,
            (p as any).barcode,
            (p as any).code,
            p.description,
            p.tags,
            brandName,
            catName,
            colName,
            seaName,
            variantTexts
          );
        });
      }
      if (selectedCategoryFilter) {
        list = list.filter((p) => (normalizeId(p.category_id) || Number(p.category_id)) === Number(selectedCategoryFilter));
      }
      if (selectedBrandFilter) {
        list = list.filter((p) => {
          const brandVal =
            typeof p.brand === 'string' ? p.brand : p.brand?.name || (typeof p.brand_id === 'object' ? (p.brand_id as any)?.name : '');
          if (typeof p.brand_id === 'number') {
            const matchedBrand = brands.find((b) => b.id === p.brand_id);
            if (matchedBrand && matchedBrand.name === selectedBrandFilter) return true;
          }
          return brandVal === selectedBrandFilter;
        });
      }
      if (selectedCollectionFilter) {
        list = list.filter((p) => (normalizeId(p.collection_id) || Number(p.collection_id)) === Number(selectedCollectionFilter));
      }
      if (selectedSeasonFilter) {
        list = list.filter((p) => (normalizeId(p.season_id) || Number(p.season_id)) === Number(selectedSeasonFilter));
      }
      if (selectedColorFilter) {
        const matchingProductIds = new Set<number>();
        freshVars.forEach((v) => {
          const cId = normalizeId(v.color_id);
          if (cId === Number(selectedColorFilter)) {
            const pId = normalizeId(v.product_id);
            if (pId) matchingProductIds.add(pId);
          }
        });
        list = list.filter((p) => matchingProductIds.has(normalizeId(p.id) || Number(p.id)));
      }

      const exportedCount = exportProductsToExcel(
        list,
        freshVars,
        categories,
        brands,
        colors,
        sizes,
        undefined,
        { collections, seasons }
      );

      if (exportedCount === 0) {
        setExcelFeedback({
          type: 'warning',
          message: 'هیچ محصولی مطابق فیلترهای فعلی برای خروجی اکسل یافت نشد.',
        });
      } else {
        setExcelFeedback({
          type: 'success',
          message: `خروجی اکسل با موفقیت تهیه شد (${isPersian ? toPersianDigits(list.length) : list.length} محصول و ${isPersian ? toPersianDigits(exportedCount) : exportedCount} سطر تنوع).`,
        });
      }
    } catch (err: any) {
      setExcelFeedback({
        type: 'error',
        message: `خطا در تهیه خروجی اکسل: ${err?.message || err}`,
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingExcel(true);
    setExcelFeedback(null);
    try {
      const buffer = await file.arrayBuffer();
      const res = parseProductsFromExcel(buffer);
      if (!res.success || res.items.length === 0) {
        setExcelFeedback({
          type: 'error',
          message: 'خطا در خواندن فایل اکسل محصولات',
          details: res.errors.length > 0 ? res.errors.slice(0, 10) : ['هیچ ردیف معتبری یافت نشد.'],
        });
        return;
      }

      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;

      // Load fresh catalogs and attributes for accurate deduplication
      const [
        existingProducts,
        existingVariants,
        existingCats,
        existingBrands,
        existingCols,
        existingSeasons,
        existingColors,
        existingSizeGroups,
        existingSizes,
      ] = await Promise.all([
        adapter.getProducts({ organization_id: orgId }),
        adapter.getVariants({ organization_id: orgId }),
        adapter.getCategories({ organization_id: orgId }),
        adapter.getBrands({ organization_id: orgId }),
        adapter.getCollections({ organization_id: orgId }),
        adapter.getSeasons({ organization_id: orgId }),
        adapter.getColors({ organization_id: orgId }),
        adapter.getSizeGroups({ organization_id: orgId }),
        adapter.getSizes({ organization_id: orgId }),
      ]);

      const catByName = new Map(existingCats.map((c) => [normalizeSearchText(c.name), c]));
      const brandByName = new Map(existingBrands.map((b) => [normalizeSearchText(b.name), b]));
      const colByName = new Map(existingCols.map((c) => [normalizeSearchText(c.name), c]));
      const seasonByName = new Map(existingSeasons.map((s) => [normalizeSearchText(s.name), s]));
      const colorByName = new Map(existingColors.map((c) => [normalizeSearchText(c.name), c]));
      const sizeByName = new Map(existingSizes.map((s) => [normalizeSearchText(s.name), s]));

      const prodByCode = new Map<string, Product>();
      const prodByTitle = new Map<string, Product>();
      existingProducts.forEach((p) => {
        if ((p as any).code) prodByCode.set(normalizeSearchText((p as any).code), p);
        if (p.slug) prodByCode.set(normalizeSearchText(p.slug), p);
        if (p.title) prodByTitle.set(normalizeSearchText(p.title), p);
      });

      const varBySku = new Map<string, ProductVariant>();
      const varByBarcode = new Map<string, ProductVariant>();
      const varByComposite = new Map<string, ProductVariant>();
      existingVariants.forEach((v) => {
        if (v.sku) varBySku.set(normalizeSearchText(v.sku), v);
        if (v.barcode) varByBarcode.set(normalizeSearchText(v.barcode), v);
        const pId = normalizeId(v.product_id) || Number(v.product_id);
        const cId = normalizeId(v.color_id) || 0;
        const sId = normalizeId(v.size_id) || 0;
        varByComposite.set(`${pId}_${cId}_${sId}`, v);
      });

      let defaultSizeGroupId = existingSizeGroups[0]?.id;
      const getDefaultSizeGroupId = async () => {
        if (defaultSizeGroupId) return defaultSizeGroupId;
        const createdGroup = await adapter.saveSizeGroup({
          organization_id: orgId,
          name: 'سایزهای عمومی',
          category: 'apparel',
          status: 'active',
        });
        defaultSizeGroupId = createdGroup.id;
        return defaultSizeGroupId;
      };

      let createdProducts = 0;
      let updatedProducts = 0;
      let createdVariants = 0;
      let updatedVariants = 0;
      const importErrors: string[] = [...res.errors];

      for (const row of res.items) {
        try {
          // 1. Category
          let categoryId: number | undefined;
          if (row.categoryName) {
            const key = normalizeSearchText(row.categoryName);
            let cat = catByName.get(key);
            if (!cat) {
              cat = await adapter.saveCategory({
                organization_id: orgId,
                name: row.categoryName,
                slug: `cat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                status: 'active',
              });
              catByName.set(key, cat);
            }
            categoryId = cat.id;
          }

          // 2. Brand
          let brandId: number | undefined;
          if (row.brandName) {
            const key = normalizeSearchText(row.brandName);
            let br = brandByName.get(key);
            if (!br) {
              br = await adapter.saveBrand({
                organization_id: orgId,
                name: row.brandName,
                code: `BR-${Date.now().toString().slice(-4)}`,
                status: 'active',
              });
              brandByName.set(key, br);
            }
            brandId = br.id;
          }

          // 3. Collection
          let collectionId: number | undefined;
          if (row.collectionName) {
            const key = normalizeSearchText(row.collectionName);
            let col = colByName.get(key);
            if (!col) {
              col = await adapter.saveCollection({
                organization_id: orgId,
                name: row.collectionName,
                slug: `col-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                status: 'active',
              });
              colByName.set(key, col);
            }
            collectionId = col.id;
          }

          // 4. Season
          let seasonId: number | undefined;
          if (row.seasonName) {
            const key = normalizeSearchText(row.seasonName);
            let sea = seasonByName.get(key);
            if (!sea) {
              sea = await adapter.saveSeason({
                organization_id: orgId,
                name: row.seasonName,
                code: row.seasonName.slice(0, 16),
                status: 'active',
              });
              seasonByName.set(key, sea);
            }
            seasonId = sea.id;
          }

          // 5. Find or Create Product
          const codeKey = row.productCode ? normalizeSearchText(row.productCode) : '';
          const titleKey = normalizeSearchText(row.title);
          let product = (codeKey && prodByCode.get(codeKey)) || prodByTitle.get(titleKey);

          if (product) {
            const savedProd = await adapter.saveProduct({
              id: product.id,
              organization_id: orgId,
              title: row.title,
              ...(row.productCode ? { slug: row.productCode } : {}),
              ...(categoryId ? { category_id: categoryId } : {}),
              ...(brandId ? { brand_id: brandId } : {}),
              ...(collectionId ? { collection_id: collectionId } : {}),
              ...(seasonId ? { season_id: seasonId } : {}),
              ...(row.material ? { tags: row.material } : {}),
              status: row.productStatus,
            });
            product = savedProd;
            updatedProducts++;
          } else {
            const created = await adapter.saveProduct({
              organization_id: orgId,
              title: row.title,
              slug: row.productCode || `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              category_id: categoryId,
              brand_id: brandId,
              collection_id: collectionId,
              season_id: seasonId,
              tags: row.material || undefined,
              status: row.productStatus,
            });
            product = created;
            createdProducts++;
          }
          if (codeKey) prodByCode.set(codeKey, product);
          prodByTitle.set(titleKey, product);

          // 6. Variant (if row contains variant attributes/SKU/price)
          const hasVariantInfo = Boolean(
            row.sku ||
              row.barcode ||
              row.colorName ||
              row.sizeName ||
              row.price > 0 ||
              row.cost > 0 ||
              row.stockQuantity !== undefined
          );

          if (hasVariantInfo && product.id) {
            let colorId: number | undefined;
            if (row.colorName) {
              const key = normalizeSearchText(row.colorName);
              let colObj = colorByName.get(key);
              if (!colObj) {
                colObj = await adapter.saveColor({
                  organization_id: orgId,
                  name: row.colorName,
                  hex: row.colorHex || '#71717a',
                  code: row.colorHex || undefined,
                  status: 'active',
                });
                colorByName.set(key, colObj);
              }
              colorId = colObj.id;
            }

            let sizeId: number | undefined;
            if (row.sizeName) {
              const key = normalizeSearchText(row.sizeName);
              let szObj = sizeByName.get(key);
              if (!szObj) {
                const sgId = await getDefaultSizeGroupId();
                szObj = await adapter.saveSize({
                  organization_id: orgId,
                  size_group_id: sgId,
                  name: row.sizeName,
                  code: row.sizeName.slice(0, 10),
                  status: 'active',
                });
                sizeByName.set(key, szObj);
              }
              sizeId = szObj.id;
            }

            const skuKey = row.sku ? normalizeSearchText(row.sku) : '';
            const barcodeKey = row.barcode ? normalizeSearchText(row.barcode) : '';
            const compKey = `${product.id}_${colorId || 0}_${sizeId || 0}`;

            const existingVar =
              (skuKey && varBySku.get(skuKey)) ||
              (barcodeKey && varByBarcode.get(barcodeKey)) ||
              varByComposite.get(compKey);

            const savedVar = await adapter.saveVariant({
              id: existingVar?.id,
              organization_id: orgId,
              product_id: product.id,
              color_id: colorId ?? (existingVar ? normalizeId(existingVar.color_id) : undefined),
              size_id: sizeId ?? (existingVar ? normalizeId(existingVar.size_id) : undefined),
              sku: row.sku || existingVar?.sku || `SKU-${product.id}-${Date.now().toString().slice(-4)}`,
              barcode: row.barcode || existingVar?.barcode || undefined,
              price: row.price,
              cost: row.cost,
              ...(row.stockQuantity !== undefined ? { stock_quantity: row.stockQuantity } : {}),
              status: row.variantStatus,
            });

            if (existingVar) {
              updatedVariants++;
            } else {
              createdVariants++;
            }
            if (savedVar.sku) varBySku.set(normalizeSearchText(savedVar.sku), savedVar);
            if (savedVar.barcode) varByBarcode.set(normalizeSearchText(savedVar.barcode), savedVar);
            varByComposite.set(`${product.id}_${colorId || 0}_${sizeId || 0}`, savedVar);
          }
        } catch (rowErr: any) {
          importErrors.push(`سطر ${row.rowNumber} (${row.title}): ${rowErr?.message || rowErr}`);
        }
      }

      await Promise.all([loadAttributes(), loadProducts()]);

      const formatCount = (n: number) => (isPersian ? toPersianDigits(n) : String(n));
      setExcelFeedback({
        type: importErrors.length > 0 && createdProducts + createdVariants + updatedVariants === 0 ? 'error' : importErrors.length > 0 ? 'warning' : 'success',
        message: `ورود اطلاعات از اکسل انجام شد: ${formatCount(createdProducts)} محصول جدید، ${formatCount(updatedProducts)} محصول به‌روزرسانی، ${formatCount(createdVariants)} تنوع جدید و ${formatCount(updatedVariants)} تنوع به‌روزرسانی گردید.`,
        details: importErrors.length > 0 ? importErrors.slice(0, 10) : undefined,
      });
    } catch (err: any) {
      setExcelFeedback({
        type: 'error',
        message: `خطا در پردازش فایل اکسل: ${err?.message || err}`,
      });
    } finally {
      setIsImportingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (viewMode === 'edit') {
    return (
      <ProductEditView
        productId={editingProductId}
        onBack={() => setViewMode('list')}
        onSaved={loadData}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('navigation.allProducts')}
        subtitle={t('products.subtitle')}
        action={
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportExcel}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              isLoading={isImportingExcel}
              onClick={() => fileInputRef.current?.click()}
              icon={<Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-500 dark:text-neutral-400" />}
            >
              <span className="hidden sm:inline">ورود اکسل</span>
              <span className="sm:hidden">ورود</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              isLoading={isExportingExcel}
              onClick={handleExportExcel}
              icon={<FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />}
            >
              <span className="hidden sm:inline">خروجی اکسل</span>
              <span className="sm:hidden">خروجی</span>
            </Button>
            {permissions.canEditProducts && (
              <Button size="sm" onClick={handleOpenNewProduct} icon={<Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}>
                {t('common.create')}
              </Button>
            )}
          </div>
        }
      />

      {excelFeedback && (
        <div
          className={`flex items-start gap-3 p-4 rounded-xl border text-xs font-medium ${
            excelFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
              : excelFeedback.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/60 text-red-900 dark:text-red-200'
          }`}
        >
          {excelFeedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 space-y-1">
            <p className="font-bold">{excelFeedback.message}</p>
            {excelFeedback.details && excelFeedback.details.length > 0 && (
              <ul className="list-disc list-inside text-[11px] opacity-90 space-y-0.5">
                {excelFeedback.details.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            onClick={() => setExcelFeedback(null)}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 px-1"
          >
            ×
          </button>
        </div>
      )}

      <Card className="border-0 sm:border bg-transparent sm:bg-white dark:sm:bg-[#181a20] shadow-none sm:shadow-sm p-0 sm:p-5 md:p-6">
        {/* Search & Filters Bar */}
        <div className="space-y-3 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
            {/* Search Input */}
            <div className="sm:col-span-2 lg:col-span-2 flex items-center gap-1.5">
              <div className="relative flex-1">
                <Input
                  placeholder={t('products.searchPlaceholder', 'جستجو در نام، کد مدل، بارکد، رنگ، سایز، برند و...')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  icon={<Search className="w-4 h-4" />}
                  className={search ? 'pe-8' : ''}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute inset-y-0 end-0 pe-2.5 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
                    title={t('common.clear') || 'پاک کردن'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <WebcamScanButton
                size="md"
                onClick={() => setIsWebcamScannerOpen(true)}
              />
            </div>

            {/* Category Filter */}
            <div className="sm:col-span-1 lg:col-span-2">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-xl text-slate-800 dark:text-neutral-200 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">{t('products.allCategories')}</option>
                {getCategoryFilterOptions().map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Brand Filter */}
            <div>
              <select
                value={selectedBrandFilter}
                onChange={(e) => setSelectedBrandFilter(e.target.value)}
                className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-xl text-slate-800 dark:text-neutral-200 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">{t('products.allBrands')}</option>
                {brands.map((b, bIdx) => (
                  <option key={`prod_brand_${b.id || b.name}_${bIdx}`} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Collection Filter */}
            <div>
              <select
                value={selectedCollectionFilter}
                onChange={(e) => setSelectedCollectionFilter(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-xl text-slate-800 dark:text-neutral-200 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">{t('products.allCollections')}</option>
                {collections.map((col, colIdx) => (
                  <option key={`prod_col_${col.id}_${colIdx}`} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Color & Season Filters & Filter Reset Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 dark:border-neutral-800">
            <div className="flex flex-wrap items-center gap-2">
              {/* Season */}
              <select
                value={selectedSeasonFilter}
                onChange={(e) => setSelectedSeasonFilter(e.target.value ? Number(e.target.value) : '')}
                className="bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-800 dark:text-neutral-200 text-xs px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">{t('products.allSeasons')}</option>
                {seasons.map((s, sIdx) => (
                  <option key={`prod_season_${s.id}_${sIdx}`} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Color */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-600 dark:text-neutral-300 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span className="hidden sm:inline">{t('products.filterColor')}</span>
                </span>
                <select
                  value={selectedColorFilter}
                  onChange={(e) => setSelectedColorFilter(e.target.value ? Number(e.target.value) : '')}
                  className="bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-lg text-slate-800 dark:text-neutral-200 text-xs px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">{t('products.allColors')}</option>
                  {colors.map((c, cIdx) => (
                    <option key={`prod_color_${c.id}_${cIdx}`} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                icon={<X className="w-3.5 h-3.5" />}
              >
                {t('products.clearAllFilters')}
              </Button>
            )}
          </div>
        </div>

        {/* 1. Desktop Tabular View */}
        <div className="hidden md:block">
          <DataTable
            columns={columns}
            data={paginatedProducts}
            keyExtractor={(p) => p.id}
            isLoading={isLoading}
            actions={(p) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-indigo-600 hover:bg-indigo-50 font-bold"
                  onClick={() => handleOpenVariantsModal(p)}
                  title={t('products.showProductVariants')}
                  icon={<Layers className="w-3.5 h-3.5" />}
                >
                  {t('products.variants')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditProduct(p)}
                  icon={<Edit className="w-3.5 h-3.5" />}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => handleDeleteProduct(p.id)}
                  icon={<Trash2 className="w-3.5 h-3.5" />}
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
          ) : paginatedProducts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-neutral-500 text-sm">
              {t('common.noData')}
            </div>
          ) : (
            paginatedProducts.map((p) => {
              const cat = categories.find((c) => c.id === p.category_id);
              const col = collections.find((c) => c.id === p.collection_id);
              const brandName =
                typeof p.brand === 'object' ? (p.brand as any)?.name : p.brand || (typeof p.brand_id === 'number' ? brands.find((b) => b.id === p.brand_id)?.name : '') || t('products.defaultBrand');

              return (
                <div
                  key={`mob_prod_${p.id}`}
                  className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#13151a] p-4 shadow-sm space-y-3 transition-all"
                >
                  {/* Top Section: Thumbnail + Title + Brand/Category + Status */}
                  <div className="flex items-start gap-3">
                    <ProductImage
                      src={p.main_image}
                      alt={p.title}
                      fallbackText={p.title}
                      containerClassName="w-12 h-12 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-200 dark:border-neutral-700 shadow-2xs"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          className="font-bold text-neutral-900 dark:text-neutral-100 text-sm leading-snug hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                          onClick={() => handleEditProduct(p)}
                        >
                          {p.title}
                        </h3>
                        <Badge variant={p.status === 'published' ? 'success' : 'warning'} className="shrink-0 text-[10px]">
                          {p.status === 'published' ? t('common.published') : t('common.draft')}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        {brandName && (
                          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                            {brandName}
                          </span>
                        )}
                        {cat && (
                          <>
                            <span className="text-neutral-300 dark:text-neutral-600">•</span>
                            <span>{cat.name}</span>
                          </>
                        )}
                        {col && (
                          <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-1.5 py-0.5 rounded">
                            {col.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle Meta Matrix: Stock + Variants Count + Date */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/80 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800">
                      <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">{t('products.totalStock')}:</span>
                      <span className="font-mono font-bold text-amber-900 dark:text-amber-300">
                        {isPersian ? toPersianDigits(p.total_stock || 0) : (p.total_stock || 0)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenVariantsModal(p)}
                      className="flex items-center justify-between p-2 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100/80 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/70 transition-colors"
                    >
                      <span className="flex items-center gap-1 text-[11px]">
                        <Layers className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        {t('products.variants')}:
                      </span>
                      <span className="font-mono font-bold">
                        {isPersian ? toPersianDigits(p.variants_count || 0) : (p.variants_count || 0)}
                      </span>
                    </button>
                  </div>

                  {/* Bottom Actions Row */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-neutral-400 font-mono">
                      {formatDate(p.date_created, isPersian)}
                    </span>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-semibold px-2 py-1 h-8"
                        onClick={() => handleOpenVariantsModal(p)}
                        icon={<Layers className="w-3.5 h-3.5" />}
                      >
                        {t('products.variants')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 px-2 py-1 h-8"
                        onClick={() => handleEditProduct(p)}
                        icon={<Edit className="w-3.5 h-3.5" />}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 px-2 py-1 h-8"
                        onClick={() => handleDeleteProduct(p.id)}
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Universal Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalProductsCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          className="mt-4"
        />
      </Card>

      {/* Product Variants Modal */}
      <ProductVariantsModal
        isOpen={isVariantsModalOpen}
        onClose={() => setIsVariantsModalOpen(false)}
        product={activeProductForVariants}
        colors={colors}
        sizes={sizes}
        onEditProduct={(p) => handleEditProduct(p)}
      />

      {/* Webcam Barcode Scanner Modal */}
      <WebcamBarcodeScannerModal
        isOpen={isWebcamScannerOpen}
        onClose={() => setIsWebcamScannerOpen(false)}
        onScan={(code) => setSearch(code)}
      />
    </div>
  );
};
