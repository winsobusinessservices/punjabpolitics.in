import { getSupporters } from "@/features/news/news.api";

// Thank-you wall: first names of supporters who chose to appear. Amounts and emails are never shown.
export default async function SupportersWall() {
  const supporters = await getSupporters();
  if (!supporters.length) return null;

  return (
    <section aria-label="Our supporters" className="border-t border-outline-variant/20 bg-surface px-4 py-12 md:px-16">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-headline-md text-2xl text-primary">Thank you to our supporters</h2>
        <p className="mt-2 font-body-md text-sm text-on-surface-variant">Readers who chose to be named. Every contribution keeps our reporting independent.</p>
        <ul className="mt-6 flex flex-wrap justify-center gap-2">
          {supporters.map((name, index) => (
            <li key={`${name}-${index}`} className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-3.5 py-1.5 font-label-md text-sm text-on-surface">
              <i className="fa-solid fa-heart text-[11px] text-secondary" aria-hidden="true" /> {name}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
