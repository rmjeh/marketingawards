const { appendOutbox } = require("./storage");

async function notifyVoteSubmitted(vote, summary) {
  const to = process.env.EMAIL_TO;
  const from = process.env.EMAIL_FROM || "Marketing Awards <awards@example.com>";
  const subject = "Marketing awards vote submitted";
  const text = [
    "An anonymous marketing awards ballot was submitted.",
    "",
    `Receipt: ${vote.id}`,
    `Submitted: ${vote.submittedAt}`,
    "",
    "Selections:",
    ...summary.map((item) => `- ${item.award}: ${item.nominee}`)
  ].join("\n");

  if (process.env.RESEND_API_KEY && to) {
    try {
      await sendResend({ to, from, subject, text });
      return { status: "sent", channel: "resend" };
    } catch (error) {
      await appendOutbox({ to, from, subject, text, status: "resend_failed", error: error.message });
      return { status: "saved_to_outbox", detail: error.message };
    }
  }

  if (process.env.EMAIL_WEBHOOK_URL) {
    try {
      await sendWebhook({ to, from, subject, text, summary, receiptId: vote.id });
      return { status: "sent", channel: "webhook" };
    } catch (error) {
      await appendOutbox({ to, from, subject, text, status: "webhook_failed", error: error.message });
      return { status: "saved_to_outbox", detail: error.message };
    }
  }

  await appendOutbox({
    to: to || null,
    from,
    subject,
    text,
    status: to ? "missing_mail_transport" : "not_configured"
  });
  return { status: "saved_to_outbox", detail: "Email delivery is not configured." };
}

async function sendResend({ to, from, subject, text }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: to.split(",").map((item) => item.trim()).filter(Boolean),
      subject,
      text
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Resend email request failed.");
}

async function sendWebhook(payload) {
  const response = await fetch(process.env.EMAIL_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Webhook returned ${response.status}.`);
}

module.exports = {
  notifyVoteSubmitted
};
