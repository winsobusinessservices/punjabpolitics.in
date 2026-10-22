// Grammar/quality check for articles and blogs on submit.
//
// Backed by Gemini (Google's free-tier LLM API) rather than OpenAI — the
// configured OpenAI key's project has no billing and therefore no
// text-generation model access at all. This also needed a real LLM, not a
// rule-based checker: LanguageTool (the previous implementation) only covers
// 62 languages, and among Indian languages that's just Tamil — no Hindi,
// Kannada, Marathi, Telugu, Bengali, Gujarati, Malayalam, Punjabi, Urdu,
// Odia, or Assamese. It also has zero world knowledge, which is why it
// mangled Indian proper nouns (e.g. "Hanur" -> "Heiner") as if they were
// English typos. An LLM can detect the actual language, apply that
// language's grammar, and tell a real place/person name apart from a typo.
//
// Swap providers later by replacing the body of reviewArticleWithAI() —
// article.model.js / blog.model.js only depend on the returned shape.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
// Even with thinkingBudget capped low, a full article-length prompt plus a
// large structured JSON response has taken 20-28s in testing — longer real
// articles could run past that, so this leaves real margin rather than
// cutting it close.
const REQUEST_TIMEOUT_MS = 60_000;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    language: { type: "string", description: "The primary human language the content is written in, e.g. 'English', 'Hindi', 'Kannada'." },
    languageConfidence: { type: "number", description: "0 to 1 confidence in the language detection." },
    grammarIssues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          correction: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["original", "correction", "explanation"],
      },
    },
    spellingIssues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          correction: { type: "string" },
          reason: { type: "string" },
        },
        required: ["original", "correction", "reason"],
      },
    },
    correctedContent: { type: "string" },
    summary: { type: "string", description: "Short factual summary, written in the SAME language as the content." },
    qualityScore: { type: "integer", description: "0 to 100." },
    recommendation: { type: "string", enum: ["PASS", "NEEDS_CORRECTION"] },
  },
  required: [
    "language",
    "languageConfidence",
    "grammarIssues",
    "spellingIssues",
    "correctedContent",
    "summary",
    "qualityScore",
    "recommendation",
  ],
};

const SYSTEM_PROMPT = `You are a multilingual grammar, spelling, and quality checker for a news website covering Indian politics. You review one article/blog at a time and return structured JSON only.

LANGUAGE DETECTION
- Detect the primary language of the content. Do not assume English.
- Support all languages, with particular care for Indian languages: Hindi, Kannada, Marathi, Tamil, Telugu, Bengali, Gujarati, Malayalam, Punjabi, Urdu, Odia, Assamese — but do not restrict detection to only this list.
- If the content mixes languages, detect the primary one and check each sentence according to the language it's actually written in where possible. Never translate the content.

PROPER NOUNS — CRITICAL
- Never flag or "correct" Indian proper nouns as spelling mistakes: people's names, politician names, village/town/city/district/state/country names, organization names, political party names, government schemes, government departments, election names, constituency names, monuments, temples, universities, abbreviations.
- Example: "Hanur", "Ramalinga", "Chamarajanagar" are real place/person names — never change them to English dictionary words that merely look similar (e.g. never turn "Hanur" into "Heiner").
- If uncertain whether a word is a proper noun, do NOT flag it as a spelling mistake. Never apply English dictionary rules to Indian names.

GRAMMAR CHECKING
- Apply the grammar rules of the language actually detected — never apply English grammar rules to Hindi, Kannada, Marathi, Tamil, Telugu, etc.
- Check: grammar, sentence structure, subject-verb agreement, tense, articles (where applicable), punctuation, incorrect word usage, sentence clarity.
- Never change the author's political meaning, add new facts, remove factual claims, or change names/places just because they look unusual.

SPELLING CHECKING
- Report spellingIssues separately from grammarIssues.
- Only report a spelling mistake with high confidence. Do NOT report a word as misspelled simply because it's uncommon or not in an English dictionary — that is very likely a proper noun.

SUMMARY
- Write a short, factual summary in the SAME primary language as the content. If the content is Hindi, the summary must be Hindi. If Kannada, Kannada. Never translate the summary into English unless the content itself is English. Do not introduce information not present in the content.

CORRECTED CONTENT
- Keep the original language — never translate.
- Correct genuine grammar and spelling mistakes and fix punctuation where needed.
- Preserve all proper nouns and the author's meaning exactly.
- Do not add new facts, remove facts, or rewrite it into a different article — only correct actual errors.

QUALITY SCORE
- 0-100, based on how clean the writing is (fewer genuine issues -> higher score). A short article with no real errors should score high.

RECOMMENDATION
- "PASS" if there are no grammarIssues and no spellingIssues, otherwise "NEEDS_CORRECTION". This is advisory only — a human editor always makes the final approve/reject decision.`;

