import Link from "next/link";

export default function NewsletterCta({ followUs = [] }) {
  return (
    <div className="bg-primary text-on-primary rounded-lg p-4">
      <h3 className="font-headline-md text-lg mb-2">Stay Informed</h3>
      <p className="font-body-md text-sm opacity-90 mb-4">
        Get daily briefings on Indian politics, elections, and policy delivered to your inbox.
      </p>
      <Link
        href="/register"
        className="block text-center font-label-md bg-white text-primary px-4 py-2 rounded hover:bg-white/90 transition-colors mb-4"
      >
        SUBSCRIBE
      </Link>
      <div className="flex items-center justify-center gap-4 border-t border-white/20 pt-4">
        {followUs.map((social) => (
          <a key={social.id} href={social.url || "#"} target={social.url ? "_blank" : undefined} rel={social.url ? "noopener noreferrer" : undefined} aria-label={social.label} className="inline-flex items-center gap-1.5 text-white/80 hover:text-white transition-colors">
            <i className={`${social.icon} text-lg`} />
            {social.icon?.includes("fa-globe") && <span className="text-xs font-semibold">{social.label}</span>}
          </a>
        ))}
      </div>
    </div>
  );
}
