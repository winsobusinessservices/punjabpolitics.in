const PROHIBITED_TERMS = [
  "asshole", "bastard", "bitch", "bullshit", "cunt", "dick", "dickhead",
  "douchebag", "dumbass", "fuck", "fucked", "fucker", "fucking", "fuckwit",
  "idiot", "jackass", "motherfucker", "moron", "piece of shit", "prick",
  "retard", "scumbag", "shithead", "slut", "son of a bitch", "twat", "whore",
  "faggot", "kike", "nigger", "chink", "spic",
  "bakchod", "behenchod", "behen ke lode", "bhenchod", "bhosdike", "bhosdiwala",
  "chodu", "chutiya", "chutiye", "gaand", "gandu", "harami", "haramkhor",
  "jhatu", "kamina", "kaminey", "kutta", "kutti", "laude", "lodu",
  "madarchod", "randi", "saala", "suar", "tatti",
  "bokachoda", "choda", "khanki", "magi", "ommala", "otha", "punda", "thevdiya",
  "dengay", "lanja", "modda", "bevarsi", "boli maga", "sule", "myre", "poori",
  "thayoli", "kanjar", "penchod", "nalayak",
  "cabron", "cabrón", "gilipollas", "hijo de puta", "pendejo", "puta", "puto",
  "connard", "connasse", "fils de pute", "putain", "salope",
  "arschloch", "hurensohn", "scheisse", "scheiße", "schlampe", "wichser",
  "caralho", "filho da puta", "vagabunda", "blyad", "mudak", "suka",
  "\u{91a}\u{942}\u{924}\u{93f}\u{92f}\u{93e}", "\u{92e}\u{93e}\u{926}\u{930}\u{91a}\u{94b}\u{926}",
  "\u{92c}\u{939}\u{928}\u{91a}\u{94b}\u{926}", "\u{930}\u{902}\u{921}\u{940}",
  "\u{939}\u{930}\u{93e}\u{92e}\u{940}", "\u{915}\u{92e}\u{940}\u{928}\u{93e}",
  "\u{915}\u{941}\u{924}\u{94d}\u{924}\u{93e}", "\u{938}\u{93e}\u{932}\u{93e}",
  "\u{938}\u{942}\u{905}\u{930}", "\u{91d}\u{93e}\u{91f}\u{942}", "\u{932}\u{94c}\u{921}\u{93c}\u{93e}",
  "\u{9ac}\u{9cb}\u{995}\u{9be}\u{99a}\u{9cb}\u{9a6}\u{9be}", "\u{996}\u{9be}\u{9a8}\u{995}\u{9bf}",
  "\u{9ae}\u{9be}\u{997}\u{9c0}", "\u{99a}\u{9cb}\u{9a6}\u{9be}",
  "\u{ba4}\u{bc7}\u{bb5}\u{b9f}\u{bbf}\u{baf}\u{bbe}", "\u{baa}\u{bc1}\u{ba3}\u{bcd}\u{b9f}\u{bc8}",
  "\u{b93}\u{ba4}\u{bcd}\u{ba4}\u{bbe}", "\u{c32}\u{c02}\u{c1c}", "\u{c2e}\u{c4a}\u{c21}\u{c4d}\u{c21}",
  "\u{c26}\u{c46}\u{c02}\u{c17}\u{c47}\u{c2f}\u{c4d}", "\u{cb8}\u{cc2}\u{cb3}\u{cc6}",
  "\u{cac}\u{cc7}\u{cb5}\u{cb0}\u{ccd}\u{cb8}\u{cbf}", "\u{cac}\u{ccb}\u{cb3}\u{cbf} \u{cae}\u{c97}",
  "\u{d2e}\u{d48}\u{d30}\u{d47}", "\u{d2a}\u{d42}\u{d31}\u{d3f}", "\u{d24}\u{d3e}\u{d2f}\u{d4b}\u{d33}\u{d3f}",
  "\u{ab9}\u{ab0}\u{abe}\u{aae}\u{a96}\u{acb}\u{ab0}", "\u{aa8}\u{abe}\u{ab2}\u{abe}\u{aaf}\u{a95}",
  "\u{a15}\u{a70}\u{a1c}\u{a30}", "\u{a2a}\u{a47}\u{a28}\u{a1a}\u{a4b}\u{a26}",
  "\u{634}\u{631}\u{645}\u{648}\u{637}\u{629}", "\u{642}\u{62d}\u{628}\u{629}",
  "\u{627}\u{628}\u{646} \u{627}\u{644}\u{643}\u{644}\u{628}", "\u{643}\u{633} \u{623}\u{645}\u{643}",
  "\u{431}\u{43b}\u{44f}\u{434}\u{44c}", "\u{441}\u{443}\u{43a}\u{430}",
  "\u{43c}\u{443}\u{434}\u{430}\u{43a}", "\u{445}\u{443}\u{439}",
  "\u{50bb}\u{903c}", "\u{64cd}\u{4f60}\u{5988}", "\u{5988}\u{7684}", "\u{8d31}\u{4eba}",
  "\u{c528}\u{bc1c}", "\u{ac1c}\u{c0c8}\u{b07c}", "\u{bcd1}\u{c2e0}", "\u{c886}",
  "\u{99ac}\u{9e7f}", "\u{6b7b}\u{306d}",
];

const PROHIBITED_PHRASES = [
  "click here to win",
  "guaranteed income",
  "buy now",
];

const THREAT_PATTERNS = [
  /\b(?:i(?:\s*ll| will)?\s+)?kill\s+(?:you|yourself|him|her|them)\b/u,
  /\b(?:i(?:\s*ll| will)?\s+)?hurt\s+(?:you|him|her|them)\b/u,
  /\b(?:death|rape)\s+threat\b/u,
];

function normalizeForModeration(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-IN")
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .replace(/[@4]/gu, "a")
    .replace(/[3]/gu, "e")
    .replace(/[1]/gu, "i")
    .replace(/[0]/gu, "o")
    .replace(/[$5]/gu, "s")
    .replace(/[7]/gu, "t")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function joinSpacedEvasions(value) {
  return value.replace(/\b(?:\p{L}\s+){2,}\p{L}\b/gu, (match) => match.replace(/\s/gu, ""));
}

function containsWholeTerm(value, term) {
  if (/\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(term)) {
    return value.includes(term);
  }
  return ` ${value} `.includes(` ${term} `);
}

export function checkCommentContent(content) {
  const normalized = normalizeForModeration(content);
  const candidates = [normalized, joinSpacedEvasions(normalized)];

  const hasProhibitedTerm = PROHIBITED_TERMS.some((term) => {
    const normalizedTerm = normalizeForModeration(term);
    return candidates.some((candidate) => containsWholeTerm(candidate, normalizedTerm));
  });

  if (hasProhibitedTerm) {
    return {
      isAllowed: false,
      message: "Your comment contains abusive or prohibited language. Please edit it before posting.",
    };
  }

  if (PROHIBITED_PHRASES.some((phrase) => containsWholeTerm(normalized, normalizeForModeration(phrase)))) {
    return {
      isAllowed: false,
      message: "Your comment looks like prohibited promotional or spam content. Please edit it before posting.",
    };
  }

  if (THREAT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      isAllowed: false,
      message: "Threatening language is not allowed. Please edit your comment before posting.",
    };
  }

  return { isAllowed: true, message: "" };
}
