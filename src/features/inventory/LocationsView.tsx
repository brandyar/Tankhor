import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { WarehouseLocation, Warehouse, LocationType, Status } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable, Column } from '../../components/ui/DataTable';
import { toPersianDigits } from '../../utils/formatters';
import { confirmAction } from '../../utils/confirm';
import { Layers, MapPin, Barcode as BarcodeIcon, Plus, Trash2, Edit } from 'lucide-react';

export const LocationsView: React.FC = () => {
  const { t } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocation | null>(null);

  // Form states
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [parentId, setParentId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<LocationType>('rack');
  const [barcode, setBarcode] = useState('');
  const [status, setStatus] = useState<Status>('active');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id;
      const [wList, locList] = await Promise.all([
        adapter.getWarehouses({ organization_id: orgId }),
        adapter.getWarehouseLocations({
          warehouse_id: selectedWarehouseFilter ? Number(selectedWarehouseFilter) : undefined,
        }),
      ]);
      setWarehouses(wList);
      setLocations(locList);
    } catch (err) {
      console.error('[LocationsView] Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization, selectedWarehouseFilter]);

  const handleOpenModal = (loc?: WarehouseLocation) => {
    if (loc) {
      setEditingLocation(loc);
      setWarehouseId(typeof loc.warehouse_id === 'number' ? loc.warehouse_id : loc.warehouse_id.id);
      setParentId(typeof loc.parent_id === 'number' ? loc.parent_id : loc.parent_id?.id || '');
      setName(loc.name || '');
      setCode(loc.code || '');
      setType(loc.type || 'rack');
      setBarcode(loc.barcode || '');
      setStatus(loc.status || 'active');
    } else {
      setEditingLocation(null);
      setWarehouseId(warehouses.length > 0 ? warehouses[0].id : '');
      setParentId('');
      setName('');
      setCode(`LOC-${Math.floor(1000 + Math.random() * 9000)}`);
      setType('rack');
      setBarcode(`626LOC${Date.now().toString().slice(-6)}`);
      setStatus('active');
    }
    setIsModalOpen(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !warehouseId) return;

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      await adapter.saveWarehouseLocation({
        id: editingLocation?.id,
        warehouse_id: Number(warehouseId),
        parent_id: parentId ? Number(parentId) : undefined,
        name,
        code,
        type,
        barcode,
        status,
      });

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('[LocationsView] Failed to save location:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLocation = async (id: number) => {
    if (await confirmAction(t('common.confirmDeleteMessage'))) {
      const adapter = storageManager.getAdapter();
      await adapter.deleteWarehouseLocation(id);
      await loadData();
    }
  };

  const getLocationTypeBadge = (type: LocationType) => {
    const labels: Record<LocationType, { text: string; variant: 'info' | 'success' | 'warning' | 'neutral' }> = {
      zone: { text: t('inventory.locationZoneOption'), variant: 'info' },
      aisle: { text: t('inventory.locationAisleOption'), variant: 'neutral' },
      rack: { text: t('inventory.locationRackOption'), variant: 'success' },
      shelf: { text: t('inventory.locationShelfOption'), variant: 'warning' },
      bin: { text: t('inventory.locationBinOption'), variant: 'neutral' },
      other: { text: t('inventory.locationOtherOption'), variant: 'neutral' },
    };
    const item = labels[type] || labels.other;
    return <Badge variant={item.variant}>{item.text}</Badge>;
  };

  const columns: Column<WarehouseLocation>[] = [
    {
      key: 'name',
      header: t('inventory.locationNameLabel').replace(' *', ''),
      render: (loc) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold text-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-neutral-100 text-sm">{loc.name}</p>
            <p className="text-[11px] font-mono text-slate-400 dark:text-neutral-500 mt-0.5">{loc.code || '-'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('inventory.locationStructureType'),
      render: (loc) => getLocationTypeBadge(loc.type),
    },
    {
      key: 'warehouse_id',
      header: t('inventory.relatedWarehouse'),
      render: (loc) => {
        const wId = typeof loc.warehouse_id === 'number' ? loc.warehouse_id : loc.warehouse_id.id;
        const wh = warehouses.find((w) => w.id === wId);
        return <span className="font-medium text-slate-700 dark:text-neutral-200">{wh?.name || '-'}</span>;
      },
    },
    {
      key: 'barcode',
      header: t('inventory.locationBarcode'),
      render: (loc) => (
        <span className="inline-flex items-center gap-1 font-mono text-xs text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 px-2 py-1 rounded-md">
          <BarcodeIcon className="w-3 h-3 text-slate-400 dark:text-neutral-500" />
          {toPersianDigits(loc.barcode || '-')}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (loc) => (
        <Badge variant={loc.status === 'active' ? 'success' : 'danger'}>
          {loc.status === 'active' ? t('inventory.active') : t('inventory.inactive')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('navigation.locations')}
        subtitle={t('inventory.locationsManagementSubtitle')}
        action={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            {t('inventory.newLocation')}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-72">
            <select
              value={selectedWarehouseFilter}
              onChange={(e) => setSelectedWarehouseFilter(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-white dark:bg-[#181a20] border border-slate-300 dark:border-neutral-700 rounded-xl text-slate-800 dark:text-neutral-200 text-xs px-3 py-2.5 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">{t('inventory.allWarehousesOption')}</option>
              {warehouses.map((w, wIdx) => (
                <option key={`loc_wh_${w.id}_${wIdx}`} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={locations}
          keyExtractor={(loc) => loc.id}
          isLoading={isLoading}
          actions={(loc) => (
            <div className="flex items-center justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(loc)}
                icon={<Edit className="w-3.5 h-3.5" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDeleteLocation(loc.id)}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              />
            </div>
          )}
        />
      </Card>

      {/* Modal Form */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLocation ? t('inventory.editLocation') : t('inventory.newLocationInWarehouse')}
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="location-form" isLoading={isSaving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="location-form" onSubmit={handleSaveLocation} className="space-y-4">
          <Select
            label={t('inventory.relatedWarehouse') + ' *'}
            value={warehouseId}
            onChange={(e) => setWarehouseId(Number(e.target.value))}
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
            required
          />

          <Input
            label={t('inventory.locationNameLabel')}
            placeholder={t('inventory.locationNamePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('inventory.locationCodeLabel')}
              placeholder={t('inventory.locationCodePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />

            <Select
              label={t('inventory.locationStructureTypeLabel')}
              value={type}
              onChange={(e) => setType(e.target.value as LocationType)}
              options={[
                { value: 'zone', label: t('inventory.locationZoneOption') },
                { value: 'aisle', label: t('inventory.locationAisleOption') },
                { value: 'rack', label: t('inventory.locationRackOption') },
                { value: 'shelf', label: t('inventory.locationShelfOption') },
                { value: 'bin', label: t('inventory.locationBinOption') },
                { value: 'other', label: t('inventory.locationOtherOption') },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('inventory.locationBarcodeLabel')}
              placeholder="626LOC..."
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
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
        </form>
      </Modal>
    </div>
  );
};
