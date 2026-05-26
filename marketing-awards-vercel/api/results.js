const { getResults } = require("../lib/ballot");
const { handleError, methodNotAllowed, sendJson } = require("../lib/http");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      methodNotAllowed(res);
      return;
    }
    sendJson(res, 200, await getResults());
  } catch (error) {
    handleError(res, error);
  }
};
