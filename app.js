const state = {
  screen: "brief",
  brief: {
    recipientName: "Emily",
    recipientGender: "female",
    budget: 50,
    zipCode: "60614",
    likes: ["flowers", "coffee", "sweets"],
    customLike: ""
  },
  selectedGiftId: null
};

const gifts = [
  {
    id: "blooms",
    name: "Farm-grown seasonal bouquet",
    merchant: "Southside Blooms",
    neighborhood: "Englewood",
    price: 50,
    category: "Flowers",
    image: "./assets/flowers.png",
    link: "https://southsideblooms.com/",
    delivery: "Chicago delivery available through the merchant",
    tags: ["delivery", "urban farm", "mission-driven"],
    reason:
      "it feels personal without being formal, and it comes from a distinctive Chicago grower instead of a generic flower chain."
  },
  {
    id: "truffles",
    name: "Handmade truffle medley",
    merchant: "Katherine Anne Confections",
    neighborhood: "Logan Square / Irving Park",
    price: 39,
    category: "Sweets",
    image: "./assets/bakery.png",
    link: "https://www.katherine-anne.com/truffles",
    delivery: "Online ordering with shipping or local delivery options",
    tags: ["delivery", "handmade", "Chicago confectioner"],
    reason:
      "the flavors feel crafted and specific, while the order still stays easy enough for a spontaneous gesture."
  },
  {
    id: "ceramic",
    name: "Small ceramic bud vase",
    merchant: "Neighborly",
    neighborhood: "Lincoln Square",
    price: 28,
    category: "Local goods",
    image: "./assets/bookshop.png",
    link: "https://neighborlyshop.com/collections/home-decor",
    delivery: "Ships from a Chicago shop",
    tags: ["delivery", "artisan", "useful"],
    reason:
      "it is small, tactile, and quietly stylish, the kind of object that makes a shelf or desk feel more considered."
  },
  {
    id: "candle",
    name: "Mini candle gift set trio",
    merchant: "Neighborly",
    neighborhood: "Lincoln Square",
    price: 48,
    category: "Local goods",
    image: "./assets/candle.png",
    link: "https://neighborlyshop.com/products/p-f-candle-greatest-hits-mini-candle-gift-set-trio",
    delivery: "Ships from Neighborly",
    tags: ["delivery", "home", "artisan"],
    reason:
      "it lands as warm and thoughtful without feeling oversized, and the shop has a curated local-goods feel."
  },
  {
    id: "tea",
    name: "Tea sampler and honey",
    merchant: "Rare Tea Cellar",
    neighborhood: "Ravenswood",
    price: 45,
    category: "Coffee/tea",
    image: "./assets/tea.png",
    link: "https://rareteacellar.com/products/master-tea-sampler",
    delivery: "Ships from Rare Tea Cellar",
    tags: ["delivery", "foodie", "small luxury"],
    reason:
      "it creates a relaxed evening ritual and feels more special than grabbing a bag from a national chain."
  }
];

