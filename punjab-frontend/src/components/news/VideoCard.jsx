import ImagePlaceholder from "@/components/common/ImagePlaceholder";
import { formatViews } from "@/lib/formatViews";

export default function VideoCard({ title, category, image, views = 0, href }) {
  const content = (
    <>
      <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-3 cursor-pointer">
        <ImagePlaceholder icon="fa-solid fa-video" image={image} alt={title} gradient="secondary" className="w-full h-full" iconClassName="text-3xl" />
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
          <i className="fa-solid fa-circle-play text-white text-4xl opacity-90 group-hover:scale-110 transition-transform" />
        </div>
      </div>
      {category && (
        <span className="text-[10px] font-bold text-surface-tint uppercase tracking-wider">{category}</span>
      )}
      <h3 className="font-headline-md text-sm text-on-surface group-hover:text-primary transition-colors leading-snug mt-1 cursor-pointer">
        {title}
      </h3>
      <span className="inline-flex items-center gap-1 text-[10px] text-outline mt-1">
        <i className="fa-regular fa-eye" /> {formatViews(views)}
      </span>
    </>
  );

  if (!href) {
    return (
      <div className="group" aria-label={`${title} (video unavailable)`}>
        {content}
        <span className="block text-[10px] text-error mt-2">Video unavailable</span>
      </div>
    );
  }


  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="group block cursor-pointer focus-visible:outline-2 focus-visible:outline-primary rounded-lg" aria-label={`Play video in a new tab: ${title}`}>
      {content}
    </a>
  );
}
