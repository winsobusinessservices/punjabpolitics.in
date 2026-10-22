"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useAdminSite } from "@/context/AdminSiteContext";
import { authorApi, contentLimitsApi, mediaUrl } from "@/lib/api";
import { splitContentMedia } from "@/lib/contentMedia";
import { hasRichText } from "@/lib/richText";
import RichTextEditor from "@/components/common/RichTextEditor";

const TYPE_LABEL = {
  ARTICLE: "Article",
  BLOG: "Blog",
  VIDEO: "Video",
};

const MODERATOR_ROLES = ["EDITOR", "ADMIN"];

const VIDEO_SOURCES = ["YOUTUBE", "VIMEO", "UPLOAD", "EXTERNAL"];
const LOCAL_DRAFT_VERSION = 1;

function localDraftKey(userId, siteId, type) {
  return userId && siteId ? `punjab-politics:content-draft:${userId}:${siteId}:${type}` : null;
}

function initialForm(post, initialCategory = "") {
  const contentMedia = splitContentMedia(post?.content);
  return {
    title: post?.title || "",
    excerpt: post?.excerpt || "",
    content: contentMedia.text,
    additionalImages: contentMedia.images,
    description: post?.description || "",
    featuredImage: post?.featured_image || "",
    thumbnail: post?.thumbnail || "",
    videoSource: post?.video_source || VIDEO_SOURCES[0],
    videoUrl: post?.video_url || "",
    category: post?.category || initialCategory,
    state: post?.state || "",
    tags: (post?.tags || []).join(", "),
    relatedArticleId: post?.related_article_id || "",
    relatedPolitician: post?.related_politician || "",
    relatedElection: post?.related_election || "",
  };
}

// Builds a multipart body: files ride as real File objects, everything else
// as plain fields. When editing and no new file was picked, the post's
// existing path (form.featuredImage etc.) is sent through so the backend
// keeps the current image/video instead of wiping it out.
function buildFormData(type, form, files) {
  const fd = new FormData();
  const tags = form.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  fd.append("title", form.title);
  fd.append("category", form.category);
  fd.append("tags", JSON.stringify(tags));

  if (type === "ARTICLE" || type === "BLOG") {
    if (form.excerpt) fd.append("excerpt", form.excerpt);
    fd.append("content", form.content);
    if (files.featuredImage) fd.append("featuredImage", files.featuredImage);
    else if (form.featuredImage) fd.append("featuredImage", form.featuredImage);
    fd.append("existingAdditionalImages", JSON.stringify(form.additionalImages));
    (files.additionalImages || []).forEach((file) => fd.append("additionalImages", file));
  }

  if (type === "ARTICLE") {
    if (form.state) fd.append("state", form.state);
    if (form.relatedPolitician) fd.append("relatedPolitician", form.relatedPolitician);
    if (form.relatedElection) fd.append("relatedElection", form.relatedElection);
  }

  if (type === "BLOG" && form.relatedArticleId) {
    fd.append("relatedArticleId", form.relatedArticleId);
  }

  if (type === "VIDEO") {
    fd.append("description", form.description);
    fd.append("videoSource", form.videoSource);
    if (form.state) fd.append("state", form.state);
    if (form.relatedArticleId) fd.append("relatedArticleId", form.relatedArticleId);
    if (form.relatedPolitician) fd.append("relatedPolitician", form.relatedPolitician);

    if (files.thumbnail) fd.append("thumbnail", files.thumbnail);
    else if (form.thumbnail) fd.append("thumbnail", form.thumbnail);

    if (form.videoSource === "UPLOAD") {
      if (files.videoFile) fd.append("videoFile", files.videoFile);
      else if (form.videoUrl) fd.append("videoUrl", form.videoUrl);
    } else {
      fd.append("videoUrl", form.videoUrl);
    }
  }

  return fd;
}

