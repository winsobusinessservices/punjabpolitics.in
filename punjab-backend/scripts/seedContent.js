// Seeds realistic, APPROVED sample content directly into the real
// articles/blogs/videos tables (attributed to existing AUTHOR users,
// approved by an existing EDITOR) — NOT a separate dummy table. This is
// purely to populate the homepage during development; in production this
// content arrives through the normal author -> submit -> editor-review flow.
// Every image below is a real photo of an actual Indian political/
// government subject, originally sourced from Wikimedia Commons — but
// downloaded once and self-hosted under uploads/seed/ rather than hotlinked.
// upload.wikimedia.org actively rate-limits (HTTP 429) repeated hotlinked
// requests from the same client, which real page traffic would trigger
// quickly; serving our own copy avoids that entirely, the same way author-
// uploaded featured images are served from uploads/article/ etc.
//
// Usage: node scripts/seedContent.js
const pool = require("../src/config/db");
const Article = require("../src/models/article.model");
const Blog = require("../src/models/blog.model");
const Video = require("../src/models/video.model");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const IMG = {
  parliament: "/uploads/seed/parliament.jpg",
  rashtrapatiBhavan: "/uploads/seed/rashtrapati_bhavan.jpg",
  supremeCourt: "/uploads/seed/supreme_court.jpg",
  evmElection: "/uploads/seed/evm_election.jpg",
  rallyCrowd: "/uploads/seed/rally_crowd.jpg",
  karnatakaAssembly: "/uploads/seed/karnataka_assembly.jpg",
  upAssembly: "/uploads/seed/up_assembly.jpg",
  wbAssembly: "/uploads/seed/wb_assembly.jpg",
  maharashtraAssembly: "/uploads/seed/maharashtra_assembly.jpg",
  redFort: "/uploads/seed/red_fort.jpg",
  indiaGate: "/uploads/seed/india_gate.jpg",
  rbi: "/uploads/seed/rbi.jpg",
  farmerProtest: "/uploads/seed/farmer_protest.jpg",
  pressConference: "/uploads/seed/press_conference.jpg",
  biharAssembly: "/uploads/seed/bihar_assembly.jpg",
  rajasthanAssembly: "/uploads/seed/rajasthan_assembly.jpg",
};

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const ARTICLES = [
  {
    category: "Politics", image: IMG.parliament, views: 850, days: 1,
    title: "Monsoon Session Begins Amid Sharp Exchanges Over Data Privacy Bill",
    excerpt: "The government tabled the long-pending amendments to the data protection framework as opposition members demanded a joint select committee review.",
    content: [
      "Parliament's Monsoon Session opened today with the government introducing amendments to the Digital Personal Data Protection framework, setting up what is expected to be a contentious few weeks in both Houses.",
      "The Law Minister told the Lok Sabha that the amendments respond to industry feedback on cross-border data transfer rules, while opposition members argued the changes were introduced without adequate consultation and pressed for referral to a joint select committee.",
      "Several regional parties indicated conditional support pending clarification on provisions related to state government data-sharing powers, a sticking point since the bill's first draft.",
      "The session is scheduled to run for four weeks, with the data protection amendments expected to come up for detailed debate in the second week.",
    ],
    tags: ["Parliament", "Data Privacy", "Monsoon Session", "Legislation"],
  },
  {
    category: "Elections", image: IMG.evmElection, views: 620, days: 2,
    title: "Election Commission Announces Poll Dates for Three State Assemblies",
    excerpt: "Voting will be held in a single phase in two states and two phases in the third, with counting scheduled for the same day across all three.",
    content: [
      "The Election Commission of India today announced the schedule for assembly elections in three states, with the model code of conduct coming into effect immediately.",
      "Chief Election Commissioner briefed reporters on the phased voting plan, citing security deployment and weather considerations for the staggered schedule in the largest of the three states.",
      "Political parties have begun finalizing candidate lists, with several sitting legislators already confirmed for re-nomination in early announcements from state units.",
      "Counting of votes across all three states will take place on the same day, with results expected to shape the arithmetic ahead of the next Rajya Sabha biennial elections.",
    ],
    tags: ["Elections", "Election Commission", "Assembly Election", "Polls"],
  },
  {
    category: "Judiciary", image: IMG.supremeCourt, views: 540, days: 3,
    title: "Supreme Court Reserves Verdict on Electoral Bonds Transparency Case",
    excerpt: "A five-judge bench heard final arguments on petitions seeking full public disclosure of historical donor records under the now-scrapped scheme.",
    content: [
      "A five-judge Constitution Bench of the Supreme Court reserved its verdict today after hearing final arguments in petitions seeking complete disclosure of donor records under the electoral bonds scheme.",
      "Petitioners argued that partial disclosures already ordered by the court left significant gaps in the public record, while the government's counsel maintained that all legally mandated disclosures had been made in full.",
      "The bench is expected to rule on whether the State Bank of India must release additional transaction-level metadata that petitioners say is necessary to match specific donations to specific companies.",
      "Legal observers say the verdict, whenever it comes, is likely to shape the campaign finance debate ahead of the next general election cycle.",
    ],
    tags: ["Judiciary", "Supreme Court", "Electoral Bonds", "Campaign Finance"],
  },
  {
    category: "Economy", image: IMG.rbi, views: 430, days: 1,
    title: "RBI Holds Repo Rate Steady, Flags Inflation Risk from Global Crude Prices",
    excerpt: "The Monetary Policy Committee voted 5-1 to keep rates unchanged, citing upside risks to inflation from volatile international oil prices.",
    content: [
      "The Reserve Bank of India's Monetary Policy Committee voted 5-1 to keep the repo rate unchanged, with the Governor citing continued upside risk to inflation from volatile global crude oil prices.",
      "In the post-policy briefing, the Governor said the committee would remain watchful of both food price pressures ahead of the festive season and imported inflation risk, striking a cautious tone despite easing core inflation.",
      "Bank stocks were largely flat in early trade following the announcement, with analysts noting the decision was in line with consensus expectations.",
      "The next policy review is scheduled for the following quarter, with markets now watching incoming inflation data for signals on the rate path.",
    ],
    tags: ["Economy", "RBI", "Monetary Policy", "Inflation"],
  },
  {
    category: "Rally", image: IMG.rallyCrowd, views: 910, days: 2, state: "Uttar Pradesh",
    title: "PM Modi Addresses Mega Rally Ahead of Assembly Elections in Uttar Pradesh",
    excerpt: "The Prime Minister listed the government's infrastructure record in the state and urged first-time voters to turn out in large numbers.",
    content: [
      "Prime Minister Narendra Modi addressed a large public rally today, listing the government's infrastructure and welfare scheme record in the state ahead of the upcoming assembly elections.",
      "The Prime Minister's address focused heavily on connectivity projects and direct benefit transfers, framing the state election as a referendum on development delivery over the past term.",
      "State party units used the rally to formally launch their door-to-door campaign push, with local leaders sharing the stage alongside national leadership for the first time this election cycle.",
      "Opposition parties dismissed the event as an announcement-heavy exercise, pointing to unresolved local issues around unemployment and law and order.",
    ],
    tags: ["Rally", "Uttar Pradesh", "Assembly Election", "BJP"],
  },
  {
    category: "Agriculture", image: IMG.farmerProtest, views: 780, days: 4,
    title: "Farmer Unions Resume Protest at Delhi Borders Over MSP Guarantee Law",
    excerpt: "Thousands of farmers gathered again at key border points, renewing their demand for a legally binding minimum support price framework.",
    content: [
      "Farmer unions resumed their protest at key Delhi border points today, renewing their long-standing demand for a legally guaranteed minimum support price covering all major crops.",
      "Union leaders said talks with the Agriculture Ministry had stalled over the scope of crops to be covered, and accused the government of offering only incremental procurement expansions rather than a binding legal framework.",
      "Traffic disruptions were reported on key highways connecting the capital to neighboring states, prompting local authorities to issue advisories for commuters.",
      "The government has indicated it remains open to further talks, though no fresh date has been set as of this report.",
    ],
    tags: ["Agriculture", "MSP", "Farmer Unions", "Protest"],
  },
  {
    category: "Speech", image: IMG.redFort, views: 360, days: 6,
    title: "President's Address Opens Budget Session, Outlines Reform Agenda",
    excerpt: "The President's customary address to both Houses previewed the government's legislative priorities for the coming fiscal year.",
    content: [
      "The President's address to a joint sitting of both Houses of Parliament formally opened the Budget Session today, outlining the government's legislative and policy priorities for the coming fiscal year.",
      "The address touched on infrastructure spending, manufacturing incentives, and continuity of welfare scheme funding, drawing a mostly procedural response from opposition benches who reserved substantive criticism for the subsequent debate.",
      "As is customary, the motion of thanks on the President's address will be debated in both Houses over the coming days, giving parties across the spectrum their first extended floor time of the session.",
    ],
    tags: ["Speech", "Budget Session", "Parliament"],
  },
  {
    category: "Regional", image: IMG.karnatakaAssembly, views: 290, days: 5, state: "Karnataka",
    title: "Karnataka Assembly Passes Bill on Land Reform Amendments",
    excerpt: "The amendment eases restrictions on agricultural land purchase by non-farmers, a change the government says will boost rural investment.",
    content: [
      "The Karnataka Legislative Assembly passed amendments to the state's land reform law today, easing restrictions on the purchase of agricultural land by non-farmers.",
      "The state government argued the changes would unlock rural investment and simplify long-pending land conversion cases, while opposition members warned of potential speculative buying pressure on farmland near expanding urban centers.",
      "The bill now moves to the Legislative Council, where the ruling coalition holds a narrower majority than in the Assembly.",
    ],
    tags: ["Karnataka", "Land Reform", "State Legislature"],
  },
  {
    category: "Regional", image: IMG.upAssembly, views: 310, days: 3, state: "Uttar Pradesh",
    title: "Uttar Pradesh Cabinet Clears ₹12,000 Crore Infrastructure Package",
    excerpt: "The package covers highway expansion, industrial corridor development, and urban water supply upgrades across the state.",
    content: [
      "The Uttar Pradesh cabinet cleared a ₹12,000 crore infrastructure package today, covering highway expansion, industrial corridor development, and urban water supply upgrades across several districts.",
      "The state's Finance Minister said the package would be funded through a mix of state resources and central scheme allocations, with implementation to be phased over the next three fiscal years.",
      "Opposition legislators in the state questioned the timeline given the state's existing debt servicing commitments, seeking a detailed district-wise breakdown before the next assembly session.",
    ],
    tags: ["Uttar Pradesh", "Infrastructure", "State Cabinet"],
  },
  {
    category: "Regional", image: IMG.wbAssembly, views: 275, days: 7, state: "West Bengal",
    title: "West Bengal Assembly Witnesses Uproar Over Central Fund Allocation",
    excerpt: "Treasury and opposition benches clashed over pending scheme funds, disrupting proceedings for a second consecutive day.",
    content: [
      "Proceedings in the West Bengal Legislative Assembly were disrupted for a second consecutive day today as treasury and opposition benches clashed over the release of pending central scheme funds.",
      "The state government tabled figures it said showed a significant shortfall in central disbursals against approved allocations, a claim the opposition disputed citing separate central government data.",
      "The Speaker adjourned the House twice amid the disruption, with both sides agreeing to a special discussion slot on the fund dispute later in the week.",
    ],
    tags: ["West Bengal", "Centre-State Relations", "State Legislature"],
  },
  {
    category: "Regional", image: IMG.maharashtraAssembly, views: 245, days: 8, state: "Maharashtra",
    title: "Maharashtra Government Unveils New Industrial Policy for Vidarbha Region",
    excerpt: "The policy offers tax incentives and expedited clearances aimed at correcting the state's long-standing regional development imbalance.",
    content: [
      "The Maharashtra government unveiled a new industrial policy today specifically targeting the Vidarbha region, offering tax incentives and expedited environmental clearances for new manufacturing units.",
      "The Industries Minister said the policy was designed to correct a long-standing regional imbalance in industrial investment, which has historically concentrated around Mumbai and Pune.",
      "Industry bodies welcomed the announcement but flagged power infrastructure and logistics connectivity in the region as the real test of whether the incentives translate into actual investment.",
    ],
    tags: ["Maharashtra", "Industrial Policy", "Regional Development"],
  },
  {
    category: "Regional", image: IMG.biharAssembly, views: 225, days: 9, state: "Bihar",
    title: "Bihar Assembly Debates Caste Census Implementation Roadmap",
    excerpt: "Members across party lines pressed the state government for a firm timeline on translating survey findings into policy action.",
    content: [
      "The Bihar Legislative Assembly held an extended debate today on the implementation roadmap for translating the state's caste census findings into concrete welfare and reservation policy.",
      "Members across party lines, including from within the ruling coalition, pressed the government for a firm timeline, with several citing delays since the survey's findings were first made public.",
      "The Chief Minister's office said a cabinet sub-committee would submit implementation recommendations within the current quarter.",
    ],
    tags: ["Bihar", "Caste Census", "State Legislature"],
  },
  {
    category: "Foreign Affairs", image: IMG.indiaGate, views: 410, days: 2,
    title: "India, EU Resume Free Trade Agreement Talks After Two-Year Pause",
    excerpt: "Negotiators from both sides said the resumed talks would focus first on tariff schedules for automobiles and dairy products.",
    content: [
      "India and the European Union resumed free trade agreement negotiations today after a two-year pause, with both sides describing the restart as a priority ahead of the next round of ministerial talks.",
      "Officials said the immediate focus would be on tariff schedules for automobiles and dairy products, historically among the most contentious items in the negotiation.",
      "A joint statement from both sides set a target of concluding a substantial part of the agreement within the next two negotiating rounds, though officials cautioned that timeline has slipped before.",
    ],
    tags: ["Foreign Affairs", "European Union", "Trade Agreement"],
  },
  {
    category: "Governance", image: IMG.rashtrapatiBhavan, views: 195, days: 10,
    title: "President Confers Padma Awards in Ceremony at Rashtrapati Bhavan",
    excerpt: "This year's list includes recipients from public service, science, and the arts, selected through the usual multi-tier screening process.",
    content: [
      "The President conferred this year's Padma Awards in a ceremony at Rashtrapati Bhavan today, honoring recipients from public service, science, sports, and the arts.",
      "The awards, among the country's highest civilian honors, are selected through a multi-tier screening process involving state governments, central ministries, and an awards committee.",
      "Several recipients this year were recognized posthumously for long-term contributions to public health and rural education, categories the selection committee said received particular emphasis in this cycle.",
    ],
    tags: ["Governance", "Padma Awards", "Rashtrapati Bhavan"],
  },
  {
    category: "Press Briefing", image: IMG.pressConference, views: 160, days: 11,
    title: "Home Ministry Briefs Media on Revised Border Security Protocols",
    excerpt: "Officials outlined upgraded surveillance measures along key stretches of the international border following a security review.",
    content: [
      "The Home Ministry briefed reporters today on revised border security protocols following a routine internal security review, outlining upgraded surveillance measures along key stretches of the international border.",
      "Officials said the changes include expanded use of sensor-based monitoring and closer coordination with state police forces in border districts, without disclosing specific troop deployment numbers citing operational security.",
      "The briefing comes ahead of the winter session, where border security is expected to feature in both scheduled discussions and question hour.",
    ],
    tags: ["Home Ministry", "Border Security", "Press Briefing"],
  },
  {
    category: "Politics", image: IMG.parliament, views: 505, days: 1,
    title: "Opposition Moves Adjournment Motion Over Unemployment Data Row",
    excerpt: "Opposition parties disputed the government's latest labor force survey figures, seeking an immediate floor debate.",
    content: [
      "Opposition parties moved an adjournment motion in the Lok Sabha today, disputing the government's latest labor force survey figures and demanding an immediate floor debate on unemployment.",
      "The Labour Minister rejected the criticism, citing methodology differences with independent estimates cited by the opposition, and offered a scheduled short-duration discussion instead of an adjournment motion.",
      "The Speaker's office said a decision on admitting the motion would be taken after consultations with floor leaders, a routine procedural step for such motions.",
    ],
    tags: ["Parliament", "Unemployment", "Opposition"],
  },
];

