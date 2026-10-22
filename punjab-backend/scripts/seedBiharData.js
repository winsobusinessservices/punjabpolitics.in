// Replaces the development seed content for site 1 with Bihar-only records.
// Authentication users and operational data are intentionally left untouched.
const pool = require("../src/config/db");

const SITE_ID = 1;
const IMAGE = "/images/logo.jpg";
const OFFICIAL_CM_SOURCE = "https://cm.bihar.gov.in/users/home1.aspx";
const OFFICIAL_BANKIPUR_SOURCE = "https://results.eci.gov.in/ResultAcByeAugust2026/ConstituencywiseS04182.htm";

const categories = [
  ["Punjab Politics", "punjab-politics"],
  ["Bihar Government", "bihar-government"],
  ["Bihar Elections", "bihar-elections"],
  ["Bihar Assembly", "bihar-assembly"],
  ["Bihar Development", "bihar-development"],
  ["Bihar Districts", "bihar-districts"],
  ["Bihar Policy", "bihar-policy"],
  ["Bihar Explainers", "bihar-explainers"],
];

const parties = [
  ["bharatiya-janata-party-bihar", "Bharatiya Janata Party - Bihar", "BJP", 1980, "Patna, Bihar", "Bihar unit of a national political party."],
  ["janata-dal-united", "Janata Dal (United)", "JD(U)", 2003, "Patna, Bihar", "A political party with a major base in Bihar."],
  ["rashtriya-janata-dal", "Rashtriya Janata Dal", "RJD", 1997, "New Delhi", "A political party founded by Lalu Prasad Yadav with a major base in Bihar."],
  ["jan-suraaj-party", "Jan Suraaj Party", "JSP", 2024, "Patna, Bihar", "A Bihar-focused political party."],
  ["indian-national-congress-bihar", "Indian National Congress - Bihar", "INC", 1885, "Bihar", "The Bihar unit of the Indian National Congress."],
  ["lok-janshakti-party-rv", "Lok Janshakti Party (Ram Vilas)", "LJP(RV)", 2021, "Bihar", "A political party active in Bihar."],
  ["hindustani-awam-morcha", "Hindustani Awam Morcha (Secular)", "HAM(S)", 2015, "Patna, Bihar", "A Bihar-based political party."],
  ["cpi-ml-liberation-bihar", "CPI(ML) Liberation - Bihar", "CPI(ML)L", 1974, "Bihar", "The Bihar organization of CPI(ML) Liberation."],
];

const politicians = [
  {
    slug: "samrat-choudhary", name: "Samrat Choudhary", party: "Bharatiya Janata Party (BJP)",
    category: "CHIEF_MINISTER", position: "Chief Minister of Bihar", since: 2026, office: 1,
    summary: "Chief Minister of Bihar since 15 April 2026. This profile is sourced from the official Bihar Chief Minister Secretariat.",
  },
  {
    slug: "nitish-kumar", name: "Nitish Kumar", party: "Janata Dal (United)",
    category: "KEY_FIGURE", position: "Former Chief Minister of Bihar", since: null, office: 0,
    summary: "A long-serving Bihar political leader and former Chief Minister of the state.",
  },
  {
    slug: "lalu-prasad-yadav", name: "Lalu Prasad Yadav", party: "Rashtriya Janata Dal",
    category: "KEY_FIGURE", position: "Bihar political leader", since: null, office: 0,
    summary: "Former Chief Minister of Bihar and founder of the Rashtriya Janata Dal.",
  },
  {
    slug: "rabri-devi", name: "Rabri Devi", party: "Rashtriya Janata Dal",
    category: "KEY_FIGURE", position: "Former Chief Minister of Bihar", since: null, office: 0,
    summary: "Former Chief Minister of Bihar and a senior Rashtriya Janata Dal leader.",
  },
  {
    slug: "tejashwi-yadav", name: "Tejashwi Yadav", party: "Rashtriya Janata Dal",
    category: "KEY_FIGURE", position: "Bihar political leader", since: null, office: 0,
    summary: "A Bihar political leader associated with the Rashtriya Janata Dal.",
  },
  {
    slug: "prashant-kishor", name: "Prashant Kishor", party: "Jan Suraaj Party",
    category: "KEY_FIGURE", position: "Member-elect from Bankipur", since: 2026, office: 1,
    summary: "Jan Suraaj Party leader and winner of the August 2026 Bankipur Assembly by-election, according to the Election Commission of India result.",
  },
];

