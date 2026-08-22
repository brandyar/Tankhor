import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Color } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable, Column } from '../../components/ui/DataTable';
import { Palette, Plus, Search, Edit, Trash2 } from 'lucide-react';

export const ColorsView: React.FC = () => {
  const { t } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [colors, setColors] = useState<Color[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingColor, setEditingColor] = useState<Color | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [hex, setHex] = useState('#000000');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);

  const loadColors = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const list = await adapter.getColors({ organization_id: activeOrganization?.id });
      setColors(list);
    } catch (err) {
      console.error('[ColorsView] Error loading colors:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadColors();
  }, [activeOrganization]);

  const handleOpenModal = (color?: Color) => {
    if (color) {
      setEditingColor(color);
      setName(color.name);
      setCode(color.code || '');
      setHex(color.hex || '#000000');
      setStatus(color.status === 'inactive' ? 'inactive' : 'active');
    } else {
      setEditingColor(null);
      setName('');
      setCode('');
      setHex('#000000');
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

      await adapter.saveColor({
        id: editingColor?.id,
        organization_id: orgId,
        name,
        code,
        hex,
        status,
      });

      setIsModalOpen(false);
      await loadColors();
    } catch (err) {
      console.error('[ColorsView] Error saving color:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('آیا از حذف این رنگ مطمئن هستید؟')) {
      const adapter = storageManager.getAdapter();
      await adapter.deleteColor(id);
      await loadColors();
    }
  };

  const filtered = search.trim()
    ? colors.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.code && c.code.toLowerCase().includes(search.toLowerCase())) ||
          (c.hex && c.hex.toLowerCase().includes(search.toLowerCase()))
      )
    : colors;

  const columns: Column<Color>[] = [
    {
      key: 'name',
      header: 'نام و نمونه رنگ',
      render: (color) => (
        <div className="flex items-center gap-3">
          <span
            className="w-7 h-7 rounded-full border-2 border-slate-200 shadow-xs inline-block shrink-0"
            style={{ backgroundColor: color.hex || '#000000' }}
          />
          <div>
            <p className="font-extrabold text-slate-900 text-sm">{color.name}</p>
            {color.code && <p className="text-xs text-slate-400 font-mono">کد: {color.code}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'hex',
      header: 'کد هگز (HEX)',
      render: (color) => (
        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
          {color.hex || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'وضعیت',
      render: (color) => (
        <Badge variant={color.status === 'active' ? 'success' : 'neutral'}>
          {color.status === 'active' ? 'فعال' : 'غیرفعال'}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت رنگ‌ها (Colors)"
        subtitle="تعریف و کدگذاری پالت رنگ‌های کالا با امکان تعیین کد Hex دقیق"
        actions={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            افزودن رنگ جدید
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div className="w-full sm:w-80">
            <Input
              placeholder="جستجو در رنگ‌ها..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          keyExtractor={(color) => color.id}
          isLoading={isLoading}
          actions={(color) => (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(color)}
                icon={<Edit className="w-4 h-4 text-slate-600" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDelete(color.id)}
                icon={<Trash2 className="w-4 h-4" />}
              />
            </div>
          )}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingColor ? 'ویرایش رنگ' : 'افزودن رنگ جدید'}
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="color-form" isLoading={isSaving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="color-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label="نام رنگ *"
            placeholder="مثال: مشکی مات، سرمه‌ای سیر، سفید صدفی"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="کد رنگ (Color Code)"
              placeholder="BLK"
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

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">انتخاب کد رنگ دقیق (HEX Color)</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                className="w-12 h-10 rounded-xl cursor-pointer border border-slate-300 p-1 bg-white"
              />
              <Input
                value={hex}
                onChange={(e) => setHex(e.target.value)}
                placeholder="#000000"
                className="font-mono text-sm"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
