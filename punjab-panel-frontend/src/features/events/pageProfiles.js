export const DEFAULT_PAGE_PROFILES = {
  speeches: {
    description: "From Independence Day addresses to budget speeches and floor replies during no-confidence debates, speeches are one of the most closely tracked forms of political communication in India.",
    currentLabel: "Most Referenced Speaker",
    oppositionLabel: "Principal Opposition Voice",
    current: { name: "Narendra Modi", role: "Prime Minister — national and international addresses" },
    opposition: { name: "Rahul Gandhi", role: "Leader of Opposition — Parliament floor speeches" },
    bio: [
      "Set-piece addresses such as the Independence Day speech, Union Budget speech, and President's address are closely examined for major policy announcements.",
      "Floor speeches during confidence motions and major bill debates give government and opposition leaders a formal platform to present their positions.",
    ],
    facts: ["Independence Day and Republic Day addresses", "Union Budget and Parliament floor speeches", "International forum addresses including the UN and G20"],
  },
  rallies: {
    description: "Public rallies are a central campaign tool across India, from large state gatherings to joint alliance events held before elections.",
    currentLabel: "Ruling Alliance Rallies",
    oppositionLabel: "Opposition Rallies",
    current: { name: "BJP-led NDA", role: "Ruling alliance campaign rallies" },
    opposition: { name: "INDIA Bloc", role: "Opposition alliance joint rallies" },
    bio: [
      "Large rallies are usually organized before state or national elections to mobilize supporters and communicate campaign priorities.",
      "Joint rallies allow alliance partners to share a stage and present a common political programme to voters.",
    ],
    facts: ["State rallies before assembly elections", "Joint alliance and opposition rallies", "Youth-wing and voter-awareness rallies"],
  },
  elections: {
    description: "Indian elections determine representation in the Lok Sabha and state assemblies through one of the world's largest democratic exercises.",
    currentLabel: "Ruling Coalition",
    oppositionLabel: "Opposition Alliance",
    current: { name: "National Democratic Alliance (NDA)", role: "Ruling coalition" },
    opposition: { name: "INDIA Bloc", role: "Opposition alliance" },
    bio: [
      "The Election Commission of India conducts elections to Parliament, state assemblies, and the offices of President and Vice President.",
      "Election schedules, candidate nominations, campaigning, polling, counting, and results are governed by constitutional and statutory rules.",
    ],
    facts: ["Lok Sabha and state assembly elections", "Election Commission oversight", "Polling, counting, turnout, and result coverage"],
  },
};
