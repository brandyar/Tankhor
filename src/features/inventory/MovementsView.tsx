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
import { History, Search, ArrowUpRight, ArrowDownLeft, AlertCircle, RefreshCw, FileText, Warehouse as WarehouseIcon, Package } from 'lucide-react';

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
    const formattedQty = isPersian ? toPersianDigits(qty) : qty;
    switch (type) {
      case 'purchase':
        return (
          <Badge variant="success" className="gap-1">
            <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
            <span>{t('inventory.movementTypePurchase')} (+{formattedQty})</span>
          </Badge>
        );
      case 'sale':
        return (
          <Badge variant="danger" className="gap-1">
            <ArrowUpRight className="w-3 h-3 text-red-600" />
            <span>{t('inventory.movementTypeSale')} (-{formattedQty})</span>
          </Badge>
        );
      case 'return':
        return (
          <Badge variant="info" className="gap-1">
            <RefreshCw className="w-3 h-3 text-sky-600" />
            <span>{t('inventory.movementTypeReturn')} (+{formattedQty})</span>
          </Badge>
        );
      case 'damage':
        return (
          <Badge variant="danger" className="gap-1">
            <AlertCircle className="w-3 h-3 text-red-600" />
            <span>{t('inventory.movementTypeDamage')} (-{formattedQty})</span>
          </Badge>
        );
      case 'adjustment':
        return (
          <Badge variant="neutral" className="gap-1">
            <RefreshCw className="w-3 h-3 text-slate-600" />
            <span>{t('inventory.movementTypeAdjustment')} ({formattedQty})</span>
          </Badge>
        );
      case 'transfer_in':
        return (
          <Badge variant="info" className="gap-1">
            <ArrowDownLeft className="w-3 h-3 text-indigo-600" />
            <span>{t('inventory.movementTypeTransferIn')} (+{formattedQty})</span>
          </Badge>
        );
      case 'transfer_out':
        return (
          <Badge variant="warning" className="gap-1">
            <ArrowUpRight className="w-3 h-3 text-amber-600" />
            <span>{t('inventory.movementTypeTransferOut')} (-{formattedQty})</span>
          </Badge>
        );
      default:
        return <Badge variant="neutral">{type}</Badge>;
    }
  };

  const columns: Column<InventoryMovement>[] = [
    {
      key: 'created_at',
      header: t('inventory.dateTime'),
      render: (m) => (
        <span className="text-slate-600 dark:text-neutral-300 font-medium text-xs">
          {formatDate(m.created_at, isPersian)}
        </span>
      ),
    },
    {
      key: 'sku',
      header: t('inventory.itemSku'),
      render: (m) => (
        <span className="font-extrabold text-slate-900 dark:text-neutral-100 font-mono text-xs">
          {m.sku || `VAR-#${m.variant_id}`}
        </span>
      ),
    },
    {
      key: 'warehouse_id',
      header: t('inventory.relatedWarehouse'),
      render: (m) => (
        <span className="font-bold text-slate-800 dark:text-neutral-100">{m.warehouse_name || t('inventory.mainWarehouseDefault')}</span>
      ),
    },
    {
      key: 'type',
      header: t('inventory.movementTypeAndQty'),
      render: (m) => getMovementTypeBadge(m.type, m.quantity),
    },
    {
      key: 'reference_id',
      header: t('inventory.refDocNumber'),
      render: (m) => (
        <span className="font-mono text-xs text-slate-500 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md">
          {m.reference_id || '-'}
        </span>
      ),
    },
    {
      key: 'note',
      header: t('inventory.movementNote'),
      render: (m) => (
        <span className="text-slate-600 dark:text-neutral-300 text-xs truncate max-w-xs block">
          {m.note || '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('navigation.stockMovements')}
        subtitle={t('inventory.movementsViewSubtitle')}
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="w-full sm:w-72">
          <Input
            placeholder={t('inventory.searchMovementsPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <select
            value={selectedWarehouseFilter}
            onChange={(e) => setSelectedWarehouseFilter(e.target.value ? Number(e.target.value) : '')}
            className="flex-1 sm:flex-initial bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-xl text-slate-800 dark:text-neutral-100 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="">{t('inventory.allWarehousesOption')}</option>
            {warehouses.map((w, wIdx) => (
              <option key={`mov_wh_${w.id}_${wIdx}`} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value as MovementType | '')}
            className="flex-1 sm:flex-initial bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-xl text-slate-800 dark:text-neutral-100 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
          >
            <option value="">{t('inventory.allMovementTypes')}</option>
            <option value="purchase">{t('inventory.movementTypePurchase')}</option>
            <option value="sale">{t('inventory.movementTypeSale')}</option>
            <option value="return">{t('inventory.movementTypeReturn')}</option>
            <option value="adjustment">{t('inventory.movementTypeAdjustment')}</option>
            <option value="damage">{t('inventory.movementTypeDamage')}</option>
            <option value="transfer_in">{t('inventory.movementTypeTransferIn')}</option>
            <option value="transfer_out">{t('inventory.movementTypeTransferOut')}</option>
          </select>
        </div>
      </div>

      {/* 1. Desktop Tabular View */}
      <div className="hidden md:block bg-white dark:bg-[#13151a] border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl shadow-sm p-5 overflow-hidden">
        <DataTable
          columns={columns}
          data={movements}
          keyExtractor={(m) => m.id}
          isLoading={isLoading}
        />
      </div>

      {/* 2. Mobile Clean Card View */}
      <div className="block md:hidden">
        {isLoading ? (
          <div className="w-full py-12 flex flex-col items-center justify-center text-neutral-400">
            <div className="w-7 h-7 border-2 border-neutral-900 dark:border-neutral-100 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs font-mono text-neutral-500">{t('common.loadingData')}</span>
          </div>
        ) : movements.length === 0 ? (
          <div className="w-full py-12 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-center text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-900/40 p-6 text-center">
            <Package className="w-8 h-8 text-neutral-400 mb-2 stroke-1" />
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {movements.map((m) => {
              const sku = m.sku || `VAR-#${m.variant_id}`;
              const whName = m.warehouse_name || t('inventory.mainWarehouseDefault');
              return (
                <div
                  key={`mob_mov_${m.id}`}
                  className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#13151a] p-4 shadow-sm space-y-3 transition-all"
                >
                  {/* Top Row: SKU / Ref <---> Movement Type Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700">
                        {sku}
                      </span>
                      {m.reference_id && (
                        <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-850 px-2 py-0.5 rounded-lg border border-neutral-200/80 dark:border-neutral-700/80">
                          {m.reference_id}
                        </span>
                      )}
                    </div>

                    <div className="shrink-0">
                      {getMovementTypeBadge(m.type, m.quantity)}
                    </div>
                  </div>

                  {/* Middle Row: Warehouse Pill + Date */}
                  <div className="flex items-center justify-between gap-2 pt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-50 dark:bg-neutral-850 border border-neutral-200/80 dark:border-neutral-700/80">
                      <WarehouseIcon className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">{whName}</span>
                    </div>

                    <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
                      {formatDate(m.created_at, isPersian)}
                    </span>
                  </div>

                  {/* Bottom Row: Note if present */}
                  {m.note && (
                    <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      {m.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
