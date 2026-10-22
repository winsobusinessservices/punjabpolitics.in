import Link from "next/link";
import { formatViews } from "@/lib/formatViews";

export default function TrendingNews({ items, viewAllHref }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4 border-b-2 border-primary pb-2">
        <h3 className="font-headline-md text-primary tracking-tight text-lg">Trending</h3>
        {viewAllHref ? (
          <Link href={viewAllHref} className="text-xs font-label-md text-secondary hover:underline">
            VIEW ALL
          </Link>
        ) : (
          <i className="fa-solid fa-arrow-trend-up text-secondary animate-pulse text-lg" />
        )}
      </div>
      <div className="flex flex-col gap-4">
        {items.map((item, index) => {
          const Wrapper = item.slug ? Link : "div";
          const wrapperProps = item.slug ? { href: `/news/${item.slug}` } : {};
          return (
            <Wrapper key={item.id} {...wrapperProps} className="group flex gap-3 items-start cursor-pointer">
              <span className="font-display-lg text-3xl text-outline-variant/50 group-hover:text-primary transition-colors leading-none font-bold">
                {index + 1}
              </span>
              <div className="flex flex-col gap-1">
                <h4 className="font-headline-md text-on-surface text-sm group-hover:text-primary transition-colors leading-tight">
                  {item.title}
                </h4>
                <p className="font-body-md text-xs text-on-surface-variant line-clamp-2">{item.excerpt}</p>
                <span className="text-[10px] text-outline inline-flex items-center gap-1">
                  <i className="fa-regular fa-eye" /> {formatViews(item.views)}
                </span>
              </div>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}