const BLOGS = [
  {
    category: "Explainer", image: IMG.evmElection, views: 320, days: 2,
    title: "How EVMs Actually Work: A Plain-English Guide to India's Voting Machines",
    excerpt: "A walkthrough of the ballot unit, control unit, and VVPAT system — and the safeguards built into each stage of the process.",
    content: [
      "Electronic Voting Machines used in Indian elections consist of three linked components: a ballot unit where the voter casts their vote, a control unit operated by polling staff, and a VVPAT unit that prints a paper slip for the voter to visually verify.",
      "Each machine is manufactured by one of two public sector undertakings and undergoes a multi-stage checking process before, during, and after polling, including a mandatory mock poll in the presence of candidate agents.",
      "The VVPAT slips from a randomly selected set of polling stations in every assembly constituency are matched against the electronic count as a standard cross-verification step.",
      "Despite the layered safeguards, EVMs remain a recurring subject of political dispute, with periodic calls from various parties for a return to paper ballots or a full VVPAT count.",
    ],
    tags: ["Elections", "EVM", "Explainer"],
  },
  {
    category: "Opinion", image: IMG.parliament, views: 210, days: 4,
    title: "Why Parliamentary Question Hour Matters More Than It Gets Credit For",
    excerpt: "Beyond the theatrics, Question Hour remains one of the few mechanisms that forces ministries to put numbers on the record.",
    content: [
      "Question Hour is often reduced in coverage to its most disruptive moments, but the mechanism remains one of the few regular tools that forces ministries to place specific figures and commitments on the parliamentary record.",
      "Starred questions, answered orally with a follow-up supplementary, tend to get the most attention, but the far larger volume of unstarred written questions quietly produces a substantial public data trail across ministries every session.",
      "Disruption-driven washouts of Question Hour, increasingly common in recent sessions, mean this accountability function is exercised far less than the rules intend — a cost that rarely gets weighed against the disruption itself.",
    ],
    tags: ["Opinion", "Parliament", "Question Hour"],
  },
  {
    category: "Deep Dive", image: IMG.supremeCourt, views: 275, days: 6,
    title: "Basic Structure Doctrine at 50: How One Verdict Still Shapes Indian Democracy",
    excerpt: "The 1973 ruling that Parliament cannot amend the Constitution's 'basic structure' remains the bedrock of Indian judicial review.",
    content: [
      "Five decades on, the basic structure doctrine articulated by the Supreme Court continues to be the single most consequential limit on Parliament's constitutional amending power.",
      "The doctrine holds that while Parliament can amend virtually any part of the Constitution, it cannot alter what courts have identified as the document's foundational architecture — including judicial review itself, federalism, and free and fair elections.",
      "Critics have long argued the doctrine hands unelected judges an outsized role in defining the Constitution's core; defenders counter that it is precisely what has prevented more dramatic swings in India's constitutional order over the decades.",
      "The doctrine has been invoked, directly or indirectly, in nearly every major constitutional challenge since — from electoral reform cases to disputes over judicial appointments.",
    ],
    tags: ["Judiciary", "Constitution", "Deep Dive"],
  },
  {
    category: "Analysis", image: IMG.rallyCrowd, views: 190, days: 5,
    title: "Reading the Rally Circuit: What Crowd Size Actually Predicts",
    excerpt: "Large turnouts make for good visuals, but the correlation between rally attendance and vote share is weaker than campaigns like to claim.",
    content: [
      "Every election season produces competing claims about rally crowd sizes, each side reading them as evidence of momentum. The actual correlation between turnout at a rally and eventual vote share, however, is far weaker than campaigns suggest.",
      "Logistics — free transport, local holidays, and venue capacity — explain a meaningful share of variance in attendance, independent of genuine political enthusiasm.",
      "What rallies do reliably signal is organizational capacity: a party's ability to mobilize local cadre is a real and measurable asset, even if the crowd itself isn't a clean proxy for votes.",
    ],
    tags: ["Analysis", "Elections", "Campaign Strategy"],
  },
  {
    category: "Explainer", image: IMG.rbi, views: 245, days: 3,
    title: "Repo Rate, Explained: Why One RBI Number Moves Your Loan EMI",
    excerpt: "The repo rate is the interest rate at which the RBI lends to commercial banks — and it ripples through the entire lending market.",
    content: [
      "The repo rate is the rate at which the Reserve Bank of India lends short-term funds to commercial banks. When it changes, banks typically adjust their own lending rates in the same direction, affecting everything from home loan EMIs to corporate borrowing costs.",
      "The Monetary Policy Committee reviews the rate roughly every two months, weighing inflation trends against the need to support economic growth.",
      "A rate hike is meant to cool inflation by making borrowing more expensive; a cut is meant to stimulate spending and investment by making it cheaper — though transmission to actual bank lending rates is rarely immediate or complete.",
    ],
    tags: ["Economy", "RBI", "Explainer"],
  },
  {
    category: "Opinion", image: IMG.farmerProtest, views: 165, days: 8,
    title: "The MSP Debate Isn't Going Away, and Here's the Economics Behind It",
    excerpt: "A legal MSP guarantee is popular, contested, and fiscally complicated all at once — and the underlying tension is unlikely to resolve soon.",
    content: [
      "The demand for a legally guaranteed minimum support price sits at the intersection of farmer income security and fiscal sustainability, and that tension is unlikely to resolve through any single policy announcement.",
      "Economists broadly agree that extending a legal MSP guarantee across all crops would require procurement capacity far beyond what currently exists for wheat and rice, the two crops where MSP procurement is already substantial.",
      "Farm unions counter that partial, discretionary procurement leaves growers of other crops exposed to price crashes that a legal floor would prevent — a genuine gap in the current system that any long-term resolution will have to address.",
    ],
    tags: ["Agriculture", "MSP", "Opinion"],
  },
];

