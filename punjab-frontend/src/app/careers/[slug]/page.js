import Link from "next/link";
import { notFound } from "next/navigation";

import BreakingNews from "@/components/layout/BreakingNews";
import Breadcrumbs from "@/components/common/Breadcrumbs";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ApplyToJobClient from "@/components/careers/ApplyToJobClient";

import { getBreakingNews } from "@/features/news/news.api";
import { careersApi } from "@/lib/api";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { absoluteUrl, buildPageMetadata, serializeJsonLd } from "@/lib/seo";
import { isSiteFeatureEnabled } from "@/lib/siteFeatures";
import PostBody from "@/components/common/PostBody";
import { richTextToPlainText } from "@/lib/richText";

const EMPLOYMENT_LABEL = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
};

function hasExpired(job) {
  return Boolean(job.closes_at && new Date(job.closes_at).getTime() <= Date.now());
}

async function getJob(slug) {
  try {
    const { job } = await careersApi.getBySlug(slug);
    return job;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const job = await getJob(slug);

  if (!job) {
    return {
      title: "Position not found",
    };
  }

  const isExpired = hasExpired(job);
  return buildPageMetadata({
    title: job.title,
    description: richTextToPlainText(job.description),
    path: `/careers/${slug}`,
    noIndex: isExpired,
  });
}

export default async function CareerDetailPage({ params }) {
  if (!(await isSiteFeatureEnabled("feature_careers"))) notFound();
  const { slug } = await params;

  const job = await getJob(slug);

  if (!job) {
    notFound();
  }

  const breakingNews = await getBreakingNews();
  const isExpired = hasExpired(job);
  const isRemote = /remote/i.test(job.location || "");
  const jobSchema = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: [job.description, job.responsibilities, job.requirements].filter(Boolean).map(richTextToPlainText).join("\n\n"),
    datePosted: job.created_at,
    validThrough: job.closes_at || undefined,
    employmentType: job.employment_type,
    hiringOrganization: {
      "@type": "NewsMediaOrganization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      sameAs: SITE_URL,
      logo: `${SITE_URL}/globe.svg`,
    },
    identifier: { "@type": "PropertyValue", name: SITE_NAME, value: String(job.id) },
    url: absoluteUrl(`/careers/${slug}`),
    ...(isRemote
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: { "@type": "Country", name: "India" },
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: job.location, addressCountry: "IN" },
          },
        }),
  };

  return (
    <>
      <BreakingNews text={breakingNews} />
      <Header />

      <main className="w-full bg-background flex-grow">
        {!isExpired && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(jobSchema) }} />}
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 lg:px-12 py-8">

          {/* Main 65 / 35 Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.8fr)_minmax(360px,1fr)] gap-10 xl:gap-14">

            {/* ========================================= */}
            {/* LEFT SIDE - JOB DETAILS */}
            {/* ========================================= */}

            <section className="min-w-0">

              {/* Breadcrumb */}
              <Breadcrumbs items={[{ label: "Careers", href: "/careers" }, { label: job.title }]} />

              {/* Employment Type */}
              <span className="inline-block px-3 py-1 bg-primary text-on-primary text-xs font-label-md uppercase tracking-widest rounded-sm mb-4">
                {EMPLOYMENT_LABEL[job.employment_type] ||
                  job.employment_type}
              </span>

              {/* Job Title */}
              <h1 className="font-display-lg text-3xl md:text-4xl lg:text-5xl text-on-surface tracking-tight leading-tight mb-5">
                {job.title}
              </h1>

              {/* Job Meta */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-on-surface-variant font-label-md mb-8 pb-6 border-b border-outline-variant/30">

                {job.department && (
                  <span className="flex items-center gap-2">
                    <i className="fa-solid fa-building text-primary" />
                    {job.department}
                  </span>
                )}

                {job.location && (
                  <span className="flex items-center gap-2">
                    <i className="fa-solid fa-location-dot text-primary" />
                    {job.location}
                  </span>
                )}

                {job.closes_at && (
                  <span className="flex items-center gap-2">
                    <i className="fa-regular fa-calendar text-primary" />
                    Apply by{" "}
                    {new Date(job.closes_at).toLocaleDateString("en-IN")}
                  </span>
                )}
              </div>

              {/* Job Description */}
              <div className="space-y-8 font-body-md text-on-surface-variant leading-relaxed">

                {job.description && (
                  <div>
                    <h2 className="font-headline-lg text-primary text-xl mb-3">
                      About the Role
                    </h2>

                    <PostBody content={job.description} className="space-y-4" />
                  </div>
                )}

                {job.responsibilities && (
                  <div>
                    <h2 className="font-headline-lg text-primary text-xl mb-3">
                      Responsibilities
                    </h2>

                    <PostBody content={job.responsibilities} className="space-y-4" />
                  </div>
                )}

                {job.requirements && (
                  <div>
                    <h2 className="font-headline-lg text-primary text-xl mb-3">
                      Requirements
                    </h2>

                    <PostBody content={job.requirements} className="space-y-4" />
                  </div>
                )}

                {/* Additional Information */}
                <div className="pt-6 border-t border-outline-variant/30">

                  <h2 className="font-headline-lg text-primary text-xl mb-4">
                    Before You Apply
                  </h2>

                  <ul className="space-y-3 text-sm">
                    <li className="flex gap-3">
                      <i className="fa-solid fa-circle-check text-primary mt-1" />
                      <span>
                        Make sure your personal details match your
                        government documents.
                      </span>
                    </li>

                    <li className="flex gap-3">
                      <i className="fa-solid fa-circle-check text-primary mt-1" />
                      <span>
                        Keep your PAN and Aadhaar details ready.
                      </span>
                    </li>

                    <li className="flex gap-3">
                      <i className="fa-solid fa-circle-check text-primary mt-1" />
                      <span>
                        Upload a clear graduation certificate.
                      </span>
                    </li>

                    <li className="flex gap-3">
                      <i className="fa-solid fa-circle-check text-primary mt-1" />
                      <span>
                        Upload your latest resume in PDF format.
                      </span>
                    </li>
                  </ul>

                </div>
              </div>
            </section>

            {/* ========================================= */}
            {/* RIGHT SIDE - APPLICATION FORM */}
            {/* ========================================= */}

            <aside className="lg:sticky lg:top-24 h-fit">

                <ApplyToJobClient job={job} />

            </aside>

          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
