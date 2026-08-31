import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n';
import { useOrganization } from '../../context/OrganizationContext';
import { storageManager } from '../../storage';
import { Category } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ImageUpload } from '../../components/ui/ImageUpload';
import { directusClient } from '../../api/directus';
import { confirmAction } from '../../utils/confirm';
import {
  FolderTree,
  Plus,
  Search,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Image as ImageIcon,
} from 'lucide-react';

export const CategoriesView: React.FC = () => {
  const { t } = useTranslation();
  const { activeOrganization } = useOrganization();

  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [parentId, setParentId] = useState<number | ''>('');
  const [image, setImage] = useState('');
  const [description, setDescription] = useState('');
  const [sort, setSort] = useState<number | ''>(0);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSaving, setIsSaving] = useState(false);

  const loadCategories = async () => {
    setIsLoading(true);
    try {
      const adapter = storageManager.getAdapter();
      const list = await adapter.getCategories({ organization_id: activeOrganization?.id });
      setCategories(list);

      // Auto expand root nodes
      const initialExpand: Record<number, boolean> = {};
      list.forEach((c) => {
        initialExpand[c.id] = true;
      });
      setExpandedNodes(initialExpand);
    } catch (err) {
      console.error('[CategoriesView] Error loading categories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [activeOrganization]);

  const handleOpenModal = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat);
      setName(cat.name);
      setSlug(cat.slug || '');
      const pId = typeof cat.parent_id === 'number' ? cat.parent_id : cat.parent_id?.id || '';
      setParentId(pId);
      setImage(cat.image || '');
      setDescription(cat.description || '');
      setSort(cat.sort !== undefined ? cat.sort : 0);
      setStatus(cat.status === 'inactive' ? 'inactive' : 'active');
    } else {
      setEditingCategory(null);
      setName('');
      setSlug('');
      setParentId('');
      setImage('');
      setDescription('');
      setSort(0);
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
      const generatedSlug = slug.trim() || name.toLowerCase().replace(/\s+/g, '-');

      await adapter.saveCategory({
        id: editingCategory?.id,
        organization_id: orgId,
        name,
        slug: generatedSlug,
        parent_id: parentId ? Number(parentId) : null,
        image,
        description,
        sort: sort !== '' ? Number(sort) : 0,
        status,
      });

      setIsModalOpen(false);
      await loadCategories();
    } catch (err) {
      console.error('[CategoriesView] Error saving category:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (await confirmAction('آیا از حذف این دسته‌بندی مطمئن هستید؟')) {
      const adapter = storageManager.getAdapter();
      await adapter.deleteCategory(id);
      await loadCategories();
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper to build hierarchy
  const getParentId = (cat: Category): number | null => {
    if (!cat.parent_id) return null;
    return typeof cat.parent_id === 'number' ? cat.parent_id : cat.parent_id.id;
  };

  const buildTree = (pId: number | null = null): Category[] => {
    return categories
      .filter((c) => getParentId(c) === pId)
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));
  };

  const getParentSelectOptions = () => {
    const options: { value: number; label: string }[] = [];
    const traverse = (pId: number | null, prefix: string) => {
      const children = buildTree(pId);
      children.forEach((c) => {
        // Prevent electing itself as parent
        if (!editingCategory || c.id !== editingCategory.id) {
          options.push({ value: c.id, label: `${prefix}${c.name}` });
          traverse(c.id, `${prefix}${c.name} > `);
        }
      });
    };
    traverse(null, '');
    return options;
  };

  const renderTreeNode = (node: Category, depth: number = 0, nodeIndex: number = 0) => {
    const children = buildTree(node.id);
    const hasChildren = children.length > 0;
    const isExpanded = !!expandedNodes[node.id];

    return (
      <div key={`cat_node_${node.id || 'idx'}_${depth}_${nodeIndex}`} className="space-y-1">
        <div
          className={`group flex items-center justify-between p-3 rounded-2xl border transition-all duration-150 ${
            depth === 0
              ? 'bg-slate-50/80 border-slate-200/80 hover:border-slate-300'
              : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-2xs'
          }`}
          style={{ marginRight: `${depth * 1.75}rem` }}
        >
          <div className="flex items-center gap-3">
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpand(node.id)}
                className="p-1 hover:bg-slate-200/60 rounded-lg text-slate-500 cursor-pointer"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-indigo-600" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            ) : (
              <span className="w-6" />
            )}

            {node.image ? (
              <img
                src={directusClient.getAssetUrl(node.image)}
                alt={node.name}
                className="w-8 h-8 rounded-xl object-cover border border-slate-200"
              />
            ) : (
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  depth === 0
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {isExpanded && hasChildren ? (
                  <FolderOpen className="w-4 h-4" />
                ) : (
                  <Folder className="w-4 h-4" />
                )}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{node.name}</span>
                <span className="text-[11px] font-mono text-slate-400">({node.slug})</span>
              </div>
              {node.description && (
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{node.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant={node.status === 'active' ? 'success' : 'neutral'}>
              {node.status === 'active' ? 'فعال' : 'غیرفعال'}
            </Badge>

            <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenModal(node)}
                icon={<Edit className="w-3.5 h-3.5 text-slate-600" />}
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => handleDelete(node.id)}
                icon={<Trash2 className="w-3.5 h-3.5" />}
              />
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1 relative pr-3 border-r-2 border-indigo-100 mr-4">
            {children.map((child, cIdx) => renderTreeNode(child, depth + 1, cIdx))}
          </div>
        )}
      </div>
    );
  };

  const rootNodes = buildTree(null);

  const filteredCategories = search.trim()
    ? categories.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.slug && c.slug.toLowerCase().includes(search.toLowerCase()))
      )
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="مدیریت دسته‌بندی‌ها"
        subtitle="تعریف و سازماندهی دسته‌بندی‌های کالا در ساختار درختی چندسطحی"
        actions={
          <Button
            onClick={() => handleOpenModal()}
            icon={<Plus className="w-4 h-4" />}
          >
            افزودن دسته‌بندی جدید
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-5">
          <div className="w-full sm:w-80">
            <Input
              placeholder="جستجو در دسته‌بندی‌ها..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm">در حال دریافت لیست دسته‌بندی‌ها...</div>
        ) : filteredCategories ? (
          <div className="space-y-2">
            {filteredCategories.length === 0 ? (
              <p className="py-8 text-center text-slate-400 text-sm">هیچ دسته‌بندی با این مشخصات یافت نشد.</p>
            ) : (
              filteredCategories.map((c, cIdx) => renderTreeNode(c, 0, cIdx))
            )}
          </div>
        ) : rootNodes.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            هیچ دسته‌بندی تاکنون ثبت نشده است. از دکمه «افزودن دسته‌بندی جدید» استفاده کنید.
          </div>
        ) : (
          <div className="space-y-3">
            {rootNodes.map((rootNode, rIdx) => renderTreeNode(rootNode, 0, rIdx))}
          </div>
        )}
      </Card>

      {/* Modal for create/edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'ویرایش دسته‌بندی' : 'افزودن دسته‌بندی جدید'}
        maxWidth="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="category-form" isLoading={isSaving}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSave} className="space-y-4">
          <Input
            label="نام دسته‌بندی *"
            placeholder="مثال: کت و کاپشن مردانه"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="نام انگلیسی / اسلاگ (Slug)"
              placeholder="men-jackets"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <Select
              label="دسته‌بندی مادر (Parent)"
              value={parentId}
              onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : '')}
              options={[
                { value: '', label: 'دسته‌بندی اصلی (سطح اول)' },
                ...getParentSelectOptions(),
              ]}
            />
          </div>

          <ImageUpload
            label="تصویر کاور دسته‌بندی"
            value={image}
            onChange={setImage}
            helperText="تصویر آیکون یا بنر نمایش دسته‌بندی"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="ترتیب نمایش (Sort)"
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value ? Number(e.target.value) : '')}
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

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">توضیحات</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-white border border-slate-300 rounded-xl text-slate-900 text-sm p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="توضیحات تکمیلی دسته‌بندی..."
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
