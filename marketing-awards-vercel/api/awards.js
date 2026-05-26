const { getAdminData, getBallot } = require("../lib/ballot");
const { handleError, sendJson } = require("../lib/http");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed." });
      return;
    }
    const url = new URL(req.url, "http://localhost");
    const data = url.searchParams.get("all") === "1" ? await getAdminData() : await getBallot();
    sendJson(res, 200, data);
  } catch (error) {
    handleError(res, error);
  }
};
