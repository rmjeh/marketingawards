function sendJson(res, statusCode, value) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(value));
}

function methodNotAllowed(res) {
  sendJson(res, 405, { error: "Method not allowed." });
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function handleError(res, error) {
  sendJson(res, error.statusCode || 500, { error: error.message || "Unexpected server error." });
}

function isAdmin(req) {
  const requiredToken = process.env.ADMIN_TOKEN;
  if (!requiredToken) return true;
  const url = new URL(req.url, "http://localhost");
  return url.searchParams.get("token") === requiredToken;
}

module.exports = {
  handleError,
  isAdmin,
  methodNotAllowed,
  readJsonBody,
  sendJson
};
