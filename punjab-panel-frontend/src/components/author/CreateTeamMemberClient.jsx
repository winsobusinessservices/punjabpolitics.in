"use client";

import { useEffect, useState } from "react";
import AuthTextField from "@/components/auth/AuthTextField";
import { authApi, sitesApi } from "@/lib/api";
import { PERMISSIONS, PERMISSION_GROUPS, ROLE_DEFAULT_PERMISSIONS } from "@/lib/permissions";
import PermissionGroupPicker from "@/components/author/PermissionGroupPicker";
import { useAuth } from "@/context/AuthContext";

const ROLES = [
  { value: "AUTHOR", label: "Author" },
  { value: "EDITOR", label: "Editor" },
  { value: "INVESTOR", label: "Investor" },
];
const SUBADMIN_ROLE = { value: "SUBADMIN", label: "Subadmin" };

// Mirrors REQUIRED_DOCS_BY_ROLE in the backend's auth.controller.js — kept
// in sync manually since it's a small, stable list; this only drives which
// upload fields render and are marked required, the backend enforces the
// real rule regardless of what the client sends.
const REQUIRED_DOCS_BY_ROLE = {
  AUTHOR: ["panDocument", "aadharDocument"],
  EDITOR: ["panDocument", "aadharDocument", "graduationCertificate"],
  INVESTOR: [],
  SUBADMIN: [],
};

const DOCUMENT_FIELDS = [
  { name: "panDocument", icon: "fa-id-card", label: "PAN Document" },
  { name: "aadharDocument", icon: "fa-address-card", label: "Aadhar Document" },
  { name: "graduationCertificate", icon: "fa-graduation-cap", label: "Graduation Certificate" },
];

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

// A styled dropzone-style file picker, same pattern PostForm.jsx uses for
// content media — duplicated locally rather than shared, since this one
// accepts PDFs (KYC/qualification documents) where that one accepts
// images/video only, and the two aren't likely to need to change together.
function DocumentUploadField({ name, icon, label, required, selectedFile, onChange }) {
  const inputId = `field-${name}`;
  return (
    <div>
      <FieldLabel icon={icon} required={required}>
        {label}
      </FieldLabel>
      <label
        htmlFor={inputId}
        className="flex items-center gap-3 px-3 py-2.5 border-2 border-dashed border-outline-variant/40 rounded-lg bg-surface-container-low hover:border-primary/60 hover:bg-surface-container transition-colors cursor-pointer"
      >
        <span className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <i className="fa-solid fa-cloud-arrow-up text-primary" />
        </span>
        <span className="flex-grow min-w-0">
          <span className="block font-label-md text-sm text-on-surface truncate">
            {selectedFile ? selectedFile.name : "Click to upload"}
          </span>
          <span className="block font-body-md text-[11px] text-on-surface-variant truncate">
            {selectedFile ? `${(selectedFile.size / 1024).toFixed(0)} KB selected` : "Image or PDF"}
          </span>
        </span>
      </label>
      <input
        id={inputId}
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        required={required}
        onChange={onChange}
        className="hidden"
      />
    </div>
  );
}

const initialForm = { email: "", role: "AUTHOR", siteId: "", permissions: ROLE_DEFAULT_PERMISSIONS.AUTHOR };