const VIDEOS = [
  {
    category: "Live Coverage", image: IMG.parliament, views: 1200, days: 1,
    title: "Live: Monsoon Session Highlights from Both Houses of Parliament",
    description: "A recap of the day's key exchanges from the Lok Sabha and Rajya Sabha as the Monsoon Session opened.",
  },
  {
    category: "Interview", image: IMG.rashtrapatiBhavan, views: 640, days: 5,
    title: "Exclusive: In Conversation with the Union Finance Minister",
    description: "The Finance Minister discusses inflation management, the fiscal deficit target, and upcoming tax reforms.",
  },
  {
    category: "Press Briefing", image: IMG.pressConference, views: 380, days: 11,
    title: "Full Briefing: Home Ministry on Border Security Protocols",
    description: "The complete media briefing on revised surveillance and coordination measures along the international border.",
  },
  {
    category: "Highlights", image: IMG.rallyCrowd, views: 910, days: 2,
    title: "Key Moments from the Uttar Pradesh Mega Rally",
    description: "Highlights from the Prime Minister's address ahead of the state assembly elections.",
  },
  {
    category: "Field Report", image: IMG.farmerProtest, views: 505, days: 4,
    title: "Ground Report: Inside the Renewed Farmers' Protest at Delhi Borders",
    description: "A field report from the protest sites, with reactions from union leaders and commuters affected by the disruption.",
  },
  {
    category: "Press Briefing", image: IMG.evmElection, views: 300, days: 2,
    title: "Election Commission's Poll Preparedness Media Briefing",
    description: "The Election Commission briefs media on logistics and security preparedness ahead of the announced polls.",
  },
  {
    category: "Press Briefing", image: IMG.rbi, views: 465, days: 3,
    title: "RBI Governor Briefs Media on Monetary Policy Committee Decision",
    description: "The central bank's press briefing following the latest repo rate decision, with the Governor addressing the inflation outlook and liquidity measures.",
  },
  {
    category: "Press Briefing", image: IMG.supremeCourt, views: 340, days: 6,
    title: "Supreme Court Registry Briefing on Case-Listing Reforms",
    description: "A media briefing on new case-management and listing procedures aimed at reducing pendency in the apex court.",
  },
  {
    category: "Press Briefing", image: IMG.rajasthanAssembly, views: 210, days: 8,
    title: "Rajasthan Assembly Speaker's Briefing Ahead of the Budget Session",
    description: "The Speaker's office briefs reporters on the agenda and scheduled bills for the upcoming budget session.",
  },
  {
    category: "Press Briefing", image: IMG.parliament, views: 395, days: 9,
    title: "Winter Session Curtain-Raiser: Parliamentary Affairs Ministry Briefing",
    description: "The government's pre-session briefing outlining the legislative agenda for the Winter Session.",
  },
];

