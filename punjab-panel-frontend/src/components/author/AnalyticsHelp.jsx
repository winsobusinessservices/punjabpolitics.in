export default function AnalyticsHelp({ children, label = "How this is measured" }) {
  return <details className="mt-3 text-xs text-on-surface-variant">
    <summary className="w-fit cursor-pointer rounded font-medium text-primary outline-offset-4 focus-visible:outline focus-visible:outline-2">{label}</summary>
    <div className="mt-2 max-w-3xl rounded-lg bg-surface-container-low p-3 leading-relaxed">{children}</div>
  </details>;
}
