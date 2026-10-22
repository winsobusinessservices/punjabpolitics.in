export const SITE = {
  name: "Punjab Politics",
  tagline: "Punjab Political News, Elections and Public Affairs",
};

// `key` names a key in messages/*.json's "Header" namespace — only the
// items that are actually translated there have one; the rest fall back to
// their static English `label` (see the i18n scoping decision: header nav +
// homepage hero are translated today, not the whole site).
export const NAV_LINKS = [
  { label: "Home", href: "/", key: "home" },
  { label: "Punjab News", href: "/top-news" },
  { label: "Punjab Government", href: "/category/punjab-government" },
  { label: "Punjab Elections", href: "/elections" },
  { label: "Punjab Leaders", href: "/key-political-figures", feature: "feature_leaders" },
  { label: "Punjab Parties", href: "/parties", key: "politics", feature: "feature_parties" },
  { label: "Punjab State", href: "/state", key: "states", feature: "feature_states" },
  { label: "Punjab Districts", href: "/district" },
  { label: "Blogs", href: "/blogs", key: "blogs", feature: "feature_blogs" },
];

export const CATEGORY_TYPE_LABEL = {
  state: "State",
  party: "Party",
  politician: "Leader",
  topic: "Topic",
};

export const SIDEBAR_CATEGORIES = {
  more: [
    { label:"Career", href: "/careers", feature: "feature_careers"},
    { label: "Punjab Rallies", href: "/rallies" },
    { label: "Punjab Speeches", href: "/speeches" },
  ],
  legal: [
    { label: "About", href: "/about"},
    { label: "Contact", href: "/contact" },
    { label: "Privacy Policy", href: "/policies/privacy-policy", feature: "feature_policies" }
  ]
};
