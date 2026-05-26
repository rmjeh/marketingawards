const { getResults, validateAndRecordVote } = require("../lib/ballot");
const { notifyVoteSubmitted } = require("../lib/email");
const { handleError, methodNotAllowed, readJsonBody, sendJson } = require("../lib/http");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      methodNotAllowed(res);
      return;
    }

    const body = await readJsonBody(req);
    const { vote, summary } = await validateAndRecordVote(body.choices);
    const email = await notifyVoteSubmitted(vote, summary);

    sendJson(res, 201, {
      receiptId: vote.id,
      submittedAt: vote.submittedAt,
      email,
      results: await getResults()
    });
  } catch (error) {
    handleError(res, error);
  }
};
