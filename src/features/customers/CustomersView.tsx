import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Customer, Order } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable } from '../../components/ui/DataTable';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { confirmAction } from '../../utils/confirm';
import {
  Users,
  Plus,
  Search,
  Edit,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  History,
  User,
  CheckCircle2,
  Trash2,
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();
  const isPersian = locale === 'fa';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // History Modal
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [custList, orderList] = await Promise.all([
        adapter.getCustomers({ organization_id: orgId }),
        adapter.getOrders({ organization_id: orgId }),
      ]);
      setCustomers(custList);
      setOrders(orderList);
    } catch (err) {
      console.error('[CustomersView] Error loading customers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  const handleOpenModal = (cust?: Customer) => {
    if (cust) {
      setEditingCustomer(cust);
      setName(cust.name);
      setPhone(cust.phone || '');
      setEmail(cust.email || '');
      setAddress(cust.address || '');
      setNotes(cust.notes || '');
    } else {
      setEditingCustomer(null);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;

      await adapter.saveCustomer({
        id: editingCustomer?.id,
        organization_id: orgId,
        name,
        phone,
        email,
        address,
        notes,
        status: 'active',
      });

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('[CustomersView] Error saving customer:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenHistory = (cust: Customer) => {
    setHistoryCustomer(cust);
    setIsHistoryModalOpen(true);
  };

  const handleDeleteCustomer = async (cust: Customer) => {
    if (!cust.id) return;
    const isConfirmed = await confirmAction(`${t('customers.confirmDeleteCustomer')} (${cust.name})`);
    if (!isConfirmed) return;

    try {
      const adapter = storageManager.getAdapter();
      await adapter.deleteCustomer(cust.id);
      await loadData();
    } catch (err) {
      console.error('[CustomersView] Error deleting customer:', err);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    return (
      (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone && c.phone.includes(search)) ||
      (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const getCustomerOrderStats = (customerId: number) => {
    const custOrders = orders.filter((o) => {
      const cId = typeof o.customer_id === 'object' ? (o.customer_id as any)?.id : o.customer_id;
      return Number(cId) === Number(customerId);
    });
    const totalSpent = custOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    return { count: custOrders.length, totalSpent, orders: custOrders };
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('customers.title')}
        subtitle={t('customers.subtitle')}
        action={
          <Button
            onClick={() => handleOpenModal()}
            icon={<Plus className="w-4 h-4" />}
          >
            {t('customers.addNewCustomer')}
          </Button>
        }
      />

      {/* Search Toolbar */}
      <Card className="p-4">
        <div className="max-w-md">
          <Input
            placeholder={t('customers.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
      </Card>

      {/* Customers Data Table */}
      <Card className="p-0 overflow-hidden">
        <DataTable<Customer>
          data={filteredCustomers}
          keyExtractor={(c) => c.id}
          isLoading={isLoading}
          emptyMessage={t('customers.emptyMessage')}
          columns={[
            {
              key: 'name',
              header: t('customers.customerName'),
              render: (c) => (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 flex items-center justify-center text-slate-700 dark:text-neutral-300 font-bold text-xs shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-neutral-100 text-xs sm:text-sm">{c.name}</span>
                    {c.date_created && (
                      <div className="text-[10px] text-slate-400 dark:text-neutral-500">
                        {t('customers.membership')}: {formatDate(c.date_created, isPersian)}
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'phone',
              header: t('customers.phone'),
              render: (c) => (
                <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700 dark:text-neutral-300">
                  <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-500" />
                  {c.phone || '-'}
                </div>
              ),
            },
            {
              key: 'email',
              header: t('customers.emailOrAddress'),
              render: (c) => (
                <div className="text-xs text-slate-600 dark:text-neutral-400 truncate max-w-xs">
                  {c.email && (
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <Mail className="w-3 h-3 text-slate-400 dark:text-neutral-500" />
                      {c.email}
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                      <MapPin className="w-3 h-3 text-slate-400 dark:text-neutral-500 shrink-0" />
                      {c.address}
                    </div>
                  )}
                  {!c.email && !c.address && '-'}
                </div>
              ),
            },
            {
              key: 'orders',
              header: t('customers.ordersCountAndTotal'),
              render: (c) => {
                const stats = getCustomerOrderStats(c.id);
                return (
                  <div>
                    <div className="font-bold text-slate-900 dark:text-neutral-100 text-xs font-mono">
                      {formatCurrency(stats.totalSpent, activeOrganization?.currency, isPersian)}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-neutral-400 font-mono">
                      {stats.count} {t('customers.ordersCountLabel')}
                    </div>
                  </div>
                );
              },
            },
          ]}
          actions={(c) => (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenHistory(c)}
                icon={<History className="w-3.5 h-3.5" />}
              >
                {t('customers.history')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenModal(c)}
                icon={<Edit className="w-3.5 h-3.5" />}
              >
                {t('common.edit')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                onClick={() => handleDeleteCustomer(c)}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                {t('common.delete')}
              </Button>
            </div>
          )}
        />
      </Card>

      {/* Modal: Create/Edit Customer */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? t('customers.editCustomerTitle') : t('customers.addNewCustomer')}
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          <Input
            label={t('customers.customerName')}
            placeholder={t('customers.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('customers.phoneLabel')}
              placeholder="09123456789"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              label={t('customers.email')}
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">{t('customers.deliveryAddressLabel')}</label>
            <textarea
              rows={2}
              placeholder={t('customers.addressPlaceholder')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">{t('customers.notesLabel')}</label>
            <textarea
              rows={2}
              placeholder={t('customers.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-neutral-800">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editingCustomer ? t('customers.saveChanges') : t('customers.submitCustomer')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Customer History */}
      {historyCustomer && (
        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => setIsHistoryModalOpen(false)}
          title={`${t('customers.historyTitle')} ${historyCustomer.name}`}
        >
          <div className="space-y-4">
            {(() => {
              const stats = getCustomerOrderStats(historyCustomer.id);
              if (stats.orders.length === 0) {
                return (
                  <div className="p-8 text-center text-slate-400 dark:text-neutral-500 text-xs">
                    {t('customers.noOrdersForCustomer')}
                  </div>
                );
              }
              return (
                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pe-1">
                  {stats.orders.map((ord, ordIdx) => (
                    <div
                      key={`cust_ord_${ord.id || 'temp'}_${ordIdx}`}
                      className="p-3 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold font-mono text-slate-900 dark:text-neutral-100">{ord.order_number}</div>
                        <div className="text-[10px] text-slate-500 dark:text-neutral-400 font-mono">
                          {formatDate(ord.date_created, isPersian)}
                        </div>
                      </div>

                      <div className="text-end">
                        <div className="font-bold text-slate-900 dark:text-neutral-100 font-mono">
                          {formatCurrency(ord.total, activeOrganization?.currency, isPersian)}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-medium font-mono">
                          {ord.status === 'completed' ? t('orders.statusCompleted') : ord.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-neutral-800">
              <Button variant="outline" onClick={() => setIsHistoryModalOpen(false)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
