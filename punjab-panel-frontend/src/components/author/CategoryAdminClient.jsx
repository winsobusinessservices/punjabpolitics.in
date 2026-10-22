"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { categoriesApi } from "@/lib/api";
import { slugify } from "@/lib/slugify";
import { useConfirmDialog } from "@/components/common/ConfirmDialogProvider";
import RichTextEditor from "@/components/common/RichTextEditor";
import WebsiteReferenceVisibility from "@/components/author/WebsiteReferenceVisibility";
import { useAdminSite } from "@/context/AdminSiteContext";

const ROWS_PER_PAGE = 6;
const PUBLIC_SITE_URL = (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "https://punjabpolitics.com").replace(/\/$/, "");

export default function CategoryAdminClient() {
  const confirmDelete = useConfirmDialog();
  const { activeSite, activeSiteId: siteId } = useAdminSite();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isVisible, setIsVisible] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [updating, setUpdating] = useState(new Set());

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(normalizedFilter)
  );
  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const firstRow = (currentPage - 1) * ROWS_PER_PAGE;
  const visibleCategories = filteredCategories.slice(firstRow, firstRow + ROWS_PER_PAGE);

  const activeSiteUrl = activeSite?.domain ? `https://${activeSite.domain}` : PUBLIC_SITE_URL;

  const loadCategories = async (targetSiteId = siteId) => {
    try {
      const data = await categoriesApi.listVisibilitySettings(targetSiteId);
      setCategories(data.categories || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    let active = true;
    if (!siteId) return () => { active = false; };
    categoriesApi.listVisibilitySettings(siteId)
      .then((data) => {
        if (active) {
          setCategories(data.categories || []);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [siteId]);

  const addCategory = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      if (editingCategory) {
        await categoriesApi.updateContent(editingCategory.id, content);
        if (Boolean(editingCategory.is_visible) !== isVisible) {
          await categoriesApi.setVisibility(editingCategory.id, isVisible);
        }
        if (Boolean(editingCategory.is_premium) !== isPremium) {
          await categoriesApi.setPremium(editingCategory.id, isPremium, siteId);
        }
        setSuccess(`Category page updated at /${editingCategory.slug}`);
      } else {
        const result = await categoriesApi.create({ name, content, isVisible, isPremium, siteId });
        setSuccess(`Category created at /${result.category.slug}`);
      }
      setName("");
      setContent("");
      setIsVisible(true);
      setIsPremium(false);
      setEditingCategory(null);
      await loadCategories();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeCategory = async (category) => {
    const confirmed = await confirmDelete({
      title: "Delete category?",
      description: `“${category.name}” will be removed from the author dropdown. Existing posts will keep their saved category.`,
    });
    if (!confirmed) return;
    setError("");
    setSuccess("");
    try {
      await categoriesApi.remove(category.id);
      setSuccess("Category deleted from the author dropdown.");
      await loadCategories();
    } catch (err) {
      setError(err.message);
    }
  };

  const editCategory = (category) => {
    setEditingCategory(category);
    setName(category.name);
    setContent(category.content || "");
    setIsVisible(Boolean(category.is_visible));
    setIsPremium(Boolean(category.is_premium));
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setName("");
    setContent("");
    setIsVisible(true);
    setError("");
  };

  const toggleVisibility = async (kind, item) => {
    const key = `${kind}:${item.id || item.section_key}`;
    const nextVisible = !Boolean(item.is_visible);
    setError("");
    setSuccess("");
    setUpdating((current) => new Set(current).add(key));
    try {
      await categoriesApi.setVisibility(item.id, nextVisible);
      setSuccess(`Category ${nextVisible ? "is now displayed" : "is now hidden"} in the public UI.`);
      await loadCategories();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-primary/30 bg-surface p-4 sm:p-5">
        <label htmlFor="category-website" className="font-headline-md text-primary">Website being configured</label>
        <p className="mt-1 text-xs text-on-surface-variant">Every visibility change below applies only to this website.</p>
        <div id="category-website" className="mt-3 inline-flex rounded-lg bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary">{activeSite?.name || "Select a website in the sidebar"}</div>
      </section>

      {siteId && <WebsiteReferenceVisibility key={siteId} siteId={siteId} />}

      <form onSubmit={addCategory} inert={submitting} aria-busy={submitting} className="bg-surface-container-low/60 rounded-lg border border-primary/30 p-4 sm:p-6">
        <h2 className="font-headline-lg text-xl text-primary mb-1">{editingCategory ? `Edit ${editingCategory.name}` : "Create Category Page"}</h2>
        <p className="mb-4 text-xs text-on-surface-variant">{editingCategory ? "Update this category's page content and visibility." : "The public route is created automatically. Existing party, leader, state, and union-territory routes stay protected."}</p>
        <label htmlFor="category-name" className="block font-label-md text-xs text-on-surface-variant mb-1.5">
          Category name <span className="text-error">*</span>
        </label>
        <input
          id="category-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          disabled={Boolean(editingCategory)}
          maxLength={120}
          placeholder="e.g. Foreign Policy (not an existing party or state)"
          className="w-full border border-outline-variant/30 bg-surface-container-low rounded px-3 py-2.5 text-on-surface focus:border-primary focus:outline-none"
        />
        <div className="mt-2 rounded bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
          Route: <span className="font-label-md text-primary">/{slugify(name) || "your-category"}</span>
        </div>
        <label className="mt-4 block font-label-md text-xs text-on-surface-variant mb-1.5">
          Category page content
        </label>
        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder="Write the introduction, background, or information visitors should see on this category page."
          minHeight="24rem"
          maxHeight="65vh"
          disabled={submitting}
        />
        <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant">
          Use headings, emphasis, lists, quotes, and links to structure the public category page.
        </p>
        <div className="mt-1 text-right text-[11px] text-on-surface-variant">{content.length.toLocaleString()} / 50,000</div>
        <label className="mt-3 flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={isVisible}
            onChange={(event) => setIsVisible(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Show this category publicly
        </label>
        <label className="mt-2 flex items-start gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={isPremium}
            onChange={(event) => setIsPremium(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
          />
          <span>
            <i className="fa-solid fa-crown mr-1 text-secondary" aria-hidden="true" />
            Use for Premium (subscribers only)
            <span className="block text-xs text-on-surface-variant">Stories in this category count as premium, and the category gets its own card under the Category chip on the website&apos;s /premium page.</span>
          </span>
        </label>
        {error && <p className="text-sm text-error mt-3" role="alert">{error}</p>}
        {success && <p className="text-sm text-primary mt-3" role="status">{success}</p>}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {editingCategory && (
            <button type="button" onClick={cancelEdit} className="rounded border border-outline-variant/40 px-6 py-2.5 font-label-md text-on-surface">
              Cancel
            </button>
          )}
          <button disabled={submitting} className="rounded bg-primary px-6 py-2.5 font-label-md text-on-primary disabled:opacity-60">
            {submitting ? "Saving..." : editingCategory ? "Save Page" : "Create Category Page"}
          </button>
        </div>
      </form>

      <section className="bg-surface-container-low/60 rounded-lg border border-primary/30 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-headline-lg text-xl text-primary">Available Categories</h2>
            <p className="font-body-md text-xs text-on-surface-variant mt-1">
              {filteredCategories.length} of {categories.length} categories
            </p>
          </div>
          <div className="relative sm:w-72">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm" />
            <input
              type="search"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(1);
              }}
              placeholder="Filter categories..."
              aria-label="Filter categories"
              className="w-full border border-outline-variant/30 bg-surface-container-low rounded pl-9 pr-9 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none"
            />
            {filter && (
              <button
                type="button"
                onClick={() => {
                  setFilter("");
                  setPage(1);
                }}
                aria-label="Clear category filter"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center min-h-64 text-on-surface-variant">
            <i className="fa-solid fa-spinner fa-spin mr-2" /> Loading categories...
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center min-h-64 flex flex-col items-center justify-center text-on-surface-variant">
            <i className="fa-solid fa-folder-open text-3xl text-primary/50 mb-3" />
            <p>No categories have been added.</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center min-h-64 flex flex-col items-center justify-center text-on-surface-variant">
            <i className="fa-solid fa-filter-circle-xmark text-3xl text-primary/50 mb-3" />
            <p>No categories match “{filter}”.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-outline-variant/25">
              <table className="w-full text-left border-collapse">
                <thead className="bg-primary/10 text-primary">
                  <tr>
                    <th className="px-4 py-3 font-label-md text-xs uppercase tracking-wider w-14">#</th>
                    <th className="px-4 py-3 font-label-md text-xs uppercase tracking-wider">Category</th>
                    <th className="px-4 py-3 font-label-md text-xs uppercase tracking-wider hidden sm:table-cell">Public route</th>
                    <th className="px-4 py-3 font-label-md text-xs uppercase tracking-wider">Display</th>
                    <th className="px-4 py-3 font-label-md text-xs uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/20 bg-surface-container-low">
                  {visibleCategories.map((category, index) => (
                    <tr key={category.id} className="hover:bg-primary/5 transition-colors">
                      <td className="px-4 py-3 text-sm text-on-surface-variant">{firstRow + index + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-label-md text-sm text-on-surface">{category.name}</span>
                        {Boolean(category.is_premium) && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-secondary"><i className="fa-solid fa-crown text-[9px]" aria-hidden="true" /> Premium</span>}
                        <span className={`mt-0.5 block text-[11px] ${category.route_owner || category.content ? "text-primary" : "text-on-surface-variant"}`}>
                          {category.route_owner
                            ? category.route_owner.section
                              ? `Dedicated ${category.route_owner.type} page - manage in Site Data > ${category.route_owner.section}`
                              : `Reserved route used by ${category.route_owner.name}`
                            : category.content ? "Page content added" : "No page content yet"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant hidden sm:table-cell">/{category.slug}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={Boolean(category.is_visible)}
                          disabled={updating.has(`category:${category.id}`)}
                          onClick={() => toggleVisibility("category", category)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${category.is_visible ? "bg-primary" : "bg-outline-variant"}`}
                          title={`${category.is_visible ? "Hide" : "Show"} ${category.name}`}
                        >
                          <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${category.is_visible ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {!category.route_owner && (
                            <button
                              type="button"
                              onClick={() => editCategory(category)}
                              title="Edit category page content"
                              aria-label={`Edit ${category.name} page content`}
                              className="inline-flex items-center justify-center w-9 h-9 rounded border border-primary/30 text-primary hover:bg-primary hover:text-on-primary transition-colors"
                            >
                              <i className="fa-solid fa-pen text-xs" />
                            </button>
                          )}
                          <Link
                            href={`${activeSiteUrl}${category.route_owner ? `/category/${category.slug}` : `/${category.slug}`}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open category page"
                            aria-label={`Open ${category.name} page`}
                            className="inline-flex items-center justify-center w-9 h-9 rounded border border-primary/30 text-primary hover:bg-primary hover:text-on-primary transition-colors"
                          >
                            <i className="fa-solid fa-arrow-up-right-from-square text-xs" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeCategory(category)}
                            title="Delete category"
                            aria-label={`Delete ${category.name}`}
                            className="inline-flex items-center justify-center w-9 h-9 rounded border border-error/30 text-error hover:bg-error hover:text-white transition-colors"
                          >
                            <i className="fa-solid fa-trash text-xs" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-4 mt-4">
              <p className="font-body-md text-xs text-on-surface-variant">
                Showing {firstRow + 1}–{Math.min(firstRow + ROWS_PER_PAGE, filteredCategories.length)} of {filteredCategories.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={currentPage === 1}
                  className="w-9 h-9 rounded border border-outline-variant/30 text-on-surface hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  <i className="fa-solid fa-chevron-left text-xs" />
                </button>
                <span className="font-label-md text-xs text-on-surface min-w-16 text-center">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={currentPage === totalPages}
                  className="w-9 h-9 rounded border border-outline-variant/30 text-on-surface hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  <i className="fa-solid fa-chevron-right text-xs" />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
