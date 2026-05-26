const page = document.body.dataset.page;
const statusEl = document.getElementById("status");

function setStatus(message, tone = "neutral") {
  if (!statusEl) return;
  statusEl.hidden = !message;
  statusEl.textContent = message || "";
  statusEl.dataset.tone = tone;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

async function fetchJson(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }
  return data;
}

function awardHeader(award) {
  const header = createElement("div", "award-header");
  const titleWrap = createElement("div");
  titleWrap.append(createElement("h2", "", award.name));
  titleWrap.append(createElement("p", "focus", award.focus));
  header.append(titleWrap);
  header.append(createElement("p", "description", award.description));
  return header;
}

function initVotePage() {
  const form = document.getElementById("vote-form");
  const afterSubmit = document.getElementById("after-submit");
  const existingReceipt = localStorage.getItem("marketingAwardsVercelVoteReceipt");

  fetchJson("/api/awards")
    .then((data) => {
      if (!data.awards.length) {
        form.hidden = true;
        setStatus("No categories have active nominations yet.", "neutral");
        return;
      }

      form.innerHTML = "";
      data.awards.forEach((award, index) => {
        form.append(renderVoteAward(award, index + 1));
      });

      const footer = createElement("div", "form-footer");
      const submit = createElement("button", "primary-button", "Submit anonymous vote");
      submit.type = "submit";
      if (existingReceipt) {
        submit.disabled = true;
        setStatus(`This browser has already submitted receipt ${existingReceipt}.`, "success");
      }
      footer.append(submit);
      form.append(footer);
      form.addEventListener("submit", (event) => submitVote(event, form, afterSubmit));
    })
    .catch((error) => setStatus(error.message, "error"));
}

function renderVoteAward(award, number) {
  const section = createElement("fieldset", "award-card");
  section.append(createElement("legend", "award-number", `Award ${number}`));
  section.append(awardHeader(award));

  const options = createElement("div", "nominee-grid");
  award.nominees.forEach((nominee) => {
    const label = createElement("label", "nominee-option");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = award.id;
    input.value = nominee.id;
    input.required = true;

    const body = createElement("span", "nominee-body");
    body.append(createElement("strong", "", nominee.name));
    if (nominee.nominationText) body.append(createElement("span", "nomination-note", nominee.nominationText));
    label.append(input, body);
    options.append(label);
  });
  section.append(options);
  return section;
}

async function submitVote(event, form, afterSubmit) {
  event.preventDefault();
  setStatus("");

  if (!form.checkValidity()) {
    setStatus("Please select one nominee in every visible award category.", "error");
    return;
  }

  const choices = {};
  new FormData(form).forEach((value, key) => {
    choices[key] = value;
  });

  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;
  submit.textContent = "Submitting...";

  try {
    const result = await fetchJson("/api/vote", {
      method: "POST",
      body: JSON.stringify({ choices })
    });
    localStorage.setItem("marketingAwardsVercelVoteReceipt", result.receiptId);
    form.hidden = true;
    afterSubmit.hidden = false;
    afterSubmit.innerHTML = "";
    afterSubmit.append(createElement("h2", "", "Vote submitted"));
    afterSubmit.append(createElement("p", "", `Receipt ${result.receiptId}`));
    const link = createElement("a", "primary-link", "View live results");
    link.href = "/results";
    afterSubmit.append(link);
    setStatus(result.email.status === "sent" ? "Email notification sent." : "Email notification saved.", "success");
  } catch (error) {
    submit.disabled = false;
    submit.textContent = "Submit anonymous vote";
    setStatus(error.message, "error");
  }
}

function initResultsPage() {
  const list = document.getElementById("results-list");
  const meta = document.getElementById("results-meta");

  fetchJson("/api/results")
    .then((data) => {
      meta.textContent = `${data.totalBallots} anonymous ballot${data.totalBallots === 1 ? "" : "s"} submitted.`;
      list.innerHTML = "";
      if (!data.awards.length) {
        setStatus("No categories have active nominations yet.", "neutral");
        return;
      }
      data.awards.forEach((award) => list.append(renderResultAward(award)));
    })
    .catch((error) => setStatus(error.message, "error"));
}

function renderResultAward(award) {
  const section = createElement("section", "award-card result-card");
  section.append(awardHeader(award));

  const list = createElement("div", "result-list");
  const maxVotes = Math.max(1, ...award.nominees.map((nominee) => nominee.votes));
  award.nominees.forEach((nominee) => {
    const row = createElement("div", "result-row");
    const label = createElement("div", "result-label");
    label.append(createElement("strong", "", nominee.name));
    label.append(createElement("span", "", `${nominee.votes} vote${nominee.votes === 1 ? "" : "s"}`));

    const track = createElement("div", "result-track");
    const bar = createElement("div", "result-bar");
    bar.style.width = `${Math.round((nominee.votes / maxVotes) * 100)}%`;
    track.append(bar);
    row.append(label, track);
    list.append(row);
  });
  section.append(list);
  return section;
}

function initAdminPage() {
  const form = document.getElementById("admin-form");
  fetchJson("/api/awards?all=1")
    .then((data) => {
      form.innerHTML = "";
      data.awards.forEach((award) => form.append(renderAdminAward(award)));

      const footer = createElement("div", "form-footer");
      const save = createElement("button", "primary-button", "Save nominations");
      save.type = "submit";
      footer.append(save);
      form.append(footer);
      form.addEventListener("submit", submitNominations);
    })
    .catch((error) => setStatus(error.message, "error"));
}

function renderAdminAward(award) {
  const section = createElement("section", "award-card");
  section.dataset.awardId = award.id;
  section.append(awardHeader(award));

  const label = createElement("label", "editor-label");
  label.textContent = "Nominees";
  const textarea = document.createElement("textarea");
  textarea.rows = 6;
  textarea.name = award.id;
  textarea.placeholder = "Alex Chen | Led a campaign that influenced pipeline\nPriya Shah | Created the AI workflow used by the team";
  textarea.value = award.nominees
    .map((nominee) => `${nominee.name}${nominee.nominationText ? ` | ${nominee.nominationText}` : ""}`)
    .join("\n");
  label.append(textarea);
  section.append(label);
  return section;
}

async function submitNominations(event) {
  event.preventDefault();
  setStatus("");

  const form = event.currentTarget;
  const categories = Array.from(form.querySelectorAll(".award-card")).map((section) => ({
    awardId: section.dataset.awardId,
    nominees: parseNomineeLines(section.querySelector("textarea").value)
  }));

  const save = form.querySelector("button[type='submit']");
  save.disabled = true;
  save.textContent = "Saving...";

  try {
    await fetchJson(`/api/nominations${window.location.search}`, {
      method: "POST",
      body: JSON.stringify({ categories })
    });
    setStatus("Nominations saved.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    save.disabled = false;
    save.textContent = "Save nominations";
  }
}

function parseNomineeLines(value) {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, ...noteParts] = line.split("|");
      return {
        name: name.trim(),
        nominationText: noteParts.join("|").trim()
      };
    })
    .filter((nominee) => nominee.name);
}

if (page === "vote") initVotePage();
if (page === "results") initResultsPage();
if (page === "admin") initAdminPage();
