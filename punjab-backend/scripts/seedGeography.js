// Seeds every Indian state and union territory used by category pages.
// Re-runnable: rows are updated by slug rather than duplicated.
const pool = require("../src/config/db");
const State = require("../src/models/state.model");

const slugify = (text) => text.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const PLACES = [
  ["Andhra Pradesh", "Amaravati", "STATE"], ["Arunachal Pradesh", "Itanagar", "STATE"],
  ["Assam", "Dispur", "STATE", "1950s (multiple states later carved from its territory)", "Assam was one of India's original states at independence, though its territory was later reduced as several northeastern states were created.", "Assam is India's leading tea-producing region, has significant oil reserves, and is a gateway to the Northeast."],
  ["Bihar", "Patna", "STATE", "1950 (Jharkhand carved out in 2000)", "One of India's original states at independence, Bihar was reshaped in 2000 when Jharkhand was created from its southern region.", "Bihar has a rich political history and remains central to caste-based coalition politics in national elections."],
  ["Chhattisgarh", "Raipur", "STATE"], ["Goa", "Panaji", "STATE"],
  ["Gujarat", "Gandhinagar", "STATE", "1960", "Gujarat was formed in 1960 when the bilingual Bombay State was divided into Gujarat and Maharashtra.", "The state has a strong industrial and port-led economy anchored by petrochemicals, textiles, and major ports."],
  ["Haryana", "Chandigarh", "STATE"], ["Himachal Pradesh", "Shimla", "STATE"], ["Jharkhand", "Ranchi", "STATE"],
  ["Karnataka", "Bangalore", "STATE", "1956 (as Mysore State, renamed Karnataka in 1973)", "Karnataka unified Kannada-speaking regions previously divided among provinces and princely states.", "Bengaluru's technology ecosystem has made Karnataka a leading contributor to India's software and startup economy."],
  ["Kerala", "Thiruvananthapuram", "STATE", "1956", "Kerala was formed under the States Reorganisation Act by uniting Malayalam-speaking regions.", "Kerala is known for high literacy and strong public-health outcomes."],
  ["Madhya Pradesh", "Bhopal", "STATE", "1956", "Madhya Pradesh was reorganized into its current form under the States Reorganisation Act.", "The state has significant mineral resources, a large tribal population, and major heritage and religious-tourism destinations."],
  ["Maharashtra", "Mumbai", "STATE", "1960", "Maharashtra was formed when the bilingual Bombay State was divided along linguistic lines.", "Home to Mumbai, Maharashtra has India's largest state economy and is a major finance, entertainment, and manufacturing centre."],
  ["Manipur", "Imphal", "STATE"], ["Meghalaya", "Shillong", "STATE"], ["Mizoram", "Aizawl", "STATE"], ["Nagaland", "Kohima", "STATE"], ["Odisha", "Bhubaneswar", "STATE"],
  ["Punjab", "Chandigarh", "STATE", "1966", "Punjab was reorganized in 1966 along linguistic lines, with Haryana and parts of Himachal Pradesh separated from it.", "Punjab was the heartland of India's Green Revolution and remains a major wheat and rice producer."],
  ["Rajasthan", "Jaipur", "STATE", "1956 (final reorganization; initially unified in 1949)", "Rajasthan emerged through the gradual integration of princely states and reached its present boundaries in 1956.", "India's largest state by area is a leader in renewable energy and a major international tourism destination."],
  ["Sikkim", "Gangtok", "STATE"],
  ["Tamil Nadu", "Chennai", "STATE", "1969 (Madras State renamed Tamil Nadu)", "Tamil Nadu's modern politics has been shaped by the Dravidian movement and its social-justice tradition.", "Tamil Nadu is a major automotive and manufacturing hub and performs strongly on human-development measures."],
  ["Telangana", "Hyderabad", "STATE", "2014", "Telangana was created from Andhra Pradesh in 2014 after a long statehood movement.", "Hyderabad's technology and pharmaceutical sectors anchor the state's services economy."],
  ["Tripura", "Agartala", "STATE"], ["Uttarakhand", "Dehradun", "STATE"],
  ["Uttar Pradesh", "Lucknow", "STATE", "1950", "Uttar Pradesh was formed from the United Provinces and sends India's largest state delegation to the Lok Sabha.", "The state is central to national electoral politics and has major agricultural, manufacturing, and religious-tourism economies."],
  ["West Bengal", "Kolkata", "STATE"],
  ["Andaman and Nicobar Islands", "Port Blair", "UNION_TERRITORY"], ["Chandigarh", "Chandigarh", "UNION_TERRITORY"],
  ["Dadra and Nagar Haveli and Daman & Diu", "Daman", "UNION_TERRITORY"], ["Delhi", "New Delhi", "UNION_TERRITORY"],
  ["Jammu & Kashmir", "Srinagar / Jammu", "UNION_TERRITORY"], ["Ladakh", "Leh", "UNION_TERRITORY"],
  ["Lakshadweep", "Kavaratti", "UNION_TERRITORY"], ["Puducherry", "Puducherry", "UNION_TERRITORY"],
];

async function seed() {
  await pool.query(`CREATE TABLE IF NOT EXISTS states (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, slug VARCHAR(160) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL UNIQUE, capital VARCHAR(160) NOT NULL,
    kind ENUM('STATE', 'UNION_TERRITORY') NOT NULL, formed VARCHAR(160),
    history TEXT, achievements TEXT, sort_order INT NOT NULL DEFAULT 0
  )`);

  for (const [sortOrder, place] of PLACES.entries()) {
    const [name, capital, kind, formed, history, achievements] = place;
    await State.upsert({ slug: slugify(name), name, capital, kind, formed, history, achievements, sortOrder });
  }
  console.log(`Seeded ${PLACES.length} states and union territories.`);
}

seed().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