const app = document.querySelector("#app");
const budgetOptions = [20, 50];
const chicagolandZipPattern = /^60[0-8]\d{2}$/;
const genderOptions = [
  { id: "female", label: "Female", summary: "Shopping for her", defaults: ["flowers", "coffee", "sweets"] },
  { id: "male", label: "Male", summary: "Shopping for him", defaults: ["coffee", "sweets", "home"] }
];
const likeOptionsByGender = {
  female: [
    { id: "flowers", label: "Flowers or plants", image: "./assets/likes/flowers-plants.png", categories: ["Flowers"] },
    { id: "sweets", label: "Chocolate & pastries", image: "./assets/likes/chocolate-pastries.png", categories: ["Sweets"] },
    { id: "coffee", label: "Coffee or tea", image: "./assets/likes/coffee-tea.png", categories: ["Coffee/tea", "Sweets"] },
    { id: "home", label: "Candles & home", image: "./assets/likes/candles-home.png", categories: ["Local goods"] },
    { id: "spa", label: "Self-care", image: "./assets/likes/self-care.png", categories: ["Local goods"] },
    { id: "foodie", label: "Foodie treats", image: "./assets/likes/foodie-treats.png", categories: ["Sweets", "Coffee/tea"] },
    { id: "cozy", label: "Cozy night in", image: "./assets/likes/cozy-night.png", categories: ["Coffee/tea", "Local goods"] }
  ],
  male: [
    { id: "coffee", label: "Coffee beans or tea", image: "./assets/likes/coffee-tea.png", categories: ["Coffee/tea", "Sweets"] },
    { id: "sweets", label: "Bakery treats", image: "./assets/likes/chocolate-pastries.png", categories: ["Sweets"] },
    { id: "home", label: "Home goods", image: "./assets/likes/home-goods.png", categories: ["Local goods"] },
    { id: "plants", label: "Plants", image: "./assets/likes/flowers-plants.png", categories: ["Flowers"] },
    { id: "snacks", label: "Snack run", image: "./assets/likes/snack-run.png", categories: ["Sweets"] },
    { id: "bar", label: "Bar cart", image: "./assets/likes/bar-cart.png", categories: ["Coffee/tea", "Local goods"] },
    { id: "desk", label: "Desk upgrade", image: "./assets/likes/desk-upgrade.png", categories: ["Local goods"] }
  ]
};

function render() {
  app.innerHTML = `
    ${topbar()}
    ${screen()}
  `;
  bindEvents();
}

function topbar() {
  return `
    <header class="topbar">
      <button class="brand" type="button" data-go="brief" aria-label="Start over">
        <span class="brand-mark" aria-hidden="true">S</span>
        <span>
          <span class="brand-title">Sirsee</span>
          <span class="brand-caption">Small spontaneous gifts in Chicagoland.</span>
        </span>
      </button>
      <span class="city-badge">Chicagoland pilot</span>
    </header>
  `;
}

function screen() {
  if (state.screen === "results") return resultsScreen();
  if (state.screen === "detail") return detailScreen();
  return briefScreen();
}

function briefScreen() {
  return `
    <section class="brief-screen">
      <div class="brief-copy">
        <p class="eyebrow">Chicagoland gift finder</p>
        <h1>A small gift, just because.</h1>
        <p>
          Sirsee is for spontaneous gift giving: partners, friends, parents, siblings, or anyone who would appreciate a small unexpected thing. Share a few clues and get one strong local pick plus two backups.
        </p>
        <div class="promise-list" aria-label="What Sirsee returns">
          <span>Artisanal local shops</span>
          <span>Delivery first</span>
          <span>Best pick first</span>
          <span>No chain-store filler</span>
        </div>
        <img class="brief-visual" src="./assets/hero.png" alt="" />
      </div>

      <form class="brief-panel" data-brief-form>
        <div class="section-heading">
          <p class="eyebrow">Quick brief</p>
          <h2>Who are you surprising?</h2>
        </div>
        <div class="field-grid">
          ${inputField("recipientName", "Recipient name", state.brief.recipientName)}
          <div class="field">
            <span class="field-title">Shopping for</span>
            <div class="segment-group" role="group" aria-label="Recipient gender">
              ${genderOptions.map(genderButton).join("")}
            </div>
          </div>
          ${inputField("zipCode", "Chicagoland ZIP code", state.brief.zipCode, "text", "60614", "numeric")}
          <div class="field">
            <span class="field-title">Budget</span>
            <div class="segment-group budget-group" role="group" aria-label="Budget">
              ${budgetOptions.map(budgetButton).join("")}
              ${customBudgetField()}
            </div>
          </div>
        </div>
        <div class="field">
          <span class="field-title">Likes</span>
          <div class="like-grid" aria-label="Likes">
            ${activeLikeOptions().map(likeTile).join("")}
            ${customLikeTile()}
          </div>
        </div>
        <button class="primary full-width" type="submit">Find gift ideas</button>
      </form>
    </section>
  `;
}