const articles = [
  {
    slug: "samrat-choudhary-takes-oath-bihar-chief-minister-2026",
    title: "Samrat Choudhary Takes Oath as Bihar Chief Minister",
    category: "Bihar Government",
    excerpt: "The Bihar Chief Minister Secretariat records that Samrat Choudhary took oath as Chief Minister on 15 April 2026.",
    content: `Samrat Choudhary took oath as the Chief Minister of Bihar on 15 April 2026. The Punjab Politics profile uses the official Chief Minister Secretariat as its source.\n\nOfficial source: ${OFFICIAL_CM_SOURCE}`,
    tags: ["Bihar", "Chief Minister", "Samrat Choudhary", "Bihar Government"], views: 850,
  },
  {
    slug: "bankipur-by-election-result-2026-explained",
    title: "Bankipur By-Election Result 2026: The Official Numbers",
    category: "Bihar Elections",
    excerpt: "Election Commission results show Prashant Kishor winning Bankipur with 64,151 votes.",
    content: `The Election Commission of India result for the August 2026 Bankipur Assembly by-election records 64,151 votes for Prashant Kishor of the Jan Suraaj Party. Neeraj Kumar of the BJP received 44,827 votes and Rekha Kumari of the RJD received 14,273.\n\nOfficial source: ${OFFICIAL_BANKIPUR_SOURCE}`,
    tags: ["Bihar", "Bankipur", "By-election", "Election Commission"], views: 790,
  },
  {
    slug: "how-bihar-vidhan-sabha-works",
    title: "How the Bihar Vidhan Sabha Works",
    category: "Bihar Assembly",
    excerpt: "A plain-language introduction to constituencies, MLAs, questions, debates and state legislation in Bihar.",
    content: "The Bihar Legislative Assembly is the elected chamber in which Members of the Legislative Assembly represent constituencies across the state. The House debates state laws, examines government spending and allows members to question ministers. Committee work and proceedings help residents follow how policy decisions are reviewed.",
    tags: ["Bihar", "Vidhan Sabha", "MLA", "Explainer"], views: 520,
  },
  {
    slug: "bihar-panchayati-raj-local-government-guide",
    title: "Bihar Panchayati Raj: A Guide to Local Government",
    category: "Bihar Explainers",
    excerpt: "An overview of village, block and district-level democratic institutions in Bihar.",
    content: "Panchayati Raj institutions connect village communities with local planning and public services. Gram Panchayats, Panchayat Samitis and Zila Parishads work at different levels. Residents can use meeting records, budgets and public information channels to understand local priorities and implementation.",
    tags: ["Bihar", "Panchayati Raj", "Local Government"], views: 410,
  },
  {
    slug: "bihar-flood-governance-explainer",
    title: "Why Flood Management Is a Major Bihar Governance Issue",
    category: "Bihar Policy",
    excerpt: "River systems, embankments, relief delivery and district coordination all shape Bihar's flood response.",
    content: "Flood management in Bihar involves preparedness, river monitoring, embankment maintenance, evacuation, relief delivery and recovery. Coordination between state departments, district administrations and local bodies is essential. Public scrutiny commonly focuses on readiness, relief access and long-term resilience.",
    tags: ["Bihar", "Flood Management", "Governance"], views: 375,
  },
  {
    slug: "bihar-employment-migration-policy-context",
    title: "Employment and Migration in Bihar's Policy Debate",
    category: "Bihar Development",
    excerpt: "Jobs, skills, local industry and worker protections remain central themes in Bihar's development debate.",
    content: "Bihar's employment debate connects skills, agriculture, small businesses, industrial investment and migration. Useful policy reporting separates announcements from measurable outcomes such as placements, wages, business formation and access to worker support.",
    tags: ["Bihar", "Employment", "Migration", "Development"], views: 340,
  },
  {
    slug: "tracking-bihar-district-development",
    title: "How to Track Development Across Bihar's Districts",
    category: "Bihar Districts",
    excerpt: "District-level data helps readers compare delivery in health, education, roads and public services.",
    content: "Statewide averages can hide large differences between Bihar's districts. District-level reporting should identify the time period, official source and measurement method for every comparison. It should also distinguish budget allocation from actual expenditure and completed work.",
    tags: ["Bihar", "Districts", "Public Data", "Development"], views: 295,
  },
  {
    slug: "reading-bihar-government-budget",
    title: "How to Read the Bihar Government Budget",
    category: "Bihar Government",
    excerpt: "A practical guide to receipts, expenditure, department allocations and revised estimates.",
    content: "A state budget presents expected revenue and planned spending. Readers should compare budget estimates with revised estimates and actual expenditure, then examine department-level allocations. Year-on-year percentage changes are most useful when inflation and changes in scheme design are also considered.",
    tags: ["Bihar", "Budget", "Government", "Explainer"], views: 260,
  },
];

