// Seeds public reference-page content into home_widgets. The frontend reads
// these records through the API and does not carry a second hardcoded copy.
const HomeWidget = require("../src/models/homeWidget.model");

const parliament = {
  loksabha: {
    key: "loksabha", href: "/loksabha", label: "Lok Sabha", fullName: "House of the People",
    totalSeats: 543, formed: "1952 (first Lok Sabha constituted)", currentTerm: "18th Lok Sabha",
    presidingOfficer: { name: "Om Birla", role: "Speaker, Lok Sabha", party: "BJP" },
    deputyPresidingOfficer: { name: "Vacant", role: "Deputy Speaker" },
    leaderOfHouse: { name: "Narendra Modi", role: "Prime Minister and Leader of the House", party: "BJP" },
    leaderOfOpposition: { name: "Rahul Gandhi", role: "Leader of Opposition, Lok Sabha", party: "INC" },
    composition: [
      { party: "BJP", seats: 240, colorClass: "bg-primary" }, { party: "INC", seats: 99, colorClass: "bg-secondary" },
      { party: "SP", seats: 37, colorClass: "bg-surface-tint" }, { party: "TMC", seats: 29, colorClass: "bg-error" },
      { party: "DMK", seats: 22, colorClass: "bg-green-600" }, { party: "JD(U)", seats: 12, colorClass: "bg-amber-500" },
      { party: "Shiv Sena", seats: 7, colorClass: "bg-orange-500" }, { party: "Others / Independents", seats: 97, colorClass: "bg-outline-variant" },
    ],
    history: "The Lok Sabha is the directly elected lower house of India's Parliament, with members representing territorial constituencies across states and union territories.",
    achievements: "The government is formed by the party or coalition that commands a majority in the House, making the Lok Sabha decisive for confidence votes, Money Bills, and most major legislation.",
    relatedSlugs: [],
  },
  rajyasabha: {
    key: "rajyasabha", href: "/rajyasabha", label: "Rajya Sabha", fullName: "Council of States",
    totalSeats: 245, formed: "1952 (first constituted)", currentTerm: "Permanent house; one-third of members retire every two years",
    presidingOfficer: { name: "Vice President of India", role: "Chairman, Rajya Sabha", party: "Non-partisan" },
    deputyPresidingOfficer: { name: "Harivansh Narayan Singh", role: "Deputy Chairman", party: "JD(U)" },
    leaderOfHouse: { name: "J. P. Nadda", role: "Leader of the House, Rajya Sabha", party: "BJP" },
    leaderOfOpposition: { name: "Mallikarjun Kharge", role: "Leader of Opposition, Rajya Sabha", party: "INC" },
    composition: [
      { party: "BJP", seats: 96, colorClass: "bg-primary" }, { party: "INC", seats: 27, colorClass: "bg-secondary" },
      { party: "TMC", seats: 13, colorClass: "bg-error" }, { party: "DMK", seats: 10, colorClass: "bg-green-600" },
      { party: "AAP", seats: 10, colorClass: "bg-amber-500" }, { party: "BJD", seats: 7, colorClass: "bg-orange-500" },
      { party: "Nominated", seats: 6, colorClass: "bg-outline" }, { party: "Others / Independents", seats: 76, colorClass: "bg-outline-variant" },
    ],
    history: "The Rajya Sabha is Parliament's permanent upper house, representing the states and providing legislative continuity because it is never fully dissolved.",
    achievements: "As a revising chamber, the Rajya Sabha scrutinizes legislation and can refer bills to committees for deeper examination.",
    relatedSlugs: [],
  },
};

const pageProfiles = {
  speeches: {
    description: "Political speeches include national addresses, budget speeches, and floor replies during major parliamentary debates.",
    currentLabel: "Government Voice", oppositionLabel: "Opposition Voice",
    current: { name: "Narendra Modi", role: "Prime Minister; national and international addresses" },
    opposition: { name: "Rahul Gandhi", role: "Leader of Opposition; Parliament floor speeches" },
    bio: ["Major speeches are tracked for policy announcements and changes in political priorities.", "Floor speeches give government and opposition leaders a formal platform to present their positions."],
    facts: ["National addresses", "Parliament floor speeches", "International forum addresses"],
  },
  rallies: {
    description: "Public rallies are a central campaign and public-engagement tool for political parties and alliances.",
    currentLabel: "Ruling Alliance Rallies", oppositionLabel: "Opposition Rallies",
    current: { name: "BJP-led NDA", role: "Ruling alliance campaign rallies" },
    opposition: { name: "INDIA Bloc", role: "Opposition alliance joint rallies" },
    bio: ["Political rallies communicate campaign priorities and mobilize supporters before elections.", "Joint rallies allow alliance partners to present a shared programme to voters."],
    facts: ["Assembly-election rallies", "Joint alliance rallies", "Voter-awareness rallies"],
  },
  elections: {
    description: "Indian elections determine representation in the Lok Sabha and state assemblies through a democratic exercise overseen by the Election Commission of India.",
    currentLabel: "Ruling Coalition", oppositionLabel: "Opposition Alliance",
    current: { name: "National Democratic Alliance (NDA)", role: "Ruling coalition" },
    opposition: { name: "INDIA Bloc", role: "Opposition alliance" },
    bio: ["The Election Commission of India conducts elections to Parliament, state assemblies, and the offices of President and Vice President.", "Election schedules, nominations, campaigning, polling, counting, and results are governed by constitutional and statutory rules."],
    facts: ["Lok Sabha and state assembly elections", "Election Commission oversight", "Polling, counting, turnout, and results"],
  },
};

async function seed() {
  await HomeWidget.upsert("parliament_data", parliament);
  await HomeWidget.upsert("page_profiles", pageProfiles);
  console.log("Seeded Parliament and public page profiles into home_widgets.");
}

seed().then(() => process.exit(0)).catch((error) => {
  console.error("Reference data seed failed:", error);
  process.exit(1);
});