export default function CreateTeamMemberClient({ onCreated }) {
  const { user } = useAuth();
  const assignableRoles = user?.role === "ADMIN" ? [...ROLES, SUBADMIN_ROLE] : ROLES;
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState([]);

  useEffect(() => {
    sitesApi.list().then((data) => {
      const available = data.sites || [];
      setSites(available);
      setForm((current) => ({ ...current, siteId: current.siteId || String(available[0]?.id || "") }));
    }).catch((err) => setError(err.message));
  }, []);

  const requiredDocs = REQUIRED_DOCS_BY_ROLE[form.role];

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFileChange = (e) => {
    const { name, files: fileList } = e.target;
    setFiles((prev) => ({ ...prev, [name]: fileList?.[0] || null }));
  };

  const handleRoleChange = (e) => {
    const role = e.target.value;
    setForm((prev) => ({ ...prev, role, permissions: ROLE_DEFAULT_PERMISSIONS[role] || [] }));
    // Switching roles changes which documents are required/relevant — drop
    // any already-picked files that no longer apply rather than silently
    // submitting them.
    setFiles({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("email", form.email.trim());
      fd.append("role", form.role);
      fd.append("siteId", form.siteId);
      fd.append("permissions", JSON.stringify(form.permissions));
      requiredDocs.forEach((field) => fd.append(field, files[field]));
      const data = await authApi.assignRole(fd);
      setSuccess(`${data.message}. They've been emailed about the change.`);
      setForm({ ...initialForm, siteId: String(sites[0]?.id || "") });
      setFiles({});
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (permission) => {
    setForm((prev) => {
      const selected = prev.permissions.includes(permission);
      let permissions = selected
        ? prev.permissions.filter((item) => item !== permission)
        : [...prev.permissions, permission];
      const siteDataChildren = PERMISSION_GROUPS.find((group) => group.label === "Site Data").permissions.map(([value]) => value);
      if (!selected && siteDataChildren.includes(permission) && !permissions.includes(PERMISSIONS.MANAGE_SITE_DATA)) {
        permissions.push(PERMISSIONS.MANAGE_SITE_DATA);
      }
      if (permission === PERMISSIONS.MANAGE_SITE_DATA && selected) {
        permissions = permissions.filter((item) => !siteDataChildren.includes(item));
      }
      return { ...prev, permissions };
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      inert={loading}
      aria-busy={loading}
      className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12"
    >
      <div className="space-y-6 lg:col-span-5">
        <div className={sectionClass}>
          <SectionTitle icon="fa-user-check">Account Email</SectionTitle>
          <div className="space-y-5">
            <AuthTextField
              id="team-email"
              name="email"
              label="Email Address"
              type="email"
              icon="fa-solid fa-envelope"
              autoComplete="email"
              required
              value={form.email}
              onChange={handleChange}
            />
            <p className="text-xs font-body-md text-on-surface-variant">
              The person must already have an account (via the sign-up page) — this only assigns their role.
              They&apos;ll be emailed that their role has changed.
            </p>
          </div>
        </div>

        <div className={sectionClass}>
          <SectionTitle icon="fa-user-tag">Role &amp; Website</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
          <select
            name="role"
            value={form.role}
            onChange={handleRoleChange}
            className="w-full rounded-lg border border-outline-variant/30 bg-surface px-3 py-2.5 text-on-surface transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 font-body-md"
          >
            {assignableRoles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <select name="siteId" value={form.siteId} onChange={handleChange} required className="w-full rounded-lg border border-outline-variant/30 bg-surface px-3 py-2.5 text-on-surface transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 font-body-md">
            <option value="" disabled>Select website</option>
            {sites.filter((site) => site.status === "ACTIVE").map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select>
          </div>
          <p className="mt-3 text-xs font-body-md text-on-surface-variant">
            {form.role === "AUTHOR" && "Authors need a PAN and Aadhar document on file."}
            {form.role === "EDITOR" && "Editors need PAN, Aadhar, and a graduation certificate on file."}
            {form.role === "INVESTOR" && "Investors don't require any documents."}
            {form.role === "SUBADMIN" && "Choose exactly which administration, wallet, points, and Site Data tools this subadmin can use."}
          </p>
        </div>

        {requiredDocs.length > 0 && (
          <div className={sectionClass}>
            <SectionTitle icon="fa-file-shield">Required Documents</SectionTitle>
            <div className="space-y-4">
              {DOCUMENT_FIELDS.filter((field) => requiredDocs.includes(field.name)).map((field) => (
                <DocumentUploadField
                  key={field.name}
                  name={field.name}
                  icon={field.icon}
                  label={field.label}
                  selectedFile={files[field.name]}
                  onChange={handleFileChange}
                />
              ))}
            </div>
            <p className="text-xs font-body-md text-on-surface-variant mt-3">
              Only needed if not already on file for this account.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-6 lg:col-span-7">
        <div className={sectionClass}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 [&_h2]:mb-0">
            <SectionTitle icon="fa-key">Privileges</SectionTitle>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 font-label-md text-[11px] text-primary">
              {form.permissions.length} selected
            </span>
          </div>
          <p className="mb-4 text-xs font-body-md text-on-surface-variant">
            {user?.role !== "ADMIN"
              ? "Author, Editor, and Investor accounts receive their standard role privileges."
              : "Select only the tools this team member should be able to open and use."}
          </p>
          <PermissionGroupPicker selected={form.permissions} onToggle={togglePermission} disabled={user?.role !== "ADMIN"} />
        </div>

        <div className={sectionClass}>
          <SectionTitle icon="fa-cloud-arrow-up">Review and Assign</SectionTitle>

          {error && (
            <p className="flex items-start gap-1.5 text-sm text-error font-body-md mb-3" role="alert">
              <i className="fa-solid fa-triangle-exclamation mt-0.5" />
              {error}
            </p>
          )}
          {success && (
            <p className="flex items-start gap-1.5 text-sm text-primary font-body-md mb-3" role="status">
              <i className="fa-solid fa-circle-check mt-0.5" />
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary px-6 py-3 rounded font-label-md uppercase tracking-widest hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : "fa-user-tag"}`} />
            {loading ? "Assigning..." : "Assign Role"}
          </button>
        </div>
      </div>
    </form>
  );
}
