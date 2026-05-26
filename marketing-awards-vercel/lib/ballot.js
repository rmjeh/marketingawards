const crypto = require("crypto");
const { cleanNominationPayload } = require("./awards");
const { appendVote, getNominations, getVotes, setNominations } = require("./storage");

async function getBallot() {
  const nominations = await getNominations();
  return {
    updatedAt: nominations.updatedAt,
    awards: nominations.categories.filter((category) => category.nominees.length > 0)
  };
}

async function getAdminData() {
  const nominations = await getNominations();
  return {
    updatedAt: nominations.updatedAt,
    awards: nominations.categories
  };
}

async function saveNominations(categories) {
  if (!Array.isArray(categories)) {
    throw new Error("Expected a categories array.");
  }
  return setNominations(cleanNominationPayload(categories));
}

async function validateAndRecordVote(choices) {
  const ballot = await getBallot();
  const errors = [];
  const cleanChoices = {};

  if (ballot.awards.length === 0) {
    errors.push("No award categories currently have nominations.");
  }

  for (const award of ballot.awards) {
    const selected = String((choices && choices[award.id]) || "");
    if (!selected) {
      errors.push(`Choose a nominee for ${award.name}.`);
      continue;
    }
    if (!award.nominees.some((nominee) => nominee.id === selected)) {
      errors.push(`The selected nominee for ${award.name} is not valid.`);
      continue;
    }
    cleanChoices[award.id] = selected;
  }

  if (errors.length) {
    const error = new Error(errors.join(" "));
    error.statusCode = 400;
    throw error;
  }

  const vote = {
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    choices: cleanChoices
  };
  await appendVote(vote);

  return {
    vote,
    summary: ballot.awards.map((award) => {
      const nominee = award.nominees.find((item) => item.id === vote.choices[award.id]);
      return {
        award: award.name,
        nominee: nominee ? nominee.name : "Unknown nominee"
      };
    })
  };
}

async function getResults() {
  const nominations = await getNominations();
  const votes = await getVotes();

  const awards = nominations.categories
    .filter((category) => category.nominees.length > 0)
    .map((category) => {
      const counts = new Map(category.nominees.map((nominee) => [nominee.id, 0]));
      for (const vote of votes) {
        const selected = vote.choices && vote.choices[category.id];
        if (counts.has(selected)) counts.set(selected, counts.get(selected) + 1);
      }

      const nominees = category.nominees
        .map((nominee) => ({
          ...nominee,
          votes: counts.get(nominee.id) || 0
        }))
        .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));

      return {
        id: category.id,
        name: category.name,
        focus: category.focus,
        description: category.description,
        nominees,
        totalVotes: nominees.reduce((sum, nominee) => sum + nominee.votes, 0)
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    totalBallots: votes.length,
    awards
  };
}

module.exports = {
  getAdminData,
  getBallot,
  getResults,
  saveNominations,
  validateAndRecordVote
};
