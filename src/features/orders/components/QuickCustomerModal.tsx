import React, { useState } from 'react';
import { useTranslation } from '../../../i18n';
import { storageManager } from '../../../storage';
import { Customer } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { UserPlus, User, Phone } from 'lucide-react';

interface QuickCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: number;
  onCustomerCreated: (customer: Customer) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export const QuickCustomerModal: React.FC<QuickCustomerModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  onCustomerCreated,
  showToast,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const adapter = storageManager.getAdapter();
      const created = await adapter.saveCustomer({
        organization_id: organizationId || 1,
        name: name.trim(),
        phone: phone.trim() || undefined,
        status: 'active',
      });

      onCustomerCreated(created);
      onClose();
      setName('');
      setPhone('');
      showToast('success', t('orders.customerCreatedSuccess', { name: created.name }));
    } catch (err) {
      console.error('[QuickCustomerModal] Error creating customer:', err);
      showToast('error', t('orders.customerCreateError') || 'خطا در ثبت مشتری جدید');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('orders.quickCustomerAdd')}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('orders.customerName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('orders.customerNamePlaceholder') || 'نام و نام خانوادگی'}
          required
          autoFocus
          icon={<User className="w-4 h-4 text-neutral-400" />}
        />

        <Input
          label={t('orders.customerPhone')}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="0912..."
          icon={<Phone className="w-4 h-4 text-neutral-400" />}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSaving}
            disabled={!name.trim()}
          >
            <UserPlus className="w-4 h-4 me-1.5" />
            {t('orders.saveCustomer')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
