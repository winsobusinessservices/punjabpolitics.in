import Link from "next/link";
import WidgetHeading from "@/components/common/WidgetHeading";
import { getPopularTags } from "@/features/news/news.api";
import { getParties, getKeyFigures, getChiefMinisters } from "@/features/politicians/politician.api";
import { slugify } from "@/lib/slugify";

function ViewAllLink({ href }) {
  return (
    <Link href={href} className="text-xs font-label-md text-secondary hover:underline">
      VIEW ALL
    </Link>
  );
}

export default async function CategorySidebar() {
  const [tags, parties, leaders, chiefMinisters] = await Promise.all([
    getPopularTags(),
    getParties(),
    getKeyFigures(),
    getChiefMinisters(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <WidgetHeading title="News Keywords" icon="fa-solid fa-tag" action={<ViewAllLink href="/category" />} />
        <div className="flex flex-wrap gap-2">
          {tags.slice(0, 14).map((tag) => (
            <Link
              key={tag}
              href={`/category/${slugify(tag)}`}
              className="px-2 py-1 bg-surface-container-high text-on-surface text-xs font-label-md rounded-sm border border-outline-variant/20 hover:bg-primary hover:text-on-primary transition-colors cursor-pointer"
            >
              {tag}
            </Link>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-outline-variant/30">
        <WidgetHeading title="Political Parties" action={<ViewAllLink href="/parties" />} />
        <ul className="space-y-2">
          {parties.slice(0, 6).map((party) => (
            <li key={party.id} className="group cursor-pointer">
              <Link href={`/category/${slugify(party.abbreviation)}`} className="font-body-md text-sm text-on-surface group-hover:text-primary transition-colors">
                {party.name} <span className="text-on-surface-variant text-xs">({party.abbreviation})</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-4 border-t border-outline-variant/30">
        <WidgetHeading title="Top Leaders" action={<ViewAllLink href="/key-political-figures" />} />
        <ul className="space-y-2">
          {leaders.slice(0, 6).map((leader) => (
            <li key={leader.id} className="group cursor-pointer">
              <Link href={`/category/${slugify(leader.slug)}`} className="font-body-md text-sm text-on-surface group-hover:text-primary transition-colors">
                {leader.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-4 border-t border-outline-variant/30">
        <WidgetHeading title="States" action={<ViewAllLink href="/state" />} />
        <ul className="space-y-2">
          {chiefMinisters.slice(0, 6).map((cm) => (
            <li key={cm.id} className="group cursor-pointer">
              <Link href={`/category/${slugify(cm.state)}`} className="font-body-md text-sm text-on-surface group-hover:text-primary transition-colors">
                {cm.state}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
