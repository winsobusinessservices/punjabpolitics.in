"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authApi, internalLinksApi, taskApi } from "@/lib/api";
import { publicSiteUrl } from "@/lib/siteUrl";
import { PERMISSIONS, hasAnyPermission } from "@/lib/permissions";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/lib/toast";
import { useConfirmDialog } from "@/components/common/ConfirmDialogProvider";
import { SkeletonBlock } from "@/components/common/Skeleton";
import EmptyState from "@/components/common/EmptyState";

/*
 * Task management hub backed by GET/POST/PATCH/DELETE /api/tasks.
 *
 * Reused panel building blocks:
 *  - useConfirmDialog() → styled delete-confirmation popup
 *  - showToast()        → success notifications
 *  - SkeletonBlock      → table loading state
 *  - EmptyState         → empty / no-search-match states
 *  - Native <dialog>    → create/edit popup with blurred backdrop
 *
 * Backend rules mirrored in the UI:
 *  - Editors only see their own/assigned tasks, can self-assign only,
 *    (Completed is available to everyone.)
 */

const PAGE_SIZE = 50;

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Completed" },
];

const STATUS_OPTIONS = STATUS_TABS.filter((item) => item.value);

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const TYPE_OPTIONS = [
  { value: "content", label: "Content" },
  { value: "website", label: "Website" },
  { value: "policy", label: "Policy" },
  { value: "review", label: "Review" },
  { value: "other", label: "Other" },
];

const EMPTY_FORM = {
  title: "",
  description: "",
  status: "open",
  priority: "medium",
  type: "other",
  assigneeId: "",
  dueDate: "",
  relatedContent: "",
  statusNote: "",
};

