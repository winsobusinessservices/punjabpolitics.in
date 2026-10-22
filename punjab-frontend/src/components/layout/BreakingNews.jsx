import { getSectionVisibility } from "@/features/news/news.api";

export default async function BreakingNews({ text }) {
  const visibility = await getSectionVisibility();
  if (visibility.breaking_news === false || !text) return null;
  return (
    <div className="relative z-[180] w-full h-10 bg-primary text-on-primary flex items-center overflow-hidden border-b border-white/10">
      <div className="flex-shrink-0 bg-secondary px-6 h-full flex items-center font-label-md font-bold tracking-widest text-xs z-10 shadow-[4px_0_8px_rgba(0,0,0,0.2)]">
        BREAKING
      </div>
      <div className="flex-grow overflow-hidden whitespace-nowrap flex items-center h-full pause-on-hover">
        <div className="inline-block animate-marquee font-label-md pl-6">{text}</div>
      </div>
    </div>
  );
}