async function pickUsers() {
  const [authors] = await pool.query("SELECT id FROM users WHERE role = 'AUTHOR' ORDER BY id LIMIT 2");
  if (!authors.length) {
    throw new Error("Need at least one AUTHOR user in the database to attribute seeded content to.");
  }
  let [[editor]] = await pool.query("SELECT id FROM users WHERE role = 'EDITOR' ORDER BY id LIMIT 1");
  if (!editor) {
    const email = "seed-reviewer@punjabpolitics.local";
    [[editor]] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (!editor) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);
      const [result] = await pool.query(
        `INSERT INTO users
          (name, email, password_hash, role, status, email_verified, terms_accepted, terms_accepted_at, site_id)
         VALUES ('Content Seed Reviewer', ?, ?, 'EDITOR', 'INACTIVE', 1, 1, CURRENT_TIMESTAMP, 1)`,
        [email, passwordHash]
      );
      editor = { id: result.insertId };
      console.log("Created an inactive attribution-only editor for development seed content.");
    }
  }
  return { authorIds: authors.map((a) => a.id), reviewerId: editor.id };
}

async function approve(table, id, reviewerId, views, publishedAt) {
  await pool.query(
    `UPDATE ${table} SET status = 'APPROVED', ai_status = 'PASSED', reviewer_id = ?, submitted_at = ?, reviewed_at = ?, published_at = ?, views = ? WHERE id = ?`,
    [reviewerId, publishedAt, publishedAt, publishedAt, views, id]
  );
}

