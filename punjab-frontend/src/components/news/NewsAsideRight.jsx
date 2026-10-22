import Link from "next/link";
import NewsletterCta from "@/components/layout/NewsletterCta";
import WidgetHeading from "@/components/common/WidgetHeading";
import { getDigitalPulse, getElectionResults, getPoliticalKeywords, getFollowUs, getSectionVisibility } from "@/features/news/news.api";
import { getParliamentSummary } from "@/features/parliament/parliament.api";
import { slugify } from "@/lib/slugify";
import AdSlot from "@/components/common/AdSlot";
import GoogleAd from "@/components/common/GoogleAd";

export default async function NewsAsideRight() {
  const [digitalPulse, electionResults, politicalKeywords, followUs, parliamentSummary, visibility] = await Promise.all([
    getDigitalPulse(),
    getElectionResults(),
    getPoliticalKeywords(),
    getFollowUs(),
    getParliamentSummary(),
    getSectionVisibility(),
  ]);
  const visible = (key) => visibility[key] !== false;

  return (
    <aside className="order-3 lg:w-1/4 flex flex-col bg-surface-container rounded-xl p-4 border border-outline-variant/30 gap-6">
      {visible("parliament_strength") && <div>
        <WidgetHeading title="Parliament" icon="fa-solid fa-landmark" />
        <div className="flex flex-col gap-3">
          {parliamentSummary.map((house, index) => (
            <Link
              key={house.key}
              href={house.href}
              className={`group block ${index > 0 ? "border-t border-outline-variant/20 pt-3" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="font-headline-md text-sm text-on-surface group-hover:text-primary transition-colors">
                  {house.label}
                </h4>
                <span className="text-[10px] font-label-md text-on-surface-variant">{house.totalSeats} seats</span>
              </div>
              <p className="font-body-md text-xs text-on-surface-variant">
                {house.presidingOfficer.role}: {house.presidingOfficer.name}
              </p>
              <p className="font-body-md text-xs text-on-surface-variant">
                Leading bloc: {house.leadingParty} ({house.leadingSeats} seats)
              </p>
            </Link>
          ))}
        </div>
      </div>}

      {visible("digital_pulse") && <div className="pt-4 border-t border-outline-variant/30">
        <WidgetHeading title="Digital Pulse" icon="fa-solid fa-bolt" />
        <div className="flex flex-col gap-3">
          {digitalPulse.map((item, index) => (
            <div key={item.id} className={index > 0 ? "border-t border-outline-variant/20 pt-3" : ""}>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm inline-block mb-1 uppercase tracking-widest ${item.tagClass}`}>
                {item.tag}
              </span>
              <p className="font-body-md text-sm text-on-surface">{item.text}</p>
            </div>
          ))}
        </div>
      </div>}

      {visible("political_keywords") && <div className="pt-4 border-t border-outline-variant/30">
        <WidgetHeading title="Political Keywords" icon="fa-solid fa-tag" />
        <div className="flex flex-wrap gap-2">
          {[...politicalKeywords.parties, ...politicalKeywords.states, ...politicalKeywords.categories].map((tag) => (
            <Link
              key={tag}
              href={`/category/${slugify(tag)}`}
              className="px-2 py-1 bg-surface-container-high text-on-surface font-bold text-xs rounded-sm border border-outline-variant/20 hover:bg-primary hover:text-on-primary transition-colors cursor-pointer"
            >
              {tag}
            </Link>
          ))}
        </div>
      </div>}

      {visible("election_results") && <div className="pt-4 border-t border-outline-variant/30">
        <WidgetHeading title="Election Results" />
        <div className="bg-surface-container-low rounded p-2 border border-outline-variant/20">
          <table className="w-full text-[10px] font-label-md">
            <thead>
              <tr className="text-outline border-b border-outline-variant/30">
                <th className="text-left py-1">INDEX</th>
                <th className="text-right py-1">VALUE</th>
                <th className="text-right py-1">CHG</th>
              </tr>
            </thead>
            <tbody className="text-on-surface">
              {electionResults.map((row, index) => (
                <tr key={row.id} className={index < electionResults.length - 1 ? "border-b border-outline-variant/10" : ""}>
                  <td className="py-1.5">{row.state}</td>
                  <td className="text-right py-1.5">{row.party}</td>
                  <td className={`text-right py-1.5 ${String(row.change || "").startsWith('+') ? "text-green-600" : "text-error"}`}>{row.seats}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>}

      <div className="pt-4 border-t border-outline-variant/30">
        <NewsletterCta followUs={visible("follow_us") ? followUs : []} />
      </div>

      <AdSlot placement="sidebar_right" />
      <GoogleAd slot="3691353983" className="flex justify-center" style={{ width: 250, height: 250 }} />
    </aside>
  );
}
