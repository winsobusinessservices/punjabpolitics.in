export const SITE_NAME = "Punjab Politics";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://punjabpolitics.com").replace(/\/$/, "");
export const SITE_DESCRIPTION =
  "Punjab Politics: latest news, analysis and updates on Punjab Vidhan Sabha, elections, MLAs (vidhayak), opposition, RJD, JDU, BJP, Congress, leaders, speeches and rallies.";

// Default meta keywords, merged with page-specific ones by buildPageMetadata().
export const SEO_KEYWORDS = [
  "Punjab politics", "Punjab Politics news", "punjabpolitics", "punjabpolitics.com",
  "Punjab Vidhan Sabha", "Vidhansabha", "Punjab assembly", "Punjab elections", "Punjab election results", "Punjab opposition", "opposition leaders",
  "vidhayak", "Punjab MLA", "MLA list Punjab", "Punjab politician", "politician profile", "neta", "Punjab chief minister", "Punjab government policy",
  "Bhashan", "political speech", "bhashan Punjab", "political rallies", "press conference", "Punjab political news",
  "RJD", "JDU", "BJP", "Congress", "LJP", "HAM", "VIP party", "CPI(ML)", "AIMIM", "Jan Suraaj", "NDA", "INDIA alliance", "Mahagathbandhan",
  "Punjab districts", "Lok Sabha", "Rajya Sabha", "Indian politics",
];