// Google's free tier caps gemini-3.6-flash at 20 requests/minute. A 429 on
// that quota is usually gone within seconds, so one short, bounded retry
// recovers most transient hits without making the author wait through the
// full (sometimes 30-45s) delay the API itself suggests.
const RATE_LIMIT_RETRY_CAP_MS = 5_000;

function parseRetryDelayMs(errorBody) {
  try {
    const parsed = JSON.parse(errorBody);
    const retryInfo = parsed.error?.details?.find((d) => d["@type"]?.includes("RetryInfo"));
    const seconds = parseFloat(retryInfo?.retryDelay);
    return Number.isFinite(seconds) ? seconds * 1000 : null;
  } catch {
    return null;
  }
}

async function callGeminiOnce(content) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: content }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
          // Grammar/spelling checking doesn't need deep multi-step reasoning,
          // and this model's default "thinking" adds real latency (a trivial
          // one-word prompt took ~17s uncapped vs ~2s at this budget) — high
          // enough to occasionally exceed REQUEST_TIMEOUT_MS on a full
          // article. thinkingBudget: 0 is rejected by this model (400), so a
          // small positive floor is the minimum available.
          thinkingConfig: { thinkingBudget: 128 },
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      const error = new Error(`Gemini API returned ${response.status}: ${errorBody.slice(0, 500)}`);
      error.status = response.status;
      error.retryDelayMs = parseRetryDelayMs(errorBody);
      throw error;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Gemini API returned no content");
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(content) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  try {
    return await callGeminiOnce(content);
  } catch (error) {
    if (error.status !== 429) throw error;

    const wait = Math.min(error.retryDelayMs ?? RATE_LIMIT_RETRY_CAP_MS, RATE_LIMIT_RETRY_CAP_MS);
    console.warn(`Gemini rate-limited, retrying once after ${wait}ms`);
    await new Promise((resolve) => setTimeout(resolve, wait));
    return callGeminiOnce(content);
  }
}

async function reviewArticleWithAI({ content }) {
  try {
    const result = await callGemini(content);
    const grammarIssues = result.grammarIssues || [];
    const spellingIssues = result.spellingIssues || [];
    const totalIssues = grammarIssues.length + spellingIssues.length;

    return {
      language: result.language || null,
      languageConfidence: result.languageConfidence ?? null,
      summary: result.summary || null,
      grammarIssues,
      spellingIssues,
      correctedContent: result.correctedContent || content,
      qualityScore: result.qualityScore ?? null,
      recommendation: result.recommendation === "PASS" ? "PASS" : "NEEDS_CORRECTION",
      notes:
        totalIssues === 0
          ? `Automated check passed (${result.language || "unknown language"}) — no issues found.`
          : `Automated check found ${totalIssues} issue${totalIssues === 1 ? "" : "s"} in ${result.language || "the detected language"} (${grammarIssues.length} grammar, ${spellingIssues.length} spelling).`,
    };
  } catch (error) {
    console.error("Gemini grammar check error:", error);
    throw new Error("AI_REVIEW_FAILED");
  }
}

module.exports = { reviewArticleWithAI };
