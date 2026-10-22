export default function AuthTextField({
  id,
  name,
  label,
  type = "text",
  icon,
  autoComplete,
  required,
  value,
  onChange,
}) {
  return (
    <div className="relative group">
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        value={value}
        onChange={onChange}
        placeholder=" "
        className="block w-full appearance-none border-b border-outline-variant/50 bg-transparent px-3 py-3 text-on-surface placeholder-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-0 sm:text-sm font-body-md transition-colors peer"
      />
      <label
        htmlFor={id}
        className="absolute left-3 top-3 text-sm font-label-md text-on-surface-variant/70 transition-all duration-200 peer-focus:-top-3 peer-focus:text-xs peer-focus:text-primary peer-[:not(:placeholder-shown)]:-top-3 peer-[:not(:placeholder-shown)]:text-xs"
      >
        {label}
      </label>
      {icon && (
        <i
          className={`${icon} absolute right-3 top-3.5 text-sm text-on-surface-variant/40 opacity-0 group-hover:opacity-100 transition-opacity peer-focus:text-primary`}
        />
      )}
    </div>
  );
}
