const AWARDS = [
  {
    id: "business-impact",
    name: "Business Impact Award",
    focus: "for outcomes",
    description:
      "Recognizes work that moves the business forward: pipeline, sales adoption, breakthrough story telling, creative elevation, customer engagement and other measurable business outcomes."
  },
  {
    id: "execution-excellence",
    name: "Execution Excellence Award",
    focus: "for operational rigor",
    description:
      "Recognizes work that drives increase in business efficiency, process improvements, team productivity, experimentation, stepping into stretch assignments, or turning chaos into clarity."
  },
  {
    id: "team-player",
    name: "Team Player Award",
    focus: "for cross collaboration",
    description:
      "Recognizes making complex cross-functional work easier, especially with product, sales, customer success, regional teams, executives and others."
  },
  {
    id: "ai-transformation",
    name: "AI Transformation Award",
    focus: "for innovation through AI",
    description:
      "Recognizes showcasing new, innovative use of AI to boost productivity and marketing impact."
  },
  {
    id: "marketing-visionary",
    name: "Marketing Visionary Award",
    focus: "for leadership and strategic thinking",
    description:
      "Recognizes thinking beyond immediate execution to shape the future of marketing, the business, and the organization, with strategic leadership and bold ideas to inspire transformational thinking elevating the brand and business over the long term."
  }
];

function normalizeNominees(nominees) {
  const used = new Set();
  return (Array.isArray(nominees) ? nominees : [])
    .map((nominee) => {
      const name = String(nominee.name || "").trim();
      if (!name) return null;
      const id = createStableId(nominee.id || name, used);
      return {
        id,
        name,
        nominationText: String(nominee.nominationText || "").trim()
      };
    })
    .filter(Boolean);
}

function createStableId(value, used) {
  const base =
    String(value || "nominee")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "nominee";

  let id = base;
  let counter = 2;
  while (used.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  used.add(id);
  return id;
}

function mergeNominations(data) {
  const byAward = new Map(((data && data.categories) || []).map((category) => [category.awardId, category]));
  return {
    updatedAt: (data && data.updatedAt) || null,
    categories: AWARDS.map((award) => {
      const saved = byAward.get(award.id) || {};
      return {
        ...award,
        nominees: normalizeNominees(saved.nominees || [])
      };
    })
  };
}

function cleanNominationPayload(categories) {
  return {
    updatedAt: new Date().toISOString(),
    categories: AWARDS.map((award) => {
      const incoming = categories.find((category) => category.awardId === award.id);
      return {
        awardId: award.id,
        nominees: incoming && Array.isArray(incoming.nominees) ? normalizeNominees(incoming.nominees) : []
      };
    })
  };
}

module.exports = {
  AWARDS,
  cleanNominationPayload,
  mergeNominations
};
