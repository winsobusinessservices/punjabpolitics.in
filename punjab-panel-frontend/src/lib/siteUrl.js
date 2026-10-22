// Address of the public website, for turning site paths (/news/some-post) into links.
export function publicSiteUrl() {
  return (process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "https://punjabpolitics.com").replace(/\/$/, "");
}
