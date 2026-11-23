import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import {
  Customer,
  Order,
  OrderReturn,
  OrderReturnItem,
  OrderReturnReason,
  OrderReturnSettlementMethod,
  Product,
  ProductVariant,
  Warehouse,
} from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable } from '../../components/ui/DataTable';
import { Pagination } from '../../components/ui/Pagination';
import { formatCurrency, formatDate, toPersianDigits } from '../../utils/formatters';
import { printReturnReceipt } from '../../utils/returnReceiptPrint';
import { OrderReturnExchangeModal } from './components/OrderReturnExchangeModal';
import { useSwrRefresh } from '../../hooks/useSwrRefresh';
import {
  RotateCcw,
  ArrowLeftRight,
  Plus,
  Search,
  Eye,
  Printer,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  FileText,
  User,
  Sparkles,
  ShoppingCart,
} from 'lucide-react';

export const ReturnsView: React.FC = () => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';
  const { activeOrganization, permissions } = useOrganization();

  const [returns, setReturns] = useState<OrderReturn[]>([]);
  const [allReturnItems, setAllReturnItems] = useState<OrderReturnItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // New Return -> Order Picker Modal
  const [isOrderPickerOpen, setIsOrderPickerOpen] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [activeOrderForReturn, setActiveOrderForReturn] = useState<Order | null>(null);

  // Detail Modal
  const [selectedReturn, setSelectedReturn] = useState<OrderReturn | null>(null);
  const [selectedReturnItems, setSelectedReturnItems] = useState<OrderReturnItem[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const loadData = async (silent: boolean | unknown = false) => {
    if (silent !== true) setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;

      const [retList, retItemsList, ordList, custList, whList, prodList, varList] =
        await Promise.all([
          adapter.getOrderReturns
            ? adapter.getOrderReturns({ organization_id: orgId })
            : Promise.resolve([]),
          adapter.getOrderReturnItems
            ? adapter.getOrderReturnItems()
            : Promise.resolve([]),
          adapter.getOrders({ organization_id: orgId }),
          adapter.getCustomers({ organization_id: orgId }),
          adapter.getWarehouses({ organization_id: orgId }),
          adapter.getProducts({ organization_id: orgId }),
          adapter.getVariants({ organization_id: orgId }),
        ]);

      const enrichedOrders = ordList.map((o) => {
        const cId = typeof o.customer_id === 'object' ? (o.customer_id as any)?.id : o.customer_id;
        const wId = typeof o.warehouse_id === 'object' ? (o.warehouse_id as any)?.id : o.warehouse_id;
        const cust = custList.find((c) => Number(c.id) === Number(cId));
        const wh = whList.find((w) => Number(w.id) === Number(wId));
        return {
          ...o,
          customer_name: cust?.name || (o as any).customer_name || t('orders.generalCustomer'),
          warehouse_name: wh?.name || (o as any).warehouse_name || t('orders.defaultWarehouse'),
        };
      });

      const enrichedReturns: OrderReturn[] = retList.map((r) => {
        const origOrdId =
          typeof r.original_order_id === 'object'
            ? (r.original_order_id as any)?.id
            : r.original_order_id;
        const origOrd = enrichedOrders.find((o) => Number(o.id) === Number(origOrdId));
        const cId = typeof r.customer_id === 'object' ? (r.customer_id as any)?.id : r.customer_id;
        const cust = custList.find((c) => Number(c.id) === Number(cId));
        const wId =
          typeof r.warehouse_id === 'object' ? (r.warehouse_id as any)?.id : r.warehouse_id;
        const wh = whList.find((w) => Number(w.id) === Number(wId));

        return {
          ...r,
          original_order_number:
            r.original_order_number || origOrd?.order_number || `#${origOrdId}`,
          customer_name:
            r.customer_name ||
            cust?.name ||
            origOrd?.customer_name ||
            t('orders.generalCustomer'),
          warehouse_name: r.warehouse_name || wh?.name || t('orders.defaultWarehouse'),
        };
      });

      // Sort newest first
      enrichedReturns.sort(
        (a, b) =>
          new Date(b.return_date || b.date_created || 0).getTime() -
          new Date(a.return_date || a.date_created || 0).getTime()
      );

      setReturns(enrichedReturns);
      setAllReturnItems(retItemsList);
      setOrders(enrichedOrders);
      setCustomers(custList);
      setWarehouses(whList);
      setProducts(prodList);
      setVariants(varList);
    } catch (err) {
      console.error('[ReturnsView] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization?.id]);

  useSwrRefresh(['order_returns', 'order_return_items', 'orders'], () => loadData(true));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, reasonFilter, statusFilter]);

  const enrichReturnItems = (rawItems: OrderReturnItem[]): OrderReturnItem[] => {
    return rawItems.map((it) => {
      const vId =
        typeof it.variant_id === 'object' ? (it.variant_id as any)?.id : it.variant_id;
      const matchedVar = variants.find((v) => Number(v.id) === Number(vId));
      const pId = matchedVar
        ? typeof matchedVar.product_id === 'object'
          ? (matchedVar.product_id as any)?.id
          : matchedVar.product_id
        : undefined;
      const matchedProd = pId ? products.find((p) => Number(p.id) === Number(pId)) : undefined;

      return {
        ...it,
        sku: it.sku || matchedVar?.sku || '-',
        product_title:
          it.product_title ||
          matchedProd?.title ||
          matchedVar?.product_title ||
          t('orders.orderedItem'),
        color_name: it.color_name || matchedVar?.color_name,
        size_name: it.size_name || matchedVar?.size_name,
      };
    });
  };

  const handleOpenDetail = async (ret: OrderReturn) => {
    setSelectedReturn(ret);
    setIsDetailOpen(true);

    try {
      const adapter = storageManager.getAdapter();
      const raw = adapter.getOrderReturnItems
        ? await adapter.getOrderReturnItems(ret.id)
        : allReturnItems.filter((i) => {
            const rId =
              typeof i.return_id === 'object' ? (i.return_id as any)?.id : i.return_id;
            return Number(rId) === Number(ret.id);
          });
      setSelectedReturnItems(enrichReturnItems(raw));
    } catch {
      setSelectedReturnItems([]);
    }
  };

  const handleQuickPrint = async (ret: OrderReturn, format: 'a4' | 'thermal') => {
    try {
      const adapter = storageManager.getAdapter();
      const raw = adapter.getOrderReturnItems
        ? await adapter.getOrderReturnItems(ret.id)
        : [];
      await printReturnReceipt({
        orderReturn: ret,
        items: enrichReturnItems(raw),
        organization: activeOrganization,
        format,
        isPersian,
      });
    } catch (err) {
      console.error('[ReturnsView] Quick print error:', err);
    }
  };

  const getReasonLabel = (reason?: OrderReturnReason) => {
    switch (reason) {
      case 'size_mismatch':
        return t('orders.reasonSizeMismatch');
      case 'color_mismatch':
        return t('orders.reasonColorMismatch');
      case 'defective':
        return t('orders.reasonDefective');
      case 'wrong_item':
        return t('orders.reasonWrongItem');
      case 'customer_changed_mind':
        return t('orders.reasonChangedMind');
      case 'other':
        return t('orders.reasonOther');
      default:
        return '—';
    }
  };

  const getSettlementLabel = (method?: OrderReturnSettlementMethod) => {
    switch (method) {
      case 'cash':
        return t('orders.settlementCash');
      case 'pos':
        return t('orders.settlementPos');
      case 'card':
        return t('orders.settlementCard');
      case 'bank':
        return t('orders.settlementBank');
      case 'store_credit':
        return t('orders.settlementStoreCredit');
      case 'credit':
        return t('orders.settlementCredit');
      case 'none':
        return t('orders.settlementNone');
      default:
        return '—';
    }
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const completed = returns.filter((r) => r.status === 'completed');
    const totalDocs = completed.length;
    const totalReturnedValue = completed.reduce((s, r) => s + (Number(r.returned_total) || 0), 0);
    const totalExchangedValue = completed.reduce((s, r) => s + (Number(r.exchange_total) || 0), 0);

    const completedIds = new Set(completed.map((r) => Number(r.id)));
    const damagedQty = allReturnItems
      .filter((it) => {
        const rId = typeof it.return_id === 'object' ? (it.return_id as any)?.id : it.return_id;
        return (
          completedIds.has(Number(rId)) &&
          it.item_type === 'returned' &&
          it.condition === 'damaged'
        );
      })
      .reduce((s, it) => s + (Number(it.quantity) || 0), 0);

    // Top reason insight
    const reasonCounts = new Map<OrderReturnReason, number>();
    completed.forEach((r) => {
      if (r.reason) {
        reasonCounts.set(r.reason, (reasonCounts.get(r.reason) || 0) + 1);
      }
    });
    let topReason: OrderReturnReason | null = null;
    let topCount = 0;
    reasonCounts.forEach((cnt, rsn) => {
      if (cnt > topCount) {
        topCount = cnt;
        topReason = rsn;
      }
    });
    const topPct = totalDocs > 0 ? Math.round((topCount / totalDocs) * 100) : 0;

    return { totalDocs, totalReturnedValue, totalExchangedValue, damagedQty, topReason, topPct };
  }, [returns, allReturnItems]);

  // Filtered returns
  const filteredReturns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return returns.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (reasonFilter !== 'all' && r.reason !== reasonFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q) {
        const matchNum = (r.return_number || '').toLowerCase().includes(q);
        const matchOrig = (r.original_order_number || '').toLowerCase().includes(q);
        const matchCust = (r.customer_name || '').toLowerCase().includes(q);
        if (!matchNum && !matchOrig && !matchCust) return false;
      }
      return true;
    });
  }, [returns, search, typeFilter, reasonFilter, statusFilter]);

  const paginatedReturns = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReturns.slice(start, start + pageSize);
  }, [filteredReturns, currentPage, pageSize]);

  // Eligible orders for the Order Picker Modal
  const eligibleOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders
      .filter((o) =>
        ['confirmed', 'processing', 'completed', 'partially_returned'].includes(o.status)
      )
      .filter((o) => {
        if (!q) return true;
        return (
          (o.order_number || '').toLowerCase().includes(q) ||
          (o.customer_name || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 30);
  }, [orders, orderSearch]);

  const renderNetBadge = (net: number) => {
    if (net < 0) {
      return (
        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
          - {formatCurrency(Math.abs(net), 'TOMAN', isPersian)}
        </span>
      );
    }
    if (net > 0) {
      return (
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
          + {formatCurrency(net, 'TOMAN', isPersian)}
        </span>
      );
    }
    return (
      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
        {isPersian ? '۰ (سر‌به‌سر)' : '0 (Even)'}
      </span>
    );
  };

  return (
    <div className="space-y-6 font-sans">
      <PageHeader
        title={t('orders.returnsTitle')}
        subtitle={t('orders.returnsSubtitle')}
        action={
          permissions.canCreateOrders && (
            <Button
              size="sm"
              onClick={() => {
                setOrderSearch('');
                setIsOrderPickerOpen(true);
              }}
              icon={<Plus className="w-4 h-4" />}
            >
              <span>{t('orders.newReturnExchange')}</span>
            </Button>
          )
        }
      />

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 bg-white dark:bg-[#181a20] border border-neutral-200/80 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {t('orders.kpiTotalDocs')}
            </span>
            <FileText className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black font-mono text-neutral-900 dark:text-white">
            {isPersian ? toPersianDigits(kpis.totalDocs) : kpis.totalDocs}
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#181a20] border border-neutral-200/80 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {t('orders.kpiReturnedValue')}
            </span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg font-black font-mono text-rose-600 dark:text-rose-400">
            {formatCurrency(kpis.totalReturnedValue, 'TOMAN', isPersian)}
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#181a20] border border-neutral-200/80 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {t('orders.kpiExchangedValue')}
            </span>
            <ArrowLeftRight className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
            {formatCurrency(kpis.totalExchangedValue, 'TOMAN', isPersian)}
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-[#181a20] border border-neutral-200/80 dark:border-neutral-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {t('orders.kpiDamagedCount')}
            </span>
            <ShieldAlert className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
            {isPersian ? toPersianDigits(kpis.damagedQty) : kpis.damagedQty}
          </div>
        </Card>
      </div>

      {/* Top Reason Insight Banner */}
      {kpis.topReason && (
        <div className="px-4 py-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50 flex items-center gap-2 text-xs text-indigo-900 dark:text-indigo-200">
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>
            {t('orders.topReasonInsight')}{' '}
            <strong>{getReasonLabel(kpis.topReason)}</strong>{' '}
            <span className="font-mono opacity-80">
              ({isPersian ? toPersianDigits(kpis.topPct) : kpis.topPct}٪)
            </span>
          </span>
        </div>
      )}

      {/* Main Listing Card */}
      <Card className="border-0 sm:border bg-transparent sm:bg-white dark:sm:bg-[#181a20] shadow-none sm:shadow-sm p-0 sm:p-5 md:p-6">
        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Input
            placeholder={t('orders.searchReturnsPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: 'all', label: t('orders.allTypes') },
              { value: 'return', label: t('orders.typeReturn') },
              { value: 'exchange', label: t('orders.typeExchange') },
            ]}
          />
          <Select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            options={[
              { value: 'all', label: t('orders.allReasons') },
              { value: 'size_mismatch', label: t('orders.reasonSizeMismatch') },
              { value: 'color_mismatch', label: t('orders.reasonColorMismatch') },
              { value: 'defective', label: t('orders.reasonDefective') },
              { value: 'wrong_item', label: t('orders.reasonWrongItem') },
              { value: 'customer_changed_mind', label: t('orders.reasonChangedMind') },
              { value: 'other', label: t('orders.reasonOther') },
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'all', label: t('orders.allStatuses') },
              { value: 'completed', label: t('orders.returnStatusCompleted') },
              { value: 'pending', label: t('orders.returnStatusPending') },
              { value: 'cancelled', label: t('orders.returnStatusCancelled') },
            ]}
          />
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <DataTable<OrderReturn>
            data={paginatedReturns}
            keyExtractor={(r) => r.id}
            isLoading={isLoading}
            emptyMessage={t('orders.noReturnsYet')}
            columns={[
              {
                key: 'return_number',
                header: t('orders.returnNumber'),
                render: (r) => (
                  <div>
                    <span className="font-mono font-bold text-slate-900 dark:text-neutral-100 text-xs">
                      {r.return_number}
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatDate(r.return_date || r.date_created, isPersian)}
                    </div>
                  </div>
                ),
              },
              {
                key: 'original_order_number',
                header: t('orders.originalOrder'),
                render: (r) => (
                  <span className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    {r.original_order_number}
                  </span>
                ),
              },
              {
                key: 'customer_name',
                header: t('orders.customer'),
                render: (r) => (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-neutral-100">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{r.customer_name}</span>
                  </div>
                ),
              },
              {
                key: 'type',
                header: t('orders.returnType'),
                render: (r) =>
                  r.type === 'exchange' ? (
                    <Badge variant="info">{t('orders.typeExchange')}</Badge>
                  ) : (
                    <Badge variant="danger">{t('orders.typeReturn')}</Badge>
                  ),
              },
              {
                key: 'reason',
                header: t('orders.returnReason'),
                render: (r) => (
                  <span className="text-xs text-slate-600 dark:text-neutral-300">
                    {getReasonLabel(r.reason)}
                  </span>
                ),
              },
              {
                key: 'net_amount',
                header: t('orders.settlementSummary').replace(/^۳\.\s*/, ''),
                render: (r) => (
                  <div className="text-xs">
                    {renderNetBadge(Number(r.net_amount) || 0)}
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {getSettlementLabel(r.settlement_method)}
                    </div>
                  </div>
                ),
              },
            ]}
            actions={(r) => (
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickPrint(r, 'thermal')}
                  icon={<Receipt className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                  title={t('orders.printReturnThermal')}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenDetail(r)}
                  icon={<Eye className="w-3.5 h-3.5" />}
                >
                  {t('common.details')}
                </Button>
              </div>
            )}
          />
        </div>

        {/* Mobile Cards View */}
        <div className="block md:hidden space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-sm">{t('common.loading')}</div>
          ) : paginatedReturns.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              {t('orders.noReturnsYet')}
            </div>
          ) : (
            paginatedReturns.map((r) => (
              <div
                key={`mob_ret_${r.id}`}
                className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#181a20] p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {r.return_number}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono mt-0.5">
                      {t('orders.originalOrder')}: {r.original_order_number} •{' '}
                      {formatDate(r.return_date || r.date_created, isPersian)}
                    </div>
                  </div>
                  {r.type === 'exchange' ? (
                    <Badge variant="info">{t('orders.typeExchange')}</Badge>
                  ) : (
                    <Badge variant="danger">{t('orders.typeReturn')}</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 truncate">
                    {r.customer_name}
                  </span>
                  <span className="text-[11px] text-neutral-500">{getReasonLabel(r.reason)}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-100 dark:border-neutral-800 text-xs">
                  <div>
                    <span className="text-[10px] text-neutral-400 block">
                      {getSettlementLabel(r.settlement_method)}
                    </span>
                    {renderNetBadge(Number(r.net_amount) || 0)}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuickPrint(r, 'thermal')}
                      icon={<Receipt className="w-3.5 h-3.5 text-emerald-600" />}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDetail(r)}
                      icon={<Eye className="w-3.5 h-3.5" />}
                    >
                      {t('common.details')}
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredReturns.length / pageSize) || 1}
          totalItems={filteredReturns.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          className="mt-4"
        />
      </Card>

      {/* Modal 1: Quick Order Selector to start a Return/Exchange */}
      <Modal
        isOpen={isOrderPickerOpen}
        onClose={() => setIsOrderPickerOpen(false)}
        title={t('orders.selectOrderForReturn')}
        maxWidth="max-w-xl"
      >
        <div className="space-y-3 pt-1 text-xs">
          <Input
            placeholder={t('orders.searchOrderPlaceholder')}
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />

          <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl">
            {eligibleOrders.length === 0 ? (
              <div className="p-8 text-center text-neutral-400">{t('orders.noEligibleOrders')}</div>
            ) : (
              eligibleOrders.map((ord) => (
                <button
                  key={`pick_ord_${ord.id}`}
                  type="button"
                  onClick={() => {
                    setIsOrderPickerOpen(false);
                    setActiveOrderForReturn(ord);
                  }}
                  className="w-full p-3 text-start hover:bg-neutral-50 dark:hover:bg-neutral-800/60 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                        {ord.order_number}
                      </span>
                      {ord.status === 'partially_returned' && (
                        <Badge variant="warning">{t('orders.statusPartiallyReturned')}</Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                      {ord.customer_name} • {formatDate(ord.date_created, isPersian)}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-neutral-900 dark:text-white shrink-0">
                    {formatCurrency(ord.total, 'TOMAN', isPersian)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Modal 2: Return / Exchange Processor Modal */}
      <OrderReturnExchangeModal
        isOpen={Boolean(activeOrderForReturn)}
        onClose={() => setActiveOrderForReturn(null)}
        order={activeOrderForReturn}
        onSuccess={() => {
          loadData(true);
        }}
      />

      {/* Modal 3: Return Document Detail Modal */}
      {selectedReturn && (
        <Modal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          title={t('orders.returnDetailsTitle', { number: selectedReturn.return_number })}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 text-xs pt-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-50 dark:bg-[#181a20] rounded-xl border border-slate-200 dark:border-neutral-800">
              <div>
                <span className="text-[10px] text-slate-500 block">{t('orders.originalOrder')}</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedReturn.original_order_number}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">{t('orders.customer')}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedReturn.customer_name}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">{t('orders.returnReason')}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {getReasonLabel(selectedReturn.reason)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">{t('orders.orderDate')}</span>
                <span className="font-mono text-slate-800 dark:text-neutral-200">
                  {formatDate(selectedReturn.return_date || selectedReturn.date_created, isPersian)}
                </span>
              </div>
            </div>

            {/* Returned items */}
            <div className="space-y-1.5">
              <h4 className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('orders.returnedTotalValue')}</span>
              </h4>
              <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                <table className="w-full text-start border-collapse">
                  <thead className="bg-rose-50/70 dark:bg-rose-950/20 text-[11px] font-bold text-rose-900 dark:text-rose-200 border-b border-rose-100 dark:border-rose-900/40">
                    <tr>
                      <th className="p-2 text-start">{t('orders.itemTitleAndSpecs')}</th>
                      <th className="p-2 text-center">{t('orders.itemCondition')}</th>
                      <th className="p-2 text-center">{t('orders.quantity')}</th>
                      <th className="p-2 text-end">{t('orders.itemTotal')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {selectedReturnItems
                      .filter((i) => i.item_type === 'returned')
                      .map((it) => (
                        <tr key={`det_ret_${it.id}`}>
                          <td className="p-2">
                            <div className="font-bold text-neutral-900 dark:text-white">
                              {it.product_title}
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono">
                              SKU: {it.sku}
                              {it.size_name ? ` | ${it.size_name}` : ''}
                              {it.color_name ? ` | ${it.color_name}` : ''}
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            {it.condition === 'damaged' ? (
                              <Badge variant="danger">
                                <span className="flex items-center gap-1">
                                  <ShieldAlert className="w-3 h-3" />
                                  {t('orders.conditionDamaged')}
                                </span>
                              </Badge>
                            ) : (
                              <Badge variant="success">
                                <span className="flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" />
                                  {t('orders.conditionRestockable')}
                                </span>
                              </Badge>
                            )}
                          </td>
                          <td className="p-2 text-center font-mono font-bold">
                            {isPersian ? toPersianDigits(it.quantity) : it.quantity}
                          </td>
                          <td className="p-2 text-end font-mono font-bold">
                            {formatCurrency(it.total, 'TOMAN', isPersian)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Exchanged items (if any) */}
            {selectedReturnItems.some((i) => i.item_type === 'exchanged') && (
              <div className="space-y-1.5">
                <h4 className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>{t('orders.exchangedTotalValue')}</span>
                </h4>
                <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                  <table className="w-full text-start border-collapse">
                    <thead className="bg-emerald-50/70 dark:bg-emerald-950/20 text-[11px] font-bold text-emerald-900 dark:text-emerald-200 border-b border-emerald-100 dark:border-emerald-900/40">
                      <tr>
                        <th className="p-2 text-start">{t('orders.itemTitleAndSpecs')}</th>
                        <th className="p-2 text-center">{t('orders.quantity')}</th>
                        <th className="p-2 text-end">{t('orders.unitPrice')}</th>
                        <th className="p-2 text-end">{t('orders.itemTotal')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {selectedReturnItems
                        .filter((i) => i.item_type === 'exchanged')
                        .map((it) => (
                          <tr key={`det_ex_${it.id}`}>
                            <td className="p-2">
                              <div className="font-bold text-neutral-900 dark:text-white">
                                {it.product_title}
                              </div>
                              <div className="text-[10px] text-neutral-500 font-mono">
                                SKU: {it.sku}
                                {it.size_name ? ` | ${it.size_name}` : ''}
                                {it.color_name ? ` | ${it.color_name}` : ''}
                              </div>
                            </td>
                            <td className="p-2 text-center font-mono font-bold">
                              {isPersian ? toPersianDigits(it.quantity) : it.quantity}
                            </td>
                            <td className="p-2 text-end font-mono">
                              {formatCurrency(it.unit_price, 'TOMAN', isPersian)}
                            </td>
                            <td className="p-2 text-end font-mono font-bold">
                              {formatCurrency(it.total, 'TOMAN', isPersian)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Financial Settlement Summary */}
            <div className="p-3.5 rounded-xl bg-neutral-900 text-white space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-neutral-400">
                <span>{t('orders.returnedTotalValue')}:</span>
                <span>{formatCurrency(selectedReturn.returned_total, 'TOMAN', isPersian)}</span>
              </div>
              {selectedReturn.type === 'exchange' && (
                <div className="flex justify-between text-neutral-400">
                  <span>{t('orders.exchangedTotalValue')}:</span>
                  <span>{formatCurrency(selectedReturn.exchange_total, 'TOMAN', isPersian)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-2 border-t border-neutral-800">
                <span>{getSettlementLabel(selectedReturn.settlement_method)}</span>
                <span
                  className={
                    selectedReturn.net_amount < 0
                      ? 'text-rose-400'
                      : selectedReturn.net_amount > 0
                      ? 'text-emerald-400'
                      : 'text-indigo-400'
                  }
                >
                  {formatCurrency(Math.abs(selectedReturn.net_amount), 'TOMAN', isPersian)}
                </span>
              </div>
            </div>

            {selectedReturn.notes && (
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300">
                {selectedReturn.notes}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
              <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                {t('orders.close')}
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() =>
                    printReturnReceipt({
                      orderReturn: selectedReturn,
                      items: selectedReturnItems,
                      organization: activeOrganization,
                      format: 'thermal',
                      isPersian,
                    })
                  }
                  icon={<Receipt className="w-4 h-4 text-emerald-500" />}
                >
                  {t('orders.printReturnThermal')}
                </Button>
                <Button
                  variant="primary"
                  onClick={() =>
                    printReturnReceipt({
                      orderReturn: selectedReturn,
                      items: selectedReturnItems,
                      organization: activeOrganization,
                      format: 'a4',
                      isPersian,
                    })
                  }
                  icon={<Printer className="w-4 h-4" />}
                >
                  {t('orders.printReturnA4')}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
