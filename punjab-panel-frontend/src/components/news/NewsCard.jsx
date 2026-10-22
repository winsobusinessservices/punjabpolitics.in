import Link from "next/link";
import ImagePlaceholder from "@/components/common/ImagePlaceholder";
import { slugify } from "@/lib/slugify";
import { formatViews } from "@/lib/formatViews";

function ViewCount({ views }) {
  return <span className="inline-flex items-center gap-1"><i className="fa-regular fa-eye" /> {formatViews(views)}</span>;
}

/**
 * variant: "stacked" (Top Stories), "horizontal" (Editorial Opinion), "compact" (Regional Focus)
 *
 * The category/tag badge links to /category/[slug] while the rest of the card
 * links to /news/[slug] — since both can't share one <a>, they're kept as
 * sibling links under a shared `group` container so hover styling still works.
 */
export default function NewsCard({ variant = "stacked", story }) {
  const newsHref = story.slug ? `/news/${story.slug}` : null;

  if (variant === "horizontal") {
    return (
      <article className="flex gap-4 group">
        {newsHref ? (
          <Link href={newsHref} className="cursor-pointer flex-shrink-0">
            <ImagePlaceholder
              icon={story.icon}
              image={story.image}
              alt={story.title}
              gradient="secondary"
              className="w-24 h-24 md:w-32 md:h-32 rounded-md"
            />
          </Link>
        ) : (
          <ImagePlaceholder
            icon={story.icon}
            image={story.image}
            alt={story.title}
            gradient="secondary"
            className="w-24 h-24 md:w-32 md:h-32 flex-shrink-0 rounded-md"
          />
        )}
        <div className="flex flex-col gap-1 justify-center">
          {story.tag && (
            <Link
              href={`/category/${slugify(story.tag)}`}
              className="text-[10px] font-bold text-primary uppercase tracking-wider hover:underline w-fit"
            >
              {story.tag}
            </Link>
          )}
          {newsHref ? (
            <Link href={newsHref} className="cursor-pointer">
              <h3 className="font-headline-md text-base md:text-lg text-on-surface group-hover:text-primary transition-colors leading-snug">
                {story.title}
              </h3>
            </Link>
          ) : (
            <h3 className="font-headline-md text-base md:text-lg text-on-surface leading-snug">{story.title}</h3>
          )}
          <p className="font-body-md text-on-surface-variant line-clamp-2 text-xs mt-1">{story.excerpt}</p>
          <span className="text-outline text-[10px] mt-1">
            By {story.author} • {story.time} • <ViewCount views={story.views} />
          </span>
        </div>
      </article>
    );
  }

  if (variant === "compact") {
    const Wrapper = newsHref ? Link : "div";
    const wrapperProps = newsHref ? { href: newsHref } : {};
    return (
      <Wrapper {...wrapperProps} className="group flex flex-col gap-2 cursor-pointer">
        <ImagePlaceholder icon={story.icon} image={story.image} alt={story.title} gradient="tint" className="w-full aspect-[4/3] rounded-md" />
        {story.category && (
          <span className="text-[10px] font-bold text-surface-tint uppercase tracking-wider">{story.category}</span>
        )}
        <h3 className="font-headline-md text-base text-on-surface group-hover:text-primary transition-colors leading-snug">
          {story.title}
        </h3>
        <p className="font-body-md text-on-surface-variant line-clamp-2 text-xs">{story.excerpt}</p>
        {(story.author || story.time) && (
          <span className="text-outline text-[10px]">
            {story.author && <>By {story.author}</>}
            {story.author && story.time && " • "}
            {story.time}
            {" • "}<ViewCount views={story.views} />
          </span>
        )}
      </Wrapper>
    );
  }

  return (
    <article className="flex flex-col gap-3 group">
      {newsHref ? (
        <Link href={newsHref} className="cursor-pointer">
          <ImagePlaceholder icon={story.icon} image={story.image} alt={story.title} gradient="primary" className="w-full aspect-video rounded-lg" />
        </Link>
      ) : (
        <ImagePlaceholder icon={story.icon} image={story.image} alt={story.title} gradient="primary" className="w-full aspect-video rounded-lg" />
      )}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 mb-1">
          {story.category && (
            <Link
              href={`/category/${slugify(story.category)}`}
              className="text-[10px] font-bold text-surface-tint uppercase tracking-wider hover:underline"
            >
              {story.category}
            </Link>
          )}
          {story.time && <span className="text-outline text-[10px]">• {story.time}</span>}
        </div>
        {newsHref ? (
          <Link href={newsHref} className="cursor-pointer">
            <h3 className="font-headline-md text-lg text-on-surface group-hover:text-primary transition-colors leading-snug">
              {story.title}
            </h3>
          </Link>
        ) : (
          <h3 className="font-headline-md text-lg text-on-surface leading-snug">{story.title}</h3>
        )}
        <p className="font-body-md text-on-surface-variant line-clamp-3 text-xs mt-1">{story.excerpt}</p>
        {story.author && (
          <span className="text-outline text-[10px] mt-1">
            By {story.author}
            {/* {story.time && ` • ${story.time}`} */}
            {" • "}<ViewCount views={story.views} />
          </span>
        )}
      </div>
    </article>
  );
}
