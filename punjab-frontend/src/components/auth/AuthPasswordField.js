"use client";

import { useState } from "react";

function strengthOf(value) {
  if (!value) return { width: "0%", color: "bg-error" };
  if (value.length < 6) return { width: "33%", color: "bg-error" };
  if (value.length < 10) return { width: "66%", color: "bg-secondary-container" };
  return { width: "100%", color: "bg-primary" };
}

export default function AuthPasswordField({
  id,
  name,
  label,
  autoComplete,
  required,
  value,
  onChange,
  showStrength,
}) {
  const [visible, setVisible] = useState(false);
  const strength = strengthOf(value);

  return (
    <div className="relative group">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={onChange}
        placeholder=" "
        className="block w-full appearance-none border-b border-outline-variant/50 bg-transparent px-3 py-3 text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-0 sm:text-sm font-body-md transition-colors peer pr-10"
      />
      <label
        htmlFor={id}
        className="absolute left-3 top-3 text-sm font-label-md text-on-surface-variant/70 transition-all duration-200 peer-focus:-top-3 peer-focus:text-xs peer-focus:text-primary peer-[:not(:placeholder-shown)]:-top-3 peer-[:not(:placeholder-shown)]:text-xs"
      >
        {label}
      </label>
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-3 text-on-surface-variant/40 hover:text-on-surface focus:outline-none"
      >
        <i className={`fa-solid ${visible ? "fa-eye" : "fa-eye-slash"} text-base`} />
      </button>

      {showStrength && (
        <div className=" w-full bg-surface-container-highest mt-1 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${strength.color}`}
            style={{ width: strength.width }}
          />
        </div>
      )}
    </div>
  );
}
