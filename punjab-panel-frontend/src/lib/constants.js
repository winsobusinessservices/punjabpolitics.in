export const SITE = {
  name: "Punjab Politics",
  tagline: "News, elections, leaders, and public affairs across Punjab",
};

// `key` names a key in messages/*.json's "Header" namespace — only the
// items that are actually translated there have one; the rest fall back to
// their static English `label` (see the i18n scoping decision: header nav +
// homepage hero are translated today, not the whole site).
export const NAV_LINKS = [
  { label: "Home", href: "/", key: "home" },
  { label: "Politics", href: "/parties", key: "politics" },
  { label: "States", href: "/state", key: "states" },
  { label: "Districts", href: "/district" },
  { label: "Elections", href: "/elections" },
  // { label: "Policies", href: "/policies" },
  { label: "Blogs", href: "/blogs", key: "blogs" },
  { label: "Lok Sabha", href: "/loksabha", key: "loksabha" },
  { label: "Rajya Sabha", href: "/rajyasabha", key: "rajyasabha" },
  // { label: "Parliament", href: "/parliament" },
  { label: "Rallies", href: "/rallies" },
  { label: "Speeches", href: "/speeches" },
  { label: "Top News", href: "/top-news" },
];

export const CATEGORY_TYPE_LABEL = {
  state: "State",
  party: "Party",
  politician: "Leader",
  topic: "Topic",
};

export const SIDEBAR_CATEGORIES = {
  more: [
    "Investors",
    "Advertise with Us",
    { label:"Career", href: "/careers"},
    "Connect As A Sponsor",
    { label: "Lok Sabha", href: "/loksabha" },
    { label: "Rajya Sabha", href: "/rajyasabha" },
    { label: "Rallies", href: "/rallies" },
  ],
  legal: [
    { label: "About", href: "/about"},
    { label: "Contact", href: "/contact" },
    { label: "Privacy Policy", href: "/policies/privacy-policy" }
  ]
};
