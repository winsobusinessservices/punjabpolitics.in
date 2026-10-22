// Seeds real, fact-checked (WebSearch-verified, August 2026) biographical
// data for Indian political figures and parties. Read-only reference
// content the site curates — not author-submitted, so no workflow.
//
// Photo paths are filled in by scripts/attachPoliticianPhotos.js after this
// runs (photos are sourced from Wikimedia Commons separately and self-hosted
// under uploads/seed/{politicians,parties}/ — same reasoning as
// seedContent.js: avoids upload.wikimedia.org's hotlink rate limit).
//
// Usage: node scripts/seedPoliticians.js
const pool = require("../src/config/db");
const Politician = require("../src/models/politician.model");
const Party = require("../src/models/party.model");

function slugify(text) {
  return text.toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Real Wikimedia Commons photos, downloaded once and self-hosted under
// uploads/seed/ (see seedContent.js's header comment — upload.wikimedia.org
// rate-limits repeated hotlinked requests, so we serve our own copy). A
// handful of very recently elevated figures (e.g. Tamil Nadu's new CM,
// sworn in May 2026) have no free-licensed Commons photo yet — left null,
// which the frontend Avatar component handles by falling back to initials.
const POLITICIAN_PHOTOS = {
  "narendra-modi": "/uploads/seed/politicians/narendra-modi.jpg",
  "rahul-gandhi": "/uploads/seed/politicians/rahul-gandhi.jpg",
  "amit-shah": "/uploads/seed/politicians/amit-shah.jpg",
  "rajnath-singh": "/uploads/seed/politicians/rajnath-singh.jpg",
  "nirmala-sitharaman": "/uploads/seed/politicians/nirmala-sitharaman.jpg",
  "s-jaishankar": "/uploads/seed/politicians/s-jaishankar.jpg",
  "om-birla": "/uploads/seed/politicians/om-birla.jpg",
  "cp-radhakrishnan": "/uploads/seed/politicians/cp-radhakrishnan.jpg",
  "droupadi-murmu": "/uploads/seed/politicians/droupadi-murmu.jpg",
  "piyush-goyal": "/uploads/seed/politicians/piyush-goyal.jpg",
  "manmohan-singh": "/uploads/seed/politicians/manmohan-singh.jpg",
  "atal-bihari-vajpayee": "/uploads/seed/politicians/atal-bihari-vajpayee.jpg",
  "ik-gujral": "/uploads/seed/politicians/ik-gujral.jpg",
  "hd-deve-gowda": "/uploads/seed/politicians/hd-deve-gowda.jpg",
  "pv-narasimha-rao": "/uploads/seed/politicians/pv-narasimha-rao.jpg",
  "chandra-shekhar": "/uploads/seed/politicians/chandra-shekhar.jpg",
  "vp-singh": "/uploads/seed/politicians/vp-singh.jpg",
  "rajiv-gandhi": "/uploads/seed/politicians/rajiv-gandhi.jpg",
  "indira-gandhi": "/uploads/seed/politicians/indira-gandhi.jpg",
  "morarji-desai": "/uploads/seed/politicians/morarji-desai.jpg",
  "lal-bahadur-shastri": "/uploads/seed/politicians/lal-bahadur-shastri.jpg",
  "jawaharlal-nehru": "/uploads/seed/politicians/jawaharlal-nehru.jpg",
  "yogi-adityanath": "/uploads/seed/politicians/yogi-adityanath.jpg",
  "vijay-tvk": null,
  "vd-satheesan": null,
  "samrat-choudhary": "/uploads/seed/politicians/samrat-choudhary.jpg",
  "bhagwant-mann": "/uploads/seed/politicians/bhagwant-mann.jpg",
  "devendra-fadnavis": "/uploads/seed/politicians/devendra-fadnavis.jpg",
  "dk-shivakumar": "/uploads/seed/politicians/dk-shivakumar.jpg",
  "revanth-reddy": "/uploads/seed/politicians/revanth-reddy.jpg",
  "mohan-yadav": "/uploads/seed/politicians/mohan-yadav.jpg",
  "bhajan-lal-sharma": "/uploads/seed/politicians/bhajan-lal-sharma.jpg",
  "bhupendra-patel": "/uploads/seed/politicians/bhupendra-patel.jpg",
  "himanta-biswa-sarma": "/uploads/seed/politicians/himanta-biswa-sarma.jpg",
};

const PARTY_PHOTOS = {
  bjp: "/uploads/seed/parties/bjp.jpg",
  inc: "/uploads/seed/parties/inc.jpg",
  aap: "/uploads/seed/parties/aap.jpg",
  tmc: "/uploads/seed/parties/tmc.jpg",
  sp: "/uploads/seed/parties/sp.jpg",
  bsp: null,
  dmk: "/uploads/seed/parties/dmk.jpg",
  aiadmk: "/uploads/seed/parties/aiadmk.jpg",
  jdu: "/uploads/seed/parties/jdu.jpg",
  ncp: "/uploads/seed/parties/ncp.jpg",
  "shiv-sena": null,
  cpim: "/uploads/seed/parties/cpim.jpg",
  rjd: null,
  ljprv: null,
  bjd: "/uploads/seed/parties/bjd.jpg",
  jmm: null,
  cpi: "/uploads/seed/parties/cpi.jpg",
};

const KEY_FIGURES = [
  {
    key: "narendra-modi", name: "Narendra Modi", position: "Prime Minister", party: "Bharatiya Janata Party (BJP)",
    born: 1950, birthPlace: "Vadnagar, Gujarat",
    education: ["Gujarat University, Ahmedabad — M.A. in Political Science"],
    currentPosition: "Prime Minister of India (since 2014, serving a third consecutive term since June 2024)",
    careerTimeline: [
      { role: "Chief Minister", organization: "Gujarat", fromYear: "2001", toYear: "2014" },
      { role: "Prime Minister of India", organization: "Government of India", fromYear: "2014", toYear: "Present" },
    ],
    summary: "Longest-serving BJP Prime Minister in the post-2000 era, first elected in 2014 and re-elected for a third consecutive term in 2024; previously served over a decade as Chief Minister of Gujarat.",
    bio: [
      "Narendra Modi entered public life through decades of organizational work before becoming Chief Minister of Gujarat in 2001, a post he held for over 12 years while overseeing the state's rapid industrial growth.",
      "As Prime Minister since 2014, he has been the face of major national initiatives including Digital India, the Goods and Services Tax rollout, and the abrogation of Article 370 in Jammu & Kashmir, and remains the BJP's principal electoral figure heading into successive general elections.",
    ],
  },
  {
    key: "rahul-gandhi", name: "Rahul Gandhi", position: "Leader of Opposition", party: "Indian National Congress (INC)",
    born: 1970, birthPlace: "Delhi",
    education: ["St. Stephen's College, Delhi — attended", "Rollins College, Florida — B.A., 1994", "Trinity College, Cambridge — M.Phil."],
    currentPosition: "Leader of the Opposition, Lok Sabha (since June 2024); MP from Rae Bareli, Uttar Pradesh",
    careerTimeline: [
      { role: "Member of Parliament (Lok Sabha)", organization: "Amethi, Uttar Pradesh", fromYear: "2004", toYear: "2019" },
      { role: "Vice-President", organization: "Indian National Congress", fromYear: "2013", toYear: "2017" },
      { role: "President", organization: "Indian National Congress", fromYear: "2017", toYear: "2019" },
      { role: "Member of Parliament (Lok Sabha)", organization: "Wayanad, Kerala", fromYear: "2019", toYear: "2024" },
      { role: "Member of Parliament (Lok Sabha)", organization: "Rae Bareli, Uttar Pradesh", fromYear: "2024", toYear: "Present" },
      { role: "Leader of the Opposition, Lok Sabha", organization: "Parliament of India", fromYear: "2024", toYear: "Present" },
    ],
    summary: "Senior Congress leader and member of the Nehru-Gandhi political family; became the first Leader of the Opposition in the Lok Sabha in a decade after the 2024 general election.",
    bio: [
      "A member of the Nehru–Gandhi family, Rahul Gandhi has been a Member of Parliament for Amethi and later Wayanad, and served as President of the Indian National Congress from 2017 to 2019.",
      "As Leader of Opposition in the Lok Sabha, he has focused on issues of unemployment, agrarian distress, and electoral transparency, positioning himself as the principal challenger to the ruling BJP-led coalition.",
    ],
  },
  {
    key: "amit-shah", name: "Amit Shah", position: "Minister of Home Affairs", party: "Bharatiya Janata Party (BJP)",
    born: 1964, birthPlace: "Mumbai, Maharashtra",
    education: ["C.U. Shah Science College, Ahmedabad (Gujarat University) — B.Sc. in Biochemistry"],
    currentPosition: "Union Minister of Home Affairs (since 2019); also Minister of Cooperation (since 2021)",
    careerTimeline: [
      { role: "Various Gujarat state minister portfolios", organization: "Government of Gujarat", fromYear: "2002", toYear: "2012" },
      { role: "President", organization: "Bharatiya Janata Party", fromYear: "2014", toYear: "2020" },
      { role: "Member of Parliament (Rajya Sabha)", organization: "Parliament of India", fromYear: "2017", toYear: "2019" },
      { role: "Union Minister of Home Affairs", organization: "Government of India", fromYear: "2019", toYear: "Present" },
      { role: "Union Minister of Cooperation", organization: "Government of India", fromYear: "2021", toYear: "Present" },
    ],
    summary: "Widely regarded as a principal architect of the BJP's electoral strategy since the mid-2010s; as Home Minister has overseen major internal security and administrative policy including the reorganization of Jammu & Kashmir.",
    bio: [
      "A long-time BJP organizer, Amit Shah served as the party's national president from 2014 to 2020, overseeing its expansion across states where it previously had limited presence.",
      "As Union Home Minister, he has been the architect of major internal security and federal restructuring decisions, including the reorganization of Jammu & Kashmir and the repeal of several colonial-era criminal statutes.",
    ],
  },
  {
    key: "rajnath-singh", name: "Rajnath Singh", position: "Minister of Defence", party: "Bharatiya Janata Party (BJP)",
    born: 1951, birthPlace: "Chandauli district, Uttar Pradesh",
    education: ["Gorakhpur University — M.Sc. in Physics"],
    currentPosition: "Union Minister of Defence (since 2019)",
    careerTimeline: [
      { role: "Member, Legislative Assembly", organization: "Uttar Pradesh", fromYear: "1977", toYear: "1990s" },
      { role: "Chief Minister", organization: "Uttar Pradesh", fromYear: "2000", toYear: "2002" },
      { role: "Union Minister of Agriculture", organization: "Government of India", fromYear: "2003", toYear: "2004" },
      { role: "President (two terms)", organization: "Bharatiya Janata Party", fromYear: "2005", toYear: "2014" },
      { role: "Union Minister of Home Affairs", organization: "Government of India", fromYear: "2014", toYear: "2019" },
      { role: "Union Minister of Defence", organization: "Government of India", fromYear: "2019", toYear: "Present" },
    ],
    summary: "One of the BJP's most senior leaders, having served twice as national party president and held both the Home and Defence portfolios at the union level.",
    bio: [
      "Rajnath Singh has held several senior BJP and government positions, including national party president and Union Home Minister, before taking charge of the Defence Ministry.",
      "As Defence Minister, he has overseen major indigenous defence procurement programs and India's military modernization push, including expanded domestic manufacturing under the 'Atmanirbhar Bharat' initiative.",
    ],
  },
  {
    key: "nirmala-sitharaman", name: "Nirmala Sitharaman", position: "Minister of Finance", party: "Bharatiya Janata Party (BJP)",
    born: 1959, birthPlace: "Madurai, Tamil Nadu",
    education: ["Seethalakshmi Ramaswami College, Tiruchirappalli — B.A. Economics", "Jawaharlal Nehru University — M.A. Economics, M.Phil."],
    currentPosition: "Union Minister of Finance and Corporate Affairs (since 2019)",
    careerTimeline: [
      { role: "Joined BJP", organization: "Bharatiya Janata Party", fromYear: "2006", toYear: "2006" },
      { role: "Union Minister of State for Commerce and Industry", organization: "Government of India", fromYear: "2014", toYear: "2017" },
      { role: "Union Minister of Defence", organization: "Government of India", fromYear: "2017", toYear: "2019" },
      { role: "Union Minister of Finance and Corporate Affairs", organization: "Government of India", fromYear: "2019", toYear: "Present" },
    ],
    summary: "First woman to serve full-time as India's Defence Minister and Finance Minister; has presented the Union Budget every year since 2019.",
    bio: [
      "Nirmala Sitharaman previously served as Defence Minister before becoming India's Finance Minister, one of the few women globally to hold either portfolio.",
      "She has presented multiple Union Budgets addressing economic recovery, infrastructure spending, and tax reform, and represents India at international financial forums including the G20.",
    ],
  },
  {
    key: "s-jaishankar", name: "S. Jaishankar", position: "Minister of External Affairs", party: "Bharatiya Janata Party (BJP)",
    born: 1955, birthPlace: "New Delhi",
    education: ["St. Stephen's College, Delhi University — B.A.", "Jawaharlal Nehru University — M.A., M.Phil. and Ph.D. in International Relations"],
    currentPosition: "Union Minister of External Affairs (since 2019)",
    careerTimeline: [
      { role: "Officer, Indian Foreign Service", organization: "Ministry of External Affairs", fromYear: "1977", toYear: "2018" },
      { role: "Ambassador to China", organization: "Government of India", fromYear: "2009", toYear: "2013" },
      { role: "Ambassador to the United States", organization: "Government of India", fromYear: "2013", toYear: "2015" },
      { role: "Foreign Secretary", organization: "Government of India", fromYear: "2015", toYear: "2018" },
      { role: "Union Minister of External Affairs", organization: "Government of India", fromYear: "2019", toYear: "Present" },
    ],
    summary: "First career diplomat and former Foreign Secretary to become India's External Affairs Minister; has played a central role in shaping India's foreign policy amid shifting global alignments.",
    bio: [
      "A career diplomat before entering politics, S. Jaishankar served as India's Foreign Secretary and as Ambassador to the United States and China prior to being appointed External Affairs Minister.",
      "In office, he has managed India's diplomatic balancing act amid shifting global alliances, including relations with the United States, Russia, and neighbouring states.",
    ],
  },
  {
    key: "om-birla", name: "Om Birla", position: "Speaker, Lok Sabha", party: "Bharatiya Janata Party (BJP)",
    born: 1962, birthPlace: "Kota, Rajasthan",
    education: ["Government Commerce College, Kota", "Maharshi Dayanand Saraswati University, Ajmer — M.Com."],
    currentPosition: "Speaker of the Lok Sabha (since June 2019, re-elected to a second term in June 2024)",
    careerTimeline: [
      { role: "Member, Legislative Assembly", organization: "Rajasthan (Kota)", fromYear: "2003", toYear: "2014" },
      { role: "Member of Parliament (Lok Sabha)", organization: "Kota, Rajasthan", fromYear: "2014", toYear: "Present" },
      { role: "Speaker of the Lok Sabha", organization: "Parliament of India", fromYear: "2019", toYear: "Present" },
    ],
    summary: "Presiding officer of the Lok Sabha since 2019, re-elected to the post following the 2024 general election.",
    bio: [
      "Om Birla represents Kota in the Lok Sabha and was elected Speaker of the House in 2019, a constitutionally non-partisan role overseeing parliamentary proceedings.",
      "As Speaker, he presides over debates, rules on points of order, and has overseen the digitization of several parliamentary processes during his tenure.",
    ],
  },
  {
    key: "cp-radhakrishnan", name: "C. P. Radhakrishnan", position: "Vice President of India", party: "Bharatiya Janata Party (BJP)",
    born: 1957, birthPlace: "Tiruppur, Tamil Nadu",
    education: ["V.O.C. College, Madurai Kamaraj University — B.B.A., 1978"],
    currentPosition: "Vice President of India (since September 2025)",
    careerTimeline: [
      { role: "Member of Parliament (Lok Sabha)", organization: "Coimbatore, Tamil Nadu", fromYear: "1998", toYear: "2004" },
      { role: "State President, Tamil Nadu", organization: "Bharatiya Janata Party", fromYear: "2004", toYear: "2007" },
      { role: "Chairman", organization: "Coir Board, Kochi", fromYear: "2016", toYear: "2020" },
      { role: "Governor", organization: "Jharkhand", fromYear: "2023", toYear: "2025" },
      { role: "Governor", organization: "Maharashtra", fromYear: "2025", toYear: "2025" },
      { role: "Vice President of India", organization: "Government of India", fromYear: "2025", toYear: "Present" },
    ],
    summary: "Elected as India's 15th Vice President in September 2025, succeeding Jagdeep Dhankhar (who resigned in July 2025); previously a two-term Lok Sabha MP from Coimbatore and Governor of Jharkhand and Maharashtra.",
    bio: [
      "C. P. Radhakrishnan built a four-decade career in Tamil Nadu BJP politics, including two terms in the Lok Sabha from Coimbatore and a stint as the party's state president, before moving into gubernatorial roles.",
      "As Vice President, he serves as the ex-officio Chairman of the Rajya Sabha, succeeding Jagdeep Dhankhar, who stepped down in mid-2025 citing health reasons.",
    ],
  },
  {
    key: "droupadi-murmu", name: "Droupadi Murmu", position: "President of India", party: "Bharatiya Janata Party (BJP)",
    born: 1958, birthPlace: "Uparbeda village, Mayurbhanj district, Odisha",
    education: ["Ramadevi Women's College, Bhubaneswar — B.A. in Political Science and Economics, 1979"],
    currentPosition: "President of India (since July 25, 2022)",
    careerTimeline: [
      { role: "Teacher", organization: "Sri Aurobindo Integral Education Centre, Rairangpur, Odisha", fromYear: "1980s", toYear: "1990s" },
      { role: "Councillor, Rairangpur Nagar Panchayat", organization: "Odisha", fromYear: "1997", toYear: "2000" },
      { role: "Minister (various portfolios)", organization: "Government of Odisha", fromYear: "2000", toYear: "2004" },
      { role: "Governor of Jharkhand", organization: "Government of Jharkhand", fromYear: "2015", toYear: "2021" },
      { role: "President of India", organization: "Government of India", fromYear: "2022", toYear: "Present" },
    ],
    summary: "First person from a Scheduled Tribe community and the second woman to become President of India; her five-year term began in 2022.",
    bio: [
      "Droupadi Murmu previously served as Governor of Jharkhand and as a state legislator in Odisha before being elected President of India in 2022, becoming the first person from a tribal community to hold the office.",
      "As President, she occupies India's highest constitutional office, a largely ceremonial but symbolically significant position above partisan affiliation.",
    ],
  },
  {
    key: "piyush-goyal", name: "Piyush Goyal", position: "Minister of Commerce & Industry", party: "Bharatiya Janata Party (BJP)",
    born: 1964, birthPlace: "Mumbai, Maharashtra",
    education: ["University of Mumbai — B.Com. and LL.B.", "Chartered Accountancy — All India Rank 2 (ICAI)"],
    currentPosition: "Union Minister of Commerce and Industry (since 2019); MP, Lok Sabha, Mumbai North (since 2024)",
    careerTimeline: [
      { role: "Member of Parliament (Rajya Sabha)", organization: "Parliament of India", fromYear: "2010", toYear: "2024" },
      { role: "Union Minister of State (I/C) for Power, Coal, Renewable Energy, Mines", organization: "Government of India", fromYear: "2014", toYear: "2017" },
      { role: "Union Minister of Railways", organization: "Government of India", fromYear: "2017", toYear: "2021" },
      { role: "Union Minister of Commerce and Industry", organization: "Government of India", fromYear: "2019", toYear: "Present" },
      { role: "Member of Parliament (Lok Sabha)", organization: "Mumbai North", fromYear: "2024", toYear: "Present" },
    ],
    summary: "Has held a wide range of key economic ministries over the past decade — power and renewable energy, railways, and now commerce and industry.",
    bio: [
      "Piyush Goyal has held multiple cabinet portfolios including Railways and Coal before taking charge of Commerce and Industry.",
      "In his current role, he has led India's trade negotiations with major economies and overseen initiatives aimed at boosting exports and domestic manufacturing.",
    ],
  },
];

const FORMER_PMS = [
  {
    key: "manmohan-singh", name: "Dr. Manmohan Singh", tenure: "2004 - 2014", party: "Indian National Congress (INC)",
    born: 1932, died: 2024, birthPlace: "Gah, Punjab (now in Pakistan)",
    education: ["Panjab University, Chandigarh — B.A./M.A. Economics", "St John's College, Cambridge — Economics Tripos (Honours)", "Nuffield College, Oxford — D.Phil. in Economics"],
    careerTimeline: [
      { role: "Chief Economic Adviser", organization: "Ministry of Finance", fromYear: "1972", toYear: "1976" },
      { role: "Governor", organization: "Reserve Bank of India", fromYear: "1982", toYear: "1985" },
      { role: "Finance Minister", organization: "Government of India", fromYear: "1991", toYear: "1996" },
      { role: "Leader of Opposition, Rajya Sabha", organization: "Parliament of India", fromYear: "1998", toYear: "2004" },
      { role: "Prime Minister of India", organization: "Government of India", fromYear: "2004", toYear: "2014" },
    ],
    summary: "As Finance Minister (1991-96) he launched the landmark liberalization reforms that opened up India's economy, and as PM (2004-2014) presided over a decade of strong GDP growth as the first Sikh to hold the office.",
    bio: [
      "An economist by training, Dr. Manmohan Singh served as India's Finance Minister in the early 1990s, where he led the landmark economic liberalization reforms that opened up the Indian economy.",
      "As Prime Minister for two terms, his government implemented the Right to Information Act, the MGNREGA rural employment guarantee scheme, and steered India through the 2008 global financial crisis.",
    ],
  },
  {
    key: "atal-bihari-vajpayee", name: "Atal Bihari Vajpayee", tenure: "1998 - 2004", party: "Bharatiya Janata Party (BJP)",
    born: 1924, died: 2018, birthPlace: "Gwalior, Madhya Pradesh",
    education: ["Victoria College, Gwalior — Bachelor's degree", "DAV College, Kanpur — M.A. Political Science"],
    careerTimeline: [
      { role: "Founding President", organization: "Bharatiya Janata Party (BJP)", fromYear: "1980", toYear: "1986" },
      { role: "External Affairs Minister", organization: "Government of India", fromYear: "1977", toYear: "1979" },
      { role: "Prime Minister of India (1st term)", organization: "Government of India", fromYear: "1996", toYear: "1996" },
      { role: "Prime Minister of India (full term)", organization: "Government of India", fromYear: "1999", toYear: "2004" },
    ],
    summary: "Authorized the 1998 Pokhran-II nuclear tests, pursued peace diplomacy with Pakistan, and became the first non-Congress PM to complete a full five-year term (1999-2004).",
    bio: [
      "A founding figure of the Bharatiya Janata Party, Atal Bihari Vajpayee was known as much for his oratory and poetry as for his political career spanning over five decades.",
      "As Prime Minister, his government conducted the Pokhran-II nuclear tests, launched the Golden Quadrilateral highway project, and pursued the Lahore peace process with Pakistan.",
    ],
  },
  {
    key: "ik-gujral", name: "I. K. Gujral", tenure: "1997 - 1998", party: "Janata Dal",
    born: 1919, died: 2012, birthPlace: "Jhelum, Punjab (now in Pakistan)",
    education: ["Hailey College of Commerce and Forman Christian College, Lahore"],
    careerTimeline: [
      { role: "Minister of Information & Broadcasting (and other portfolios)", organization: "Government of India", fromYear: "1967", toYear: "1976" },
      { role: "Ambassador to the Soviet Union", organization: "Government of India", fromYear: "1976", toYear: "1980" },
      { role: "Minister of External Affairs", organization: "Government of India", fromYear: "1996", toYear: "1997" },
      { role: "Prime Minister of India", organization: "Government of India", fromYear: "1997", toYear: "1998" },
    ],
    summary: "Best remembered for the 'Gujral Doctrine' — a foreign policy of unilateral goodwill toward India's smaller South Asian neighbours.",
    bio: [
      "I. K. Gujral held several ministerial portfolios, including External Affairs, before briefly serving as Prime Minister of a coalition government.",
      "He is best remembered for the 'Gujral Doctrine', a foreign policy approach emphasizing goodwill towards India's smaller South Asian neighbours without expecting reciprocity.",
    ],
  },
  {
    key: "hd-deve-gowda", name: "H. D. Deve Gowda", tenure: "1996 - 1997", party: "Janata Dal (Secular)",
    born: 1933, birthPlace: "Haradanahalli, Hassan district, Karnataka",
    education: ["Diploma in Civil Engineering, a Mysore State government polytechnic"],
    careerTimeline: [
      { role: "Member, Karnataka Legislative Assembly", organization: "Karnataka", fromYear: "1962", toYear: "1989" },
      { role: "Chief Minister", organization: "Karnataka", fromYear: "1994", toYear: "1996" },
      { role: "Prime Minister of India", organization: "Government of India", fromYear: "1996", toYear: "1997" },
      { role: "President, JD(S)", organization: "Janata Dal (Secular)", fromYear: "1999", toYear: "Present" },
    ],
    summary: "As PM leading the United Front coalition, his brief tenure is chiefly noted for holding together a fractious regional-party alliance; the only one of the six 1990s-era PMs still living.",
    bio: [
      "H. D. Deve Gowda rose from state politics in Karnataka, where he served as Chief Minister, to lead a coalition government at the national level.",
      "His tenure as Prime Minister was defined by managing a fractious multi-party alliance during a period of coalition instability in the mid-1990s.",
    ],
  },
  {
    key: "pv-narasimha-rao", name: "P. V. Narasimha Rao", tenure: "1991 - 1996", party: "Indian National Congress (INC)",
    born: 1921, died: 2004, birthPlace: "Laknepalli, Warangal district (now Telangana)",
    education: ["Osmania University, Hyderabad", "University of Bombay", "Nagpur University", "Fergusson College, Pune — Law degree"],
    careerTimeline: [
      { role: "Chief Minister", organization: "Andhra Pradesh", fromYear: "1971", toYear: "1973" },
      { role: "Minister of External Affairs", organization: "Government of India", fromYear: "1980", toYear: "1984" },
      { role: "Minister of Defence", organization: "Government of India", fromYear: "1984", toYear: "1985" },
      { role: "Prime Minister of India", organization: "Government of India", fromYear: "1991", toYear: "1996" },
    ],
    summary: "Known as the 'Father of Indian Economic Reforms' — his government (with FM Manmohan Singh) dismantled the License Raj and liberalized the economy in 1991; posthumously awarded the Bharat Ratna in 2024.",
    bio: [
      "P. V. Narasimha Rao took office at a moment of acute economic crisis and, together with his Finance Minister, initiated the 1991 liberalization reforms that reshaped India's economic trajectory.",
      "His government also navigated the aftermath of the Babri Masjid demolition and pursued the 'Look East' policy that expanded India's ties with Southeast Asia.",
    ],
  },
  {
    key: "chandra-shekhar", name: "Chandra Shekhar", tenure: "1990 - 1991", party: "Samajwadi Janata Party",
    born: 1927, died: 2007, birthPlace: "Ibrahimpatti, Ballia district, Uttar Pradesh",
    education: ["Satish Chandra P.G. College — B.A.", "University of Allahabad — M.A. Political Science, 1951"],
    careerTimeline: [
      { role: "Member of Parliament (Rajya Sabha)", organization: "Indian National Congress", fromYear: "1962", toYear: "1977" },
      { role: "President, Janata Party", organization: "Janata Party", fromYear: "1977", toYear: "1988" },
      { role: "Prime Minister of India", organization: "Government of India (minority government)", fromYear: "1990", toYear: "1991" },
    ],
    summary: "His seven-month tenure heading a minority government stabilized a period of political turmoil that preceded the pivotal 1991 economic reforms initiated under his successor.",
    bio: [
      "Chandra Shekhar was a prominent socialist leader within the Janata Dal before briefly leading a minority government with outside support from the Congress party.",
      "His short tenure was largely occupied with managing a severe balance-of-payments crisis that set the stage for the reforms of the following government.",
    ],
  },
  {
    key: "vp-singh", name: "V. P. Singh", tenure: "1989 - 1990", party: "Janata Dal",
    born: 1931, died: 2008, birthPlace: "Allahabad district, Uttar Pradesh",
    education: ["University of Allahabad — B.Sc.", "University of Poona — LL.B."],
    careerTimeline: [
      { role: "Chief Minister", organization: "Uttar Pradesh", fromYear: "1980", toYear: "1982" },
      { role: "Union Finance Minister", organization: "Government of India", fromYear: "1984", toYear: "1987" },
      { role: "Union Defence Minister", organization: "Government of India", fromYear: "1987", toYear: "1987" },
      { role: "Prime Minister of India", organization: "Government of India", fromYear: "1989", toYear: "1990" },
    ],
    summary: "Implemented the Mandal Commission's OBC reservation recommendations, reshaping caste-based reservation politics; earlier exposed the Bofors scandal as Defence Minister.",
    bio: [
      "V. P. Singh led the Janata Dal-headed National Front government after breaking away from the Congress party over allegations of defence procurement corruption.",
      "His government is chiefly remembered for implementing the Mandal Commission's reservation recommendations for backward classes in government jobs and education.",
    ],
  },
  {
    key: "rajiv-gandhi", name: "Rajiv Gandhi", tenure: "1984 - 1989", party: "Indian National Congress (INC)",
    born: 1944, died: 1991, birthPlace: "Bombay (now Mumbai), Maharashtra",
    education: ["The Doon School, Dehradun", "Imperial College London — attended", "Trinity College, Cambridge — attended engineering, did not complete degree"],
    careerTimeline: [
      { role: "Pilot", organization: "Indian Airlines", fromYear: "1970s", toYear: "1980" },
      { role: "Member of Parliament (Amethi)", organization: "Parliament of India", fromYear: "1981", toYear: "1991" },
      { role: "Prime Minister of India", organization: "Government of India", fromYear: "1984", toYear: "1989" },
    ],
    summary: "Became PM at 40 after his mother's assassination; credited with modernizing India's telecom/IT policy and lowering the voting age to 18. Assassinated in 1991.",
    bio: [
      "Rajiv Gandhi became Prime Minister following the assassination of his mother, Indira Gandhi, and led the Congress party to a historic majority in the subsequent general election.",
      "His government is associated with early telecom and technology modernization efforts and the Shah Bano-related debates over personal law reform.",
    ],
  },
  {
    key: "indira-gandhi", name: "Indira Gandhi", tenure: "1966 - 1977, 1980 - 1984", party: "Indian National Congress (INC)",
    born: 1917, died: 1984, birthPlace: "Allahabad, Uttar Pradesh",
    education: ["Visva-Bharati University, Santiniketan — attended briefly", "Somerville College, Oxford — attended, did not complete degree"],
    careerTimeline: [
      { role: "President, Indian National Congress", organization: "Indian National Congress", fromYear: "1959", toYear: "1960" },
      { role: "Prime Minister of India", organization: "Government of India", fromYear: "1966", toYear: "1977" },
      { role: "Prime Minister of India (second tenure)", organization: "Government of India", fromYear: "1980", toYear: "1984" },
    ],
    summary: "Led India to victory in the 1971 war and nationalized major banks; her 1975-77 Emergency, during which civil liberties were suspended, remains a historically contested chapter. Assassinated in 1984.",
    bio: [
      "Indira Gandhi, daughter of Jawaharlal Nehru, served as Prime Minister across two spells marked by the nationalization of banks, the 1971 war with Pakistan, and the imposition of the Emergency from 1975 to 1977.",
      "Her second term ended with her assassination in 1984, following the Punjab insurgency and Operation Blue Star, events that remain among the most consequential of the period.",
    ],
  },
  {
    key: "morarji-desai", name: "Morarji Desai", tenure: "1977 - 1979", party: "Janata Party",
    born: 1896, died: 1995, birthPlace: "Bhadeli, Bombay Presidency (now Gujarat)",
    education: ["Wilson College, Bombay (University of Bombay) — B.A."],
    careerTimeline: [
      { role: "Chief Minister", organization: "Bombay State", fromYear: "1952", toYear: "1956" },
      { role: "Union Finance Minister and Deputy PM", organization: "Government of India", fromYear: "1967", toYear: "1969" },
      { role: "Prime Minister of India", organization: "Government of India", fromYear: "1977", toYear: "1979" },
    ],
    summary: "Became India's first non-Congress Prime Minister, leading the Janata Party coalition that ended nearly three decades of unbroken Congress rule after the Emergency.",
    bio: [
      "Morarji Desai became India's first non-Congress Prime Minister, leading the Janata Party government that came to power after the Emergency was lifted.",
      "His tenure focused on restoring democratic institutions weakened during the Emergency, though the coalition ultimately collapsed amid internal disagreements.",
    ],
  },
  {
    key: "lal-bahadur-shastri", name: "Lal Bahadur Shastri", tenure: "1964 - 1966", party: "Indian National Congress (INC)",
    born: 1904, died: 1966, birthPlace: "Mughalsarai, Uttar Pradesh",
    education: ["Kashi Vidyapith, Varanasi — graduated with the title 'Shastri'"],
    careerTimeline: [
      { role: "Union Home Minister", organization: "Government of India", fromYear: "1961", toYear: "1963" },
      { role: "Prime Minister of India", organization: "Government of India", fromYear: "1964", toYear: "1966" },
    ],
    summary: "Led India through the 1965 war with Pakistan, coined 'Jai Jawan Jai Kisan', and promoted the White Revolution in milk production; died in Tashkent shortly after signing a peace declaration, posthumously awarded the Bharat Ratna.",
    bio: [
      "Lal Bahadur Shastri succeeded Jawaharlal Nehru and is remembered for his 'Jai Jawan, Jai Kisan' (Hail the Soldier, Hail the Farmer) slogan during the 1965 war with Pakistan.",
      "He died shortly after signing the Tashkent Declaration that ended the 1965 conflict, cutting short a tenure widely seen as steady and principled.",
    ],
  },
  {
    key: "jawaharlal-nehru", name: "Jawaharlal Nehru", tenure: "1947 - 1964", party: "Indian National Congress (INC)",
    born: 1889, died: 1964, birthPlace: "Allahabad, Uttar Pradesh",
    education: ["Harrow School, England", "Trinity College, Cambridge — B.A. (Honours), Natural Science, 1910", "Inner Temple, London — called to the Bar, 1912"],
    careerTimeline: [
      { role: "President, Indian National Congress (multiple terms)", organization: "Indian National Congress", fromYear: "1929", toYear: "1954" },
      { role: "Prime Minister of India", organization: "Government of India", fromYear: "1947", toYear: "1964" },
    ],
    summary: "As independent India's first Prime Minister, established its parliamentary democratic institutions, pursued a state-led mixed-economy model via Five-Year Plans, and shaped India's Non-Aligned foreign policy.",
    bio: [
      "India's first Prime Minister, Jawaharlal Nehru led the country through its formative years after independence, establishing its parliamentary democratic framework and a foreign policy of non-alignment.",
      "His government prioritized industrialization through Five-Year Plans and the establishment of institutions like the IITs, shaping much of India's post-independence state architecture.",
    ],
  },
];

// Chief Ministers as of August 2026 — four of the original twelve (Tamil
// Nadu, Kerala, Bihar, Karnataka) changed hands in 2026 state elections /
// internal power-sharing since this data was first written; verified via
// WebSearch rather than trusting the older assumption.
const CHIEF_MINISTERS = [
  {
    key: "yogi-adityanath", name: "Yogi Adityanath", state: "Uttar Pradesh", party: "BJP", oppositionParty: "Samajwadi Party (SP)", since: 2017, stillInOffice: true,
    born: 1972, birthPlace: "Panchur, Pauri Garhwal district (Uttarakhand)",
    education: ["Hemwati Nandan Bahuguna Garhwal University — B.Sc. Mathematics"],
    careerTimeline: [
      { role: "Mahant (head priest), Gorakhnath Math", organization: "Gorakhnath Math, Gorakhpur", fromYear: "1994", toYear: "Present" },
      { role: "Member of Parliament (Lok Sabha, Gorakhpur)", organization: "Parliament of India", fromYear: "1998", toYear: "2017" },
      { role: "Chief Minister of Uttar Pradesh", organization: "Government of Uttar Pradesh", fromYear: "2017", toYear: "Present" },
    ],
    summary: "UP's longest-serving CM and first to win consecutive terms; his tenure has emphasized law-and-order enforcement and religious-tourism infrastructure around Ayodhya.",
    bio: [
      "Before entering politics, Yogi Adityanath was a Hindu monk and head priest of the Gorakhnath Math in Gorakhpur, and had already been elected to the Lok Sabha multiple times from the constituency.",
      "As Chief Minister of India's most populous state since 2017, he has focused his tenure on law-and-order messaging, infrastructure projects, and religious-tourism development around sites including Ayodhya.",
    ],
  },
  {
    key: "vijay-tvk", name: "Vijay", state: "Tamil Nadu", party: "Tamilaga Vettri Kazhagam (TVK)", oppositionParty: "DMK", since: 2026, stillInOffice: true,
    born: 1974, birthPlace: "Madras (now Chennai), Tamil Nadu",
    education: ["Attended Chennai schools and briefly Loyola College"],
    careerTimeline: [
      { role: "Actor, Tamil cinema", organization: "Tamil film industry", fromYear: "1990s", toYear: "2026" },
      { role: "Founder", organization: "Tamilaga Vettri Kazhagam (TVK)", fromYear: "2024", toYear: "Present" },
      { role: "Chief Minister of Tamil Nadu", organization: "Government of Tamil Nadu", fromYear: "2026", toYear: "Present" },
    ],
    summary: "A leading Tamil film actor who founded the TVK in 2024 and led it to a majority (with INC support) in the May 2026 assembly election, ending DMK's rule and becoming Chief Minister.",
    bio: [
      "One of Tamil cinema's biggest stars, Vijay (Joseph Vijay Chandrasekhar) drew the curtain on his acting career in 2026 to focus on the political party he founded two years earlier.",
      "As Chief Minister, his TVK-led coalition government has campaigned on a '21st Century Good Governance' platform of job guarantees, student stipends, and administrative reform.",
    ],
  },
  {
    key: "vd-satheesan", name: "V. D. Satheesan", state: "Kerala", party: "Indian National Congress (INC)", oppositionParty: "CPI(M) — LDF", since: 2026, stillInOffice: true,
    born: 1964, birthPlace: "Nettoor, Kerala",
    education: ["Sacred Heart College, Thevara (Mahatma Gandhi University) — B.A.", "Rajagiri College of Social Sciences — M.S.W.", "Kerala Law Academy — LL.B.", "Government Law College, Thiruvananthapuram — LL.M."],
    careerTimeline: [
      { role: "Advocate, Kerala High Court", organization: "Kerala High Court", fromYear: "1990s", toYear: "2001" },
      { role: "MLA, Paravur (six terms)", organization: "Kerala Legislative Assembly", fromYear: "2001", toYear: "Present" },
      { role: "Leader of Opposition, Kerala Assembly", organization: "Kerala Legislative Assembly", fromYear: "2021", toYear: "2026" },
      { role: "Chief Minister of Kerala", organization: "Government of Kerala", fromYear: "2026", toYear: "Present" },
    ],
    summary: "A six-term MLA and Kerala High Court advocate, Satheesan led the UDF's 2026 assembly election victory and was sworn in as Chief Minister in May 2026, ending a decade of LDF rule.",
    bio: [
      "V. D. Satheesan built his political career as a six-time MLA from Paravur and practised as an advocate in the Kerala High Court for nearly a decade before rising to lead the state's Congress-led opposition.",
      "As Chief Minister since May 2026, he heads the United Democratic Front government that unseated the CPI(M)-led Left Democratic Front after its ten-year run in power.",
    ],
  },
  {
    key: "samrat-choudhary", name: "Samrat Choudhary", state: "Bihar", party: "BJP", oppositionParty: "RJD", since: 2026, stillInOffice: true,
    born: 1968, birthPlace: "Lakhanpur, Munger district, Bihar",
    education: ["Pre-Foundation Course, Madurai Kamaraj University"],
    careerTimeline: [
      { role: "MLA, Parbatta", organization: "Bihar Legislative Assembly", fromYear: "2000", toYear: "2018" },
      { role: "Joined BJP", organization: "Bharatiya Janata Party", fromYear: "2018", toYear: "2018" },
      { role: "Deputy Chief Minister of Bihar", organization: "Government of Bihar", fromYear: "2025", toYear: "2026" },
      { role: "Chief Minister of Bihar", organization: "Government of Bihar", fromYear: "2026", toYear: "Present" },
    ],
    summary: "Bihar's first-ever BJP Chief Minister, sworn in April 2026 after the NDA's landslide win in the November 2025 assembly election, succeeding longtime CM Nitish Kumar.",
    bio: [
      "Samrat Choudhary comes from a political family in Munger district and built his career within Bihar's BJP unit before becoming Deputy Chief Minister in Nitish Kumar's final cabinet.",
      "As Chief Minister since April 2026, he became the first BJP leader to hold the post in Bihar, a milestone following the NDA's decisive 2025 state election win.",
    ],
  },
  {
    key: "bhagwant-mann", name: "Bhagwant Mann", state: "Punjab", party: "AAP", oppositionParty: "INC", since: 2022, stillInOffice: true,
    born: 1973, birthPlace: "Satoj, Sangrur district, Punjab",
    education: ["Shaheed Udham Singh Government College, Sunam — pursued B.Com"],
    careerTimeline: [
      { role: "Comedian and TV performer", organization: "Punjabi entertainment industry", fromYear: "1990s", toYear: "2010s" },
      { role: "Member of Parliament (Lok Sabha, Sangrur)", organization: "Parliament of India", fromYear: "2014", toYear: "2022" },
      { role: "Chief Minister of Punjab", organization: "Government of Punjab", fromYear: "2022", toYear: "Present" },
    ],
    summary: "A former comedian and singer turned two-term MP, Mann's government has emphasized free healthcare via 'Mohalla clinics' and power subsidies for households.",
    bio: [
      "Before entering electoral politics, Bhagwant Mann was a well-known comedian and singer in Punjab, later winning a Lok Sabha seat and becoming a prominent AAP leader in the state.",
      "As Chief Minister since 2022, his government has focused on power subsidies, anti-drug enforcement messaging, and continuing AAP's welfare-oriented governance model from Delhi.",
    ],
  },
  {
    key: "devendra-fadnavis", name: "Devendra Fadnavis", state: "Maharashtra", party: "BJP", oppositionParty: "Shiv Sena (UBT) — MVA", since: 2024, stillInOffice: true,
    born: 1970, birthPlace: "Nagpur, Maharashtra",
    education: ["Government Law College, Nagpur — LL.B.", "Institute of Management Development and Research, Pune — Master's in Business Management"],
    careerTimeline: [
      { role: "Mayor of Nagpur", organization: "Nagpur Municipal Corporation", fromYear: "1997", toYear: "2001" },
      { role: "Chief Minister of Maharashtra", organization: "Government of Maharashtra", fromYear: "2014", toYear: "2019" },
      { role: "Deputy Chief Minister of Maharashtra", organization: "Government of Maharashtra", fromYear: "2022", toYear: "2024" },
      { role: "Chief Minister of Maharashtra (second stint)", organization: "Government of Maharashtra", fromYear: "2024", toYear: "Present" },
    ],
    summary: "In his second stint as CM, Fadnavis has pushed major infrastructure projects including the Mumbai-Nagpur Samruddhi Expressway and Mumbai Metro expansion.",
    bio: [
      "Devendra Fadnavis previously served as Maharashtra's Chief Minister from 2014 to 2019 and later as Deputy Chief Minister, before returning to the top post in December 2024.",
      "His terms have centered on infrastructure projects in the Mumbai metropolitan region and navigating the state's fragmented, coalition-driven political landscape.",
    ],
  },
  {
    key: "dk-shivakumar", name: "D. K. Shivakumar", state: "Karnataka", party: "INC", oppositionParty: "BJP", since: 2026, stillInOffice: true,
    born: 1962, birthPlace: "Doddalahalli, Kanakapura taluk, Karnataka",
    education: ["Karnataka State Open University, Mysore — M.A. Political Science"],
    careerTimeline: [
      { role: "MLA (eight terms)", organization: "Karnataka Legislative Assembly", fromYear: "1980s", toYear: "Present" },
      { role: "President, Karnataka Pradesh Congress Committee", organization: "Indian National Congress", fromYear: "2020", toYear: "2023" },
      { role: "Deputy Chief Minister of Karnataka", organization: "Government of Karnataka", fromYear: "2023", toYear: "2026" },
      { role: "Chief Minister of Karnataka", organization: "Government of Karnataka", fromYear: "2026", toYear: "Present" },
    ],
    summary: "An eight-time MLA known as the Congress party's 'troubleshooter', Shivakumar became Chief Minister in June 2026 under a pre-agreed power-sharing arrangement with Siddaramaiah.",
    bio: [
      "D. K. Shivakumar spent over four decades building organizational strength for the Congress party in Karnataka, including a term as state party president that revived its structure ahead of the 2023 election win.",
      "He became Chief Minister in June 2026, succeeding Siddaramaiah under a power-sharing arrangement reached after their 2023 election victory.",
    ],
  },
  {
    key: "revanth-reddy", name: "Revanth Reddy", state: "Telangana", party: "INC", oppositionParty: "BRS", since: 2023, stillInOffice: true,
    born: 1969, birthPlace: "Konda Reddy Palle, Wanaparthy (now Telangana)",
    education: ["A.V. College, Osmania University — B.A., 1992"],
    careerTimeline: [
      { role: "MLA, Kodangal (TDP)", organization: "Telugu Desam Party", fromYear: "2009", toYear: "2017" },
      { role: "Joined Indian National Congress", organization: "Indian National Congress", fromYear: "2017", toYear: "Present" },
      { role: "Telangana PCC President", organization: "Indian National Congress", fromYear: "2021", toYear: "2023" },
      { role: "Chief Minister of Telangana", organization: "Government of Telangana", fromYear: "2023", toYear: "Present" },
    ],
    summary: "Telangana's second Chief Minister, Reddy has pushed a caste census, Congress welfare 'guarantee' schemes, and the Musi River rejuvenation project.",
    bio: [
      "Revanth Reddy led the Congress party's revival in Telangana, becoming Chief Minister in 2023 after the state had been governed by the BRS since its formation in 2014.",
      "His government has focused on caste-census commitments and welfare scheme rollouts aimed at consolidating the party's return to power in the state.",
    ],
  },
  {
    key: "mohan-yadav", name: "Mohan Yadav", state: "Madhya Pradesh", party: "BJP", oppositionParty: "INC", since: 2023, stillInOffice: true,
    born: 1965, birthPlace: "Ujjain, Madhya Pradesh",
    education: ["Vikram University, Ujjain — B.Sc., LL.B., M.A. Political Science, MBA, and Ph.D."],
    careerTimeline: [
      { role: "Member, MP Legislative Council", organization: "Government of Madhya Pradesh", fromYear: "2013", toYear: "2018" },
      { role: "Cabinet Minister for Higher Education", organization: "Government of Madhya Pradesh", fromYear: "2020", toYear: "2023" },
      { role: "Chief Minister of Madhya Pradesh", organization: "Government of Madhya Pradesh", fromYear: "2023", toYear: "Present" },
    ],
    summary: "Mohan Yadav's government has emphasized religious-tourism development around Ujjain's Mahakal corridor and investment summits aimed at attracting industry.",
    bio: [
      "Mohan Yadav previously served as a state minister handling higher education and other portfolios before being chosen as Chief Minister following the BJP's 2023 state election win.",
      "His government has continued the state's long run of BJP rule, with a focus on industrial investment promotion and religious-tourism circuits.",
    ],
  },
  {
    key: "bhajan-lal-sharma", name: "Bhajan Lal Sharma", state: "Rajasthan", party: "BJP", oppositionParty: "INC", since: 2023, stillInOffice: true,
    born: 1966, birthPlace: "Aterna, Bharatpur district, Rajasthan",
    education: ["S.S. Jain Subodh College, Jaipur (University of Rajasthan) — B.A., 1989", "University of Rajasthan — M.A. Political Science, 1993"],
    careerTimeline: [
      { role: "General Secretary, BJP Rajasthan (organizational role)", organization: "Bharatiya Janata Party", fromYear: "2010s", toYear: "2023" },
      { role: "Chief Minister of Rajasthan", organization: "Government of Rajasthan", fromYear: "2023", toYear: "Present" },
    ],
    summary: "A relatively low-profile legislator before his appointment, Sharma's government has prioritized law-and-order messaging and industrial investment through the 'Rising Rajasthan' summit.",
    bio: [
      "A relatively low-profile legislator before his appointment, Bhajan Lal Sharma was chosen as a consensus Chief Minister candidate after the BJP's 2023 Rajasthan election victory.",
      "His government has prioritized law-and-order messaging and continuity of welfare schemes inherited from the previous administration.",
    ],
  },
  {
    key: "bhupendra-patel", name: "Bhupendra Patel", state: "Gujarat", party: "BJP", oppositionParty: "INC", since: 2021, stillInOffice: true,
    born: 1962, birthPlace: "Ahmedabad, Gujarat",
    education: ["Government Polytechnic, Ahmedabad — Diploma in Civil Engineering, 1982"],
    careerTimeline: [
      { role: "President, Memnagar Municipality", organization: "Ahmedabad", fromYear: "1999", toYear: "2000s" },
      { role: "MLA, Ghatlodia", organization: "Government of Gujarat", fromYear: "2017", toYear: "Present" },
      { role: "Chief Minister of Gujarat", organization: "Government of Gujarat", fromYear: "2021", toYear: "Present" },
    ],
    summary: "Known for a low-key, consensus-driven style, Patel's government has emphasized continuity of Gujarat's industrial-investment model via Vibrant Gujarat summits.",
    bio: [
      "Bhupendra Patel was a relatively low-profile municipal-level leader before being elevated to Chief Minister in 2021, and was re-appointed after the BJP's landslide win in the 2022 state election.",
      "His tenure has continued Gujarat's long-standing BJP governance model, with emphasis on industrial investment and urban infrastructure.",
    ],
  },
  {
    key: "himanta-biswa-sarma", name: "Himanta Biswa Sarma", state: "Assam", party: "BJP", oppositionParty: "INC", since: 2021, stillInOffice: true,
    born: 1969, birthPlace: "Assam",
    education: ["Cotton College, Guwahati — B.A. and M.A. Political Science", "Government Law College, Guwahati — LL.B.", "Gauhati University — Ph.D. Political Science"],
    careerTimeline: [
      { role: "MLA, Assam Legislative Assembly", organization: "Government of Assam", fromYear: "2001", toYear: "Present" },
      { role: "Joined BJP", organization: "Bharatiya Janata Party", fromYear: "2015", toYear: "2015" },
      { role: "Chief Minister of Assam", organization: "Government of Assam", fromYear: "2021", toYear: "2026" },
      { role: "Chief Minister of Assam (second consecutive term)", organization: "Government of Assam", fromYear: "2026", toYear: "Present" },
    ],
    summary: "A key BJP strategist for India's Northeast, re-elected for a second term after the BJP-led NDA's landslide win in the 2026 Assam election.",
    bio: [
      "Himanta Biswa Sarma switched from the Congress to the BJP in 2015 after a long career in Assam politics, becoming one of the party's most prominent leaders in the Northeast.",
      "As Chief Minister since 2021, and re-elected in 2026, he has pursued peace accords with insurgent groups and investment drives including 'Advantage Assam'.",
    ],
  },
];

const PARTIES = [
  {
    key: "bjp", name: "Bharatiya Janata Party", abbreviation: "BJP", foundedYear: 1980, foundedPlace: "New Delhi",
    founders: ["Atal Bihari Vajpayee", "Lal Krishna Advani"], ideology: "Right-wing, Hindu nationalist (Hindutva), socially conservative, pro-free-market",
    history: "Formed on 6 April 1980 by leaders from the earlier Bharatiya Jana Sangh and the collapsed Janata Party coalition. Grew through the 1990s and first led a national government under Vajpayee (1998-2004); returned to power in 2014 under Narendra Modi and has governed continuously since.",
    achievements: "Led national governments under Vajpayee and Modi, overseeing the 1998 nuclear tests, the GST rollout, and the abrogation of Article 370. As of 2026, leads the central government and heads the NDA coalition governing most Indian states.",
    yearsInPower: "In power nationally since 2014, with an earlier term 1998-2004",
  },
  {
    key: "inc", name: "Indian National Congress", abbreviation: "INC", foundedYear: 1885, foundedPlace: "Bombay (now Mumbai), Maharashtra",
    founders: ["Allan Octavian Hume", "Dadabhai Naoroji", "Womesh Chunder Bonnerjee"], ideology: "Centrist to center-left, secular, social-democratic/welfarist",
    history: "Founded 28 December 1885, became the principal organization of India's independence movement under leaders including Gandhi and Nehru. Governed India for most of the decades after 1947.",
    achievements: "Implemented the 1991 economic liberalization reforms, the Right to Information Act, and MGNREGA. As of 2026, the largest national opposition party, governing Karnataka and Telangana, and part of the winning UDF alliance in Kerala's 2026 election.",
    yearsInPower: "Governed India for roughly 54 of the first 67 years after independence, most recently 2004-2014",
  },
  {
    key: "aap", name: "Aam Aadmi Party", abbreviation: "AAP", foundedYear: 2012, foundedPlace: "New Delhi",
    founders: ["Arvind Kejriwal"], ideology: "Centrist, populist, anti-corruption and welfare-state focused",
    history: "Grew out of the 2011-12 India Against Corruption movement, launched 26 November 2012. Won a landslide in Delhi's 2015 election and later expanded to govern Punjab from 2022.",
    achievements: "Built its profile on subsidized electricity/water and school/health clinic reforms in Delhi. Lost Delhi in the February 2025 election after over a decade in power there; continues governing Punjab under CM Bhagwant Mann.",
    yearsInPower: "Governed Delhi 2013-2025; governs Punjab since 2022",
  },
  {
    key: "tmc", name: "All India Trinamool Congress", abbreviation: "TMC", foundedYear: 1998, foundedPlace: "Kolkata, West Bengal",
    founders: ["Mamata Banerjee"], ideology: "Regional, populist, secular, center-left welfarist",
    history: "Founded 1 January 1998 by Mamata Banerjee after breaking from Congress. Ended the Left Front's 34-year rule in the 2011 West Bengal election.",
    achievements: "Built its base on welfare schemes for women and farmers. Governed West Bengal continuously from 2011 until losing the 2026 assembly election to the BJP.",
    yearsInPower: "Governed West Bengal continuously from 2011 to 2026",
  },
  {
    key: "sp", name: "Samajwadi Party", abbreviation: "SP", foundedYear: 1992, foundedPlace: "Uttar Pradesh",
    founders: ["Mulayam Singh Yadav"], ideology: "Socialist, secular, OBC- and minority-oriented regional party",
    history: "Founded 4 October 1992 after splitting from the Janata Dal, drawing on Ram Manohar Lohia's socialist ideas to mobilize backward castes and Muslim voters in UP.",
    achievements: "Formed UP state governments in 1993, 2003, and 2012. As of 2026, the principal opposition party in the UP Assembly, part of the national INDIA bloc.",
    yearsInPower: "Has governed Uttar Pradesh in multiple terms, most recently 2012-2017",
  },
  {
    key: "bsp", name: "Bahujan Samaj Party", abbreviation: "BSP", foundedYear: 1984, foundedPlace: null,
    founders: ["Kanshi Ram"], ideology: "Bahujan (Dalit, OBC, minority) social-justice movement, Ambedkarite",
    history: "Founded 14 April 1984 to represent Scheduled Castes, Tribes, OBCs and minorities together as the 'Bahujan Samaj'. Grew into a major UP force through the 1990s-2000s under Mayawati.",
    achievements: "Won an outright majority in the 2007 UP election under Mayawati. As of 2026, significantly diminished — 0 Lok Sabha seats and a single UP Assembly seat.",
    yearsInPower: "Has governed Uttar Pradesh in multiple terms, most recently 2007-2012",
  },
  {
    key: "dmk", name: "Dravida Munnetra Kazhagam", abbreviation: "DMK", foundedYear: 1949, foundedPlace: "Madras (now Chennai), Tamil Nadu",
    founders: ["C. N. Annadurai"], ideology: "Dravidian, social-justice/anti-caste, secular, regional welfarist",
    history: "Founded 17 September 1949 after a split from Periyar's Dravidar Kazhagam. Annadurai became Tamil Nadu CM in 1967; succeeded by Karunanidhi, then M. K. Stalin.",
    achievements: "Long-championed Tamil-language rights and social welfare. Governed Tamil Nadu under Stalin until losing the 2026 election to the newly formed TVK; now the principal opposition party.",
    yearsInPower: "Governed Tamil Nadu 2021-2026, with multiple earlier terms",
  },
  {
    key: "aiadmk", name: "All India Anna Dravida Munnetra Kazhagam", abbreviation: "AIADMK", foundedYear: 1972, foundedPlace: "Madras (now Chennai), Tamil Nadu",
    founders: ["M. G. Ramachandran"], ideology: "Dravidian, populist, welfarist regional party",
    history: "Founded 17 October 1972 by film star M. G. Ramachandran after his expulsion from the DMK; renamed AIADMK in 1976. Jayalalithaa later led the party through multiple CM terms.",
    achievements: "Associated with welfare schemes including subsidized canteens. Contested the 2026 Tamil Nadu election allied with the BJP and won 47 seats, finishing behind the TVK and DMK.",
    yearsInPower: "Last governed Tamil Nadu from 2011-2021",
  },
  {
    key: "jdu", name: "Janata Dal (United)", abbreviation: "JD(U)", foundedYear: 2003, foundedPlace: "New Delhi",
    founders: ["Sharad Yadav", "George Fernandes", "Nitish Kumar"], ideology: "Centrist, socialist-rooted regional party, currently NDA-aligned",
    history: "Formed 30 October 2003 through a merger of Janata Dal, Samata Party, and Lok Shakti factions, largely in opposition to the RJD in Bihar. Nitish Kumar became its dominant figure.",
    achievements: "Focused on road infrastructure and law-and-order in Bihar. As of 2026, a key NDA ally with 85 seats after the November 2025 Bihar election; Nitish Kumar continues as JD(U)'s legislature leader.",
    yearsInPower: "Part of Bihar's ruling coalition for most of the period since 2005",
  },
  {
    key: "ncp", name: "Nationalist Congress Party", abbreviation: "NCP", foundedYear: 1999, foundedPlace: "New Delhi",
    founders: ["Sharad Pawar", "P. A. Sangma", "Tariq Anwar"], ideology: "Secularism, social democracy, Maharashtrian regional interests",
    history: "Formed June 1999 after expulsion from Congress over objections to a foreign-born leader becoming PM. Split in July 2023 when Ajit Pawar took most legislators into the BJP-led Maharashtra government; the EC awarded his faction the official NCP name in 2024.",
    achievements: "Held significant Maharashtra cabinet portfolios for two decades. As of 2026, Ajit Pawar's NCP is in power as part of the ruling Mahayuti alliance; Sharad Pawar's NCP(SP) faction is in opposition.",
    yearsInPower: "Part of Maharashtra's ruling coalition for extended periods since 1999",
  },
  {
    key: "shiv-sena", name: "Shiv Sena", abbreviation: "SHS", foundedYear: 1966, foundedPlace: "Mumbai, Maharashtra",
    founders: ["Bal Thackeray"], ideology: "Hindu nationalism; Marathi regional pride",
    history: "Founded 19 June 1966 by cartoonist Bal Thackeray, championing Marathi identity before evolving into a Hindu-nationalist BJP ally. Split in June 2022 when Eknath Shinde led a rebellion against Uddhav Thackeray; the EC recognized Shinde's faction as the official Shiv Sena in 2023.",
    achievements: "Led Maharashtra's government from 2019-2022 for the first time under one of its own leaders. As of 2026, Shinde's Shiv Sena is in power in the ruling Mahayuti alliance; Uddhav's Shiv Sena (UBT) is in opposition.",
    yearsInPower: "Led Maharashtra's state government from 2019-2022 before a party split",
  },
  {
    key: "cpim", name: "Communist Party of India (Marxist)", abbreviation: "CPI(M)", foundedYear: 1964, foundedPlace: "Calcutta (Kolkata), West Bengal",
    founders: ["P. Sundarayya", "E. M. S. Namboodiripad", "Jyoti Basu", "A. K. Gopalan"], ideology: "Marxism-Leninism; communism",
    history: "Formed November 1964 when a faction broke from the CPI over ideological differences. Led the longest continuously elected communist government in the world in West Bengal (1977-2011) and repeatedly governed Kerala.",
    achievements: "West Bengal governments implemented land reforms for sharecroppers; Kerala governments credited with strong public health/literacy outcomes. Lost the 2026 Kerala election, ending the last communist-led state government in India.",
    yearsInPower: "Governed West Bengal for 34 continuous years (1977-2011) and Kerala until 2026",
  },
  {
    key: "rjd", name: "Rashtriya Janata Dal", abbreviation: "RJD", foundedYear: 1997, foundedPlace: "New Delhi",
    founders: ["Lalu Prasad Yadav"], ideology: "Social justice; OBC, Dalit and Muslim political representation",
    history: "Founded July 1997 by Lalu Prasad Yadav after breaking from the Janata Dal, building support among OBCs, Dalits, and Muslims in Bihar. Leadership has gradually shifted to his son Tejashwi Yadav.",
    achievements: "Governed Bihar directly under Lalu and later Rabri Devi. As of 2026, leads the Mahagathbandhan opposition in Bihar after a heavy defeat in the November 2025 election.",
    yearsInPower: "Part of Bihar's ruling coalition for extended periods since 2015",
  },
  {
    key: "ljprv", name: "Lok Janshakti Party (Ram Vilas)", abbreviation: "LJP(RV)", foundedYear: 2021, foundedPlace: "Patna, Bihar",
    founders: ["Chirag Paswan"], ideology: "Social justice; Dalit and backward-classes representation; NDA-aligned",
    history: "Formed 5 October 2021 by Chirag Paswan after a split in the original LJP (founded by his father Ram Vilas Paswan in 2000) following his father's death in 2020.",
    achievements: "Chirag Paswan holds a Union Cabinet portfolio (Food Processing Industries) as of 2026, and the party's NDA-allied candidates won seats in the November 2025 Bihar election.",
    yearsInPower: "A recurring NDA coalition partner in Bihar and at the Centre",
  },
  {
    key: "bjd", name: "Biju Janata Dal", abbreviation: "BJD", foundedYear: 1997, foundedPlace: "Bhubaneswar, Odisha",
    founders: ["Naveen Patnaik"], ideology: "Odia regionalism; secularism; welfarism",
    history: "Founded 26 December 1997 by Naveen Patnaik, drawing on his father Biju Patnaik's legacy. Won power in Odisha in 2000, with Naveen Patnaik serving 24 consecutive years as CM.",
    achievements: "Associated with disaster-management reforms in Odisha. Lost the 2024 Odisha election to the BJP; Naveen Patnaik now leads the opposition in the state assembly.",
    yearsInPower: "Governed Odisha continuously from 2000 to 2024",
  },
  {
    key: "jmm", name: "Jharkhand Mukti Morcha", abbreviation: "JMM", foundedYear: 1972, foundedPlace: "Dhanbad district, Bihar (now Jharkhand)",
    founders: ["Binod Bihari Mahato", "A. K. Roy", "Shibu Soren"], ideology: "Jharkhandi regionalism; tribal rights; left-leaning socialism",
    history: "Founded in the early 1970s to campaign for a separate Jharkhand state, achieved with statehood in 2000. Shibu Soren served three terms as CM; leadership passed to his son Hemant Soren.",
    achievements: "As of 2026, the largest party in Jharkhand's ruling coalition after the 2024 election, with Hemant Soren as Chief Minister.",
    yearsInPower: "Leads Jharkhand's ruling coalition since 2019",
  },
  {
    key: "cpi", name: "Communist Party of India", abbreviation: "CPI", foundedYear: 1925, foundedPlace: "Kanpur, United Provinces (now Uttar Pradesh)",
    founders: ["Muzaffar Ahmed", "S. V. Ghate", "S. A. Dange"], ideology: "Marxism-Leninism; communism",
    history: "Established at a conference in Kanpur on 26 December 1925. A major force in early trade union and peasant movements; lost its more radical wing when the CPI(M) split away in 1964.",
    achievements: "Part of Kerala's 1957 communist government, the first elected communist government in the world. As of 2026, in opposition with no state government, following the LDF's loss in Kerala's 2026 election.",
    yearsInPower: "Part of Left Front governments in Kerala and West Bengal for decades",
  },
];

async function seed() {
  let order = 0;
  for (const p of KEY_FIGURES) {
    await Politician.upsert({
      slug: slugify(p.name), name: p.name, photoUrl: POLITICIAN_PHOTOS[p.key], bornYear: p.born, birthPlace: p.birthPlace, party: p.party,
      category: "KEY_FIGURE", currentPosition: p.currentPosition || p.position, education: p.education,
      careerTimeline: p.careerTimeline, summary: p.summary, bio: p.bio, sortOrder: order++,
    });
  }
  for (const p of FORMER_PMS) {
    await Politician.upsert({
      slug: slugify(p.name), name: p.name, photoUrl: POLITICIAN_PHOTOS[p.key], bornYear: p.born, diedYear: p.died, birthPlace: p.birthPlace, party: p.party,
      category: "FORMER_PM", currentPosition: `Former Prime Minister of India (${p.tenure})`, education: p.education,
      careerTimeline: p.careerTimeline, summary: p.summary, bio: p.bio, sortOrder: order++,
    });
  }
  for (const p of CHIEF_MINISTERS) {
    await Politician.upsert({
      slug: slugify(p.name), name: p.name, photoUrl: POLITICIAN_PHOTOS[p.key], bornYear: p.born, birthPlace: p.birthPlace, party: p.party, state: p.state,
      category: "CHIEF_MINISTER", currentPosition: `Chief Minister of ${p.state} (since ${p.since})`, stillInOffice: p.stillInOffice,
      oppositionParty: p.oppositionParty, sinceYear: p.since,
      education: p.education, careerTimeline: p.careerTimeline, summary: p.summary, bio: p.bio, sortOrder: order++,
    });
  }
  console.log(`Seeded ${KEY_FIGURES.length + FORMER_PMS.length + CHIEF_MINISTERS.length} politicians.`);

  order = 0;
  for (const p of PARTIES) {
    await Party.upsert({
      slug: slugify(p.abbreviation), name: p.name, abbreviation: p.abbreviation, photoUrl: PARTY_PHOTOS[p.key], foundedYear: p.foundedYear,
      foundedPlace: p.foundedPlace, founders: p.founders, ideology: p.ideology, history: p.history,
      achievements: p.achievements, currentStatus: p.currentStatus, yearsInPower: p.yearsInPower, sortOrder: order++,
    });
  }
  console.log(`Seeded ${PARTIES.length} parties.`);
}

seed()
  .then(() => {
    console.log("Politicians/parties seed complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Politicians/parties seed failed:", err);
    process.exit(1);
  });