// Mirrors REQUIRED_FIELDS in the backend's content.controller.js, plus the
// file inputs' `required` conditions below — run explicitly (rather than
// relying only on the native `required` attributes) because those attributes
// sit on hidden file inputs, whose browser validation messages don't surface
// usefully to the user.
function validateForm(type, form, files, isEdit) {
  const missing = [];

  if (!form.title.trim()) missing.push("Title");
  if (!form.category.trim()) missing.push("Category");

  if (type === "ARTICLE" || type === "BLOG") {
    if (type === "ARTICLE" && !form.excerpt.trim()) missing.push("Excerpt");
    if (!hasRichText(form.content)) missing.push("Content");
    if (!isEdit && !files.featuredImage && !form.featuredImage) missing.push("Featured Image");
  }

  if (type === "VIDEO") {
    if (!hasRichText(form.description)) missing.push("Description");
    if (!form.videoSource) missing.push("Video Source");

    if (form.videoSource === "UPLOAD") {
      if (!isEdit && !files.thumbnail && !form.thumbnail) missing.push("Thumbnail");
      if (!isEdit && !files.videoFile && !form.videoUrl) missing.push("Video File");
    } else if (!form.videoUrl.trim()) {
      missing.push("Video URL");
    }
  }

  return missing;
}

const fieldClass =
  "w-full border border-outline-variant/30 bg-surface-container-low rounded px-3 py-2.5 text-on-surface focus:border-primary focus:outline-none font-body-md transition-colors";
const sectionClass = "bg-surface-container-low/60 rounded-lg border border-primary/30 p-5";

function SectionTitle({ icon, children }) {
  return (
    <h2 className="flex items-center gap-2 font-headline-md text-sm text-primary uppercase tracking-wide mb-4">
      <i className={`fa-solid ${icon}`} />
      {children}
    </h2>
  );
}

function FieldLabel({ icon, required, children }) {
  return (
    <label className="flex items-center gap-1.5 font-label-md text-xs text-on-surface-variant mb-1.5">
      <i className={`fa-solid ${icon} text-primary/60 text-[11px]`} />
      {children}
      {required && <span className="text-error">*</span>}
    </label>
  );
}