function toDateInput(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function isUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function isInternalPath(value) {
  const text = String(value || "").trim();
  return text.startsWith("/") && !text.startsWith("//");
}

function resolveLink(value) {
  const text = String(value || "").trim();
  if (!isInternalPath(text)) return text;
  try {
    return `${publicSiteUrl()}${text}`;
  } catch {
    return text;
  }
}

/*
 * Dropdown of website pages (news posts, categories, policies, careers,
 * services, states, parties, leaders...) - the same source the rich text
 * editor uses for hyperlinks. The selected value is the page's path
 * (e.g. /news/some-article).
 */
const RELATED_TABS = [
  { key: "content", label: "Assignee's content" },
  { key: "CATEGORY", label: "Categories" },
  { key: "TOPIC", label: "Keywords" },
  { key: "PARTY", label: "Parties" },
  { key: "POLITICIAN", label: "Leaders" },
];

const CONTENT_TYPE_LABEL = {
  ARTICLE: "Article",
  BLOG: "Blog",
  VIDEO: "Video",
};

function RelatedContentPicker({ value, onChange, disabled, assigneeId }) {
  const [tab, setTab] = useState("content");
  const [query, setQuery] = useState("");

  const [content, setContent] = useState([]);
  const [contentFor, setContentFor] = useState(null);

  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(false);

  const [selectedLabel, setSelectedLabel] = useState("");

  const hasAssignee = Boolean(assigneeId);
  const contentLoading = hasAssignee && contentFor !== assigneeId;
  const previousAssignee = useRef(assigneeId);

  /*
   * Content tab: published articles / blogs / videos written by the
   * assignee only - never anyone else's.
   */
  useEffect(() => {
    let cancelled = false;

    if (!hasAssignee) return undefined;

    taskApi
      .relatedContent(assigneeId)
      .then((response) => {
        if (!cancelled) setContent(response?.posts || []);
      })
      .catch(() => {
        if (!cancelled) setContent([]);
      })
      .finally(() => {
        if (!cancelled) setContentFor(assigneeId);
      });

    return () => {
      cancelled = true;
    };
  }, [assigneeId, hasAssignee]);

  /*
   * A different assignee means the previously picked article/blog/video
   * belongs to someone else - clear it.
   */
  useEffect(() => {
    if (previousAssignee.current === assigneeId) return;
    previousAssignee.current = assigneeId;

    if (String(value || "").startsWith("/news/")) onChange("");
  }, [assigneeId, value, onChange]);

  /*
   * Categories / keywords / parties / leaders: same site link source the
   * rich text editor uses, narrowed to the selected group.
   */
  useEffect(() => {
    if (tab === "content") return undefined;

    let cancelled = false;

    const timer = setTimeout(async () => {
      try {
        setPagesLoading(true);
        const result = await internalLinksApi.search(query.trim());
        if (!cancelled) {
          setPages(
            (result?.items || [])
              .filter((item) => item.type === tab)
              .slice(0, 80)
          );
        }
      } catch {
        if (!cancelled) setPages([]);
      } finally {
        if (!cancelled) setPagesLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tab, query]);

  const visibleContent = useMemo(() => {
    const source = hasAssignee ? content : [];
    const text = query.trim().toLowerCase();
    if (!text) return source;

    return source.filter((post) =>
      `${post.title} ${CONTENT_TYPE_LABEL[post.type] || ""}`
        .toLowerCase()
        .includes(text)
    );
  }, [content, query, hasAssignee]);

  const rows =
    tab === "content"
      ? visibleContent.map((post) => ({
          href: post.href,
          title: post.title,
          badge: CONTENT_TYPE_LABEL[post.type] || post.type,
        }))
      : pages.map((item) => ({
          href: item.href,
          title: item.title,
          badge: item.category || "",
        }));

  const loading = tab === "content" ? contentLoading : pagesLoading;

  const choose = (row) => {
    onChange(row.href);
    setSelectedLabel(row.title);
  };

  const clear = () => {
    onChange("");
    setSelectedLabel("");
  };

  return (
    <div>
      <p className="mb-1.5 font-label-md text-xs text-on-surface-variant">
        Related To <span className="opacity-60">(optional)</span>
      </p>

      {/* Selected value */}

      {value && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-label-md text-sm font-semibold text-on-surface">
              {selectedLabel || value}
            </p>
            <p className="truncate font-body-md text-xs text-on-surface-variant">
              {value}
            </p>
          </div>

          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            aria-label="Remove related link"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Group tabs */}

      <div className="mb-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Related link type">
        {RELATED_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => {
              setTab(item.key);
              setQuery("");
            }}
            disabled={disabled}
            className={`rounded-full px-3 py-1.5 font-label-md text-xs font-semibold transition-colors disabled:opacity-60 ${
              tab === item.key
                ? "bg-primary text-on-primary"
                : "border border-outline-variant/40 bg-surface text-on-surface hover:bg-surface-container"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Search */}

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        disabled={disabled || (tab === "content" && !hasAssignee)}
        placeholder={
          tab === "content"
            ? "Search the assignee's articles, blogs, videos..."
            : "Search..."
        }
        aria-label="Search related links"
        className="mb-2 w-full rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />

      {/* Options */}

      <div
        role="listbox"
        aria-label="Related link options"
        className="table-scroll max-h-52 overflow-y-auto rounded-lg border border-outline-variant/30 bg-surface-container-low"
      >
        {tab === "content" && !hasAssignee ? (
          <p className="px-3 py-4 text-center font-body-md text-xs text-on-surface-variant">
            Choose an assignee first to see their articles, blogs and videos.
          </p>
        ) : loading ? (
          <p className="px-3 py-4 text-center font-body-md text-xs text-on-surface-variant">
            Loading...
          </p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-4 text-center font-body-md text-xs text-on-surface-variant">
            {tab === "content"
              ? "No published content found for this assignee."
              : "No matches found."}
          </p>
        ) : (
          rows.map((row) => {
            const selected = row.href === value;

            return (
              <button
                key={row.href}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => choose(row)}
                disabled={disabled}
                className={`flex w-full items-start justify-between gap-3 border-b border-outline-variant/15 px-3 py-2.5 text-left transition-colors last:border-b-0 disabled:opacity-60 ${
                  selected
                    ? "bg-primary/10"
                    : "hover:bg-surface-container"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-label-md text-sm font-semibold text-on-surface">
                    {row.title}
                  </span>
                  <span className="block truncate font-body-md text-xs text-on-surface-variant">
                    {row.href}
                  </span>
                </span>

                {row.badge && (
                  <span className="flex-shrink-0 rounded-md border border-outline-variant/30 bg-surface px-2 py-0.5 font-label-md text-[10px] font-medium uppercase text-on-surface-variant">
                    {row.badge}
                  </span>
                )}

                {selected && (
                  <i
                    className="fa-solid fa-check mt-1 flex-shrink-0 text-xs text-primary"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })
        )}
      </div>

      <p className="mt-1 font-body-md text-xs text-on-surface-variant">
        Pick the assignee&apos;s own content, or a category, keyword, party or leader page.
      </p>
    </div>
  );
}

function RelatedContent({ value, className = "" }) {
  if (!value) return <span className={className}>-</span>;
  if (isUrl(value) || isInternalPath(value)) {
    return (
      <a
        href={resolveLink(value)}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 text-primary hover:underline ${className}`}
      >
        <i className="fa-solid fa-arrow-up-right-from-square text-xs" aria-hidden="true" />
        Open link
      </a>
    );
  }
  return <span className={`break-words ${className}`}>{value}</span>;
}

const STATUS_STYLES = {
  open: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200",
  done: "bg-green-50 text-green-700 border-green-200",
};

const PRIORITY_STYLES = {
  low: {
    pill: "bg-green-50 text-green-700 border-green-200",
    dot: "bg-green-500",
  },
  medium: {
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  high: {
    pill: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
};

function formatStatus(status) {
  return (
    STATUS_OPTIONS.find((item) => item.value === status)?.label ||
    status ||
    "-"
  );
}

function formatPriority(priority) {
  return (
    PRIORITY_OPTIONS.find((item) => item.value === priority)?.label ||
    priority ||
    "-"
  );
}

function formatType(type) {
  return (
    TYPE_OPTIONS.find((item) => item.value === type)?.label ||
    type ||
    "-"
  );
}

function formatDate(iso) {
  if (!iso) return "—";

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function statusPillClass(status) {
  return (
    STATUS_STYLES[status] ||
    "bg-gray-50 text-gray-700 border-gray-200"
  );
}

function priorityPillClass(priority) {
  return (
    PRIORITY_STYLES[priority]?.pill ||
    "bg-gray-50 text-gray-700 border-gray-200"
  );
}

function priorityDotClass(priority) {
  return PRIORITY_STYLES[priority]?.dot || "bg-gray-400";
}

function assigneeLabel(task, userId) {
  if (!task.assignee_id) return "Unassigned";

  if (
    userId &&
    Number(task.assignee_id) === Number(userId)
  ) {
    return "You";
  }

  return (
    task.assignee_name ||
    task.assigneeName ||
    `User #${task.assignee_id}`
  );
}

function initials(name) {
  const parts = String(name || "?")
    .trim()
    .split(/\s+/);

  return (
    (parts[0]?.[0] || "?") +
    (parts[1]?.[0] || "")
  );
}

export default function TaskManagementClient() {
  const { user } = useAuth();
  const confirm = useConfirmDialog();

  const isEditor = user?.role === "EDITOR";

  /*
   * Task privileges. Authors/Editors get "view tasks" + "change status
   * only"; creating, full editing and deleting need the matching privilege.
   */
  const canCreate = hasAnyPermission(user, [
    PERMISSIONS.MANAGE_TASK_MANAGEMENT,
    PERMISSIONS.CREATE_TASKS,
  ]);
  const canEditAll = hasAnyPermission(user, [
    PERMISSIONS.MANAGE_TASK_MANAGEMENT,
    PERMISSIONS.EDIT_TASKS,
  ]);
  const canDelete = hasAnyPermission(user, [
    PERMISSIONS.MANAGE_TASK_MANAGEMENT,
    PERMISSIONS.DELETE_TASKS,
  ]);
  const canChangeStatus =
    canEditAll ||
    ["AUTHOR", "EDITOR"].includes(user?.role);

  /*
   * Native dialog ref.
   * This is the same pattern used by the Withdrawal Requests popup.
   */
  const formDialogRef = useRef(null);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [viewTask, setViewTask] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  /*
   * null = users have not been loaded yet
   * array = users have been loaded
   */
  const [assignableUsers, setAssignableUsers] = useState(null);

  /*
   * ---------------------------------------------------------
   * Native dialog open / close
   * ---------------------------------------------------------
   *
   * showModal() automatically creates the dialog backdrop.
   * The backdrop is styled in the JSX using:
   *
   * backdrop:bg-black/40
   * backdrop:backdrop-blur-md
   */
  useEffect(() => {
    const dialog = formDialogRef.current;

    if (!dialog) return;

    if (formOpen && !dialog.open) {
      dialog.showModal();
    }

    if (!formOpen && dialog.open) {
      dialog.close();
    }
  }, [formOpen]);

  /*
   * ---------------------------------------------------------
   * Load tasks
   * ---------------------------------------------------------
   */

  const loadSeqRef = useRef(0);

  const loadTasks = useCallback(async () => {
    /*
     * Only the most recent request may update the list, so a slow response
     * for a previous tab/page cannot overwrite the current filter's results.
     */
    const seq = ++loadSeqRef.current;

    try {
      setLoading(true);

      const response = await taskApi.list({
        status: statusFilter || undefined,
        page,
        limit: PAGE_SIZE,
      });

      if (seq !== loadSeqRef.current) return;

      if (!response?.success) {
        throw new Error(
          response?.message || "Tasks could not be loaded"
        );
      }

      const rows = response.tasks || [];

      setTasks(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      if (seq !== loadSeqRef.current) return;

      /*
       * request() already surfaces API failures.
       */
      setTasks([]);
      setHasMore(false);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    // Loading is an external-data sync that sets state when the request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTasks();
  }, [loadTasks]);

  /*
   * ---------------------------------------------------------
   * Load assignable users
   * ---------------------------------------------------------
   */

  const loadAssignableUsers = useCallback(async () => {
    if (assignableUsers !== null) return;

    try {
      const data = await authApi.listUsers();

      setAssignableUsers(data?.users?.filter((user) => (user.role?.includes("AUTHOR") || user.role?.includes("EDITOR") || user.role?.includes("SUBADMIN")) && user.status === "ACTIVE" && user.panel_status !== "INACTIVE") || []);
    } catch {
      /*
       * Empty array causes fallback to manual ID entry.
       */
      setAssignableUsers([]);
    }
  }, [assignableUsers]);

  /*
   * ---------------------------------------------------------
   * Search
   * ---------------------------------------------------------
   */

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return tasks;
    }

    return tasks.filter((task) =>
      [
        task.title,
        task.description,
        `task-${task.id}`,
        formatType(task.type),
        formatPriority(task.priority),
        task.assignee_name,
        task.related_content,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query)
      )
    );
  }, [tasks, search]);

  /*
   * ---------------------------------------------------------
   * Status filter
   * ---------------------------------------------------------
   */

  const handleStatusTab = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  /*
   * ---------------------------------------------------------
   * Create modal
   * ---------------------------------------------------------
   */

  const openCreateModal = () => {
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);

    if (!isEditor && canEditAll) {
      loadAssignableUsers();
    }
  };

  /*
   * ---------------------------------------------------------
   * Edit modal
   * ---------------------------------------------------------
   */

  const openEditModal = (task) => {
    setEditingTask(task);

    setForm({
      title: task.title || "",
      description: task.description || "",
      status: task.status || "open",
      priority: task.priority || "medium",
      type: task.type || "other",
      assigneeId:
        task.assignee_id !== null &&
        task.assignee_id !== undefined
          ? String(task.assignee_id)
          : "",
      dueDate: toDateInput(task.due_date),
      relatedContent: task.related_content || "",
      statusNote: "",
    });

    setFormError("");
    setFormOpen(true);

    if (!isEditor && canEditAll) {
      loadAssignableUsers();
    }
  };

  /*
   * ---------------------------------------------------------
   * Close create/edit dialog
   * ---------------------------------------------------------
   */

  const closeFormModal = () => {
    if (saving) return;

    setFormOpen(false);
    setEditingTask(null);
    setForm(EMPTY_FORM);
    setFormError("");
  };

  /*
   * ---------------------------------------------------------
   * Form change
   * ---------------------------------------------------------
   */

  /*
   * Whose content the "Related To" picker may offer: the selected assignee,
   * or the current user when creating with the assignee left empty
   * (the backend then assigns the task to the creator).
   */
  const relatedAssigneeId =
    form.assigneeId !== ""
      ? Number(form.assigneeId)
      : !editingTask || isEditor
        ? Number(user?.id) || ""
        : "";

  const handleRelatedChange = useCallback((href) => {
    setForm((previous) => ({
      ...previous,
      relatedContent: href,
    }));
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  /*
   * ---------------------------------------------------------
   * Submit create/edit
   * ---------------------------------------------------------
   */

  const handleSubmit = async (event) => {
    event.preventDefault();

    /*
     * Status-only users (Author/Editor): only the status is sent.
     */
    if (editingTask && !canEditAll) {
      if (
        form.status === (editingTask.status || "open") &&
        !form.statusNote.trim()
      ) {
        closeFormModal();
        return;
      }

      try {
        setSaving(true);
        setFormError("");

        await taskApi.updateStatus(
          editingTask.id,
          form.status,
          form.statusNote.trim()
        );

        showToast("Task status updated.");
        setSaving(false);
        closeFormModal();
        await loadTasks();
      } catch (err) {
        setFormError(err?.message || "Status could not be updated.");
      } finally {
        setSaving(false);
      }

      return;
    }

    if (!form.title.trim()) {
      setFormError("Task title is required.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority: form.priority,
        type: form.type,
        dueDate: form.dueDate || null,
        relatedContent: form.relatedContent.trim() || null,
      };

      /*
       * Only send status when:
       * - creating a task
       * - or status actually changed
       *
       * This prevents an Editor from re-saving an existing
       * "done" task and accidentally triggering the backend
       * Editor restriction.
       */
      if (
        !editingTask ||
        form.status !== (editingTask.status || "open")
      ) {
        payload.status = form.status;
      }

      /*
       * Assignee
       */
      if (!isEditor) {
        if (form.assigneeId !== "") {
          payload.assigneeId = Number(form.assigneeId);
        } else if (editingTask) {
          /*
           * Explicitly unassign during edit.
           */
          payload.assigneeId = null;
        }

        /*
         * During create, empty assignee is omitted.
         * Backend will assign the task to creator.
         */
      }

      /*
       * Update existing task
       */
      if (editingTask) {
        await taskApi.update(
          editingTask.id,
          payload
        );

        showToast("Task updated successfully.");
      } else {
        /*
         * Create new task
         */
        await taskApi.create(payload);

        showToast("Task created successfully.");
      }

      closeFormModal();

      await loadTasks();
    } catch (err) {
      /*
       * request() already handles API error toast.
       * Keep modal open so user can fix the form.
       */
      setFormError(
        err?.message || "Task could not be saved."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * ---------------------------------------------------------
   * Delete task
   * ---------------------------------------------------------
   */

  const handleDelete = async (task) => {
    const confirmed = await confirm({
      title: "Delete this task?",
      description:
        `“${task.title}” will be removed from the list. ` +
        "This action cannot be undone.",
      icon: "fa-trash-can",
      confirmLabel: "Delete",
    });

    if (!confirmed) return;

    try {
      setDeletingId(task.id);

      await taskApi.delete(task.id);

      if (
        viewTask &&
        viewTask.id === task.id
      ) {
        setViewTask(null);
      }

      await loadTasks();
    } catch {
      /*
       * request() already handles error toast.
       */
    } finally {
      setDeletingId(null);
    }
  };

  /*
   * ---------------------------------------------------------
   * Editor status options
   * ---------------------------------------------------------
   */

  // Every role can pick every status, including Completed.
  const statusOptionsForEditor = STATUS_OPTIONS;

  return (
    <div className="space-y-6">

      {/* =====================================================
          TOOLBAR
          ===================================================== */}

      <div className="rounded-xl border border-primary/25 bg-surface p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          {/* Status tabs */}

          <div
            className="flex flex-wrap gap-2"
            aria-label="Filter tasks by status"
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value || "all"}
                type="button"
                onClick={() =>
                  handleStatusTab(tab.value)
                }
                aria-pressed={
                  statusFilter === tab.value
                }
                className={`min-h-10 rounded-lg px-4 font-label-md text-xs font-bold transition-colors ${
                  statusFilter === tab.value
                    ? "bg-primary text-on-primary"
                    : "border border-outline-variant/40 bg-surface text-on-surface hover:bg-surface-container"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search + New Task */}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

            <div className="relative">
              <i
                className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant"
                aria-hidden="true"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search title, type, assignee..."
                aria-label="Search in loaded tasks"
                className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-low py-2.5 pl-9 pr-3 font-body-md text-sm text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none sm:w-56"
              />
            </div>

            {canCreate && (
              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-label-md text-xs uppercase tracking-widest text-on-primary transition-colors hover:bg-primary-container"
              >
                <i
                  className="fa-solid fa-plus text-xs"
                  aria-hidden="true"
                />
                New Task
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================
          TASK TABLE
          ===================================================== */}

      <div className="overflow-hidden rounded-xl border border-primary/25 bg-surface">

        <div className="table-scroll overflow-x-auto">

          <table className="w-full min-w-[1000px]">

            <thead>
              <tr className="border-b border-primary/15 bg-surface-container-low">

                <th className="px-5 py-4 text-left font-label-md text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Task
                </th>

                <th className="px-4 py-4 text-left font-label-md text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Type
                </th>

                <th className="px-4 py-4 text-left font-label-md text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Priority
                </th>

                <th className="px-4 py-4 text-left font-label-md text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Related To
                </th>

                <th className="px-4 py-4 text-left font-label-md text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Status
                </th>

                <th className="px-4 py-4 text-left font-label-md text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Assignee
                </th>

                <th className="px-4 py-4 text-left font-label-md text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Created
                </th>
                
                <th className="px-4 py-4 text-left font-label-md text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Due
                </th>


                <th className="px-5 py-4 text-right font-label-md text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Actions
                </th>

              </tr>
            </thead>

            <tbody className="divide-y divide-outline-variant/15">

              {/* Loading */}

              {loading ? (
                Array.from({ length: 5 }).map(
                  (_, index) => (
                    <tr key={index}>
                      <td
                        colSpan={8}
                        className="px-5 py-4"
                      >
                        <div className="flex items-center gap-4">
                          <SkeletonBlock className="h-4 w-20" />

                          <SkeletonBlock className="h-4 flex-grow" />

                          <SkeletonBlock className="h-6 w-24 rounded-full" />

                          <SkeletonBlock className="h-6 w-20 rounded-full" />
                        </div>
                      </td>
                    </tr>
                  )
                )
              ) : visibleTasks.length === 0 ? (

                /* Empty */

                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-10"
                  >
                    {tasks.length === 0 ? (
                      <div className="mx-auto max-w-md">

                        <EmptyState
                          icon="fa-list-check"
                          title="No tasks yet"
                          description={
                            canCreate
                              ? "Create your first task to start tracking work for your team."
                              : "No tasks have been assigned to you yet."
                          }
                        />

                        {canCreate && (
                          <div className="mt-4 text-center">
                            <button
                              type="button"
                              onClick={openCreateModal}
                              className="rounded-lg bg-primary px-4 py-2.5 font-label-md text-xs uppercase tracking-widest text-on-primary transition-colors hover:bg-primary-container"
                            >
                              Create Task
                            </button>
                          </div>
                        )}

                      </div>
                    ) : (
                      <div className="mx-auto max-w-md">

                        <EmptyState
                          icon="fa-magnifying-glass"
                          title="No matching tasks"
                          description="No loaded tasks match your search. Try different keywords or clear the search."
                        />

                      </div>
                    )}
                  </td>
                </tr>

              ) : (

                /* Tasks */

                visibleTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="transition-colors hover:bg-surface-container-low/60"
                  >

                    {/* Task */}

                    <td className="max-w-[380px] px-5 py-4 align-top">

                      <span className="font-mono text-xs font-semibold text-primary">
                        TASK-{task.id}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setViewTask(task)
                        }
                        className="mt-0.5 block w-full text-left font-label-md text-sm font-semibold text-on-surface transition-colors hover:text-primary"
                      >
                        {task.title}
                      </button>

                      {task.description && (
                        <p className="mt-1 line-clamp-2 font-body-md text-xs text-on-surface-variant">
                          {task.description}
                        </p>
                      )}

                    </td>

                    {/* Type */}

                    <td className="px-4 py-4 align-top">

                      <span className="inline-flex rounded-md border border-outline-variant/30 bg-surface-container-low px-2.5 py-1 font-label-md text-xs font-medium text-on-surface-variant">
                        {formatType(task.type)}
                      </span>

                    </td>

                    {/* Priority */}

                    <td className="px-4 py-4 align-top">

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-label-md text-xs font-medium ${priorityPillClass(
                          task.priority
                        )}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${priorityDotClass(
                            task.priority
                          )}`}
                          aria-hidden="true"
                        />

                        {formatPriority(
                          task.priority
                        )}
                      </span>

                    </td>
                    {/* Related To */}

                    <td className="max-w-[180px] px-4 py-4 align-top font-body-md text-xs text-on-surface-variant">
                      <RelatedContent value={task.related_content} />
                    </td>

                    {/* Status */}

                    <td className="px-4 py-4 align-top">

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 font-label-md text-xs font-medium ${statusPillClass(
                          task.status
                        )}`}
                      >
                        {formatStatus(
                          task.status
                        )}
                      </span>

                    </td>

                    {/* Assignee */}

                    <td className="px-4 py-4 align-top">

                      <div className="flex items-center gap-2">

                        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-label-md text-[10px] font-bold uppercase text-primary">
                          {initials(
                            assigneeLabel(
                              task,
                              user?.id
                            )
                          )}
                        </span>

                        <span className="font-body-md text-sm text-on-surface">
                          {assigneeLabel(
                            task,
                            user?.id
                          )}
                        </span>

                      </div>

                    </td>

                    {/* Updated */}

                    <td className="px-4 py-4 align-top font-body-md text-xs text-on-surface-variant">
                      {formatDate(
                          task.created_at
                      )}
                    </td>
                       <td className="px-4 py-4 align-top font-body-md text-xs text-on-surface-variant">
                      {formatDate(
                          task.due_date
                      )}
                    </td>



                    {/* Actions */}

                    <td className="px-5 py-4 align-top">

                      <div className="flex items-center justify-end gap-1">

                        {/* View */}

                        <button
                          type="button"
                          onClick={() =>
                            setViewTask(task)
                          }
                          aria-label={`View task ${task.id}`}
                          title="View"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                        >
                          <i className="fa-regular fa-eye text-sm" />
                        </button>

                        {/* Edit */}

                        {canChangeStatus && (
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(task)
                            }
                            aria-label={`${canEditAll ? "Edit" : "Update status of"} task ${task.id}`}
                            title={canEditAll ? "Edit" : "Update status"}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                          >
                            <i className={`fa-solid ${canEditAll ? "fa-pen" : "fa-arrows-rotate"} text-sm`} />
                          </button>
                        )}

                        {/* Delete */}

                        {canDelete && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(task)
                            }
                            disabled={
                              deletingId === task.id
                            }
                            aria-label={`Delete task ${task.id}`}
                            title="Delete"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error-container hover:text-error disabled:opacity-50"
                          >
                            <i
                              className={`fa-solid ${
                                deletingId === task.id
                                  ? "fa-spinner fa-spin"
                                  : "fa-trash-can"
                              } text-sm`}
                            />
                          </button>
                        )}

                      </div>

                    </td>

                  </tr>
                ))
              )}

            </tbody>

          </table>

        </div>

        {/* ===================================================
            PAGINATION
            =================================================== */}

        <div className="flex items-center justify-between gap-3 border-t border-outline-variant/20 px-5 py-3">

          <span className="font-body-md text-xs text-on-surface-variant">
            Page {page}

            {!loading &&
              ` · ${visibleTasks.length} task${
                visibleTasks.length === 1
                  ? ""
                  : "s"
              }`}
          </span>

          <div className="flex gap-2">

            <button
              type="button"
              onClick={() =>
                setPage((value) =>
                  Math.max(1, value - 1)
                )
              }
              disabled={page <= 1 || loading}
              className="rounded-lg border border-outline-variant/40 px-4 py-2 font-label-md text-xs font-bold text-on-surface transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={() =>
                setPage((value) => value + 1)
              }
              disabled={!hasMore || loading}
              className="rounded-lg border border-outline-variant/40 px-4 py-2 font-label-md text-xs font-bold text-on-surface transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>

          </div>

        </div>

      </div>

      {/* =====================================================
          CREATE / EDIT NATIVE DIALOG
          ===================================================== */}

      <dialog
        ref={formDialogRef}
        onCancel={(event) => {
          /*
           * Prevent browser from closing the dialog directly.
           * This keeps React's formOpen state synchronized.
           */
          event.preventDefault();

          if (!saving) {
            closeFormModal();
          }
        }}
        aria-labelledby="task-form-dialog-title"
        className="m-auto w-[calc(100%-2rem)] max-w-1/2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-0 text-on-surface shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-md"
      >

        <div className="max-h-[90vh] overflow-y-auto p-6 sm:p-8">

          {/* Header */}

          <div className="mb-2 flex items-center justify-between">

            <h2
              id="task-form-dialog-title"
              className="font-display-lg text-xl tracking-tight text-primary"
            >
              {editingTask
                ? canEditAll
                  ? "Edit Task"
                  : "Update Status"
                : "New Task"}
            </h2>

            <button
              type="button"
              onClick={closeFormModal}
              disabled={saving}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
            >
              <i className="fa-solid fa-xmark" />
            </button>

          </div>

          <p className="mb-5 font-body-md text-sm text-on-surface-variant">
            {editingTask
              ? `Update TASK-${editingTask.id} — changes are saved instantly.`
              : "Describe the work, set priority and assign it to a team member."}
          </p>

          {/* Status-only form (Author / Editor) */}

          {editingTask && !canEditAll && (
            <form
              onSubmit={handleSubmit}
              aria-busy={saving}
              className="space-y-5"
            >
              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">
                <span className="font-mono text-xs font-semibold text-primary">
                  TASK-{editingTask.id}
                </span>
                <p className="mt-1 font-label-md text-sm font-semibold text-on-surface">
                  {editingTask.title}
                </p>
                {editingTask.description && (
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap font-body-md text-xs text-on-surface-variant">
                    {editingTask.description}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="task-status-only"
                  className="mb-1.5 block font-label-md text-xs text-on-surface-variant"
                >
                  Status
                </label>

                <select
                  id="task-status-only"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  disabled={saving}
                  className="w-full rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {statusOptionsForEditor.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="task-status-note"
                  className="mb-1.5 block font-label-md text-xs text-on-surface-variant"
                >
                  Description{" "}
                  <span className="opacity-60">(optional)</span>
                </label>

                <textarea
                  id="task-status-note"
                  name="statusNote"
                  value={form.statusNote}
                  onChange={handleChange}
                  rows={4}
                  maxLength={2000}
                  disabled={saving}
                  placeholder="Add a note about this status change, e.g. what was done or what is blocking it..."
                  className="w-full resize-none rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface placeholder-on-surface-variant/50 transition-colors focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              {formError && (
                <div
                  className="rounded-lg border border-error/20 bg-error-container px-3 py-2.5 text-sm text-error"
                  role="alert"
                >
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeFormModal}
                  disabled={saving}
                  className="flex-1 border border-outline-variant/40 py-2.5 font-label-md text-xs uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary py-2.5 font-label-md text-xs uppercase tracking-widest text-on-primary transition-colors hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Update Status"}
                </button>
              </div>
            </form>
          )}

          {/* Form */}

          <form
            onSubmit={handleSubmit}
            aria-busy={saving}
            className={`space-y-5 ${editingTask && !canEditAll ? "hidden" : ""}`}
          >

            {/* Title */}

            <div>

              <label
                htmlFor="task-title"
                className="mb-1.5 block font-label-md text-xs text-on-surface-variant"
              >
                Task Title{" "}
                <span className="text-error">
                  *
                </span>
              </label>

              <input
                id="task-title"
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Draft election budget article"
                autoFocus
                maxLength={500}
                required
                disabled={saving}
                className="w-full rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface placeholder-on-surface-variant/50 transition-colors focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />

            </div>

            {/* Description */}

            <div>

              <label
                htmlFor="task-description"
                className="mb-1.5 block font-label-md text-xs text-on-surface-variant"
              >
                Description{" "}
                <span className="opacity-60">
                  (optional)
                </span>
              </label>

              <textarea
                id="task-description"
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                disabled={saving}
                placeholder="Add context, links or acceptance criteria..."
                className="w-full resize-none rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface placeholder-on-surface-variant/50 transition-colors focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />

            </div>

            {/* Type / Priority */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Type */}

              <div>

                <label
                  htmlFor="task-type"
                  className="mb-1.5 block font-label-md text-xs text-on-surface-variant"
                >
                  Type
                </label>

                <select
                  id="task-type"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  disabled={saving}
                  className="w-full rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {TYPE_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>

              </div>

              {/* Priority */}

              <div>

                <label
                  htmlFor="task-priority"
                  className="mb-1.5 block font-label-md text-xs text-on-surface-variant"
                >
                  Priority
                </label>

                <select
                  id="task-priority"
                  name="priority"
                  value={form.priority}
                  onChange={handleChange}
                  disabled={saving}
                  className="w-full rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {PRIORITY_OPTIONS.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>

              </div>

            </div>

            {/* Status / Assignee */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Status */}

              <div>

                <label
                  htmlFor="task-status"
                  className="mb-1.5 block font-label-md text-xs text-on-surface-variant"
                >
                  Status
                </label>

                <select
                  id="task-status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  disabled={saving}
                  className="w-full rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {statusOptionsForEditor.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    )
                  )}
                </select>

              </div>

              {/* Assignee */}

              <div>

                <label
                  htmlFor="task-assignee"
                  className="mb-1.5 block font-label-md text-xs text-on-surface-variant"
                >
                  Assignee
                </label>

                {Array.isArray(
                  assignableUsers
                ) ? (

                  <select
                    id="task-assignee"
                    name="assigneeId"
                    value={form.assigneeId}
                    onChange={handleChange}
                    disabled={saving}
                    className="w-full rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    <option value="">
                      {editingTask
                        ? "Unassigned"
                        : "Assign to me"}
                    </option>

                    {assignableUsers.map(
                      (account) => (
                        <option
                          key={account.id}
                          value={String(
                            account.id
                          )}
                        >
                          {account.name ||
                            account.email}{" "}
                          ({account.role})
                        </option>
                      )
                    )}

                  </select>

                ) : (

                  <input
                    id="task-assignee"
                    type="number"
                    name="assigneeId"
                    value={form.assigneeId}
                    onChange={handleChange}
                    placeholder={isEditor ? "You" : "Enter user ID"}
                    min="1"
                    disabled={saving || isEditor}
                    className="w-full rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  />

                )}

                <p className="mt-1 font-body-md text-xs text-on-surface-variant">
                  {isEditor
                    ? "Tasks are assigned to you."
                    : editingTask
                      ? "Leave empty to unassign."
                      : "Leave empty to assign to yourself."}
                </p>

              </div>

            </div>

            {/* Due date */}

            <div>
              <label
                htmlFor="task-due-date"
                className="mb-1.5 block font-label-md text-xs text-on-surface-variant"
              >
                Due Date{" "}
                <span className="opacity-60">(optional)</span>
              </label>

              <input
                id="task-due-date"
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={handleChange}
                disabled={saving}
                className="w-full rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2.5 font-body-md text-sm text-on-surface focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {/* Related content (website link dropdown) */}

            <RelatedContentPicker
              key={`${formOpen}-${editingTask?.id ?? "new"}`}
              value={form.relatedContent}
              disabled={saving}
              assigneeId={relatedAssigneeId}
              onChange={handleRelatedChange}
            />

            {/* Error */}

            {formError && (
              <div
                className="rounded-lg border border-error/20 bg-error-container px-3 py-2.5 text-sm text-error"
                role="alert"
              >
                {formError}
              </div>
            )}

            {/* Buttons */}

            <div className="flex gap-3 pt-1">

              <button
                type="button"
                onClick={closeFormModal}
                disabled={saving}
                className="flex-1 border border-outline-variant/40 py-2.5 font-label-md text-xs uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className={`flex-1 py-2.5 font-label-md text-xs uppercase tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  saving
                    ? "bg-primary/50 text-on-primary"
                    : "bg-primary text-on-primary hover:bg-primary-container"
                }`}
              >
                {saving
                  ? "Saving..."
                  : editingTask
                    ? "Save Changes"
                    : "Create Task"}
              </button>

            </div>

          </form>

        </div>

      </dialog>

      {/* =====================================================
          TASK DETAIL POPUP
          ===================================================== */}

      {viewTask && (
        <dialog
          ref={(element) => {
            if (element && !element.open) element.showModal();
          }}
          onCancel={(event) => {
            event.preventDefault();
            setViewTask(null);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setViewTask(null);
            }
          }}
          aria-labelledby="task-detail-dialog-title"
          className="fixed inset-0 z-[200] m-0 flex h-full w-full items-center justify-center bg-transparent p-4 backdrop:bg-black/40 backdrop:backdrop-blur-md"
        >

          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 text-on-surface shadow-2xl sm:p-8">

            {/* Header */}

            <div className="mb-6 flex items-start justify-between gap-4">

              <div>

                <span className="font-mono text-xs font-semibold text-primary">
                  TASK-{viewTask.id}
                </span>

                <h2
                  id="task-detail-dialog-title"
                  className="mt-1 font-display-lg text-xl tracking-tight text-primary"
                >
                  {viewTask.title}
                </h2>

              </div>

              <button
                type="button"
                onClick={() =>
                  setViewTask(null)
                }
                aria-label="Close"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                <i className="fa-solid fa-xmark" />
              </button>

            </div>

            {/* Description */}

            <div className="mb-6">

              <p className="mb-2 font-label-md text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                Description
              </p>

              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">

                {viewTask.description ? (
                  <p className="whitespace-pre-wrap font-body-md text-sm leading-6 text-on-surface">
                    {viewTask.description}
                  </p>
                ) : (
                  <p className="font-body-md text-sm italic text-on-surface-variant">
                    No description provided.
                  </p>
                )}

              </div>

            </div>

            {/* Status note (written by Author / Editor on status change) */}

            {viewTask.status_note && (
              <div className="mb-6">

                <p className="mb-2 font-label-md text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
                  Status Note
                </p>

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">

                  <p className="whitespace-pre-wrap font-body-md text-sm leading-6 text-on-surface">
                    {viewTask.status_note}
                  </p>

                  <p className="mt-2 font-body-md text-xs text-on-surface-variant">
                    {viewTask.status_note_by_name
                      ? `— ${viewTask.status_note_by_name}`
                      : ""}
                    {viewTask.status_note_at
                      ? ` · ${formatDate(viewTask.status_note_at)}`
                      : ""}
                  </p>

                </div>

              </div>
            )}

            {/* Task information */}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Type */}

              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">

                <p className="mb-1 font-label-md text-xs uppercase tracking-widest text-on-surface-variant">
                  Type
                </p>

                <p className="font-label-md text-sm font-semibold text-on-surface">
                  {formatType(viewTask.type)}
                </p>

              </div>

              {/* Priority */}

              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">

                <p className="mb-1 font-label-md text-xs uppercase tracking-widest text-on-surface-variant">
                  Priority
                </p>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-label-md text-xs font-medium ${priorityPillClass(
                    viewTask.priority
                  )}`}
                >

                  <span
                    className={`h-1.5 w-1.5 rounded-full ${priorityDotClass(
                      viewTask.priority
                    )}`}
                  />

                  {formatPriority(
                    viewTask.priority
                  )}

                </span>

              </div>

              {/* Status */}

              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">

                <p className="mb-1 font-label-md text-xs uppercase tracking-widest text-on-surface-variant">
                  Status
                </p>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 font-label-md text-xs font-medium ${statusPillClass(
                    viewTask.status
                  )}`}
                >
                  {formatStatus(
                    viewTask.status
                  )}
                </span>

              </div>

              {/* Assignee */}

              <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-4">

                <p className="mb-1 font-label-md text-xs uppercase tracking-widest text-on-surface-variant">
                  Assignee
                </p>

                <div className="flex items-center gap-2">

                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 font-label-md text-[10px] font-bold uppercase text-primary">
                    {initials(
                      assigneeLabel(
                        viewTask,
                        user?.id
                      )
                    )}
                  </span>

                  <span className="font-label-md text-sm font-semibold text-on-surface">
                    {assigneeLabel(
                      viewTask,
                      user?.id
                    )}
                  </span>

                </div>

              </div>

            </div>

            {/* Dates */}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">

              <div>

                <p className="font-label-md text-xs uppercase tracking-widest text-on-surface-variant">
                  Created
                </p>

                <p className="mt-1 font-body-md text-sm text-on-surface">
                  {formatDate(
                    viewTask.created_at
                  )}
                </p>

              </div>

              <div>

                <p className="font-label-md text-xs uppercase tracking-widest text-on-surface-variant">
                  Last Updated
                </p>

                <p className="mt-1 font-body-md text-sm text-on-surface">
                  {formatDate(
                    viewTask.updated_at ||
                      viewTask.created_at
                  )}
                </p>

              </div>

              <div>

                <p className="font-label-md text-xs uppercase tracking-widest text-on-surface-variant">
                  Due Date
                </p>

                <p className="mt-1 font-body-md text-sm text-on-surface">
                  {formatDate(viewTask.due_date)}
                </p>

              </div>

              <div>

                <p className="font-label-md text-xs uppercase tracking-widest text-on-surface-variant">
                  Related Content
                </p>

                <p className="mt-1 font-body-md text-sm text-on-surface">
                  <RelatedContent value={viewTask.related_content} />
                </p>

              </div>

            </div>

            {/* Footer */}

            <div className="mt-6 flex gap-3 border-t border-outline-variant/20 pt-5">

              {canChangeStatus && (
                <button
                  type="button"
                  onClick={() => {
                    setViewTask(null);
                    openEditModal(viewTask);
                  }}
                  className="flex-1 bg-primary py-2.5 font-label-md text-xs uppercase tracking-widest text-on-primary transition-colors hover:bg-primary-container"
                >
                  {canEditAll ? "Edit Task" : "Update Status"}
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  setViewTask(null)
                }
                className="flex-1 border border-outline-variant/40 py-2.5 font-label-md text-xs uppercase tracking-widest text-on-surface transition-colors hover:bg-surface-container-low"
              >
                Close
              </button>

            </div>

          </div>

        </dialog>
      )}

    </div>
  );
}