"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { careersApi, mediaUrl } from "@/lib/api";

const fieldClass =
  "w-full border border-outline-variant/30 bg-surface-container-low rounded px-3 py-2.5 text-on-surface focus:border-primary focus:outline-none font-body-md transition-colors";

const APPLICATION_STATUS_BADGE = {
  PENDING: "bg-secondary/10 text-secondary",
  REVIEWED: "bg-surface-tint/10 text-surface-tint",
  ACCEPTED: "bg-green-600/10 text-green-700",
  REJECTED: "bg-error/10 text-error",
};

export default function ApplyToJobClient({ job }) {
  const { user, loading } = useAuth();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    pan: "",
    aadhaar: "",
    coverLetter: "",
  });

  const [resume, setResume] = useState(null);
  const [graduationCertificate, setGraduationCertificate] = useState(null);

  const [error, setError] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // undefined = still checking, null = never applied, object = already applied
  const [myApplication, setMyApplication] = useState(undefined);

  useEffect(() => {
    if (user) {
      // Seed the application fields once the asynchronous user session resolves.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((prev) => ({
        ...prev,
        name: prev.name || user.name || "",
        email: prev.email || user.email || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    careersApi
      .getMyApplication(job.id)
      .then((data) => {
        if (!cancelled) setMyApplication(data.application || null);
      })
      .catch(() => {
        if (!cancelled) setMyApplication(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, job.id]);

  if (loading) return null;

  if (job.status !== "OPEN") {
    return (
      <p className="font-body-md text-sm text-on-surface-variant bg-surface-container-low rounded-lg p-4">
        This position is no longer accepting applications.
      </p>
    );
  }

  if (!user) {
    return (
      <div className="bg-surface-container-low rounded-lg p-6 text-center">
        <i className="fa-solid fa-lock text-2xl text-outline-variant mb-3" />

        <p className="font-body-md text-sm text-on-surface-variant mb-4">
          Sign in to apply for this position.
        </p>

        <Link
          href="/login"
          className="inline-block bg-primary text-on-primary px-6 py-2 font-label-md text-sm uppercase tracking-widest rounded hover:bg-primary-container transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (myApplication === undefined) return null;

  if (myApplication) {
    return (
      <div className="bg-surface-container-low rounded-lg p-6 space-y-4">
        {justSubmitted && (
          <p
            className="flex items-start gap-2 text-sm text-primary font-body-md bg-primary/5 rounded-lg p-3"
            role="status"
          >
            <i className="fa-solid fa-circle-check mt-0.5" />
            Your application has been submitted. We&apos;ll be in touch.
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <h2 className="font-headline-lg text-primary text-lg">Your Application</h2>
          <span
            className={`text-[10px] font-label-md uppercase px-2 py-0.5 rounded-sm ${APPLICATION_STATUS_BADGE[myApplication.status]}`}
          >
            {myApplication.status}
          </span>
        </div>

        {!justSubmitted && (
          <p className="font-body-md text-sm text-on-surface-variant">
            You&apos;ve already applied for this position
            {myApplication.created_at
              ? ` on ${new Date(myApplication.created_at).toLocaleDateString()}`
              : ""}
            .
          </p>
        )}

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <dt className="font-label-md text-xs text-on-surface-variant mb-0.5">Full Name</dt>
            <dd className="font-body-md text-sm text-on-surface">{myApplication.name}</dd>
          </div>
          <div>
            <dt className="font-label-md text-xs text-on-surface-variant mb-0.5">Email</dt>
            <dd className="font-body-md text-sm text-on-surface">{myApplication.email}</dd>
          </div>
          {myApplication.phone && (
            <div>
              <dt className="font-label-md text-xs text-on-surface-variant mb-0.5">Phone</dt>
              <dd className="font-body-md text-sm text-on-surface">{myApplication.phone}</dd>
            </div>
          )}
          {myApplication.pan && (
            <div>
              <dt className="font-label-md text-xs text-on-surface-variant mb-0.5">PAN Number</dt>
              <dd className="font-body-md text-sm text-on-surface">{myApplication.pan}</dd>
            </div>
          )}
          {myApplication.aadhaar && (
            <div>
              <dt className="font-label-md text-xs text-on-surface-variant mb-0.5">Aadhaar Number</dt>
              <dd className="font-body-md text-sm text-on-surface">{myApplication.aadhaar}</dd>
            </div>
          )}
        </dl>

        {myApplication.cover_letter && (
          <div>
            <p className="font-label-md text-xs text-on-surface-variant mb-0.5">Cover Letter</p>
            <p className="font-body-md text-sm text-on-surface whitespace-pre-wrap">{myApplication.cover_letter}</p>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <a
            href={mediaUrl(myApplication.resume)}
            target="_blank"
            rel="noreferrer"
            className="font-label-sm text-xs uppercase inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary hover:text-white transition-colors"
          >
            <i className="fa-solid fa-file-arrow-down" /> Resume
          </a>
          {myApplication.graduation_certificate && (
            <a
              href={mediaUrl(myApplication.graduation_certificate)}
              target="_blank"
              rel="noreferrer"
              className="font-label-sm text-xs uppercase inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/40 text-primary hover:bg-primary hover:text-white transition-colors"
            >
              <i className="fa-solid fa-file-arrow-down" /> Graduation Certificate
            </a>
          )}
        </div>
      </div>
    );
  }

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (!resume) {
      setError("Please attach your resume.");
      return;
    }

    if (!graduationCertificate) {
      setError("Please attach your graduation certificate.");
      return;
    }

    if (!form.pan.trim()) {
      setError("Please enter your PAN number.");
      return;
    }

    if (!form.aadhaar.trim()) {
      setError("Please enter your Aadhaar number.");
      return;
    }

    setSubmitting(true);

    try {
      const fd = new FormData();

      fd.append("name", form.name.trim());
      fd.append("email", form.email.trim());

      if (form.phone) {
        fd.append("phone", form.phone.trim());
      }

      fd.append("pan", form.pan.trim().toUpperCase());

      fd.append("aadhaar", form.aadhaar.trim());

      if (form.coverLetter) {
        fd.append("coverLetter", form.coverLetter.trim());
      }

      fd.append("resume", resume);

      fd.append("graduationCertificate", graduationCertificate);

      const data = await careersApi.apply(job.id, fd);

      setJustSubmitted(true);
      setMyApplication(data.application);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      inert={submitting}
      aria-busy={submitting}
      className="bg-surface-container-low rounded-lg p-6 space-y-4"
    >
      <h2 className="font-headline-lg text-primary text-lg mb-2">
        Apply for this Position
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Full Name */}
        <div>
          <label className="block font-label-md text-xs text-on-surface-variant mb-1.5">
            Full Name <span className="text-error">*</span>
          </label>

          <input
            type="text"
            name="name"
            required
            placeholder="Enter your name"
            value={form.name}
            onChange={handleChange}
            className={fieldClass}
          />
        </div>


        {/* Email */}
        <div>
          <label className="block font-label-md text-xs text-on-surface-variant mb-1.5">
            Email <span className="text-error">*</span>
          </label>

          <input
            type="email"
            name="email"
            required
            placeholder="Enter your emaile"
            value={form.email}
            onChange={handleChange}
            className={fieldClass}
          />
        </div>


        {/* Phone */}
        <div>
          <label className="block font-label-md text-xs text-on-surface-variant mb-1.5">
            Phone
          </label>

          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            className={fieldClass}
            placeholder="Enter your mobile number"
          />
        </div>


        {/* PAN */}
        <div>
          <label className="block font-label-md text-xs text-on-surface-variant mb-1.5">
            PAN Number <span className="text-error">*</span>
          </label>

          <input
            type="text"
            name="pan"
            required
            value={form.pan}
            onChange={handleChange}
            maxLength={10}
            placeholder="ABCDE1234F"
            className={fieldClass}
          />
        </div>


        {/* Aadhaar */}
        <div>
          <label className="block font-label-md text-xs text-on-surface-variant mb-1.5">
            Aadhaar Number <span className="text-error">*</span>
          </label>

          <input
            type="text"
            name="aadhaar"
            required
            value={form.aadhaar}
            onChange={handleChange}
            maxLength={12}
            inputMode="numeric"
            placeholder="12-digit Aadhaar number"
            className={fieldClass}
          />
        </div>


        {/* Resume */}
        <div>
          <label className="block font-label-md text-xs text-on-surface-variant mb-1.5">
            Resume <span className="text-error">*</span>
          </label>

          <input
            type="file"
            required
            accept="application/pdf,.doc,.docx,image/jpeg,image/png"
            onChange={(e) =>
              setResume(e.target.files?.[0] || null)
            }
            className="w-full text-sm font-body-md text-on-surface-variant"
          />
        </div>


        {/* Graduation Certificate */}
        <div>
          <label className="block font-label-md text-xs text-on-surface-variant mb-1.5">
            Graduation Certificate <span className="text-error">*</span>
          </label>

          <input
            type="file"
            required
            accept="application/pdf,.doc,.docx,image/jpeg,image/png"
            onChange={(e) =>
              setGraduationCertificate(e.target.files?.[0] || null)
            }
            className="w-full text-sm font-body-md text-on-surface-variant"
          />
        </div>

      </div>


      {/* Cover Letter */}
      <div>
        <label className="block font-label-md text-xs text-on-surface-variant mb-1.5">
          Cover Letter
        </label>

        <textarea
          name="coverLetter"
          rows={4}
          value={form.coverLetter}
          onChange={handleChange}
          className={fieldClass}
        />
      </div>


      {/* Error */}
      {error && (
        <p
          className="flex items-start gap-1.5 text-sm text-error font-body-md"
          role="alert"
        >
          <i className="fa-solid fa-triangle-exclamation mt-0.5" />

          {error}
        </p>
      )}


      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary text-on-primary px-8 py-3 rounded font-label-md uppercase tracking-widest hover:bg-primary-container transition-colors disabled:opacity-60"
      >
        <i
          className={`fa-solid ${
            submitting
              ? "fa-spinner fa-spin"
              : "fa-paper-plane"
          }`}
        />

        {submitting
          ? "Submitting..."
          : "Submit Application"}
      </button>

    </form>
  );
}
