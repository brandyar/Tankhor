import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Supplier } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { DataTable } from '../../components/ui/DataTable';
import { formatDate } from '../../utils/formatters';
import { Truck, Plus, Search, Edit, Phone, Mail, MapPin, UserCheck, Trash2 } from 'lucide-react';

export const SuppliersView: React.FC = () => {
  const { t, locale } = useTranslation();
  const { activeOrganization } = useOrganization();
  const isPersian = locale === 'fa';

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const list = await adapter.getSuppliers({ organization_id: activeOrganization?.id });
      setSuppliers(list);
    } catch (err) {
      console.error('[SuppliersView] Error loading suppliers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeOrganization]);

  const handleDeleteSupplier = async (sup: Supplier) => {
    if (!sup.id) return;
    const isConfirmed = window.confirm(`آیا از حذف تامین‌کننده «${sup.name}» اطمینان دارید؟`);
    if (!isConfirmed) return;

    try {
      const adapter = storageManager.getAdapter();
      await adapter.deleteSupplier(sup.id);
      await loadData();
    } catch (err) {
      console.error('[SuppliersView] Error deleting supplier:', err);
    }
  };

  const handleOpenModal = (sup?: Supplier) => {
    if (sup) {
      setEditingSupplier(sup);
      setName(sup.name);
      setContactName(sup.contact_name || '');
      setPhone(sup.phone || '');
      setEmail(sup.email || '');
      setAddress(sup.address || '');
      setNotes(sup.notes || '');
    } else {
      setEditingSupplier(null);
      setName('');
      setContactName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setNotes('');
    }
    setIsModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      await adapter.saveSupplier({
        id: editingSupplier?.id,
        organization_id: activeOrganization?.id || 1,
        name,
        contact_name: contactName,
        phone,
        email,
        address,
        notes,
        status: 'active',
      });

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('[SuppliersView] Error saving supplier:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    return (
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.contact_name && s.contact_name.toLowerCase().includes(search.toLowerCase())) ||
      (s.phone && s.phone.includes(search))
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="تامین‌کنندگان و تولیدکنندگان (Suppliers)"
        subtitle="بانک اطلاعات بنکداران، کارگاه‌های خیاطي، کارخانجات و تامین‌کنندگان پارچه و لباس"
        action={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            افزودن تامین‌کننده جدید
          </Button>
        }
      />

      <Card className="p-4">
        <div className="max-w-md">
          <Input
            placeholder="جستجو نام تامین‌کننده، مسئول فروش یا تلفن..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <DataTable<Supplier>
          data={filteredSuppliers}
          keyExtractor={(s) => s.id}
          isLoading={isLoading}
          emptyMessage="هیچ تامین‌کننده‌ای ثبت نشده است."
          columns={[
            {
              key: 'name',
              header: 'نام شرکت / تامین‌کننده',
              render: (s) => (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs sm:text-sm">{s.name}</span>
                    {s.contact_name && (
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <UserCheck className="w-3 h-3" /> مسئول: {s.contact_name}
                      </div>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: 'phone',
              header: 'شماره تماس',
              render: (s) => (
                <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {s.phone || '-'}
                </div>
              ),
            },
            {
              key: 'email',
              header: 'ایمیل / آدرس',
              render: (s) => (
                <div className="text-xs text-slate-600 truncate max-w-xs">
                  {s.email && (
                    <div className="flex items-center gap-1 font-mono text-[11px]">
                      <Mail className="w-3 h-3 text-slate-400" />
                      {s.email}
                    </div>
                  )}
                  {s.address && (
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 truncate">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      {s.address}
                    </div>
                  )}
                  {!s.email && !s.address && '-'}
                </div>
              ),
            },
            {
              key: 'date_created',
              header: 'تاریخ ثبت',
              render: (s) => (
                <span className="font-mono text-xs text-slate-500">
                  {formatDate(s.date_created, isPersian)}
                </span>
              ),
            },
          ]}
          actions={(s) => (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenModal(s)}
                icon={<Edit className="w-3.5 h-3.5" />}
              >
                ویرایش
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:bg-rose-50"
                onClick={() => handleDeleteSupplier(s)}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              >
                حذف
              </Button>
            </div>
          )}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? 'ویرایش اطلاعات تامین‌کننده' : 'افزودن تامین‌کننده جدید'}
      >
        <form onSubmit={handleSaveSupplier} className="space-y-4">
          <Input
            label="نام تولیدی / شرکت تامین‌کننده"
            placeholder="مثلا: کارخانه تولیدی پوشاک آریا"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="نام مسئول فروش / رابط"
              placeholder="آقای رضایی"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <Input
              label="شماره تلفن"
              placeholder="02188888888"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <Input
            label="آدرس ایمیل"
            type="email"
            placeholder="supplier@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">آدرس کارخانه / دفتر</label>
            <textarea
              rows={2}
              placeholder="استان، شهر، شهرک صنعتی..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editingSupplier ? 'ذخیره تغییرات' : 'ثبت تامین‌کننده'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
