import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Warehouse, WarehouseType, Status } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable, Column } from '../../components/ui/DataTable';
import { toPersianDigits, formatDate } from '../../utils/formatters';
import { confirmAction } from '../../utils/confirm';
import { Warehouse as WarehouseIcon, Building2, Store, Plus, Trash2, Edit, Phone, MapPin } from 'lucide-react';

export const WarehousesView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<WarehouseType>('warehouse');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<Status>('active');
  const [isSaving, setIsSaving] = useState(false);

  const isPersian = locale === 'fa';

  const loadWarehouses = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const list = await adapter.getWarehouses({
        organization_id: activeOrganization?.id,
      });

      let filtered = list;
      if (search.trim()) {
        const term = search.toLowerCase();
        filtered = list.filter(
          (w) =>
            w.name.toLowerCase().includes(term) ||
            (w.code && w.code.toLowerCase().includes(term)) ||
            (w.address && w.address.toLowerCase().includes(term))
        );
      }

      setWarehouses(filtered);
    } catch (err) {
      console.error('[WarehousesView] Error loading warehouses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, [activeOrganization, search]);

  const handleOpenModal = (w?: Warehouse) => {
    if (w) {
      setEditingWarehouse(w);
      setName(w.name || '');
      setCode(w.code || '');
      setType(w.type || 'warehouse');
      setPhone(w.phone || '');
      setAddress(w.address || '');
      setStatus(w.status || 'active');
    } else {
      setEditingWarehouse(null);
      setName('');
      setCode(`WH-${Math.floor(100 + Math.random() * 900)}`);
      setType('warehouse');
      setPhone('');
      setAddress('');
      setStatus('active');
    }
    setIsModalOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      await adapter.saveWarehouse({
        id: editingWarehouse?.id,
        organization_id: activeOrganization?.id || 1,
        name,
        code,
        type,
        phone,
        address,
        status,
      });

      setIsModalOpen(false);
      await loadWarehouses();
    } catch (err) {
      console.error('[WarehousesView] Error saving warehouse:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWarehouse = async (id: number) => {
    if (await confirmAction(t('common.confirmDeleteMessage'))) {
      const adapter = storageManager.getAdapter();
      await adapter.deleteWarehouse(id);
      await loadWarehouses();
    }
  };

  const getTypeBadge = (type: WarehouseType) => {
    switch (type) {
      case 'warehouse':
        return <Badge variant="info">{t('inventory.warehouseTypeCentral')}</Badge>;
      case 'store':
        return <Badge variant="success">{t('inventory.warehouseTypeStore')}</Badge>;
      default:
        return <Badge variant="neutral">{t('inventory.warehouseTypeOther')}</Badge>;
    }
  };

  const columns: Column<Warehouse>[] = [
    {
      key: 'name',
      header: t('inventory.warehouseNameLabel').replace(' *', ''),
      render: (w) => (
        <div>
          <p className="font-bold text-slate-900 dark:text-neutral-100 text-sm">{w.name}</p>
          <p className="text-[11px] font-mono text-slate-400 dark:text-neutral-500 mt-0.5">{w.code || '-'}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('inventory.warehouseCenterType'),
      render: (w) => getTypeBadge(w.type),
    },
    {
      key: 'phone',
      header: t('inventory.warehousePhoneLabel'),
      render: (w) => (
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-neutral-300 text-xs font-mono">
          <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-500" />
          <span>{toPersianDigits(w.phone || '-')}</span>
        </div>
      ),
    },
    {
      key: 'address',
      header: t('inventory.warehouseAddress'),
      render: (w) => (
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-neutral-300 text-xs truncate max-w-xs">
          <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-500 shrink-0" />
          <span className="truncate">{w.address || '-'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (w) => (
        <Badge variant={w.status === 'active' ? 'success' : 'danger'}>
          {w.status === 'active' ? t('inventory.active') : t('inventory.inactive')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('navigation.warehouses')}
        subtitle={t('inventory.warehousesManagementSubtitle')}
        action={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            {t('inventory.newWarehouse')}
          </Button>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-80">
          <Input
            placeholder={t('inventory.searchWarehousePlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 1. Desktop Tabular View */}
      <div className="hidden md:block bg-white dark:bg-[#13151a] border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl shadow-sm p-5 overflow-hidden">
        <DataTable
          columns={columns}
          data={warehouses}
          keyExtractor={(w) => w.id}
          isLoading={isLoading}
          actions={(w) => (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(w)}
                icon={<Edit className="w-3.5 h-3.5" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                onClick={() => handleDeleteWarehouse(w.id)}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              />
            </div>
          )}
        />
      </div>

      {/* 2. Mobile Clean Card View */}
      <div className="block md:hidden">
        {isLoading ? (
          <div className="w-full py-12 flex flex-col items-center justify-center text-neutral-400">
            <div className="w-7 h-7 border-2 border-neutral-900 dark:border-neutral-100 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs font-mono text-neutral-500">{t('common.loadingData')}</span>
          </div>
        ) : warehouses.length === 0 ? (
          <div className="w-full py-12 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl flex flex-col items-center justify-center text-neutral-500 dark:text-neutral-400 bg-neutral-50/50 dark:bg-neutral-900/40 p-6 text-center">
            <WarehouseIcon className="w-8 h-8 text-neutral-400 mb-2 stroke-1" />
            <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">{t('common.noData')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {warehouses.map((w) => (
              <div
                key={`mob_wh_${w.id}`}
                className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#13151a] p-4 shadow-sm space-y-3 transition-all"
              >
                {/* Top Row: Name & Code <---> Type & Status */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                      {w.name}
                    </h4>
                    <span className="font-mono text-xs text-neutral-400 dark:text-neutral-500 mt-0.5 inline-block">
                      {w.code || '-'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {getTypeBadge(w.type)}
                    <Badge variant={w.status === 'active' ? 'success' : 'danger'}>
                      {w.status === 'active' ? t('inventory.active') : t('inventory.inactive')}
                    </Badge>
                  </div>
                </div>

                {/* Middle Row: Phone & Address */}
                {(w.phone || w.address) && (
                  <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
                    {w.phone && (
                      <div className="flex items-center gap-1.5 font-mono">
                        <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span>{toPersianDigits(w.phone)}</span>
                      </div>
                    )}
                    {w.address && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="leading-snug">{w.address}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Bottom Row: Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenModal(w)}
                    icon={<Edit className="w-3.5 h-3.5" />}
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                    onClick={() => handleDeleteWarehouse(w.id)}
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    {t('common.delete')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warehouse Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingWarehouse ? t('inventory.editWarehouse') : t('inventory.newWarehouse')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="warehouse-form"
              isLoading={isSaving}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="warehouse-form" onSubmit={handleSaveWarehouse} className="space-y-4">
          <Input
            label={t('inventory.warehouseNameLabel')}
            placeholder={t('inventory.warehouseNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('inventory.warehouseCodeLabel')}
              placeholder={t('inventory.warehouseCodePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />

            <Select
              label={t('inventory.warehouseTypeLabel')}
              value={type}
              onChange={(e) => setType(e.target.value as WarehouseType)}
              options={[
                { value: 'warehouse', label: t('inventory.warehouseTypeCentralOption') },
                { value: 'store', label: t('inventory.warehouseTypeStoreOption') },
                { value: 'other', label: t('inventory.warehouseTypeOtherOption') },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('inventory.warehousePhoneLabel')}
              placeholder="02188888888"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <Select
              label={t('inventory.warehouseStatusLabel')}
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              options={[
                { value: 'active', label: t('inventory.active') },
                { value: 'inactive', label: t('inventory.inactive') },
              ]}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300">{t('inventory.warehouseFullAddressLabel')}</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder={t('inventory.warehouseFullAddressPlaceholder')}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