function resultsScreen() {
  const [best, ...backups] = recommendations();

  return `
    <section class="results-screen">
      <div class="results-header">
        <div>
          <p class="eyebrow">Delivery-ready Chicagoland picks for ${escapeHtml(state.brief.recipientName)}</p>
          <h1>Spontaneous gift ideas</h1>
          <p>${briefSummary()}</p>
        </div>
        <button class="secondary" type="button" data-go="brief">Edit brief</button>
      </div>

      ${bestCard(best)}

      <section class="backup-section" aria-label="Backup gift ideas">
        <div class="section-heading">
          <p class="eyebrow">Backups</p>
          <h2>Two easy alternatives.</h2>
        </div>
        <div class="backup-grid">
          ${backups.map(backupCard).join("")}
        </div>
      </section>
    </section>
  `;
}

function detailScreen() {
  const gift = decoratedGift(gifts.find((item) => item.id === state.selectedGiftId) || recommendations()[0]);

  return `
    <section class="detail-screen">
      <button class="text-button back-link" type="button" data-go="results">Back to results</button>
      <div class="detail-layout">
        <img class="detail-image" src="${gift.image}" alt="${escapeHtml(gift.name)}" />
        <div class="detail-panel">
          <p class="eyebrow">Chicagoland · ${escapeHtml(gift.category)} · ${escapeHtml(gift.neighborhood)}</p>
          <h1>${escapeHtml(gift.name)}</h1>
          <p>${escapeHtml(whyThisWorks(gift))}</p>
          <dl class="detail-list">
            <div>
              <dt>Merchant</dt>
              <dd>${escapeHtml(gift.merchant)}</dd>
            </div>
            <div>
              <dt>Estimate</dt>
              <dd>$${gift.price} · ${escapeHtml(budgetFit(gift))}</dd>
            </div>
            <div>
              <dt>Delivery note</dt>
              <dd>${escapeHtml(gift.delivery)}</dd>
            </div>
          </dl>
          <div class="tag-list">
            ${gift.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <div class="action-row">
            <button class="secondary" type="button" data-go="results">See backups</button>
            <a class="primary" href="${gift.link}" target="_blank" rel="noreferrer">View merchant</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

function bestCard(gift) {
  return `
    <article class="best-card">
      <img src="${gift.image}" alt="${escapeHtml(gift.name)}" />
      <div class="best-body">
        <div class="card-kicker">
          <span class="pill">Best pick</span>
          <span>${escapeHtml(budgetFit(gift))}</span>
        </div>
        <h2>${escapeHtml(gift.name)}</h2>
        <p class="merchant-line">${escapeHtml(gift.merchant)} · ${escapeHtml(gift.neighborhood)} · $${gift.price}</p>
        <p>${escapeHtml(whyThisWorks(gift))}</p>
        <dl class="detail-list compact">
          <div>
            <dt>Delivery</dt>
            <dd>${escapeHtml(gift.delivery)}</dd>
          </div>
          <div>
            <dt>Fit</dt>
            <dd>${escapeHtml(gift.tags.join(", "))}</dd>
          </div>
        </dl>
        <div class="action-row">
          <button class="secondary" type="button" data-detail="${gift.id}">Details</button>
          <a class="primary" href="${gift.link}" target="_blank" rel="noreferrer">View merchant</a>
        </div>
      </div>
    </article>
  `;
}

function backupCard(gift) {
  return `
    <article class="backup-card">
      <img src="${gift.image}" alt="${escapeHtml(gift.name)}" />
      <div class="backup-body">
        <div>
          <span class="card-meta">${escapeHtml(gift.merchant)} · $${gift.price}</span>
          <h3>${escapeHtml(gift.name)}</h3>
          <p class="delivery-line">${escapeHtml(gift.delivery)}</p>
          <p>${escapeHtml(whyThisWorks(gift))}</p>
        </div>
        <div class="action-row compact-actions">
          <button class="text-button" type="button" data-detail="${gift.id}">Details</button>
          <a class="primary" href="${gift.link}" target="_blank" rel="noreferrer">View merchant</a>
        </div>
      </div>
    </article>
  `;
}

function inputField(key, label, value, type = "text", placeholder = "", inputMode = "") {
  return `
    <div class="field">
      <label for="${key}">${label}</label>
      <input id="${key}" class="input" data-brief="${key}" type="${type}" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" inputmode="${escapeAttribute(inputMode)}" />
    </div>
  `;
}

function likeTile(option) {
  const selected = state.brief.likes.includes(option.id);
  return `
    <button class="like-tile ${selected ? "is-selected" : ""}" type="button" data-like="${option.id}" aria-pressed="${selected}">
      <img src="${option.image}" alt="" />
      <span>${escapeHtml(option.label)}</span>
    </button>
  `;
}

function customLikeTile() {
  return `
    <label class="like-tile custom-like ${state.brief.customLike.trim() ? "is-selected" : ""}">
      <span>Something else</span>
      <input class="custom-like-input" data-brief="customLike" type="text" value="${escapeAttribute(state.brief.customLike)}" placeholder="${escapeAttribute(customLikePlaceholder())}" />
    </label>
  `;
}

function budgetButton(amount) {
  const selected = Number(state.brief.budget) === amount;
  return `
    <button class="segment ${selected ? "is-selected" : ""}" type="button" data-budget="${amount}" aria-pressed="${selected}">
      $${amount}
    </button>
  `;
}

function customBudgetField() {
  const customValue = budgetOptions.includes(Number(state.brief.budget)) ? "" : Number(state.brief.budget);
  const selected = Boolean(customValue);
  return `
    <label class="custom-budget ${selected ? "is-selected" : ""}">
      <span class="sr-only">Custom budget</span>
      <span class="budget-prefix">$</span>
      <input class="custom-budget-input" data-budget-custom type="number" min="1" step="1" value="${escapeAttribute(customValue)}" placeholder="Other" aria-label="Custom budget" />
    </label>
  `;
}

function genderButton(option) {
  const selected = state.brief.recipientGender === option.id;
  return `
    <button class="segment ${selected ? "is-selected" : ""}" type="button" data-gender="${option.id}" aria-pressed="${selected}">
      ${option.label}
    </button>
  `;
}

function activeLikeOptions() {
  return likeOptionsByGender[state.brief.recipientGender] || likeOptionsByGender.female;
}

function customLikePlaceholder() {
  return state.brief.recipientGender === "male"
    ? "e.g. vinyl, grilling, desk gear"
    : "e.g. skincare, ceramics, jewelry";
}

function recommendations() {
  return gifts
    .map(decoratedGift)
    .sort((a, b) => b.score - a.score || a.price - b.price)
    .slice(0, 3);
}

function decoratedGift(gift) {
  return {
    ...gift,
    overBudget: Math.max(0, gift.price - Number(state.brief.budget)),
    score: scoreGift(gift)
  };
}

function scoreGift(gift) {
  const budget = Number(state.brief.budget);
  const overBudget = Math.max(0, gift.price - budget);
  const selectedLikes = activeLikeOptions().filter((option) => state.brief.likes.includes(option.id));
  const customLikeText = state.brief.customLike.toLowerCase();
  const isChicagolandZip = chicagolandZipPattern.test(state.brief.zipCode.trim());
  let score = gift.price <= budget ? 100 : Math.max(0, 85 - overBudget * 10);

  if (isChicagolandZip) score += 8;
  if (selectedLikes.some((option) => option.categories.includes(gift.category))) score += 30;
  if (gift.category === "Flowers" && /flower|bouquet|plant/.test(customLikeText)) score += 24;
  if (gift.category === "Sweets" && /chocolate|pastr|croissant|bakery|sweet|dessert/.test(customLikeText)) score += 24;
  if (gift.category === "Coffee/tea" && /coffee|tea|matcha|chai/.test(customLikeText)) score += 24;
  if (gift.category === "Local goods" && /candle|home|ceramic|skincare|record|vinyl|jewelry|art|desk|bar|grill/.test(customLikeText)) score += 24;
  if (state.brief.likes.includes("coffee") && gift.tags.some((tag) => /morning|quiet|foodie/.test(tag))) score += 8;
  if (gift.tags.some((tag) => /delivery|ships|artisan|handmade|small luxury/.test(tag))) score += 10;

  return score;
}

function whyThisWorks(gift) {
  const budgetText = gift.price <= Number(state.brief.budget)
    ? `It stays inside the $${state.brief.budget} brief`
    : `It is $${gift.overBudget} over the $${state.brief.budget} brief, so it stays in the near-budget set`;
  return `${budgetText}, matches ${likesSummary().toLowerCase()}, includes a delivery option, and works as a spontaneous small surprise because ${gift.reason}`;
}

function budgetFit(gift) {
  return gift.price <= Number(state.brief.budget)
    ? `Within $${state.brief.budget}`
    : `$${gift.overBudget} over budget`;
}

function briefSummary() {
  return `${escapeHtml(genderSummary())} · ZIP ${escapeHtml(state.brief.zipCode)} · Up to $${state.brief.budget} · Likes: ${escapeHtml(likesSummary())}`;
}

function likesSummary() {
  return state.brief.likes
    .map((id) => activeLikeOptions().find((option) => option.id === id)?.label)
    .filter(Boolean)
    .concat(state.brief.customLike.trim() ? [state.brief.customLike.trim()] : [])
    .join(", ") || "small local surprises";
}

function genderSummary() {
  return genderOptions.find((option) => option.id === state.brief.recipientGender)?.summary || "Shopping for them";
}

function bindEvents() {
  document.querySelectorAll("[data-go]").forEach((control) => {
    control.addEventListener("click", () => {
      state.screen = control.dataset.go;
      render();
    });
  });

  document.querySelectorAll("[data-brief]").forEach((field) => {
    field.addEventListener("input", () => {
      state.brief[field.dataset.brief] = field.value;
      if (field.dataset.brief === "customLike") {
        field.closest(".custom-like")?.classList.toggle("is-selected", Boolean(field.value.trim()));
      }
    });
  });

  document.querySelectorAll("[data-budget]").forEach((button) => {
    button.addEventListener("click", () => {
      state.brief.budget = Number(button.dataset.budget);
      render();
    });
  });

  document.querySelectorAll("[data-budget-custom]").forEach((field) => {
    field.addEventListener("input", () => {
      const amount = Number(field.value);
      if (amount > 0) {
        state.brief.budget = Math.round(amount);
        document.querySelectorAll("[data-budget]").forEach((button) => {
          button.classList.toggle("is-selected", false);
          button.setAttribute("aria-pressed", "false");
        });
        field.closest(".custom-budget")?.classList.add("is-selected");
      } else {
        state.brief.budget = 50;
        field.closest(".custom-budget")?.classList.remove("is-selected");
        const defaultBudget = document.querySelector('[data-budget="50"]');
        defaultBudget?.classList.add("is-selected");
        defaultBudget?.setAttribute("aria-pressed", "true");
      }
    });
  });

  document.querySelectorAll("[data-gender]").forEach((button) => {
    button.addEventListener("click", () => {
      const gender = button.dataset.gender;
      const option = genderOptions.find((item) => item.id === gender);
      state.brief.recipientGender = gender;
      state.brief.likes = option ? [...option.defaults] : [];
      render();
    });
  });

  document.querySelectorAll("[data-like]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.like;
      const likes = state.brief.likes;
      state.brief.likes = likes.includes(id) ? likes.filter((item) => item !== id) : [...likes, id];
      render();
    });
  });

  document.querySelectorAll("[data-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedGiftId = button.dataset.detail;
      state.screen = "detail";
      render();
    });
  });

  const form = document.querySelector("[data-brief-form]");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      state.screen = "results";
      render();
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

render();
