import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { InventoryMovement, MovementType, Warehouse } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { toPersianDigits, formatDate } from '../../utils/formatters';
import { History, Search, ArrowUpRight, ArrowDownLeft, AlertCircle, RefreshCw, FileText } from 'lucide-react';

export const MovementsView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState('');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<number | ''>('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<MovementType | ''>('');
  const [isLoading, setIsLoading] = useState(true);

  const isPersian = locale === 'fa';

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;

      const [mList, wList] = await Promise.all([
        adapter.getInventoryMovements({
          organization_id: orgId,
          warehouse_id: selectedWarehouseFilter ? Number(selectedWarehouseFilter) : undefined,
          type: selectedTypeFilter || undefined,
        }),
        adapter.getWarehouses({ organization_id: orgId }),
      ]);

      let filtered = mList;
      if (search.trim()) {
        const term = search.toLowerCase();
        filtered = mList.filter(
          (m) =>
            (m.sku && m.sku.toLowerCase().includes(term)) ||
            (m.reference_id && m.reference_id.toLowerCase().includes(term)) ||
            (m.note && m.note.toLowerCase().includes(term))
        );
      }

      setMovements(filtered);
      setWarehouses(wList);
    } catch (err) {
      console.error('[MovementsView] Error loading movements:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [activeOrganization, selectedWarehouseFilter, selectedTypeFilter, search]);

  const getMovementTypeBadge = (type: MovementType, qty: number) => {
    switch (type) {
      case 'purchase':
        return (
          <Badge variant="success" className="gap-1">
            <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
            <span>ورود خرید (+{toPersianDigits(qty)})</span>
          </Badge>
        );
      case 'sale':
        return (
          <Badge variant="danger" className="gap-1">
            <ArrowUpRight className="w-3 h-3 text-red-600" />
            <span>خروج فروش (-{toPersianDigits(qty)})</span>
          </Badge>
        );
      case 'return':
        return (
          <Badge variant="info" className="gap-1">
            <RefreshCw className="w-3 h-3 text-sky-600" />
            <span>مرجوعی (+{toPersianDigits(qty)})</span>
          </Badge>
        );
      case 'damage':
        return (
          <Badge variant="danger" className="gap-1">
            <AlertCircle className="w-3 h-3 text-red-600" />
            <span>ضایعات (-{toPersianDigits(qty)})</span>
          </Badge>
        );
      case 'adjustment':
        return (
          <Badge variant="neutral" className="gap-1">
            <RefreshCw className="w-3 h-3 text-slate-600" />
            <span>اصلاح موجودی ({toPersianDigits(qty)})</span>
          </Badge>
        );
      case 'transfer_in':
        return (
          <Badge variant="info" className="gap-1">
            <ArrowDownLeft className="w-3 h-3 text-indigo-600" />
            <span>ورود انتقال (+{toPersianDigits(qty)})</span>
          </Badge>
        );
      case 'transfer_out':
        return (
          <Badge variant="warning" className="gap-1">
            <ArrowUpRight className="w-3 h-3 text-amber-600" />
            <span>خروج انتقال (-{toPersianDigits(qty)})</span>
          </Badge>
        );
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  const columns: Column<InventoryMovement>[] = [
    {
      key: 'created_at',
      header: 'تاریخ و زمان',
      render: (m) => (
        <span className="text-slate-600 font-medium text-xs">
          {formatDate(m.created_at, isPersian)}
        </span>
      ),
    },
    {
      key: 'sku',
      header: 'شناسه کالا (SKU)',
      render: (m) => (
        <span className="font-extrabold text-slate-900 font-mono text-xs">
          {m.sku || `VAR-#${m.variant_id}`}
        </span>
      ),
    },
    {
      key: 'warehouse_id',
      header: 'انبار مربوطه',
      render: (m) => (
        <span className="font-bold text-slate-800">{m.warehouse_name || 'انبار مرکزی'}</span>
      ),
    },
    {
      key: 'type',
      header: 'نوع و تعداد گردش',
      render: (m) => getMovementTypeBadge(m.type, m.quantity),
    },
    {
      key: 'reference_id',
      header: 'شماره سند / مرجع',
      render: (m) => (
        <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
          {m.reference_id || '-'}
        </span>
      ),
    },
    {
      key: 'note',
      header: 'شرح گردش',
      render: (m) => (
        <span className="text-slate-600 text-xs truncate max-w-xs block">
          {m.note || '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('navigation.movements')}
        subtitle="سجل و دفتر روزنامه ثبت تمام ورودها، خروج‌ها، ضایعات و اصلاحات موجودی انبار"
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-72">
            <Input
              placeholder="جستجو با SKU، کد سند یا توضیحات..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <select
              value={selectedWarehouseFilter}
              onChange={(e) => setSelectedWarehouseFilter(e.target.value ? Number(e.target.value) : '')}
              className="bg-white border border-slate-300 rounded-xl text-slate-800 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">همه انبارها</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value as MovementType | '')}
              className="bg-white border border-slate-300 rounded-xl text-slate-800 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">همه انواع گردش</option>
              <option value="purchase">ورود خرید</option>
              <option value="sale">خروج فروش</option>
              <option value="return">ورود مرجوعی</option>
              <option value="adjustment">اصلاح موجودی</option>
              <option value="damage">اعلام ضایعات</option>
              <option value="transfer_in">ورود انتقال</option>
              <option value="transfer_out">خروج انتقال</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={movements}
          keyExtractor={(m) => m.id}
          isLoading={isLoading}
        />
      </Card>
    </div>
  );
};
