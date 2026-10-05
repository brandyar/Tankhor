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
import { confirmAction } from '../../utils/confirm';
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
    const isConfirmed = await confirmAction(`${t('purchasing.confirmDeleteSupplier')} (${sup.name})`);
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
        title={t('purchasing.suppliersViewTitle')}
        subtitle={t('purchasing.suppliersViewSubtitle')}
        action={
          <Button onClick={() => handleOpenModal()} icon={<Plus className="w-4 h-4" />}>
            {t('purchasing.addNewSupplier')}
          </Button>
        }
      />

      {/* Unified Suppliers Container */}
      <Card className="border-0 sm:border bg-transparent sm:bg-white dark:sm:bg-[#181a20] shadow-none sm:shadow-sm p-0 sm:p-5 md:p-6">
        {/* Search Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
          <div className="w-full sm:w-80">
            <Input
              placeholder={t('purchasing.searchSuppliersPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* 1. Desktop Tabular View */}
        <div className="hidden md:block">
          <DataTable<Supplier>
            data={filteredSuppliers}
            keyExtractor={(s) => s.id}
            isLoading={isLoading}
            emptyMessage={t('purchasing.noSuppliersFound')}
            columns={[
              {
                key: 'name',
                header: t('purchasing.supplierName'),
                render: (s) => (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{s.name}</span>
                      {s.contact_name && (
                        <div className="text-[10px] text-slate-500 dark:text-neutral-300 flex items-center gap-1 mt-0.5">
                          <UserCheck className="w-3 h-3 text-indigo-500 dark:text-indigo-400" /> {t('purchasing.contactLabel')}: {s.contact_name}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                key: 'phone',
                header: t('purchasing.phone'),
                render: (s) => (
                  <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-900 dark:text-white">
                    <Phone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    {s.phone || '-'}
                  </div>
                ),
              },
              {
                key: 'email',
                header: t('purchasing.emailOrAddress'),
                render: (s) => (
                  <div className="text-xs text-slate-700 dark:text-neutral-200 truncate max-w-xs">
                    {s.email && (
                      <div className="flex items-center gap-1 font-mono text-[11px] text-slate-800 dark:text-neutral-200">
                        <Mail className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                        {s.email}
                      </div>
                    )}
                    {s.address && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-neutral-300 truncate">
                        <MapPin className="w-3 h-3 text-slate-400 dark:text-neutral-400 shrink-0" />
                        {s.address}
                      </div>
                    )}
                    {!s.email && !s.address && '-'}
                  </div>
                ),
              },
              {
                key: 'date_created',
                header: t('purchasing.registrationDate'),
                render: (s) => (
                  <span className="font-mono text-xs text-slate-600 dark:text-neutral-300">
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
                  {t('common.edit')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  onClick={() => handleDeleteSupplier(s)}
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  {t('common.delete')}
                </Button>
              </div>
            )}
          />
        </div>

        {/* 2. Mobile Responsive Cards View */}
        <div className="block md:hidden space-y-3">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400 dark:text-neutral-500 text-sm">
              {t('common.loading')}
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-neutral-500 text-sm">
              {t('purchasing.noSuppliersFound')}
            </div>
          ) : (
            filteredSuppliers.map((s) => (
              <div
                key={`mob_sup_${s.id}`}
                className="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#181a20] p-4 shadow-sm space-y-3 transition-all"
              >
                {/* Header: Name + Contact Name + Registration Date */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                      <Truck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-neutral-100 text-sm">
                        {s.name}
                      </h3>
                      {s.contact_name && (
                        <p className="text-[11px] text-slate-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1">
                          <UserCheck className="w-3 h-3 text-indigo-500" />
                          <span>{s.contact_name}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {s.date_created && (
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-mono shrink-0">
                      {formatDate(s.date_created, isPersian)}
                    </span>
                  )}
                </div>

                {/* Contact Info (Phone, Email, Address) */}
                <div className="space-y-1.5 text-xs text-slate-600 dark:text-neutral-300 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  {s.phone && (
                    <div className="flex items-center gap-1.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <a href={`tel:${s.phone}`} className="hover:underline text-indigo-600 dark:text-indigo-400 font-bold">
                        {s.phone}
                      </a>
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500 dark:text-neutral-400">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{s.email}</span>
                    </div>
                  )}
                  {s.address && (
                    <div className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-neutral-400">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{s.address}</span>
                    </div>
                  )}
                </div>

                {/* Actions Row */}
                <div className="flex items-center justify-end gap-1 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenModal(s)}
                    icon={<Edit className="w-3.5 h-3.5" />}
                    className="h-8 px-2.5 text-xs"
                  >
                    {t('common.edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    onClick={() => handleDeleteSupplier(s)}
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSupplier ? t('purchasing.editSupplier') : t('purchasing.addNewSupplier')}
      >
        <form onSubmit={handleSaveSupplier} className="space-y-4">
          <Input
            label={t('purchasing.companyName')}
            placeholder={t('purchasing.companyPlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={t('purchasing.contactPerson')}
              placeholder={t('purchasing.contactPlaceholder')}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
            <Input
              label={t('purchasing.phone')}
              placeholder={t('purchasing.phonePlaceholder')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <Input
            label={t('purchasing.email')}
            type="email"
            placeholder="supplier@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-neutral-300 mb-1">{t('purchasing.addressFactory')}</label>
            <textarea
              rows={2}
              placeholder={t('purchasing.addressFactoryPlaceholder')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2.5 text-xs rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-[#181a20] text-slate-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-neutral-800">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isSaving}>
              {editingSupplier ? t('customers.saveChanges') : t('purchasing.saveSupplier')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