async function seed() {
  const { authorIds, reviewerId } = await pickUsers();
  let authorCursor = 0;
  const nextAuthor = () => authorIds[authorCursor++ % authorIds.length];

  // Skip seeding articles if a healthy number of APPROVED ones already
  // exist (e.g. from the WordPress import) — this set exists to fill the
  // gap on tables with none, not to duplicate real content already there.
  const [[{ approvedArticles }]] = await pool.query("SELECT COUNT(*) AS approvedArticles FROM articles WHERE status = 'APPROVED'");
  if (approvedArticles >= 10) {
    console.log(`Skipping article seed — ${approvedArticles} APPROVED articles already exist.`);
  } else {
    for (const item of ARTICLES) {
      const created = await Article.create({
        authorId: nextAuthor(),
        title: item.title,
        excerpt: item.excerpt,
        content: item.content.join("\n\n"),
        featuredImage: item.image,
        category: item.category,
        state: item.state ?? null,
        tags: item.tags,
      });
      await approve("articles", created.id, reviewerId, item.views, daysAgo(item.days));
    }
    console.log(`Seeded ${ARTICLES.length} approved articles.`);
  }

  for (const item of BLOGS) {
    const created = await Blog.create({
      authorId: nextAuthor(),
      title: item.title,
      excerpt: item.excerpt,
      content: item.content.join("\n\n"),
      featuredImage: item.image,
      category: item.category,
      tags: item.tags,
    });
    await approve("blogs", created.id, reviewerId, item.views, daysAgo(item.days));
  }
  console.log(`Seeded ${BLOGS.length} approved blogs.`);

  // Per-title skip (rather than articles' coarse "skip if >= N exist"
  // check above) so re-running this script to add new entries — as opposed
  // to seeding from scratch — doesn't duplicate the ones already inserted.
  const [existingVideoRows] = await pool.query("SELECT title FROM videos");
  const existingVideoTitles = new Set(existingVideoRows.map((r) => r.title));
  let videosSeeded = 0;
  for (const item of VIDEOS) {
    if (existingVideoTitles.has(item.title)) continue;
    const created = await Video.create({
      authorId: nextAuthor(),
      title: item.title,
      description: item.description,
      videoSource: "EXTERNAL",
      // No real video file/stream exists for this seed content — the
      // player URL isn't surfaced anywhere in the current UI (VideoCard has
      // no link), so this points at the same real, verified image used as
      // the thumbnail rather than a fabricated video link.
      videoUrl: item.image,
      thumbnail: item.image,
      category: item.category,
    });
    await approve("videos", created.id, reviewerId, item.views, daysAgo(item.days));
    videosSeeded++;
  }
  console.log(`Seeded ${videosSeeded} approved videos (${VIDEOS.length - videosSeeded} already existed).`);
}

seed()
  .then(() => {
    console.log("Content seed complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Content seed failed:", err);
    process.exit(1);
  });