const blogs = [
  {
    slug: "questions-to-ask-about-bihar-policy-announcements",
    title: "Five Questions to Ask About a Bihar Policy Announcement",
    category: "Bihar Explainers",
    excerpt: "A checklist for separating an announcement from a funded, measurable programme.",
    content: "Ask what problem the policy addresses, which department owns it, how much funding is approved, when implementation begins and which public measure will show progress. This checklist helps readers evaluate Bihar policy announcements without relying on slogans.",
    tags: ["Bihar", "Policy", "Accountability"], views: 220,
  },
  {
    slug: "understanding-bihar-assembly-constituency-results",
    title: "How to Read a Bihar Assembly Constituency Result",
    category: "Bihar Elections",
    excerpt: "Votes, vote share, margin and turnout answer different questions about an election result.",
    content: "The winner's vote total is only one part of a constituency result. Vote share shows support among valid votes, the victory margin compares the top two candidates, and turnout shows participation among registered electors. Use official Election Commission tables for final figures.",
    tags: ["Bihar", "Elections", "Constituency", "Explainer"], views: 205,
  },
  {
    slug: "why-bihar-district-reporting-matters",
    title: "Why District-Level Reporting Matters in Bihar",
    category: "Bihar Districts",
    excerpt: "Local evidence makes state policy reporting more useful and accountable.",
    content: "Reporting from districts can test whether a state programme is reaching residents. Strong district reporting uses documents, field observations and multiple voices, while clearly separating verified facts from claims and opinion.",
    tags: ["Bihar", "Districts", "Reporting"], views: 180,
  },
  {
    slug: "punjab-politics-source-checklist",
    title: "A Source Checklist for Bihar Political News",
    category: "Bihar Explainers",
    excerpt: "Start with official records, identify dates and distinguish results from commentary.",
    content: "For Bihar political news, check the original government order, Election Commission result, Assembly record or department release. Confirm the publication date and event date separately. Attribute political claims and avoid presenting projections or social posts as final results.",
    tags: ["Bihar", "Fact Check", "Sources"], views: 165,
  },
];

