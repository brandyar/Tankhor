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
  const { t } = useTranslation();
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
    if (await confirmAction('آیا از حذف این فصل مطمئن هستید؟')) {
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
      header: 'نام فصل (Season)',
      render: (season) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <p className="font-extrabold text-slate-900 text-sm">{season.name}</p>
            {season.code && <p className="text-xs text-slate-400 font-mono">کد: {season.code}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'start_date',
      header: 'بازه زمانی فصل',
      render: (season) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{toPersianDigits(season.start_date || 'تعریف‌نشده')}</span>
          <span className="text-slate-300">تا</span>
          <span>{toPersianDigits(season.end_date || 'تعریف‌نشده')}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (season) => (
        <Badge variant={season.status === 'active' ? 'success' : 'neutral'}>
          {season.status === 'active' ? 'فعال' : 'غیرفعال'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت فصل‌ها (Seasons)"
        subtitle="تعریف و دسته‌بندی پوشاک فصلی (بهاره، تابستانه، پاییزه، زمستانه و چهارفصل)"
        actions={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            افزودن فصل جدید
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder="جستجو در فصل‌ها..."
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
                icon={<Edit className="w-4 h-4 text-slate-600" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
        title={editingSeason ? 'ویرایش فصل' : 'افزودن فصل جدید'}
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
            label="نام فصل *"
            placeholder="مثال: پاییز و زمستان ۱۴۰۳"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="کد فصل (Season Code)"
              placeholder="FW24"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Select
              label="وضعیت"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              options={[
                { value: 'active', label: 'فعال' },
                { value: 'inactive', label: 'غیرفعال' },
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="تاریخ شروع"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="تاریخ پایان"
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
