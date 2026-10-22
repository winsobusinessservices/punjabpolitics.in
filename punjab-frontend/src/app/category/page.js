import Link from "next/link";
import CategoryPageShell from "@/components/category/CategoryPageShell";
import { getCategoryDefinitions } from "@/features/news/news.api";

export const metadata = {
  title: "Browse Political Topics & Categories",
  description: "Browse Punjab Politics by category: elections, governance, parties, public policy and more, each with its own collection of blogs, analysis and updates.",
};

export default async function CategoriesPage() {
  const categories = (await getCategoryDefinitions()).filter((category) => !category.route_owner);

  return (
    <CategoryPageShell
      title="Categories"
      count={categories.length}
      gridClassName="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
    >
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/${category.slug}`}
          className="group flex min-h-44 flex-col rounded-xl border border-outline-variant/30 bg-surface-container-low p-5 transition-colors hover:border-primary/60 hover:bg-primary/5"
        >
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <i className="fa-solid fa-folder-open" />
            </span>
            <i className="fa-solid fa-arrow-right text-sm text-on-surface-variant transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </div>
          <h2 className="mt-4 font-headline-lg text-lg text-on-surface group-hover:text-primary">{category.name}</h2>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-on-surface-variant">
            {category.content || `View information and updates about ${category.name}.`}
          </p>
          <span className="mt-auto pt-4 text-xs font-label-md text-primary">/{category.slug}</span>
        </Link>
      ))}
    </CategoryPageShell>
  );
}