const widgets = {
  site_header: {
    showUpcomingRallies: false,
    showWeather: false,
    showUpcomingEvents: false,
    countdown: { enabled: false, title: "Bihar Election Results", targetAt: "", link: "/elections", buttonLabel: "View Bihar results" },
    menuItems: [
      { label: "Home", href: "/", enabled: true },
      { label: "Bihar News", href: "/top-news", enabled: true },
      { label: "Bihar Government", href: "/category/bihar-government", enabled: true },
      { label: "Bihar Elections", href: "/elections", enabled: true },
      { label: "Bihar Leaders", href: "/key-political-figures", enabled: true, feature: "feature_leaders" },
      { label: "Bihar Parties", href: "/parties", enabled: true, feature: "feature_parties" },
      { label: "Bihar State", href: "/state", enabled: true, feature: "feature_states" },
      { label: "Blogs", href: "/blogs", enabled: true, feature: "feature_blogs" },
    ],
  },
  site_navigation: {
    more: [
      { label: "Bihar Rallies", href: "/rallies" },
      { label: "Bihar Speeches", href: "/speeches" },
      { label: "Careers", href: "/careers", feature: "feature_careers" },
    ],
    legal: [
      { label: "About", href: "/about", pageKey: "about" },
      { label: "Contact", href: "/contact", pageKey: "contact" },
      { label: "Policies", href: "/policies", feature: "feature_policies" },
    ],
  },
  site_footer: {
    sections: [
      {
        title: "Bihar Coverage",
        links: [
          { label: "Bihar News", href: "/top-news" },
          { label: "Bihar Elections", href: "/elections" },
          { label: "Bihar Leaders", href: "/key-political-figures", feature: "feature_leaders" },
          { label: "Bihar Parties", href: "/parties", feature: "feature_parties" },
        ],
      },
      {
        title: "About",
        links: [
          { label: "About Punjab Politics", href: "/about", pageKey: "about" },
          { label: "Contact", href: "/contact", pageKey: "contact" },
          { label: "Careers", href: "/careers", feature: "feature_careers" },
        ],
      },
    ],
    coverageTitle: "Bihar Coverage",
    coverageLinks: [
      { label: "Bihar News", href: "/top-news" },
      { label: "Bihar Elections", href: "/elections" },
      { label: "Bihar Speeches", href: "/speeches" },
      { label: "Bihar Rallies", href: "/rallies" },
    ],
    directoryTitle: "Explore Bihar by Keyword",
  },
  breaking_news: "Bihar government, Assembly, district and election updates - verified from primary sources",
  x_feed: [],
  facebook_updates: [],
  digital_pulse: [],
  election_results: [],
  popular_tags: ["Bihar", "Bihar Government", "Bihar Vidhan Sabha", "Bihar Elections", "Patna", "Bankipur", "Bihar Districts"],
  extra_keywords: ["Punjab Politics", "Bihar Assembly", "BJP Bihar", "JD(U)", "RJD", "Jan Suraaj", "Bihar Development", "Bihar Panchayat"],
  poll_of_the_day: {
    question: "Which Bihar issue should receive the most detailed public reporting?",
    options: [{ label: "Jobs and skills", pct: 50, votes: 0 }, { label: "District public services", pct: 50, votes: 0 }],
    totalVotes: 0,
  },
  the_briefing: [
    "Follow Bihar government decisions through official orders and department releases.",
    "Use Election Commission result pages for final constituency figures.",
    "Compare Bihar district outcomes using consistent dates and measures.",
  ],
  political_calendar: [],
  political_rallys: [],
  follow_us: [],
  legislative_tracker: [],
  rti_corner: [],
  voices_of_nation: [],
  fact_check: {
    claim: "Claim: Social-media result graphics are final election records.",
    verdict: "False",
    verdictClass: "bg-green-600 text-white",
    explanation: "Final Bihar constituency figures should be checked against the Election Commission of India result portal.",
  },
  political_keywords: {
    parties: ["BJP", "JD(U)", "RJD", "Jan Suraaj", "INC", "LJP(RV)", "HAM(S)", "CPI(ML)L"],
    states: ["Bihar"],
    categories: categories.map(([name]) => name),
  },
  party_pulse: {
    title: "Bihar Party Tracker",
    excerpt: "Profiles and updates for political parties active in Bihar.",
  },
  constituency_spotlight: {
    title: "Bankipur Assembly Constituency",
    excerpt: "Official ECI figures for the August 2026 by-election are included in the Bihar Elections coverage.",
  },
  from_the_archives: {
    title: "Bihar State Formation",
    note: "Bihar was formed as a separate province in 1912; statehood history remains central to Bihar's public life.",
  },
  page_profiles: {
    speeches: {
      description: "Speeches and statements by Bihar political leaders.",
      currentLabel: "Government", oppositionLabel: "Other Bihar voices",
      current: { name: "Bihar Government", role: "Official state statements" },
      opposition: { name: "Bihar political parties", role: "Attributed party statements" },
      bio: ["Coverage is limited to Bihar-related speeches and verified public statements."],
      facts: ["Bihar government statements", "Bihar Assembly speeches", "Bihar party addresses"],
    },
    rallies: {
      description: "Public meetings and rallies held in Bihar.",
      currentLabel: "Government alliance", oppositionLabel: "Other Bihar parties",
      current: { name: "Bihar NDA", role: "Bihar political meetings" },
      opposition: { name: "Bihar opposition parties", role: "Bihar political meetings" },
      bio: ["Rally coverage records the organizer, Bihar location, date and attributed claims."],
      facts: ["Bihar venues", "Attributed statements", "Verified schedules"],
    },
    elections: {
      description: "Election information for Bihar constituencies.",
      currentLabel: "Official results", oppositionLabel: "Candidate information",
      current: { name: "Election Commission of India", role: "Official Bihar election results" },
      opposition: { name: "Bihar candidates and parties", role: "Contest information" },
      bio: ["Result figures are taken from official Election Commission records."],
      facts: ["Bihar Assembly constituencies", "Vote totals and margins", "Official result sources"],
    },
  },
};