// A styled dropzone-style file picker (native input hidden underneath) so
// uploads don't fall back to the bare, unstyled browser "Choose File" button.
function FileUploadField({ name, icon, label, accept, required, currentUrl, onChange, selectedFile, error }) {
  const inputId = `field-${name}`;
  return (
    <div>
      <FieldLabel icon={icon} required={required}>
        {label}
      </FieldLabel>
      <label
        htmlFor={inputId}
        className={`flex items-center gap-3 px-3 py-2.5 border-2 border-dashed rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer ${error ? "border-error bg-error/5" : "border-outline-variant/40 hover:border-primary/60"}`}
      >
        <span className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <i className="fa-solid fa-cloud-arrow-up text-primary" />
        </span>
        <span className="flex-grow min-w-0">
          <span className="block font-label-md text-sm text-on-surface truncate">
            {selectedFile ? selectedFile.name : "Click to upload"}
          </span>
          <span className="block font-body-md text-[11px] text-on-surface-variant truncate">
            {selectedFile
              ? `${(selectedFile.size / 1024).toFixed(0)} KB selected`
              : currentUrl
                ? "Replace current file"
                : accept === "video/*"
                  ? "MP4 or WebM"
                  : "PNG or JPG"}
          </span>
        </span>
        {currentUrl && !selectedFile && (
          <a
            href={mediaUrl(currentUrl)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-label-md text-primary hover:underline flex-shrink-0"
          >
            View
          </a>
        )}
      </label>
      <input id={inputId} type="file" name={name} accept={accept} aria-required={required} onChange={onChange} className="hidden" />
      {error && <p className="mt-1.5 flex items-center gap-1.5 text-xs text-error" role="alert"><i className="fa-solid fa-circle-exclamation" />{error}</p>}
    </div>
  );
}

/**
 * `redirectTo`: where to go after a successful create/edit — defaults to the
 * content list, since creation now lives on its own page rather than inline
 * on the dashboard.
 */


export default function PostForm({ type, post, redirectTo = "/author/content", initialCategory = "" }) {
  const router = useRouter();
  const { user } = useAuth();
  const { activeSite, activeSiteId, features } = useAdminSite();
  const isEdit = Boolean(post);
  const [form, setForm] = useState(() => initialForm(post, initialCategory));
  const [files, setFiles] = useState({});
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  const [dailyLimit, setDailyLimit] = useState(null);
  const [dailyLimitLoading, setDailyLimitLoading] = useState(true);
  const [dailyLimitError, setDailyLimitError] = useState("");
  const [readyDraftKey, setReadyDraftKey] = useState(null);
  const restoredDraftKeyRef = useRef(null);
  const createSucceededRef = useRef(false);
  const errorSummaryRef = useRef(null);
  const draftKey = isEdit ? null : localDraftKey(user?.id || user?.userId, activeSiteId, type);
  const disabledFeature = type === "VIDEO" ? "feature_videos" : type === "BLOG" ? "feature_blogs" : null;
  const featureDisabled = Boolean(disabledFeature && features[disabledFeature] === false);
  const hasDailyLimit = ["AUTHOR", "EDITOR"].includes(user?.role);
  const limitRequestKey = `${user?.role || "unknown"}:${type}`;
  const currentDailyLimit = dailyLimit?._requestKey === limitRequestKey ? dailyLimit : null;
  const currentLimitError = dailyLimitError?._requestKey === limitRequestKey ? dailyLimitError.message : "";
  const limitReached = !isEdit && Boolean(currentDailyLimit?.reached);
  const checkingLimit = !isEdit && hasDailyLimit
    && !currentDailyLimit
    && !currentLimitError
    && (dailyLimitLoading || dailyLimit?._requestKey !== limitRequestKey);

  // Restore once per signed-in user/content type. File objects cannot be put
  // into localStorage, but every serializable field (including long-form
  // content and relationships) is preserved.
  useEffect(() => {
    if (!draftKey || restoredDraftKeyRef.current === draftKey) return;
    restoredDraftKeyRef.current = draftKey;
    createSucceededRef.current = false;

    try {
      const saved = JSON.parse(window.localStorage.getItem(draftKey) || "null");
      const savedForm = saved?.version === LOCAL_DRAFT_VERSION ? saved.form : null;

      // Restoring browser state after mount is intentional: localStorage is
      // unavailable during the server render of this Client Component.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        ...initialForm(null, initialCategory),
        ...(savedForm || {}),
        additionalImages: Array.isArray(savedForm?.additionalImages) ? savedForm.additionalImages : [],
      });
      setFiles({});
      setDraftNotice(savedForm
        ? saved.hadSelectedFiles
          ? "Local draft restored. Please select your image or video files again."
          : "Local draft restored."
        : ""
      );
      setReadyDraftKey(draftKey);
    } catch {
      window.localStorage.removeItem(draftKey);
      setForm(initialForm(null, initialCategory));
      setFiles({});
      setDraftNotice("");
      setReadyDraftKey(draftKey);
    }
  }, [draftKey, initialCategory]);

  // Save shortly after changes. Cleanup also writes the latest value, so an
  // immediate navigation cannot discard the final keystrokes.
  useEffect(() => {
    if (!draftKey || readyDraftKey !== draftKey) return undefined;

    const saveDraft = (showStatus = true) => {
      if (createSucceededRef.current) return;
      try {
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({
            version: LOCAL_DRAFT_VERSION,
            form,
            hadSelectedFiles: Object.values(files).some((value) =>
              Array.isArray(value) ? value.length > 0 : Boolean(value)
            ),
            savedAt: new Date().toISOString(),
          })
        );
        if (showStatus) {
          setDraftNotice((current) => current.startsWith("Local draft restored") ? current : "Draft saved on this device.");
        }
      } catch {
        if (showStatus) setDraftNotice("This draft is too large to save in the browser.");
      }
    };

    const timer = window.setTimeout(saveDraft, 350);
    return () => {
      window.clearTimeout(timer);
      saveDraft(false);
    };
  }, [draftKey, files, form, readyDraftKey]);

  // Blogs and videos can reference an article — pull the picker options from
  // whatever articles this user is permitted to see. GET /articles is always
  // self-scoped now (own content only, regardless of role), so editors/admins
  // — who could previously reference any author's article here — use the
  // moderator-only history endpoint instead to keep that same breadth.
  useEffect(() => {
    if (type !== "BLOG" && type !== "VIDEO") return;
    const isModerator = MODERATOR_ROLES.includes(user?.role);
    const request = isModerator ? authorApi.listHistoryByType("ARTICLE") : authorApi.listByType("ARTICLE");
    request.then((data) => setArticles(data.posts)).catch(() => setArticles([]));
  }, [type, user?.role]);

  useEffect(() => {
    let active = true;

    authorApi.listCategories(activeSiteId || user?.siteId)
      .then((data) => {
        if (!active) return;
        setCategories((data.categories || []).map((category) => category.name));
        setCategoriesError("");
      })
      .catch((err) => {
        if (!active) return;
        setCategoriesError(err.message);
      })
      .finally(() => {
        if (active) setCategoriesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeSiteId, user?.siteId]);

  useEffect(() => {
    if (isEdit || !user?.role) return undefined;
    if (!["AUTHOR", "EDITOR"].includes(user.role)) {
      return undefined;
    }

    let active = true;
    const limitRequest = typeof contentLimitsApi?.getMine === "function"
      ? contentLimitsApi.getMine()
      : Promise.reject(new Error("Posting limit API is unavailable in this browser session"));
    limitRequest
      .then((data) => {
        if (!active) return;
        const currentLimit = data.dailyLimits?.[type];
        if (!currentLimit) throw new Error("Posting limit details are unavailable");
        setDailyLimit({ ...currentLimit, _requestKey: limitRequestKey });
      })
      .catch((err) => {
        if (!active) return;
        setDailyLimitError({ message: err.message, _requestKey: limitRequestKey });
      })
      .finally(() => {
        if (active) setDailyLimitLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isEdit, limitRequestKey, type, user?.role]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldErrors((current) => ({ ...current, [e.target.name]: "" }));
  };

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target;
    setFiles((prev) => ({ ...prev, [name]: fileList?.[0] || null }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
  };

  useEffect(() => {
    if (!error) return;
    errorSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    errorSummaryRef.current?.focus({ preventScroll: true });
  }, [error]);

  const handleAdditionalImages = (e) => {
    const selected = Array.from(e.target.files || []);
    setFiles((prev) => ({
      ...prev,
      additionalImages: [...(prev.additionalImages || []), ...selected].slice(0, Math.max(0, 10 - form.additionalImages.length)),
    }));
    e.target.value = "";
  };

  const removeExistingImage = (index) => {
    setForm((prev) => ({ ...prev, additionalImages: prev.additionalImages.filter((_, itemIndex) => itemIndex !== index) }));
  };

  const removeNewImage = (index) => {
    setFiles((prev) => ({ ...prev, additionalImages: (prev.additionalImages || []).filter((_, itemIndex) => itemIndex !== index) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSuccess("");

    if (limitReached) {
      setError(`You have used today’s ${label.toLowerCase()} limit. You can create another draft after midnight.`);
      return;
    }

    const missing = validateForm(type, form, files, isEdit);
    if (missing.length) {
      const nextFieldErrors = {};
      const fieldNames = { Title: "title", Category: "category", Excerpt: "excerpt", Content: "content", Description: "description", "Featured Image": "featuredImage", Thumbnail: "thumbnail", "Video File": "videoFile", "Video URL": "videoUrl", "Video Source": "videoSource" };
      missing.forEach((label) => { nextFieldErrors[fieldNames[label] || label] = `${label} is required.`; });
      setFieldErrors(nextFieldErrors);
      setError(missing.length === 1 ? `${missing[0]} is required before this ${label.toLowerCase()} can be saved.` : `Please complete these required fields: ${missing.join(", ")}.`);
      return;
    }

    setLoading(true);
    try {
  
      const formData = buildFormData(type, form, files);
 
      let data;
      if (isEdit) {
        data = await authorApi.updatePost(type, post.id, formData);
      } else if (type === "ARTICLE") {
        data = await authorApi.createArticle(formData);
      } else if (type === "BLOG") {
        data = await authorApi.createBlog(formData);
      } else {
        data = await authorApi.createVideo(formData);
      }

      if (!isEdit && draftKey) {
        createSucceededRef.current = true;
        window.localStorage.removeItem(draftKey);
        setDraftNotice("");
      }
      setSuccess(data.message);
      setTimeout(() => router.push(redirectTo), 900);
    } catch (err) {
      setError(err.message);
      if (err.fieldErrors && typeof err.fieldErrors === "object") setFieldErrors(err.fieldErrors);
    } finally {
      setLoading(false);
    }
  };

  const label = TYPE_LABEL[type];

  if (featureDisabled) {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-950">
        <h2 className="font-headline-md text-xl">{TYPE_LABEL[type]} is disabled for {activeSite?.name || "this website"}</h2>
        <p className="mt-2 text-sm">Enable this website feature from Administrative Tools → Website Management before creating this content type.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      inert={loading || limitReached || checkingLimit}
      aria-busy={loading || checkingLimit}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start"
    >
      {error && (
        <div ref={errorSummaryRef} tabIndex={-1} className="lg:col-span-3 flex items-start gap-3 rounded-xl border border-error/40 bg-error/10 px-4 py-4 text-error outline-none" role="alert" aria-live="assertive">
          <i className="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden="true" />
          <div><p className="font-headline-md text-sm">Could not save {label.toLowerCase()}</p><p className="mt-1 text-sm">{error}</p></div>
        </div>
      )}
      {!isEdit && hasDailyLimit && (
        <div
          className={`lg:col-span-3 rounded-xl border px-4 py-4 ${
            limitReached
              ? "border-error/40 bg-error/10"
              : "border-primary/30 bg-primary/5"
          }`}
          role={limitReached ? "alert" : "status"}
        >
          {checkingLimit ? (
            <div className="flex items-center gap-2 text-sm font-body-md text-on-surface-variant">
              <i className="fa-solid fa-spinner fa-spin text-primary" aria-hidden="true" />
              Checking today&apos;s {label.toLowerCase()} limit…
            </div>
          ) : currentDailyLimit ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${limitReached ? "bg-error/15 text-error" : "bg-primary/10 text-primary"}`}>
                  <i className={`fa-solid ${limitReached ? "fa-ban" : "fa-gauge-high"}`} aria-hidden="true" />
                </span>
                <div>
                  <p className={`font-headline-md text-sm ${limitReached ? "text-error" : "text-primary"}`}>
                    {limitReached
                      ? `Daily ${label.toLowerCase()} limit reached`
                      : `${currentDailyLimit.remaining} of ${currentDailyLimit.limit} ${label.toLowerCase()} drafts remaining today`}
                  </p>
                  <p className="mt-1 font-body-md text-xs text-on-surface-variant">
                    You have created {currentDailyLimit.used} of {currentDailyLimit.limit} today. The limit resets at midnight.
                    {limitReached && " This form is locked so you do not spend time on a draft that cannot be saved."}
                  </p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-label-md ${limitReached ? "bg-error text-on-error" : "bg-primary text-on-primary"}`}>
                {currentDailyLimit.remaining} remaining
              </span>
            </div>
          ) : currentLimitError ? (
            <div className="flex items-start gap-2 text-sm font-body-md text-amber-700">
              <i className="fa-solid fa-triangle-exclamation mt-0.5" aria-hidden="true" />
              <span>Could not display today&apos;s limit. The server will still verify it when you save.</span>
            </div>
          ) : null}
        </div>
      )}
      {!isEdit && draftNotice && (
        <div className="lg:col-span-3 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 font-body-md text-xs text-on-surface-variant" role="status">
          <i className="fa-solid fa-cloud-arrow-up mt-0.5 text-primary" aria-hidden="true" />
          <span>{draftNotice}</span>
        </div>
      )}
      {/* Main column: the actual writing */}
      <div className="lg:col-span-2 space-y-5">
        <div className={sectionClass}>
          <SectionTitle icon="fa-pen-nib">Basic Info</SectionTitle>
          <div className="space-y-4">
            <div>
              <FieldLabel icon="fa-heading" required>
                Title
              </FieldLabel>
              <input type="text" name="title" required value={form.title} onChange={handleChange} className={fieldClass} />
            </div>

            {type === "ARTICLE" && (
              <div>
                <FieldLabel icon="fa-align-left" required>
                  Excerpt
                </FieldLabel>
                <input type="text" name="excerpt" required value={form.excerpt} onChange={handleChange} className={fieldClass} />
              </div>
            )}

            {type === "BLOG" && (
              <div>
                <FieldLabel icon="fa-align-left">Excerpt</FieldLabel>
                <input type="text" name="excerpt" value={form.excerpt} onChange={handleChange} className={fieldClass} />
              </div>
            )}

            {type === "VIDEO" ? (
              <div>
                <FieldLabel icon="fa-align-left" required>
                  Description
                </FieldLabel>
                <RichTextEditor
                  value={form.description}
                  onChange={(description) => setForm((prev) => ({ ...prev, description }))}
                  placeholder="Write the video description…"
                  minHeight="14rem"
                  disabled={loading || limitReached || checkingLimit}
                />
              </div>
            ) : (
              <div>
                <FieldLabel icon="fa-file-lines" required>
                  Content
                </FieldLabel>
                <RichTextEditor
                  value={form.content}
                  onChange={(content) => setForm((prev) => ({ ...prev, content }))}
                  placeholder={`Write your ${label.toLowerCase()}…`}
                  disabled={loading || limitReached || checkingLimit}
                  showInternalLinkSearch
                />
                <p className="mt-2 text-[11px] text-on-surface-variant">
                  Format headings, emphasis, lists, quotes, and links directly in the editor. Existing plain-text drafts are converted automatically.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar: publish action, media, categorization */}
      <div className="space-y-5">


        <div className={sectionClass}>
          <SectionTitle icon="fa-photo-film">Media</SectionTitle>
          <div className="space-y-4">
            {type === "VIDEO" ? (
              <>
                <div>
                  <FieldLabel icon="fa-clapperboard" required>
                    Video Source
                  </FieldLabel>
                  <select name="videoSource" required value={form.videoSource} onChange={handleChange} className={fieldClass}>
                    {VIDEO_SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </div>

                <FileUploadField
                  name="thumbnail"
                  icon="fa-image"
                  label="Thumbnail"
                  accept="image/*"
                  required={!isEdit && form.videoSource === "UPLOAD"}
                  currentUrl={form.thumbnail}
                  selectedFile={files.thumbnail}
                  error={fieldErrors.thumbnail}
                  onChange={handleFileChange}
                />
                {form.videoSource !== "UPLOAD" && (
                  <p className="text-xs font-body-md text-on-surface-variant -mt-2">
                    Optional — leave blank to use the video&apos;s own thumbnail (YouTube/Vimeo).
                  </p>
                )}

                {form.videoSource === "UPLOAD" ? (
                  <FileUploadField
                    name="videoFile"
                    icon="fa-file-video"
                    label="Video File"
                    accept="video/*"
                    required={!isEdit}
                    currentUrl={form.videoUrl}
                    selectedFile={files.videoFile}
                    error={fieldErrors.videoFile}
                    onChange={handleFileChange}
                  />
                ) : (
                  <div>
                    <FieldLabel icon="fa-link" required>
                      Video URL
                    </FieldLabel>
                    <input
                      type="url"
                      name="videoUrl"
                      required
                      placeholder="https://..."
                      value={form.videoUrl}
                      onChange={handleChange}
                      className={fieldClass}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                <FileUploadField
                  name="featuredImage"
                  icon="fa-image"
                  label="Featured Image"
                  accept="image/*"
                  required={!isEdit}
                  currentUrl={form.featuredImage}
                  selectedFile={files.featuredImage}
                  error={fieldErrors.featuredImage}
                  onChange={handleFileChange}
                />
                <div>
                  <FieldLabel icon="fa-images">Extra Images</FieldLabel>
                  <label
                    htmlFor="field-additionalImages"
                    className="flex items-center gap-3 px-3 py-2.5 border-2 border-dashed border-outline-variant/40 rounded-lg bg-surface-container-low hover:border-primary/60 cursor-pointer"
                  >
                    <span className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <i className="fa-solid fa-images text-primary" />
                    </span>
                    <span className="font-label-md text-sm">Choose multiple images</span>
                  </label>
                  <input id="field-additionalImages" type="file" accept="image/*" multiple onChange={handleAdditionalImages} className="hidden" />
                  <p className="mt-1.5 text-[11px] text-on-surface-variant">Optional — upload up to 10 images for the article or blog gallery.</p>

                  {(form.additionalImages.length > 0 || files.additionalImages?.length > 0) && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {form.additionalImages.map((url, index) => (
                        <div key={url} className="relative aspect-video rounded overflow-hidden bg-surface-container-high">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={mediaUrl(url)} alt={`Extra image ${index + 1}`} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removeExistingImage(index)} aria-label="Remove image" className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/70 text-white">
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </div>
                      ))}
                      {(files.additionalImages || []).map((file, index) => (
                        <div key={`${file.name}-${file.lastModified}`} className="relative p-2 rounded bg-primary/10 text-xs truncate pr-8">
                          {file.name}
                          <button type="button" onClick={() => removeNewImage(index)} aria-label="Remove selected image" className="absolute top-1 right-1 w-6 h-6 rounded-full bg-primary text-white">
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className={sectionClass}>
          <SectionTitle icon="fa-tags">Categorization</SectionTitle>
          <div className="space-y-5">
            <div>
              <FieldLabel icon="fa-folder-open" required>
                Category
              </FieldLabel>
              <select
                name="category"
                required
                value={form.category}
                onChange={handleChange}
                disabled={categoriesLoading}
                className={`${fieldClass} disabled:opacity-60`}
              >
                <option value="">{categoriesLoading ? "Loading categories..." : "Choose a category"}</option>
                {form.category && !categories.includes(form.category) && (
                  <option value={form.category}>{form.category}</option>
                )}
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {categoriesError && (
                <p className="mt-1.5 text-xs font-body-md text-error" role="alert">
                  Could not load categories: {categoriesError}
                </p>
              )}
            </div>

            {(type === "ARTICLE" || type === "VIDEO") && (
              <div>
                <FieldLabel icon="fa-location-dot">State</FieldLabel>
                <input type="text" name="state" value={form.state} onChange={handleChange} className={fieldClass} />
              </div>
            )}

            <div>
              <FieldLabel icon="fa-tag">Tags</FieldLabel>
              <input
                type="text"
                name="tags"
                placeholder="comma, separated, tags"
                value={form.tags}
                onChange={handleChange}
                className={fieldClass}
              />
            </div>

            {(type === "BLOG" || type === "VIDEO") && (
              <div>
                <FieldLabel icon="fa-link">Related Article</FieldLabel>
                <select name="relatedArticleId" value={form.relatedArticleId} onChange={handleChange} className={fieldClass}>
                  <option value="">None</option>
                  {articles.map((article) => (
                    <option key={article.id} value={article.id}>
                      {article.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(type === "ARTICLE" || type === "VIDEO") && (
              <div>
                <FieldLabel icon="fa-user-tie">Related Politician</FieldLabel>
                <input
                  type="text"
                  name="relatedPolitician"
                  value={form.relatedPolitician}
                  onChange={handleChange}
                  className={fieldClass}
                />
              </div>
            )}

            {type === "ARTICLE" && (
              <div>
                <FieldLabel icon="fa-vote-yea">Related Election</FieldLabel>
                <input
                  type="text"
                  name="relatedElection"
                  value={form.relatedElection}
                  onChange={handleChange}
                  className={fieldClass}
                />
              </div>
            )}
          </div>
        </div>
        <div className={sectionClass}>
          <SectionTitle icon="fa-cloud-arrow-up">Publish</SectionTitle>

          {success && (
            <p className="flex items-start gap-1.5 text-sm text-primary font-body-md mb-3" role="status">
              <i className="fa-solid fa-circle-check mt-0.5" />
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || limitReached || checkingLimit}
            className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary px-6 py-3 rounded font-label-md uppercase tracking-widest hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : "fa-paper-plane"}`} />
            {loading ? "Saving..." : checkingLimit ? "Checking Limit..." : limitReached ? "Daily Limit Reached" : isEdit ? "Save Changes" : "Save Draft"}
          </button>
          <p className="text-xs font-body-md text-on-surface-variant mt-3">
            {isEdit
              ? "Saving moves this back to Draft — you'll need to submit it for review again."
              : `Saves as a draft. Submit it for review from "${label} content" when you're ready.`}
          </p>
        </div>
      </div>

    </form>
  );
}
