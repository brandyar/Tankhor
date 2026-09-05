import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Product, Category, Collection, Season, SizeGuideTemplate, Color, Size, Brand, ProductVariant } from '../../types';
import { toPersianDigits, formatDate, normalizeId } from '../../utils/formatters';
import { ProductEditView } from './ProductEditView';
import { ProductVariantsModal } from './ProductVariantsModal';
import { ProductImage } from '../../components/ui/ProductImage';
import { directusClient } from '../../api/directus';
import { confirmAction } from '../../utils/confirm';
import { Plus, Search, Trash2, Edit, Layers, Filter, X, RefreshCw } from 'lucide-react';

export const ProductsView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization, permissions } = useOrganization();

  const [products, setProducts] = useState<Product[]>([]);
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
  const [viewMode, setViewMode] = useState<'list' | 'edit'>('list');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  // Product Variants Modal
  const [activeProductForVariants, setActiveProductForVariants] = useState<Product | null>(null);
  const [isVariantsModalOpen, setIsVariantsModalOpen] = useState(false);

  const isPersian = locale === 'fa';

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;

      const [pList, cList, colList, seaList, bList, sgList, colorList, sizeList, vList] = await Promise.all([
        adapter.getProducts({ organization_id: orgId, search }),
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

      let filteredProducts = pList;

      // Filter by Category
      if (selectedCategoryFilter) {
        filteredProducts = filteredProducts.filter((p) => p.category_id === Number(selectedCategoryFilter));
      }

      // Filter by Brand
      if (selectedBrandFilter) {
        filteredProducts = filteredProducts.filter((p) => {
          const brandVal = typeof p.brand === 'string' ? p.brand : p.brand?.name || (typeof p.brand_id === 'object' ? (p.brand_id as any)?.name : '');
          if (typeof p.brand_id === 'number') {
            const matchedBrand = bList.find((b) => b.id === p.brand_id);
            if (matchedBrand && matchedBrand.name === selectedBrandFilter) return true;
          }
          return brandVal === selectedBrandFilter;
        });
      }

      // Filter by Collection
      if (selectedCollectionFilter) {
        filteredProducts = filteredProducts.filter((p) => p.collection_id === Number(selectedCollectionFilter));
      }

      // Filter by Season
      if (selectedSeasonFilter) {
        filteredProducts = filteredProducts.filter((p) => p.season_id === Number(selectedSeasonFilter));
      }

      // Filter by Color (Products with at least one variant of selected color)
      if (selectedColorFilter) {
        const matchingProductIds = new Set<number>();
        vList.forEach((v) => {
          const cId = normalizeId(v.color_id);
          if (cId === Number(selectedColorFilter)) {
            const pId = normalizeId(v.product_id);
            if (pId) matchingProductIds.add(pId);
          }
        });
        filteredProducts = filteredProducts.filter((p) => matchingProductIds.has(p.id));
      }

      setProducts(filteredProducts);
    } catch (err) {
      console.error('[ProductsView] Error loading products data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    activeOrganization,
    search,
    selectedCategoryFilter,
    selectedBrandFilter,
    selectedCollectionFilter,
    selectedSeasonFilter,
    selectedColorFilter,
  ]);

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
      const adapter = storageManager.getAdapter();
      await adapter.deleteProduct(id);
      await loadData();
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
      header: 'نام محصول / کالا',
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
              className="font-bold text-neutral-900 text-sm hover:text-blue-600 cursor-pointer transition-colors"
              onClick={() => handleEditProduct(p)}
            >
              {p.title}
            </p>
            <p className="text-[11px] font-mono text-neutral-400 mt-0.5">
              {p.brand || 'تن‌خور'} | اسلاگ: {p.slug || '-'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'category_id',
      header: 'دسته‌بندی و مجموعه',
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
            <span className="text-neutral-900 font-medium block text-xs">
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
          {p.status === 'published' ? 'منتشر شده' : 'پیش‌نویس'}
        </Badge>
      ),
    },
    {
      key: 'variants_count',
      header: 'تعداد تنوع (SKU)',
      render: (p) => (
        <button
          type="button"
          onClick={() => handleOpenVariantsModal(p)}
          className="font-mono text-xs font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 px-2.5 py-0.5 rounded-full border border-neutral-200/80 cursor-pointer transition-colors inline-flex items-center gap-1"
        >
          <Layers className="w-3 h-3 text-indigo-600" />
          <span>{toPersianDigits(p.variants_count || 0)} تنوع</span>
        </button>
      ),
    },
    {
      key: 'total_stock',
      header: 'کل موجودی انبار',
      render: (p) => (
        <span className="font-mono text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full">
          {toPersianDigits(p.total_stock || 0)} عدد
        </span>
      ),
    },
    {
      key: 'date_created',
      header: t('common.date'),
      render: (p) => <span className="text-slate-500">{formatDate(p.date_created, isPersian)}</span>,
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
        subtitle="مدیریت کاتالوگ کامل پوشاک، تنوع‌ها، برندها، مجموعه‌ها و فیلترهای پیشرفته"
        action={
          permissions.canEditProducts ? (
            <Button onClick={handleOpenNewProduct} icon={<Plus className="w-4 h-4" />}>
              {t('common.create')}
            </Button>
          ) : undefined
        }
      />

      <Card>
        {/* Search & Filters Bar */}
        <div className="space-y-3 mb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
            {/* Search Input */}
            <div className="lg:col-span-2">
              <Input
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-white border border-slate-300 rounded-xl text-slate-800 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">همه دسته‌بندی‌ها</option>
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
                className="w-full bg-white border border-slate-300 rounded-xl text-slate-800 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">همه برندها</option>
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
                className="w-full bg-white border border-slate-300 rounded-xl text-slate-800 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">همه کالکشن‌ها</option>
                {collections.map((col, colIdx) => (
                  <option key={`prod_col_${col.id}_${colIdx}`} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Season Filter */}
            <div>
              <select
                value={selectedSeasonFilter}
                onChange={(e) => setSelectedSeasonFilter(e.target.value ? Number(e.target.value) : '')}
                className="w-full bg-white border border-slate-300 rounded-xl text-slate-800 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">همه فصل‌ها</option>
                {seasons.map((s, sIdx) => (
                  <option key={`prod_season_${s.id}_${sIdx}`} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Color Filter & Filter Reset Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                <span>فیلتر رنگ:</span>
              </span>
              <select
                value={selectedColorFilter}
                onChange={(e) => setSelectedColorFilter(e.target.value ? Number(e.target.value) : '')}
                className="bg-white border border-slate-300 rounded-lg text-slate-800 text-xs px-3 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">همه رنگ‌ها</option>
                {colors.map((c, cIdx) => (
                  <option key={`prod_color_${c.id}_${cIdx}`} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                icon={<X className="w-3.5 h-3.5" />}
              >
                پاک کردن همه فیلترها
              </Button>
            )}
          </div>
        </div>

        <DataTable
          columns={columns}
          data={products}
          keyExtractor={(p) => p.id}
          isLoading={isLoading}
          actions={(p) => (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-indigo-600 hover:bg-indigo-50 font-bold"
                onClick={() => handleOpenVariantsModal(p)}
                title="نمایش تنوع‌های کالا"
                icon={<Layers className="w-3.5 h-3.5" />}
              >
                تنوع‌ها
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
    </div>
  );
};