const hiddenSections = [
  "feature_videos", "multimedia_hub", "video_highlights", "press_conferences",
  "parliament", "parliament_strength", "pm_corner", "former_prime_ministers",
  "union_territories", "x_feed", "facebook_updates", "digital_dispatches",
  "voices_of_nation", "follow_us", "legislative_tracker", "election_results",
];

function withoutVideoLinks(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => {
        if (!item || typeof item !== "object") return true;
        return !String(item.href || "").toLowerCase().includes("video")
          && !String(item.label || "").toLowerCase().includes("video")
          && item.type !== "videos"
          && item.feature !== "feature_videos";
      })
      .map(withoutVideoLinks);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withoutVideoLinks(item)]));
  }
  return value;
}

async function seed() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query(
      `UPDATE sites
       SET primary_color = '#7a1f2b', secondary_color = '#9a6700',
           subtitle = 'Bihar Political News, Elections and Public Affairs',
           description = 'Bihar political news, state government updates, elections, districts and public affairs.'
       WHERE id = ?`,
      [SITE_ID]
    );

    const [[author]] = await connection.query(
      "SELECT id FROM users WHERE site_id = ? AND role = 'AUTHOR' ORDER BY id LIMIT 1",
      [SITE_ID]
    );
    const [[reviewer]] = await connection.query(
      "SELECT id FROM users WHERE site_id = ? AND role IN ('EDITOR','ADMIN','SUBADMIN') ORDER BY FIELD(role,'EDITOR','ADMIN','SUBADMIN'), id LIMIT 1",
      [SITE_ID]
    );
    if (!author || !reviewer) throw new Error("An AUTHOR and an EDITOR/ADMIN user are required to seed attributed content.");

    await connection.query("DELETE FROM site_reference_visibility WHERE site_id = ?", [SITE_ID]);
    for (const table of ["videos", "articles", "blogs", "politicians", "parties", "states", "categories"]) {
      await connection.query(`DELETE FROM ${table} WHERE site_id = ?`, [SITE_ID]);
    }

    for (const [name, slug] of categories) {
      await connection.query(
        "INSERT INTO categories (site_id, name, slug, is_visible, created_by, content) VALUES (?, ?, ?, 1, ?, ?)",
        [SITE_ID, name, slug, author.id, `${name} coverage focused only on Bihar.`]
      );
    }

    for (let index = 0; index < parties.length; index += 1) {
      const [slug, name, abbreviation, foundedYear, foundedPlace, history] = parties[index];
      await connection.query(
        `INSERT INTO parties
          (site_id, slug, name, abbreviation, founded_year, founded_place, history, current_status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active in Bihar politics', ?)`,
        [SITE_ID, slug, name, abbreviation, foundedYear, foundedPlace, history, index + 1]
      );
    }

    await connection.query(
      `INSERT INTO states
        (site_id, slug, name, capital, image_url, current_cm_name, kind, formed, history, achievements, sort_order)
       VALUES (?, 'bihar', 'Bihar', 'Patna', ?, 'Samrat Choudhary', 'STATE', '1912', ?, ?, 1)`,
      [SITE_ID, IMAGE, "Bihar was formed as a separate province in 1912.", "This record is restricted to Bihar state information."]
    );

    for (let index = 0; index < politicians.length; index += 1) {
      const person = politicians[index];
      await connection.query(
        `INSERT INTO politicians
          (site_id, slug, name, photo_url, party, state, category, current_position, still_in_office, summary, since_year, sort_order)
         VALUES (?, ?, ?, ?, ?, 'Bihar', ?, ?, ?, ?, ?, ?)`,
        [SITE_ID, person.slug, person.name, IMAGE, person.party, person.category, person.position, person.office, person.summary, person.since, index + 1]
      );
    }

    const publishedAt = new Date();
    for (let index = 0; index < articles.length; index += 1) {
      const item = articles[index];
      await connection.query(
        `INSERT INTO articles
          (author_id, site_id, title, slug, excerpt, content, featured_image, category, state, tags,
           status, ai_status, reviewer_id, submitted_at, reviewed_at, published_at, views)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Bihar', ?, 'APPROVED', 'PASSED', ?, ?, ?, ?, ?)`,
        [author.id, SITE_ID, item.title, item.slug, item.excerpt, item.content, IMAGE, item.category,
          JSON.stringify(item.tags), reviewer.id, publishedAt, publishedAt, publishedAt, item.views]
      );
    }

    for (let index = 0; index < blogs.length; index += 1) {
      const item = blogs[index];
      await connection.query(
        `INSERT INTO blogs
          (author_id, site_id, title, slug, excerpt, content, featured_image, category, tags,
           status, ai_status, reviewer_id, submitted_at, reviewed_at, published_at, views)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', 'PASSED', ?, ?, ?, ?, ?)`,
        [author.id, SITE_ID, item.title, item.slug, item.excerpt, item.content, IMAGE, item.category,
          JSON.stringify(item.tags), reviewer.id, publishedAt, publishedAt, publishedAt, item.views]
      );
    }

    await connection.query("DELETE FROM home_widgets WHERE site_id = ? AND widget_key IN ('parliament_data','pm_corner')", [SITE_ID]);
    for (const [key, data] of Object.entries(widgets)) {
      await connection.query(
        `INSERT INTO home_widgets (site_id, widget_key, data) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data)`,
        [SITE_ID, key, JSON.stringify(data)]
      );
    }

    const [configRows] = await connection.query(
      "SELECT widget_key, data FROM home_widgets WHERE site_id = ? AND widget_key IN ('site_header','site_navigation','site_footer','homepage_sections')",
      [SITE_ID]
    );
    for (const row of configRows) {
      const clean = withoutVideoLinks(typeof row.data === "string" ? JSON.parse(row.data) : row.data);
      await connection.query("UPDATE home_widgets SET data = ? WHERE site_id = ? AND widget_key = ?", [JSON.stringify(clean), SITE_ID, row.widget_key]);
    }

    await connection.query("UPDATE site_ui_sections SET is_visible = 1 WHERE site_id = ?", [SITE_ID]);
    await connection.query(
      `UPDATE site_ui_sections SET is_visible = 0 WHERE site_id = ? AND section_key IN (${hiddenSections.map(() => "?").join(",")})`,
      [SITE_ID, ...hiddenSections]
    );

    await connection.commit();
    console.log(`Bihar-only seed complete: ${articles.length} articles, ${blogs.length} blogs, ${politicians.length} leaders, ${parties.length} parties, 1 state, 0 videos.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

seed()
  .then(() => pool.end())
  .catch((error) => {
    console.error("Bihar-only seed failed:", error);
    pool.end().finally(() => process.exit(1));
  });
