"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { authApi, mediaUrl } from "@/lib/api";

export default function ProfileClient() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [profilePicture, setProfilePicture] = useState(null);
  const [picturePreview, setPicturePreview] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => () => {
    if (picturePreview) URL.revokeObjectURL(picturePreview);
  }, [picturePreview]);

  const updateProfile = async (event) => {
    event.preventDefault();
    setBusy("profile");
    setError("");
    setSuccess("");
    try {
      const data = await authApi.updateMyProfile({ name: name.trim(), phone: phone.trim() });
      setUser(data.user);
      setPhone(data.user?.phone || "");
      setSuccess("Profile details saved.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  };

  const selectPicture = (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    if (!/^image\/(jpeg|png|webp)$/.test(selectedFile.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }
    if (picturePreview) URL.revokeObjectURL(picturePreview);
    setProfilePicture(selectedFile);
    setPicturePreview(URL.createObjectURL(selectedFile));
    setError("");
  };

  const uploadPicture = async () => {
    if (!profilePicture) return;
    setBusy("picture");
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("profilePicture", profilePicture);
      const data = await authApi.updateProfilePicture(formData);
      setUser(data.user);
      setProfilePicture(null);
      setPicturePreview("");
      setSuccess("Profile picture updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy("");
    }
  };

  const inputClass = "mt-1.5 min-h-11 w-full rounded-md border border-outline-variant/40 bg-surface px-3 py-2 font-body-md text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";
  const avatarSrc = picturePreview || mediaUrl(user?.profilePicture);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-10">
      <div className="mb-8 border-b border-outline-variant/30 pb-6">
        <p className="mb-1 font-label-md text-xs uppercase tracking-[0.16em] text-on-surface-variant">Account</p>
        <h1 className="font-display-lg text-3xl text-primary">Your profile</h1>
        <p className="mt-2 font-body-md text-sm text-on-surface-variant">Update your name, profile picture and contact number.</p>
      </div>

      {error && <p className="mb-5 rounded-md border border-error/25 bg-error/5 px-4 py-3 font-body-md text-sm text-error" role="alert">{error}</p>}
      {success && <p className="mb-5 rounded-md border border-green-700/20 bg-green-50 px-4 py-3 font-body-md text-sm text-green-800" role="status">{success}</p>}

      <section className="grid gap-8 border-b border-outline-variant/30 pb-8 md:grid-cols-[minmax(13rem,0.8fr)_minmax(0,1.6fr)]">
        <div>
          <h2 className="font-label-md text-base font-semibold text-on-surface">Profile picture</h2>
          <p className="mt-1 font-body-md text-sm text-on-surface-variant">JPG, PNG, or WebP. Maximum 5 MB.</p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-outline-variant/40 bg-surface-container-low text-2xl font-semibold text-primary" aria-label="Profile picture preview">
            {avatarSrc ? <Image src={avatarSrc} alt="Profile" width={96} height={96} unoptimized className="h-full w-full object-cover" /> : (user?.name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-md border border-outline-variant/50 px-4 font-label-md text-sm font-semibold text-on-surface hover:bg-surface-container-low">
              Choose image
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPicture} className="sr-only" />
            </label>
            {profilePicture && <button type="button" onClick={uploadPicture} disabled={Boolean(busy)} className="min-h-10 rounded-md bg-primary px-4 font-label-md text-sm font-semibold text-on-primary disabled:opacity-60">{busy === "picture" ? "Uploading..." : "Upload picture"}</button>}
            {profilePicture && <span className="max-w-48 truncate text-xs text-on-surface-variant">{profilePicture.name}</span>}
          </div>
        </div>
      </section>

      <section className="grid gap-8 border-b border-outline-variant/30 py-8 md:grid-cols-[minmax(13rem,0.8fr)_minmax(0,1.6fr)]">
        <div>
          <h2 className="font-label-md text-base font-semibold text-on-surface">Personal details</h2>
          <p className="mt-1 font-body-md text-sm text-on-surface-variant">Your email address is used to sign in and cannot be changed here.</p>
        </div>
        <form onSubmit={updateProfile} className="space-y-5">
          <label className="block font-label-md text-sm text-on-surface">Full name
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required className={inputClass} autoComplete="name" />
          </label>
        
            <label className="relative block font-label-md text-sm text-on-surface">
            Email address

            <div className="relative">
                <input
                type="email"
                value={user?.email || ""}
                readOnly
                placeholder="Not added"
                className={`${inputClass} pr-28 cursor-not-allowed opacity-70`}
                />

                <span
                className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-semibold ${
                    user?.email
                    ? "text-success"
                    : "text-on-surface-variant"
                }`}
                >
                <i
                    className={`fa-solid ${
                    user?.email
                        ? "fa-circle-check"
                        : "fa-circle-xmark"
                    }`}
                ></i>

                {user?.email ? "Verified" : "Not Verified"}
                </span>
            </div>
            </label>

          <label className="block font-label-md text-sm text-on-surface">Mobile number
            <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="98765 43210" autoComplete="tel" maxLength={20} pattern="[+0-9() -]{10,20}" title="Enter a 10-digit mobile number, or a number with country code like +44 20 7946 0958" className={inputClass} />
            <span className="mt-1 block font-body-md text-xs text-on-surface-variant">Optional. Used only as your contact number.</span>
          </label>

          <button type="submit" disabled={Boolean(busy)} className="min-h-10 rounded-md bg-primary px-5 font-label-md text-sm font-semibold text-on-primary disabled:opacity-60 cursor-pointer">{busy === "profile" ? "Saving..." : "Save details"}</button>
        </form>
      </section>
    </div>
  );
}
