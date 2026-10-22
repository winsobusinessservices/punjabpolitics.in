export default function WidgetHeading({ title, icon, action }) {
  return (
    <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
      <h3 className="font-headline-md text-primary tracking-tight text-lg">{title}</h3>
      {action || (icon && <i className={`${icon} text-secondary text-lg`} />)}
    </div>
  );
}
