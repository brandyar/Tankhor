import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../i18n';
import { storageManager } from '../../storage';
import { Contractor, ContractorSpecialty, FinancialAccount } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { Pagination } from '../../components/ui/Pagination';
import { formatCurrency, toPersianDigits } from '../../utils/formatters';
import {
  Users,
  Plus,
  Search,
  Wallet,
  Phone,
  MapPin,
  Edit2,
  Trash2,
  CheckCircle2,
  Receipt,
  ArrowUpRight,
} from 'lucide-react';

const CONTRACTOR_SPECIALTIES: { key: ContractorSpecialty; label: string }[] = [
  { key: 'sewing', label: 'خیاط / مزد‌دوز' },
  { key: 'cutting', label: 'برش‌کار' },
  { key: 'embroidery', label: 'گلدوز' },
  { key: 'printing', label: 'چاپ‌کار' },
  { key: 'washing', label: 'شست‌وشو / سنگ‌شور' },
  { key: 'iron_pack', label: 'اتو و بسته‌بندی' },
  { key: 'general', label: 'پیمانکار عمومی' },
];

export const ContractorsView: React.FC = () => {
  const { t, isPersian } = useTranslation();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [selectedContractor, setSelectedContractor] = useState<Contractor | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    specialty: 'sewing' as ContractorSpecialty,
    phone: '',
    address: '',
  });

  // Settlement Form State
  const [settlementData, setSettlementData] = useState({
    amount: 0,
    financial_account_id: 0,
    notes: 'پرداخت کارمزدی به پیمانکار',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ctrList, accList] = await Promise.all([
        storageManager.getContractors(),
        storageManager.getFinancialAccounts(),
      ]);
      setContractors(ctrList || []);
      setFinancialAccounts(accList || []);
    } catch (err) {
      console.error('Error loading contractors data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered
  const filteredContractors = useMemo(() => {
    return contractors.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(search.toLowerCase());
      const phoneMatch = (c.phone || '').includes(search);
      const specMatch = specialtyFilter === 'all' || c.specialty === specialtyFilter;
      return (nameMatch || phoneMatch) && specMatch;
    });
  }, [contractors, search, specialtyFilter]);

  // Paginated
  const totalItems = filteredContractors.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedContractors = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredContractors.slice(start, start + pageSize);
  }, [filteredContractors, currentPage, pageSize]);

  // Open Create/Edit Modal
  const handleOpenAddModal = () => {
    setSelectedContractor(null);
    setFormData({
      name: '',
      specialty: 'sewing',
      phone: '',
      address: '',
    });
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (ctr: Contractor) => {
    setSelectedContractor(ctr);
    setFormData({
      name: ctr.name,
      specialty: ctr.specialty,
      phone: ctr.phone || '',
      address: ctr.address || '',
    });
    setIsAddEditModalOpen(true);
  };

  const handleOpenSettlementModal = (ctr: Contractor) => {
    setSelectedContractor(ctr);
    setSettlementData({
      amount: ctr.current_balance || 0,
      financial_account_id: financialAccounts[0]?.id || 0,
      notes: `پرداخت کارمزدی به ${ctr.name}`,
    });
    setIsSettlementModalOpen(true);
  };

  const handleSaveContractor = async () => {
    if (!formData.name.trim()) return;
    try {
      const payload: Partial<Contractor> = {
        id: selectedContractor ? selectedContractor.id : undefined,
        name: formData.name.trim(),
        specialty: formData.specialty,
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        current_balance: selectedContractor ? selectedContractor.current_balance : 0,
        status: 'active',
      };
      await storageManager.saveContractor(payload);
      setIsAddEditModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Error saving contractor:', err);
    }
  };

  const handleExecuteSettlement = async () => {
    if (!selectedContractor || settlementData.amount <= 0) return;
    try {
      const newBal = (selectedContractor.current_balance || 0) - Number(settlementData.amount);
      await storageManager.saveContractor({
        id: selectedContractor.id,
        current_balance: newBal,
      });

      // Record Treasury Transaction
      if (settlementData.financial_account_id) {
        await storageManager.saveTreasuryTransaction({
          financial_account_id: Number(settlementData.financial_account_id),
          type: 'withdrawal',
          amount: Number(settlementData.amount),
          notes: settlementData.notes,
        });
      }

      setIsSettlementModalOpen(false);
      await loadData();
    } catch (err) {
      console.error('Error executing contractor settlement:', err);
    }
  };

  const handleDeleteContractor = async (id: number) => {
    if (window.confirm('آیا از حذف این پیمانکار اطمینان دارید؟')) {
      try {
        await storageManager.deleteContractor(id);
        await loadData();
      } catch (err) {
        console.error('Error deleting contractor:', err);
      }
    }
  };

  const formatNum = (num: number) => (isPersian ? toPersianDigits(num) : num.toString());

  const getSpecialtyLabel = (specKey: string) => {
    const found = CONTRACTOR_SPECIALTIES.find((s) => s.key === specKey);
    return found ? found.label : specKey;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="معین و حساب پیمانکاران"
        subtitle="ثبت اطلاعات خیاط، چاپ‌کار، گلدوز و محاسبه بدهکاری/طلبکاری همراه با تسویه سریع"
        action={
          <Button variant="primary" onClick={handleOpenAddModal} icon={<Plus className="w-4 h-4" />}>
            تعریف پیمانکار جدید
          </Button>
        }
      />

      {/* Filter & Search Bar */}
      <Card className="p-4 bg-white dark:bg-[#13151a] border-neutral-200/80 dark:border-neutral-800/80">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <Input
              type="text"
              placeholder="جستجو بر اساس نام پیمانکار یا شماره تماس..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="ps-9 w-full text-xs"
            />
          </div>

          <div className="w-full sm:w-64">
            <Select
              value={specialtyFilter}
              onChange={(e) => {
                setSpecialtyFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs"
            >
              <option value="all">همه تخصص‌ها</option>
              {CONTRACTOR_SPECIALTIES.map((spec) => (
                <option key={`spec_opt_${spec.key}`} value={spec.key}>
                  {spec.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Data Section */}
      {loading ? (
        <div className="py-12 text-center text-xs text-neutral-400">در حال دریافت حساب پیمانکاران...</div>
      ) : paginatedContractors.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-neutral-200 dark:border-neutral-800">
          <p className="text-xs text-neutral-500">هیچ پیمانکاری یافت نشد.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Mobile Cards (md:hidden) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {paginatedContractors.map((ctr) => {
              const balance = ctr.current_balance || 0;
              return (
                <Card key={`ctr_mcard_${ctr.id}`} className="p-4 bg-white dark:bg-[#13151a]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800">
                        {getSpecialtyLabel(ctr.specialty)}
                      </span>
                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white mt-1">{ctr.name}</h4>
                      {ctr.phone && <p className="text-[11px] text-neutral-500 font-mono mt-0.5">{ctr.phone}</p>}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenSettlementModal(ctr)}
                        className="text-emerald-600"
                        title="تسویه وجه"
                      >
                        تسویه
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(ctr)}>
                        <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteContractor(ctr.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
                    <span className="text-neutral-500">مانده حساب:</span>
                    <span className={`font-bold font-mono ${balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-rose-600' : 'text-neutral-900'}`}>
                      {formatCurrency(Math.abs(balance))} {balance > 0 ? '(طلبکار)' : balance < 0 ? '(بدهکار)' : '(بی‌حساب)'}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop Table (hidden md:block) */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-neutral-200/80 dark:border-neutral-800/80 bg-white dark:bg-[#13151a] shadow-vercel-sm">
            <table className="w-full text-start text-xs">
              <thead className="bg-neutral-50 dark:bg-[#181a20] border-b border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold">
                <tr>
                  <th className="px-4 py-3 text-start">نام پیمانکار</th>
                  <th className="px-4 py-3 text-start">تخصص / کاربری</th>
                  <th className="px-4 py-3 text-start">شماره تماس</th>
                  <th className="px-4 py-3 text-end">مانده حساب کارمزدی</th>
                  <th className="px-4 py-3 text-end">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {paginatedContractors.map((ctr) => {
                  const balance = ctr.current_balance || 0;
                  return (
                    <tr key={`ctr_drow_${ctr.id}`} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40">
                      <td className="px-4 py-3 font-bold text-neutral-900 dark:text-white">{ctr.name}</td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                        {getSpecialtyLabel(ctr.specialty)}
                      </td>
                      <td className="px-4 py-3 font-mono text-neutral-600 dark:text-neutral-400">
                        {ctr.phone || '-'}
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-bold">
                        <span className={balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-rose-600' : 'text-neutral-900 dark:text-white'}>
                          {formatCurrency(Math.abs(balance))} {balance > 0 ? '(طلبکار)' : balance < 0 ? '(بدهکار)' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenSettlementModal(ctr)}
                            className="text-emerald-600 font-bold"
                          >
                            تسویه و پرداخت
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenEditModal(ctr)}>
                            ویرایش
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteContractor(ctr.id)} className="text-rose-600">
                            حذف
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {/* Add / Edit Contractor Modal */}
      {isAddEditModalOpen && (
        <Modal
          isOpen={isAddEditModalOpen}
          onClose={() => setIsAddEditModalOpen(false)}
          title={selectedContractor ? 'ویرایش اطلاعات پیمانکار' : 'تعریف پیمانکار / خیاط جدید'}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">نام و نام‌خانوادگی پیمانکار *</label>
              <Input
                type="text"
                placeholder="مثال: استاد علیرضا رضایی (کارگاه دوخت)"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">تخصص اصلی</label>
                <Select
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value as ContractorSpecialty })}
                >
                  {CONTRACTOR_SPECIALTIES.map((spec) => (
                    <option key={`ctr_form_spec_${spec.key}`} value={spec.key}>
                      {spec.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">شماره همراه / تماس</label>
                <Input
                  type="text"
                  placeholder="09121112233"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">آدرس کارگاه</label>
              <Input
                type="text"
                placeholder="تهران، بازار بزرگ، راسته‌خیاط‌ها..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <Button variant="ghost" onClick={() => setIsAddEditModalOpen(false)}>
                انصراف
              </Button>
              <Button variant="primary" onClick={handleSaveContractor}>
                ذخیره اطلاعات
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Contractor Settlement Modal */}
      {isSettlementModalOpen && selectedContractor && (
        <Modal
          isOpen={isSettlementModalOpen}
          onClose={() => setIsSettlementModalOpen(false)}
          title={`تسویه وجه کارمزدی: ${selectedContractor.name}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-neutral-600 dark:text-neutral-400">
              طلب فعلی پیمانکار:{' '}
              <strong className="font-mono text-emerald-600 font-bold">
                {formatCurrency(selectedContractor.current_balance || 0)}
              </strong>
            </p>

            <div>
              <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">مبلغ پرداختی (تومان)</label>
              <Input
                type="number"
                value={settlementData.amount}
                onChange={(e) => setSettlementData({ ...settlementData, amount: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">منبع پرداخت (بانک / صندوق)</label>
              <Select
                value={settlementData.financial_account_id}
                onChange={(e) => setSettlementData({ ...settlementData, financial_account_id: Number(e.target.value) })}
              >
                {financialAccounts.map((acc) => (
                  <option key={`settle_acc_${acc.id}`} value={acc.id}>
                    {acc.name} (موجودی: {formatCurrency(acc.current_balance || 0)})
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-neutral-700 dark:text-neutral-300 font-bold mb-1">بابت / توضیحات سند</label>
              <Input
                type="text"
                value={settlementData.notes}
                onChange={(e) => setSettlementData({ ...settlementData, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <Button variant="ghost" onClick={() => setIsSettlementModalOpen(false)}>
                انصراف
              </Button>
              <Button variant="primary" onClick={handleExecuteSettlement}>
                ثبت پرداخت و تسویه
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
