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
        return <Badge variant="success">فعال</Badge>;
      case 'invited':
        return <Badge variant="warning">دعوت‌شده</Badge>;
      case 'suspended':
        return <Badge variant="danger">تعلیق‌شده</Badge>;
      default:
        return <Badge variant="neutral">{s}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Add Action */}
      <Card
        title="مدیریت اعضا و دسترسی‌های سازمان"
        subtitle={`کاربران عضو سازمان «${activeOrganization?.name || ''}» و تعیین سطوح دسترسی کارمندان`}
        action={
          permissions.canManageUsers && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenCreateModal}
              icon={<UserPlus className="w-4 h-4" />}
            >
              افزودن / دعوت عضو جدید
            </Button>
          )
        }
      >
        <div className="space-y-4">
          {!permissions.canManageUsers && (
            <div className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                شما دسترسی کافی جهت افزودن یا تغییر نقش اعضای سازمان را ندارید. ویرایش اعضا نیازمند نقش <strong>مالک</strong> یا <strong>مدیر</strong> است.
              </span>
            </div>
          )}

          {/* Search bar */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو بر اساس نام یا ایمیل عضو..."
              className="w-full ps-9 pe-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Member List Cards / Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredMembers.length === 0 ? (
              <div className="col-span-full py-10 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-600">عضوی با این مشخصات یافت نشد</p>
                <p className="text-[11px] text-slate-400 mt-1">با کلیک روی «افزودن عضو جدید» کارمندان خود را اضافه کنید.</p>
              </div>
            ) : (
              filteredMembers.map((member) => {
                const roleDef = getRoleDefinition(member.role);
                return (
                  <div
                    key={member.id}
                    className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all shadow-xs flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                          {member.first_name ? member.first_name[0] : 'U'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900">
                              {member.first_name || member.last_name
                                ? `${member.first_name || ''} ${member.last_name || ''}`
                                : 'کاربر بدون نام'}
                            </h4>
                            {getStatusBadge(member.status)}
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{member.email || 'بدون ایمیل'}</span>
                          </p>
                        </div>
                      </div>

                      {permissions.canManageUsers && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(member)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="ویرایش دسترسی"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {member.role !== 'owner' && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(member.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف عضو"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Role & Permissions details */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {getRoleIcon(member.role)}
                        <span className="font-bold text-slate-800">{roleDef.labelFa}</span>
                      </div>
                      <span className="text-slate-400 text-[10px] font-mono">
                        عضویت: {formatDate(member.date_joined || new Date().toISOString())}
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
        title="ماتریس دسترسی نقش‌های سیستم"
        subtitle="جدول مقایسه‌ای سطح اختیارات انواع کارمندان در پلتفرم تن‌خور"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold">
                <th className="p-3 text-start">قابلیت / منو</th>
                <th className="p-3 text-center">
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <span>مالک</span>
                  </span>
                </th>
                <th className="p-3 text-center">
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                    <span>مدیر</span>
                  </span>
                </th>
                <th className="p-3 text-center">
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <Warehouse className="w-3.5 h-3.5 text-purple-500" />
                    <span>انباردار</span>
                  </span>
                </th>
                <th className="p-3 text-center">
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
                    <span>فروشنده</span>
                  </span>
                </th>
                <th className="p-3 text-center">
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>مشاهده‌گر</span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="p-3 font-medium">تنظیمات سازمان & برند</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
              </tr>
              <tr>
                <td className="p-3 font-medium">مدیر اعضا و دعوت کارمندان</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
              </tr>
              <tr>
                <td className="p-3 font-medium">تعریف و ویرایش محصولات</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
              </tr>
              <tr>
                <td className="p-3 font-medium">مدیریت انبار، قفسه‌ها و اصلاح موجودی</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
              </tr>
              <tr>
                <td className="p-3 font-medium">ثبت سفارشات فروش مشتریان</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
              </tr>
              <tr>
                <td className="p-3 font-medium">سفارشات خرید و مدیریت تامین‌کنندگان</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
              </tr>
              <tr>
                <td className="p-3 font-medium">مشاهده قیمت خرید و حاشیه سود مالی</td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><Check className="w-4 h-4 text-emerald-600 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
                <td className="p-3 text-center"><X className="w-4 h-4 text-slate-300 inline" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit Member Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMember ? 'ویرایش سطح دسترسی عضو' : 'افزودن یا دعوت عضو جدید به سازمان'}
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {editingMember ? 'رمز عبور جدید (اختیاری)' : 'رمز عبور ورود *'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingMember ? 'جهت تغییر رمز عبور وارد کنید' : 'حداقل ۶ کاراکتر'}
                  className="w-full ps-3 pe-9 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-mono tracking-wider transition-all"
                  required={!editingMember}
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
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
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>اختیارات نقش انتخاب شده ({ROLE_DEFINITIONS[role]?.labelFa}):</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {ROLE_DEFINITIONS[role]?.descriptionFa}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              انصراف
            </Button>
            <Button variant="primary" type="submit" isLoading={isSaving}>
              ذخیره تغییرات عضو
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Member Confirmation Modal */}
      {deleteConfirmId && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirmId(null)}
          title="تایید حذف عضو از سازمان"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-700">
              آیا از حذف این کاربر از لیست اعضای سازمان اطمینان دارید؟ این کاربر دیگر به اطلاعات و منوهای این سازمان دسترسی نخواهد داشت.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
                انصراف
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => handleDeleteMember(deleteConfirmId)}
                isLoading={isSaving}
              >
                حذف عضو
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
