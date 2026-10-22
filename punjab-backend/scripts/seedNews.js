// One-off / re-runnable seed script for the homepage's non-authored widgets
// (election results, poll of the day, social feed mockups, PM corner, etc.)
// — the site-configured furniture around the real news content, which comes
// from the articles/blogs/videos tables authors already write into and
// editors already approve (see news.controller.js). There is no dummy
// "posts" table here; upserts are idempotent, safe to re-run any time.
//
// Usage: node scripts/seedNews.js
const pool = require("../src/config/db");
const HomeWidget = require("../src/models/homeWidget.model");

// Lorem Picsum returns a real, stable photo for a given seed string — no API
// key, no rate limit, never 404s. Used only for the few widgets below that
// aren't backed by real author-uploaded images (PM Corner, X/Facebook feed
// mockups) — everything that's actual news content uses the real
// featured_image/thumbnail an author uploaded.
const img = (seed, w = 800, h = 500) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

async function createTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS home_widgets (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      widget_key VARCHAR(64) NOT NULL UNIQUE,
      data JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

const POPULAR_TAGS = [
  "AAM Aadmi Party", "AAP", "Arvind Kejriwal", "Assembly Election", "Polls",
  "Bharatiya Janata Party", "BJP", "CM of Karnataka", "Congress", "Delhi",
  "Delhi Politics", "Elections 2024", "Haryana", "INC", "Indian National Congress",
  "Narendra Modi", "Rahul Gandhi",
];

const EXTRA_KEYWORDS = [
  "AAM AADMI PARTY", "AITMC", "Alliance", "Assembly Election 2023",
  "Assembly Election Survey", "Assemly Election Win", "bihar", "BJP",
  "BJP Chhattisgarh", "BJP Hariyana", "BRS", "By-Election", "Chhattisgarh",
  "Chief Minister of Karnataka", "chiraj Paswan", "CM Hariyana",
  "CM of Andhra Pradesh", "CM of Karnataka", "CPM", "Delhi CM",
  "election Commission", "Election Winner", "G20 Politicians", "Hariyana",
  "Important Announcement by CM", "INC", "INC Congress", "INDIA ALLIANCE",
  "Jammu and Kashmir", "Janasena", "JDU Bihar", "Jharkhand",
  "Jharkhand Mukti Morcha-JMM", "Karnataka", "Kerala", "Ladakh",
  "Lagistrative Election 2023", "Legislative Assembly", "LJP PARTY",
  "Lok Sabha Election 2024", "Lokjan sakti Party", "Madhya Pradesh",
  "Maharashtra", "Manipur", "MP", "NATIONAL PRESIDENT OF PARTY", "NC", "NCP",
  "Next Assembly Election", "NPP", "PM", "Political Posts in India",
  "Politicians", "Powerfull Potential politoician", "Prime Minister",
  "Quad Summit", "Regional Parties", "Samajwadi Party", "SCO Summit",
  "Shivsena Maharastra", "Survey Election", "Tamil nadu", "Telangana",
  "Telugu Desham Party", "TMC", "Top Stories", "UP BJP", "UP CM",
  "Uttar Pradesh", "vidhan Sabha", "Vidhan Sabha win",
  "Vidhan Shabha Election 2023", "West bangal",
  "Why Exports our child Vaccine to other country", "World Politicians",
  "Worldwide Politicians", "Yogi Aditya Nath", "YSRCP",
];

const WIDGETS = {
  breaking_news:
    "Major Policy Shift Expected in Upcoming Cabinet Meeting • Election Commission Announces New Voting Guidelines for Border States • Sensex Hits Record High Amid Positive Economic Data",

  x_feed: [
    { id: 1, name: "Political Analyst", handle: "@pol_analyst", verified: true, text: "The upcoming state elections will be a crucial test for the incumbent government. Early polls suggest a tight race in several key constituencies. #Elections2024", stats: { comments: 124, retweets: 45, likes: 892, views: "12K" } },
    { id: 2, name: "News Network", handle: "@news_net", verified: true, text: "BREAKING: Historic trade agreement signed, promising economic growth and new opportunities for millions. Full coverage at 9 PM.", stats: { comments: 56, retweets: 120, likes: 1200 }, hasImage: true, image: img("xfeed-2", 700, 394) },
  ],

  facebook_updates: [
    { id: 1, name: "Citizens for Change", time: "2 hrs ago", text: "Join us tomorrow for a town hall meeting discussing the new infrastructure development plan. Your voice matters! See details below.", hasImage: true, image: img("fb-1", 700, 525) },
  ],

  digital_pulse: [
    { id: 1, tag: "Viral", tagClass: "bg-error text-on-error", text: "Unverified clip of cabinet meeting goes viral on social platforms." },
    { id: 2, tag: "Debate", tagClass: "bg-primary text-on-primary", text: "Netizens divided over new urban development tax proposal." },
    { id: 3, tag: "Fact Check", tagClass: "bg-green-500 text-to-primary", text: "No, the Election Commission has not changed the voting age." },
  ],

  the_briefing: [
    "Cabinet to review the National Education Policy implementation next Tuesday.",
    "New bilateral trade talks with EU scheduled for early next month in Brussels.",
    "Home Ministry issues new security protocols for upcoming state festivals.",
  ],

  election_results: [
    { id: 1, state: "Uttar Pradesh", party: "BJP", seats: 255, change: "+10" },
    { id: 2, state: "Maharashtra", party: "Shiv Sena", seats: 145, change: "-5" },
    { id: 3, state: "West Bengal", party: "TMC", seats: 213, change: "+8" },
    { id: 4, state: "Tamil Nadu", party: "DMK", seats: 134, change: "+3" },
    { id: 5, state: "Karnataka", party: "INC", seats: 78, change: "-2" },
  ],

  popular_tags: POPULAR_TAGS,
  extra_keywords: EXTRA_KEYWORDS,

  poll_of_the_day: {
    question: "Should the Winter Session be extended to clear the pending bills backlog?",
    options: [
      { label: "Yes, extend the session", pct: 62 },
      { label: "No, current schedule is enough", pct: 38 },
    ],
    totalVotes: "18,204",
  },

  rti_corner: [
    { id: 1, title: "Ministry discloses spending breakdown for flagship rural infrastructure scheme", date: "Aug 10, 2026" },
    { id: 2, title: "RTI reply reveals pendency data in judicial appointments over the last five years", date: "Aug 6, 2026" },
  ],

  follow_us: [
    { id: 1, icon: "fa-brands fa-x-twitter", label: "X (Twitter)" },
    { id: 2, icon: "fa-brands fa-facebook", label: "Facebook" },
    { id: 3, icon: "fa-brands fa-instagram", label: "Instagram" },
    { id: 4, icon: "fa-brands fa-youtube", label: "YouTube" },
  ],

  legislative_tracker: [
    { id: 1, title: "Digital Personal Data Protection Bill", status: "Passed", statusClass: "bg-green-600 text-white", stage: "Rajya Sabha" },
    { id: 2, title: "Forest Conservation Amendment Act", status: "In Review", statusClass: "bg-secondary text-on-secondary", stage: "Standing Committee" },
  ],

  political_calendar: [
    { id: 1, date: "Aug 21", title: "Monsoon Session concludes in both Houses" },
    { id: 2, date: "Sep 05", title: "All-Party Meeting on Electoral Reforms" },
    { id: 3, date: "Oct 02", title: "State Assembly Winter Session begins" },
    { id: 4, date: "Nov 14", title: "National Conference of Chief Ministers" },
  ],

  political_rallys: [
    { id: 1, date: "Aug 15", title: "Independence Day Rally by the Prime Minister in New Delhi" },
    { id: 2, date: "Aug 20", title: "Statewide Rally by the Opposition in Maharashtra" },
    { id: 3, date: "Sep 10", title: "Youth Wing Rally in Uttar Pradesh" },
  ],

  from_the_archives: {
    title: "Constitution Day",
    note: "26 January 1950 — The Constitution of India came into force, establishing the Republic and its Parliamentary system of governance.",
  },

  fact_check: {
    claim: "Claim: The Election Commission has revised the minimum voting age.",
    verdict: "False",
    verdictClass: "bg-green-600 text-white",
    explanation: "The voting age remains 18 years as per the 61st Constitutional Amendment; no revision has been notified.",
  },

  political_keywords: {
    parties: ["BJP", "INC", "AAP", "TMC", "SP", "BSP"],
    states: ["Uttar Pradesh", "Maharashtra", "West Bengal", "Bihar"],
    categories: ["Elections 2024", "Policy Analysis", "Governance"],
  },

  party_pulse: {
    title: "Coalition Seat-Sharing Talks",
    excerpt: "Internal committees meet in New Delhi to finalize candidate lists.",
  },

  constituency_spotlight: {
    title: "Varanasi: Infrastructure Boom",
    excerpt: "Reviewing the impact of the latest corridor project on local commerce and heritage preservation.",
  },

  pm_corner: {
    name: "Narendra Modi",
    tag: "Official Address",
    quote: "Our vision for a developed India rests on the pillars of innovation, inclusivity, and integrity.",
    image: img("pm-corner-modi", 800, 800),
    initiatives: [
      { title: "Vision 2047: Roadmap for Viksit Bharat", excerpt: "Outlining the strategic goals for the next quarter-century of national growth." },
      { title: "Global Biofuel Alliance Initiative", excerpt: "Leading international cooperation for sustainable energy alternatives." },
      { title: "Digital India Expansion Phase II", excerpt: "Bridging the rural-urban divide through enhanced fiber connectivity." },
    ],
  },
};

async function seed() {
  await createTables();

  for (const [key, data] of Object.entries(WIDGETS)) {
    await HomeWidget.upsert(key, data);
  }
  console.log(`Seeded ${Object.keys(WIDGETS).length} home_widgets rows.`);
}

seed()
  .then(() => {
    console.log("News widget seed complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("News widget seed failed:", err);
    process.exit(1);
  });
