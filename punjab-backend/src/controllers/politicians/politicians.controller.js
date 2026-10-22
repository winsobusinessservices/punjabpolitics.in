// Public, unauthenticated reference data — real political figures and
// parties, not author-submitted content, so there's no approval workflow
// here (unlike articles/blogs/videos). Backs the frontend's
// politician.api.js, which used to return hardcoded dummy data.
const Politician = require("../../models/politician.model");
const Party = require("../../models/party.model");
const State = require("../../models/state.model");
const District = require("../../models/district.model");
const SiteReferenceVisibility = require("../../models/siteReferenceVisibility.model");

const getPoliticians = async (req, res) => {
  try {
    const [rawKeyFigures, rawFormerPMs, rawChiefMinisters] = await Promise.all([
      Politician.findAll({ category: "KEY_FIGURE", siteId: req.site.id }),
      Politician.findAll({ category: "FORMER_PM", siteId: req.site.id }),
      Politician.findAll({ category: "CHIEF_MINISTER", siteId: req.site.id }),
    ]);
    const [keyFigures, formerPMs, chiefMinisters] = await Promise.all([
      SiteReferenceVisibility.filter(req.site.id, "POLITICIAN", rawKeyFigures),
      SiteReferenceVisibility.filter(req.site.id, "POLITICIAN", rawFormerPMs),
      SiteReferenceVisibility.filter(req.site.id, "POLITICIAN", rawChiefMinisters),
    ]);
    return res.status(200).json({ success: true, keyFigures, formerPMs, chiefMinisters });
  } catch (error) {
    console.error("Get politicians error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getPoliticianBySlug = async (req, res) => {
  try {
    const politician = await Politician.findBySlug(req.params.slug, req.site.id);
    if (!politician || !(await SiteReferenceVisibility.isVisible(req.site.id, "POLITICIAN", politician.id))) {
      return res.status(404).json({ success: false, message: "Politician not found" });
    }
    return res.status(200).json({ success: true, politician });
  } catch (error) {
    console.error("Get politician by slug error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getParties = async (req, res) => {
  try {
    const parties = await SiteReferenceVisibility.filter(req.site.id, "PARTY", await Party.findAll({ siteId: req.site.id }));
    return res.status(200).json({ success: true, parties });
  } catch (error) {
    console.error("Get parties error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getPartyBySlug = async (req, res) => {
  try {
    const party = await Party.findBySlug(req.params.slug, req.site.id);
    if (!party || !(await SiteReferenceVisibility.isVisible(req.site.id, "PARTY", party.id))) {
      return res.status(404).json({ success: false, message: "Party not found" });
    }
    return res.status(200).json({ success: true, party });
  } catch (error) {
    console.error("Get party by slug error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getStates = async (req, res) => {
  try {
    const states = await SiteReferenceVisibility.filter(req.site.id, "STATE", await State.findAll({ siteId: req.site.id }));
    return res.status(200).json({ success: true, states });
  } catch (error) {
    console.error("Get states error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getStateBySlug = async (req, res) => {
  try {
    const state = await State.findBySlug(req.params.slug, req.site.id);
    if (!state || !(await SiteReferenceVisibility.isVisible(req.site.id, "STATE", state.id))) return res.status(404).json({ success: false, message: "State not found" });
    return res.status(200).json({ success: true, state });
  } catch (error) {
    console.error("Get state by slug error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getDistricts = async (req, res) => {
  try {
    const districts = await SiteReferenceVisibility.filter(req.site.id, "DISTRICT", await District.findAll({ siteId: req.site.id }));
    return res.status(200).json({ success: true, districts });
  } catch (error) {
    console.error("Get districts error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getDistrictBySlug = async (req, res) => {
  try {
    const district = await District.findBySlug(req.params.slug, req.site.id);
    if (!district || !(await SiteReferenceVisibility.isVisible(req.site.id, "DISTRICT", district.id))) return res.status(404).json({ success: false, message: "District not found" });
    return res.status(200).json({ success: true, district });
  } catch (error) {
    console.error("Get district by slug error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { getPoliticians, getPoliticianBySlug, getParties, getPartyBySlug, getStates, getStateBySlug, getDistricts, getDistrictBySlug };
