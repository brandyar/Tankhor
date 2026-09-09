import React, { useState } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { OrganizationUser, UserRole, Status } from '../../types';
import { ROLE_DEFINITIONS, getRoleDefinition } from '../../utils/permissions';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { formatDate } from '../../utils/formatters';
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  Edit3,
  Mail,
  Search,
  Check,
  X,
  Lock,
  Key,
  UserCheck,
  Crown,
  Briefcase,
  Warehouse,
  ShoppingBag,
  Eye,
  EyeOff,
} from 'lucide-react';

export const OrganizationMembersSection: React.FC = () => {
  const { t, locale } = useTranslation();
  const isPersian = locale === 'fa';
  const {
    activeOrganization,
    organizationUsers,
    saveOrganizationUser,
    deleteOrganizationUser,
    permissions,
  } = useOrganization();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<OrganizationUser | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('sales');
  const [status, setStatus] = useState<Status>('active');

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const handleOpenCreateModal = () => {
    setEditingMember(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setRole('sales');
    setStatus('active');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (member: OrganizationUser) => {
    setEditingMember(member);
    setFirstName(member.first_name || '');
    setLastName(member.last_name || '');
    setEmail(member.email || '');
    setPassword('');
    setShowPassword(false);
    setRole((member.role as UserRole) || 'viewer');
    setStatus(member.status || 'active');
    setIsModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() && !firstName.trim()) {
      alert(isPersian ? 'لطفاً نام یا ایمیل عضو را وارد کنید.' : 'Please enter name or email.');
      return;
    }

    if (!editingMember && !password.trim()) {
      alert(isPersian ? 'لطفاً رمز عبور ورود را تعیین کنید.' : 'Please set a password.');
      return;
    }

    if (password.trim() && password.trim().length < 6) {
      alert(isPersian ? 'رمز عبور باید حداقل ۶ کاراکتر باشد.' : 'Password must be at least 6 characters.');
      return;
    }

    setIsSaving(true);
    try {
      await saveOrganizationUser({
        id: editingMember?.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        password: password.trim() || undefined,
        user_id: editingMember?.user_id || `usr_${Date.now()}`,
        role: role,
        status: status,
      });
      setIsModalOpen(false);
    } catch (err: any) {
      alert(isPersian ? `خطا در ذخیره‌سازی: ${err.message}` : `Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMember = async (id: number) => {
    setIsSaving(true);
    try {
      await deleteOrganizationUser(id);
      setDeleteConfirmId(null);
    } catch (err: any) {
      alert(isPersian ? `خطا در حذف: ${err.message}` : `Delete error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMembers = organizationUsers.filter((m) => {
    const fullName = `${m.first_name || ''} ${m.last_name || ''}`.toLowerCase();
    const mail = (m.email || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return fullName.includes(term) || mail.includes(term);
  });

  const getRoleIcon = (roleKey: string) => {
    switch (roleKey) {
      case 'owner':
        return <Crown className="w-4 h-4 text-amber-500" />;
      case 'manager':
        return <Briefcase className="w-4 h-4 text-blue-500" />;
      case 'warehouse':
        return <Warehouse className="w-4 h-4 text-purple-500" />;
      case 'sales':
        return <ShoppingBag className="w-4 h-4 text-emerald-500" />;
      default:
        return <Eye className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusBadge = (s: Status) => {
    switch (s) {
      case 'active':
        return <Badge variant="success">{isPersian ? 'فعال' : 'Active'}</Badge>;
      case 'invited':
        return <Badge variant="warning">{isPersian ? 'دعوت‌شده' : 'Invited'}</Badge>;
      case 'suspended':
        return <Badge variant="danger">{isPersian ? 'تعلیق‌شده' : 'Suspended'}</Badge>;
      default:
        return <Badge variant="neutral">{s}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Action */}
      <Card
        title={isPersian ? 'مدیریت اعضا و دسترسی‌های سازمان' : 'Organization Members & Roles'}
        subtitle={
          isPersian
            ? `کاربران عضو سازمان «${activeOrganization?.name || ''}» و تعیین سطوح دسترسی کارمندان`
            : `Members of "${activeOrganization?.name || ''}" and employee access level assignments`
        }
        action={
          permissions.canManageUsers && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreateModal}
              icon={<UserPlus className="w-4 h-4" />}
            >
              {isPersian ? 'افزودن / دعوت عضو جدید' : 'Add / Invite New Member'}
            </Button>
          )
        }
      >
        <div className="space-y-4">
          {!permissions.canManageUsers && (
            <div className="flex items-center gap-2.5 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs rounded-xl">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                {isPersian
                  ? 'شما دسترسی کافی جهت افزودن یا تغییر نقش اعضای سازمان را ندارید. ویرایش اعضا نیازمند نقش مالک یا مدیر است.'
                  : 'You do not have permissions to manage team members. Editing members requires Owner or Manager role.'}
              </span>
            </div>
          )}

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isPersian ? 'جستجو بر اساس نام یا ایمیل عضو...' : 'Search by member name or email...'}
              className="w-full ps-9 pe-4 py-2 text-xs bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-[#13151a] text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 transition-all"
            />
          </div>

          {/* Member List Cards / Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredMembers.length === 0 ? (
              <div className="col-span-full py-10 text-center border border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl bg-neutral-50/50 dark:bg-neutral-900/30">
                <Users className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mx-auto mb-2" />
                <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  {isPersian ? 'عضوی با این مشخصات یافت نشد' : 'No members found'}
                </p>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">
                  {isPersian ? 'با کلیک روی «افزودن عضو جدید» کارمندان خود را اضافه کنید.' : 'Click "Add / Invite New Member" to add team members.'}
                </p>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const roleDef = getRoleDefinition(member.role);
                return (
                  <div
                    key={member.id}
                    className="p-4 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-[#14161d] hover:border-neutral-300 dark:hover:border-neutral-700 transition-all shadow-xs flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-neutral-900 dark:bg-neutral-800 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                          {member.first_name ? member.first_name[0] : 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                              {member.first_name || member.last_name
                                ? `${member.first_name || ''} ${member.last_name || ''}`
                                : (isPersian ? 'کاربر بدون نام' : 'Unnamed User')}
                            </h4>
                            {getStatusBadge(member.status)}
                          </div>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono mt-0.5 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-neutral-400 dark:text-neutral-500" />
                            <span>{member.email || (isPersian ? 'بدون ایمیل' : 'No Email')}</span>
                          </p>
                        </div>
                      </div>

                      {permissions.canManageUsers && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(member)}
                            className="p-1.5 text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors cursor-pointer"
                            title={isPersian ? 'ویرایش دسترسی' : 'Edit Member'}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {member.role !== 'owner' && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(member.id)}
                              className="p-1.5 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                              title={isPersian ? 'حذف عضو' : 'Remove Member'}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Role & Permissions details */}
                    <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {getRoleIcon(member.role)}
                        <span className="font-bold text-neutral-800 dark:text-neutral-200">
                          {isPersian ? roleDef.labelFa : roleDef.labelEn}
                        </span>
                      </div>
                      <span className="text-neutral-400 dark:text-neutral-500 text-[10px] font-mono">
                        {isPersian ? 'عضویت:' : 'Joined:'} {formatDate(member.date_joined || new Date().toISOString())}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </Card>

      {/* Role Matrix Helper Table */}
      <Card
        title={t('settings.roleMatrixTitle')}
        subtitle={t('settings.roleMatrixSubtitle')}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700/80 bg-neutral-100/70 dark:bg-[#181a20] text-neutral-900 dark:text-neutral-100 font-bold">
                <th className="p-3 text-start">{t('settings.capabilityOrMenu')}</th>
                <th className="p-3 text-center">
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t('settings.roleOwnerShort')}</span>
                  </span>
                </th>
                <th className="p-3 text-center">
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                    <span>{t('settings.roleManagerShort')}</span>
                  </span>
                </th>
                <th className="p-3 text-center">
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <Warehouse className="w-3.5 h-3.5 text-purple-500" />
                    <span>{t('settings.roleWarehouseShort')}</span>
                  </span>
                </th>
                <th className="p-3 text-center">
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{t('settings.roleSalesShort')}</span>
                  </span>
                </th>
                <th className="p-3 text-center">
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <Eye className="w-3.5 h-3.5 text-neutral-500 dark:text-neutral-400" />
                    <span>{t('settings.roleViewerShort')}</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/80 text-neutral-800 dark:text-neutral-200">
              <tr>
                <td className="p-3 font-medium">{t('settings.matrixOrgSettings')}</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
              </tr>
              <tr>
                <td className="p-3 font-medium">{t('settings.matrixMemberManagement')}</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
              </tr>
              <tr>
                <td className="p-3 font-medium">{t('settings.matrixProductManagement')}</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
              </tr>
              <tr>
                <td className="p-3 font-medium">{t('settings.matrixInventoryManagement')}</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
              </tr>
              <tr>
                <td className="p-3 font-medium">{t('settings.matrixSalesOrders')}</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
              </tr>
              <tr>
                <td className="p-3 font-medium">{t('settings.matrixPurchasing')}</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
              </tr>
              <tr>
                <td className="p-3 font-medium">{t('settings.matrixFinancialProfit')}</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-neutral-300 dark:text-neutral-600 inline" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Member Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMember ? (isPersian ? 'ویرایش سطح دسترسی عضو' : 'Edit Member Access') : (isPersian ? 'افزودن یا دعوت عضو جدید به سازمان' : 'Add or Invite New Member')}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveMember} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="نام *"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="مثلاً: علی"
              required
            />
            <Input
              label="نام خانوادگی"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="مثلاً: رضایی"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="آدرس ایمیل *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ali@example.com"
              required
            />
            <div>
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                {editingMember ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور ورود *'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingMember ? 'جهت تغییر رمز عبور وارد کنید' : 'حداقل ۶ کاراکتر'}
                  className="w-full ps-3 pe-9 py-2 text-xs bg-neutral-50 dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-[#181a20] text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 font-mono tracking-wider transition-all"
                  required={!editingMember}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer p-1"
                  title={showPassword ? 'مخفی‌سازی رمز عبور' : 'نمایش رمز عبور'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="نقش و سطح دسترسی *"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              options={[
                { value: 'owner', label: 'مالک سازمان (Owner)' },
                { value: 'manager', label: 'مدیر فروشگاه (Store Manager)' },
                { value: 'warehouse', label: 'انباردار (Warehouse)' },
                { value: 'sales', label: 'فروشنده / صندوق‌دار (Sales)' },
                { value: 'viewer', label: 'مشاهده‌گر (Viewer)' },
              ]}
            />

            <Select
              label="وضعیت حساب عضو"
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              options={[
                { value: 'active', label: 'فعال (Active)' },
                { value: 'invited', label: 'دعوت‌نامه ارسال شده (Invited)' },
                { value: 'suspended', label: 'تعلیق شده (Suspended)' },
              ]}
            />
          </div>

          {/* Role Description Card */}
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-[#181a20] border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
            <div className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>
                {isPersian
                  ? `اختیارات نقش انتخاب شده (${ROLE_DEFINITIONS[role]?.labelFa}):`
                  : `Selected Role Permissions (${ROLE_DEFINITIONS[role]?.labelEn}):`}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {isPersian ? ROLE_DEFINITIONS[role]?.descriptionFa : ROLE_DEFINITIONS[role]?.descriptionEn}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100 dark:border-neutral-800">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" type="submit" isLoading={isSaving}>
              {isPersian ? 'ذخیره تغییرات عضو' : 'Save Member Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Member Confirmation Modal */}
      {deleteConfirmId && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirmId(null)}
          title={isPersian ? 'تایید حذف عضو از سازمان' : 'Confirm Remove Member'}
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-neutral-700 dark:text-neutral-300">
              {isPersian
                ? 'آیا از حذف این کاربر از لیست اعضای سازمان اطمینان دارید؟ این کاربر دیگر به اطلاعات و منوهای این سازمان دسترسی نخواهد داشت.'
                : 'Are you sure you want to remove this member? They will no longer have access to this organization.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDeleteMember(deleteConfirmId)}
                isLoading={isSaving}
              >
                {isPersian ? 'حذف عضو' : 'Remove Member'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
