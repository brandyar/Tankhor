import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Season } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Sun, Plus, Search, Edit, Trash2, Calendar } from 'lucide-react';
import { toPersianDigits } from '../../utils/formatters';
import { confirmAction } from '../../utils/confirm';

export const SeasonsView: React.FC = () => {
  const { t, isPersian } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);

  const loadSeasons = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const list = await adapter.getSeasons({ organization_id: activeOrganization?.id });
      setSeasons(list);
    } catch (err) {
      console.error('[SeasonsView] Error loading seasons:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSeasons();
  }, [activeOrganization]);

  const handleOpenModal = (season?: Season) => {
    if (season) {
      setEditingSeason(season);
      setName(season.name);
      setCode(season.code || '');
      setStartDate(season.start_date || '');
      setEndDate(season.end_date || '');
      setStatus(season.status === 'inactive' ? 'inactive' : 'active');
    } else {
      setEditingSeason(null);
      setName('');
      setCode('');
      setStartDate('');
      setEndDate('');
      setStatus('active');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      const orgId = activeOrganization?.id || 1;

      await adapter.saveSeason({
        id: editingSeason?.id,
        organization_id: orgId,
        name,
        code,
        start_date: startDate,
        end_date: endDate,
        status,
      });

      setIsModalOpen(false);
      await loadSeasons();
    } catch (err) {
      console.error('[SeasonsView] Error saving season:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (await confirmAction(t('products.confirmDeleteSeason'))) {
      const adapter = storageManager.getAdapter();
      await adapter.deleteSeason(id);
      await loadSeasons();
    }
  };

  const filtered = search.trim()
    ? seasons.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.code && s.code.toLowerCase().includes(search.toLowerCase()))
      )
    : seasons;

  const columns: Column<Season>[] = [
    {
      key: 'name',
      header: t('products.seasonNameHeader'),
      render: (season) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <p className="font-extrabold text-slate-900 dark:text-neutral-100 text-sm">{season.name}</p>
            {season.code && <p className="text-xs text-slate-400 dark:text-neutral-500 font-mono">{t('products.seasonCode')}: {season.code}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'start_date',
      header: t('products.seasonDateRange'),
      render: (season) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-neutral-300 font-mono">
          <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-500" />
          <span>{isPersian ? toPersianDigits(season.start_date || t('products.undefinedDate')) : season.start_date || t('products.undefinedDate')}</span>
          <span className="text-slate-300 dark:text-neutral-600">{t('products.dateTo')}</span>
          <span>{isPersian ? toPersianDigits(season.end_date || t('products.undefinedDate')) : season.end_date || t('products.undefinedDate')}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('products.productStatus'),
      render: (season) => (
        <Badge variant={season.status === 'active' ? 'success' : 'neutral'}>
          {season.status === 'active' ? t('products.statusActive') : t('products.statusInactive')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('products.seasonsTitle')}
        subtitle={t('products.seasonsSubtitle')}
        actions={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            {t('products.createSeason')}
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder={t('products.searchSeasons')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(season) => season.id}
          isLoading={isLoading}
          actions={(season) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(season)}
                icon={<Edit className="w-4 h-4 text-slate-600 dark:text-neutral-300" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                onClick={() => handleDelete(season.id)}
                icon={<Trash2 className="w-4 h-4" />}
              />
            </div>
          )}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSeason ? t('products.editSeason') : t('products.createSeason')}
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="season-form" isLoading={isSaving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="season-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label={`${t('products.seasonName')} *`}
            placeholder="FW24, Spring 2025..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('products.seasonCode')}
              placeholder="FW24"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Select
              label={t('products.productStatus')}
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              options={[
                { value: 'active', label: t('products.statusActive') },
                { value: 'inactive', label: t('products.statusInactive') },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('products.startDate')}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label={t('products.endDate')}
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
