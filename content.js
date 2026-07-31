const INFO_LINE = "Your actual costs may exceed this based on usage";
const CARD_TITLES = ["Project spend limit", "Organization spend limit"];
const SWITCH_LABEL = "Enforce a hard limit";
const MODAL_DESC = "Your usage tier defines the maximum monthly limit";
const MODAL_TITLE = "Edit spend limit";

const directText = (el) =>
  [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();

const findByText = (match, root = document) =>
  [...root.querySelectorAll("h2,p,span,div,label")].find((el) => match(directText(el)));

const scopeId = () => (location.pathname.match(/\/settings\/(proj_[^/]+|organization)/) || [, "unknown"])[1];

const onLimitsPage = () => location.pathname.endsWith("/limits");

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

const ORG_LIMITS = "/settings/organization/limits";

let enforced = "unknown";
let honest = true;
let tierCeiling = null;

const replaceInPlace = (original, html) => {
  const copy = original.cloneNode(true);
  copy.classList.add("nal-new");
  copy.innerHTML = html;
  original.classList.add("nal-orig");
  original.after(copy);
  return copy;
};

const spendFromCard = (card) => {
  const m = card.innerText.match(/\$([\d,]+(?:\.\d{2})?)\s*\/\s*\$([\d,]+(?:\.\d{2})?)/);
  if (!m) return null;
  const num = (s) => Number(s.replace(/,/g, ""));
  return { spent: num(m[1]), limit: num(m[2]), limitText: "$" + m[2] };
};

const clearEscapeRoute = (card) => {
  for (let el = card.parentElement; el && el !== document.body; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowX;
    if (overflow === "hidden") el.classList.add("nal-unclip");
    if (overflow === "auto" || overflow === "scroll") {
      el.classList.add("nal-clipx");
      return;
    }
  }
};

const markProgressBar = (card) => {
  for (const el of card.querySelectorAll("div")) {
    if (el.offsetHeight > 0 && el.offsetHeight <= 10 && el.offsetWidth > 200) {
      el.classList.add("nal-bar");
      return;
    }
  }
};

const severityOf = (spend) => {
  if (enforced === "on") return "good";
  if (enforced === "off") return spend.spent > spend.limit ? "loud" : "quiet";
  return "unknown";
};

const orgLinkHtml = () => {
  if (!scopeId().startsWith("proj_")) return "";
  const known = tierCeiling
    ? `Above this project sits a usage-tier ceiling — <strong>$${esc(tierCeiling)}</strong> when you last opened the organization editor. It depends on your tier, it is the highest limit you are allowed to set, and it lives on a page that never mentions this project.`
    : `Above this project sits a usage-tier ceiling, named only in your organization’s editor. This page never mentions it.`;
  return `<div class="nal-orglink">${known} <a href="${ORG_LIMITS}">Organization limits →</a></div>`;
};

const bannerHtml = (spend, level) => {
  const limit = esc(spend.limitText);

  if (level === "good") {
    return `<div class="nal-banner nal-b-good">Enforced. Requests are rejected once spend reaches ${limit}.</div>`;
  }
  if (level === "loud") {
    const pct = Math.round((spend.spent / spend.limit) * 100);
    return `<div class="nal-banner nal-b-loud">
      <div class="nal-banner-title">This limit did not limit anything.</div>
      <div class="nal-banner-body">“Enforce a hard limit” is off, so nothing stopped your spend at ${limit}. You are at <strong>${pct}%</strong> of it, and requests are still being served and billed.</div>
      <button class="nal-cta" type="button">Show me the switch that actually works →</button>
    ${orgLinkHtml()}
    </div>`;
  }
  if (level === "quiet") {
    return `<div class="nal-banner nal-b-warn">
      <div class="nal-banner-title">Nothing will stop this at ${limit}.</div>
      <div class="nal-banner-body">“Enforce a hard limit” is off, so when spend reaches ${limit} the requests keep being served and billed. There is no wall at the end of that bar.</div>
      <button class="nal-cta" type="button">Show me the switch that actually works →</button>
    ${orgLinkHtml()}
    </div>`;
  }
  return `<div class="nal-banner nal-b-warn">
    <div class="nal-banner-title">Probably nothing will stop this either.</div>
    <div class="nal-banner-body">“Enforce a hard limit” is off by default and this card never shows that switch’s state. Until you check, assume ${limit} looks nice but doesn’t solve anything.</div>
    <button class="nal-cta" type="button">Check the editor →</button>
  ${orgLinkHtml()}
  </div>`;
};

const patchCard = () => {
  const info = findByText((t) => t === INFO_LINE);
  if (!info) {
    document.body.classList.remove("nal-loud", "nal-warn");
    return false;
  }

  let card = info.parentElement;
  while (card && !CARD_TITLES.some((t) => card.innerText.includes(t))) card = card.parentElement;
  if (!card) return false;

  const spend = spendFromCard(card);
  if (!spend) return false;

  const level = severityOf(spend);
  document.body.classList.toggle("nal-loud", level === "loud");
  document.body.classList.toggle("nal-warn", level === "quiet" || level === "unknown");

  const stamp = level + "|" + spend.spent + "/" + spend.limit + "|" + tierCeiling;
  if (card.dataset.nalState === stamp) return true;
  card.querySelectorAll(".nal-new").forEach((n) => n.remove());
  card.querySelectorAll(".nal-orig").forEach((n) => n.classList.remove("nal-orig"));
  card.dataset.nal = "card";
  card.dataset.nalState = stamp;

  markProgressBar(card);
  clearEscapeRoute(card);

  const editButton = [...card.querySelectorAll("button")].find(
    (b) => b.innerText.trim() === MODAL_TITLE
  );
  const editLabel = editButton && findByText((t) => t === MODAL_TITLE, editButton);
  if (editLabel && level !== "good") {
    replaceInPlace(editLabel, "Edit spend <s>limit</s> suggestion");
  }

  const title = findByText((t) => CARD_TITLES.includes(t), card);
  if (title) {
    const heading = directText(title);
    const badge = level === "good" ? "ENFORCED" : "NOT ENFORCED";
    replaceInPlace(
      title,
      level === "good"
        ? `${esc(heading)} <span class="nal-tag nal-tag-good">${badge}</span>`
        : `${esc(heading.replace("spend limit", "spend"))} <s>limit</s> suggestion <span class="nal-tag nal-tag-${level}">${badge}</span>`
    );
  }

  replaceInPlace(
    info,
    {
      good: "Requests are rejected once you reach this number. That is what a limit means.",
      loud: "Nothing stopped this number. “Enforce a hard limit” is off, so spend continues past it.",
      quiet: "“Enforce a hard limit” is off, so this number does not stop spend.",
      unknown: "Whether this number stops anything depends on a switch this card doesn’t show, which is off by default.",
    }[level]
  );

  card.insertAdjacentHTML("beforeend", `<div class="nal-new">${bannerHtml(spend, level)}</div>`);
  card.querySelector(".nal-cta")?.addEventListener("click", () => editButton?.click());
  return true;
};

const ALERT_LINE = /^Alert when spend reaches /;

const patchAlerts = () => {
  if (enforced === "on") {
    document.querySelectorAll("[data-nal-alert]").forEach((el) => {
      el.nextElementSibling?.remove();
      el.classList.remove("nal-orig");
      delete el.dataset.nalAlert;
    });
    return;
  }
  for (const el of document.querySelectorAll("span,div,p")) {
    const text = directText(el);
    if (!ALERT_LINE.test(text) || el.dataset.nalAlert) continue;
    el.dataset.nalAlert = "1";
    replaceInPlace(
      el,
      `${esc(text)} <span class="nal-rant">of the number you set above but obviously don’t stop serving requests because if you use up 100% of something clearly there’s more so just keep going until tokens or GPUs run out I guess</span>`
    );
  }
};

const patchModal = () => {
  const heading = [...document.querySelectorAll("h2")].find((h) => directText(h) === MODAL_TITLE);
  if (!heading) return;

  let modal = heading.parentElement;
  while (modal && !modal.innerText.includes(SWITCH_LABEL)) modal = modal.parentElement;
  if (!modal) return;

  const sw = modal.querySelector('button[role="switch"]');
  if (sw) {
    const observed = sw.getAttribute("aria-checked") === "true" ? "on" : "off";
    if (observed !== enforced) {
      enforced = observed;
      chrome.storage?.local.set({ ["nal:" + scopeId()]: enforced });
    }
  }

  if (modal.dataset.nalState === enforced) return;
  modal.querySelectorAll(".nal-new").forEach((n) => n.remove());
  modal.querySelectorAll(".nal-orig").forEach((n) => n.classList.remove("nal-orig"));
  modal.dataset.nalState = enforced;

  const desc = findByText((t) => t.startsWith(MODAL_DESC), modal);
  const ceiling = desc && directText(desc).match(/\(\$([\d,]+)\)/);
  if (ceiling && ceiling[1] !== tierCeiling) {
    tierCeiling = ceiling[1];
    chrome.storage?.local.set({ "nal:tier": tierCeiling });
  }
  if (desc) {
    replaceInPlace(
      desc,
      "The number below does not stop anything on its own. It is a notification threshold. The switch underneath it is the only thing that actually stops spend."
    );
  }

  const label = findByText((t) => t === SWITCH_LABEL, modal);
  const row = label?.closest("div") || label?.parentElement;
  if (row) {
    row.insertAdjacentHTML(
      "afterend",
      enforced === "on"
        ? `<div class="nal-new nal-note nal-note-good">This is what makes the number above real. Switch it off and the limit becomes decoration.</div>`
        : `<div class="nal-new nal-note"><strong>↑ This is the limit.</strong> While it is off, requests are served and billed past the number above.</div>`
    );
  }
};

const mountSwitch = () => {
  if (document.getElementById("nal-switch")) return;
  const el = document.createElement("button");
  el.id = "nal-switch";
  el.type = "button";
  el.addEventListener("click", () => {
    honest = !honest;
    chrome.storage?.local.set({ "nal:mode": honest });
    render();
  });
  document.body.append(el);
};

const render = () => {
  document.body.classList.toggle("nal-on", honest);
  const el = document.getElementById("nal-switch");
  if (el) {
    el.textContent = honest ? "Reality" : "OpenAI’s version";
    el.classList.toggle("nal-switch-off", !honest);
    el.style.display = onLimitsPage() ? "" : "none";
  }
};

let scope = null;

const syncScope = () => {
  const id = scopeId();
  if (id === scope) return;
  scope = id;
  enforced = "unknown";
  chrome.storage?.local.get(["nal:" + id], (stored) => {
    enforced = stored["nal:" + id] ?? "unknown";
    apply();
  });
};

const apply = () => {
  syncScope();
  if (!onLimitsPage()) {
    document.body.classList.remove("nal-loud", "nal-warn");
    render();
    return;
  }
  mountSwitch();
  patchCard();
  patchAlerts();
  patchModal();
  render();
};

let scheduled = false;
const observer = new MutationObserver(() => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    observer.disconnect();
    try {
      apply();
    } finally {
      observe();
    }
  });
});

const observe = () =>
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-checked"],
  });

chrome.storage?.local.get(["nal:mode", "nal:tier"], (stored) => {
  honest = stored["nal:mode"] ?? true;
  tierCeiling = stored["nal:tier"] ?? null;
  apply();
  observe();
});
