// The choices in the "My interests" survey. The keys are what is stored (and matched against new stories by the
// interest notifications), so do not rename a key once readers have answered; change the label instead.
const { REGIONS } = require("./regions");

const TOPICS = [
  { key: "elections", label: "Elections and results" },
  { key: "lok-sabha", label: "Lok Sabha" },
  { key: "rajya-sabha", label: "Rajya Sabha" },
  { key: "vidhan-sabha", label: "Vidhan Sabha" },
  { key: "parliament", label: "Parliament sessions" },
  { key: "parties", label: "Political parties" },
  { key: "politicians", label: "Politicians" },
  { key: "chief-ministers", label: "Chief ministers" },
  { key: "rallies", label: "Rallies" },
  { key: "speeches", label: "Speeches" },
  { key: "events", label: "Events and calendar" },
];

const CONTENT_TYPES = [
  { key: "articles", label: "Articles" },
  { key: "blogs", label: "Blogs" },
  { key: "videos", label: "Videos" },
  { key: "press-conferences", label: "Press conferences" },
];

const CHANNELS = [
  { key: "browser", label: "Browser notification" },
  { key: "email", label: "Email" },
  { key: "whatsapp", label: "WhatsApp" },
];

const FREQUENCIES = [
  { key: "breaking", label: "Only breaking updates" },
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
];

module.exports = { TOPICS, REGIONS, CONTENT_TYPES, CHANNELS, FREQUENCIES };
