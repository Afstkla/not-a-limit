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

let enforced = "unknown";
let honest = true;

const replaceInPlace = (original, html) => {
  const copy = original.cloneNode(true);
  copy.classList.add("ltd-new");
  copy.innerHTML = html;
  original.classList.add("ltd-orig");
  original.after(copy);
  return copy;
};

const spendFromCard = (card) => {
  const m = card.innerText.match(/\$([\d,]+\.\d{2})\s*\/\s*\$([\d,]+\.\d{2})/);
  if (!m) return null;
  const num = (s) => Number(s.replace(/,/g, ""));
  return { spent: num(m[1]), limit: num(m[2]), limitText: "$" + m[2] };
};

const clearEscapeRoute = (card) => {
  for (let el = card.parentElement; el && el !== document.body; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowX;
    if (overflow === "hidden") el.classList.add("ltd-unclip");
    if (overflow === "auto" || overflow === "scroll") {
      el.classList.add("ltd-clipx");
      return;
    }
  }
};

const markProgressBar = (card) => {
  for (const el of card.querySelectorAll("div")) {
    if (el.offsetHeight > 0 && el.offsetHeight <= 10 && el.offsetWidth > 200) {
      el.classList.add("ltd-bar");
      return;
    }
  }
};

const bannerHtml = (spend) => {
  const limit = spend ? esc(spend.limitText) : "your limit";
  const over =
    spend && spend.spent > spend.limit
      ? ` You are at <strong>${Math.round((spend.spent / spend.limit) * 100)}%</strong> of it right now.`
      : "";

  if (enforced === "on") {
    return `<div class="ltd-banner ltd-good">
      <div class="ltd-banner-title">This one is real.</div>
      <div class="ltd-banner-body">“Enforce a hard limit” is on, so requests get rejected once spend reaches ${limit}.</div>
    </div>`;
  }
  if (enforced === "off") {
    return `<div class="ltd-banner">
      <div class="ltd-banner-title">This limit does not limit anything.</div>
      <div class="ltd-banner-body">“Enforce a hard limit” is switched <strong>off</strong>, so nothing stops your spend at ${limit}. Requests keep being served and billed past it, forever.${over} The number above is a notification threshold with a misleading name.</div>
      <button class="ltd-cta" type="button">Show me the switch that actually works →</button>
    </div>`;
  }
  return `<div class="ltd-banner">
    <div class="ltd-banner-title">Unverified — and this page won’t tell you.</div>
    <div class="ltd-banner-body">A spend limit only stops spend when “Enforce a hard limit” is on. That switch is hidden inside the editor, and nothing on this card reveals its state.${over}</div>
    <button class="ltd-cta" type="button">Open the editor and check →</button>
  </div>`;
};

const patchCard = () => {
  const info = findByText((t) => t === INFO_LINE);
  if (!info) {
    document.body.classList.remove("ltd-danger");
    return false;
  }

  let card = info.parentElement;
  while (card && !CARD_TITLES.some((t) => card.innerText.includes(t))) card = card.parentElement;
  if (!card) return false;

  document.body.classList.toggle("ltd-danger", enforced !== "on");

  if (card.dataset.ltdState === enforced) return true;
  card.querySelectorAll(".ltd-new").forEach((n) => n.remove());
  card.querySelectorAll(".ltd-orig").forEach((n) => n.classList.remove("ltd-orig"));
  card.dataset.ltd = "card";
  card.dataset.ltdState = enforced;

  const spend = spendFromCard(card);
  markProgressBar(card);
  clearEscapeRoute(card);

  const title = findByText((t) => CARD_TITLES.includes(t), card);
  if (title) {
    const word = directText(title).replace("spend limit", "spend");
    replaceInPlace(
      title,
      enforced === "on"
        ? `${esc(directText(title))} <span class="ltd-tag ltd-tag-good">ENFORCED</span>`
        : `${esc(word)} <s>limit</s> suggestion <span class="ltd-tag">NOT ENFORCED</span>`
    );
  }

  replaceInPlace(
    info,
    enforced === "on"
      ? "Requests are rejected once you reach this number. That is what a limit means."
      : "Nothing is stopping this number. “Enforce a hard limit” is off, so spend continues past it."
  );

  card.insertAdjacentHTML("beforeend", `<div class="ltd-new">${bannerHtml(spend)}</div>`);
  card.querySelector(".ltd-cta")?.addEventListener("click", () => {
    [...card.querySelectorAll("button")]
      .find((b) => b.innerText.trim() === MODAL_TITLE)
      ?.click();
  });
  return true;
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
      chrome.storage?.local.set({ ["ltd:" + scopeId()]: enforced });
    }
  }

  if (modal.dataset.ltdState === enforced) return;
  modal.querySelectorAll(".ltd-new").forEach((n) => n.remove());
  modal.querySelectorAll(".ltd-orig").forEach((n) => n.classList.remove("ltd-orig"));
  modal.dataset.ltdState = enforced;

  const desc = findByText((t) => t.startsWith(MODAL_DESC), modal);
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
        ? `<div class="ltd-new ltd-note ltd-note-good">This is what makes the number above real. Switch it off and the limit becomes decoration.</div>`
        : `<div class="ltd-new ltd-note"><strong>↑ This is the limit.</strong> While it is off, OpenAI keeps serving and billing requests past the number above. No cap, no cutoff, no email that stops anything.</div>`
    );
  }
};

const mountSwitch = () => {
  if (document.getElementById("ltd-switch")) return;
  const el = document.createElement("button");
  el.id = "ltd-switch";
  el.type = "button";
  el.addEventListener("click", () => {
    honest = !honest;
    chrome.storage?.local.set({ "ltd:mode": honest });
    render();
  });
  document.body.append(el);
};

const render = () => {
  document.body.classList.toggle("ltd-on", honest);
  const el = document.getElementById("ltd-switch");
  if (el) {
    el.textContent = honest ? "Reality" : "OpenAI’s version";
    el.classList.toggle("ltd-switch-off", !honest);
    el.style.display = onLimitsPage() ? "" : "none";
  }
};

const apply = () => {
  if (!onLimitsPage()) {
    document.body.classList.remove("ltd-danger");
    render();
    return;
  }
  mountSwitch();
  patchCard();
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

chrome.storage?.local.get(["ltd:" + scopeId(), "ltd:mode"], (stored) => {
  enforced = stored["ltd:" + scopeId()] ?? "unknown";
  honest = stored["ltd:mode"] ?? true;
  apply();
  observe();
});
