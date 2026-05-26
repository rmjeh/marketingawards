const { saveNominations } = require("../lib/ballot");
const { handleError, isAdmin, methodNotAllowed, readJsonBody, sendJson } = require("../lib/http");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      methodNotAllowed(res);
      return;
    }
    if (!isAdmin(req)) {
      sendJson(res, 401, { error: "Admin token is missing or incorrect." });
      return;
    }
    const body = await readJsonBody(req);
    const data = await saveNominations(body.categories);
    sendJson(res, 200, data);
  } catch (error) {
    handleError(res, error);
  }
};
