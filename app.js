const state = {
  step: "welcome",
  profile: {
    wifeName: "Emily",
    neighborhood: "Lincoln Park",
    email: "you@example.com",
    cadence: "Quarterly",
    budget: 50,
    categories: ["Flowers", "Sweets", "Local goods"],
    colors: ["Green", "Warm neutrals"],
    treats: "Dark chocolate, almond croissants, and good coffee",
    hobbies: "Reading, Saturday walks, cooking",
    dislikes: "Anything too flashy",
    delivery: "Pickup or local delivery",
    lastGift: "A candle from a boutique"
  },
  selectedGiftId: null,
  saved: [],
  toastMessage: ""
};

const gifts = [
  {
    id: "blooms",
    name: "Petite seasonal bouquet",
    merchant: "Pollen Floral Design",
    neighborhood: "Logan Square",
    price: 42,
    category: "Flowers",
    image: "./assets/flowers.png",
    link: "https://www.google.com/search?q=Pollen+Floral+Design+Chicago",
    pickup: "Local pickup or delivery window",
    tags: ["classic", "low effort", "same-week"],
    reason:
      "A smaller arrangement keeps the gesture confident and casual, with enough polish to feel intentional."
  },
  {
    id: "bakery",
    name: "Croissant box and coffee beans",
    merchant: "Lost Larson",
    neighborhood: "Andersonville",
    price: 36,
    category: "Sweets",
    image: "./assets/bakery.png",
    link: "https://www.google.com/search?q=Lost+Larson+Chicago",
    pickup: "Best for morning pickup",
    tags: ["morning pickup", "under $40", "easy win"],
    reason:
      "This fits her favorite treats without feeling like a big production. It turns an ordinary morning into a small occasion."
  },
  {
    id: "book",
    name: "Staff-pick paperback and note card",
    merchant: "Women & Children First",
    neighborhood: "Andersonville",
    price: 31,
    category: "Books",
    image: "./assets/bookshop.png",
    link: "https://www.google.com/search?q=Women+and+Children+First+Chicago+bookstore",
    pickup: "Pickup friendly",
    tags: ["reader", "personal", "easy pickup"],
    reason:
      "Because she likes reading, a staff-picked paperback plus a short note feels specific without requiring you to know the perfect title."
  },
  {
    id: "candle",
    name: "Hand-poured candle and matchbox",
    merchant: "Neighborly",
    neighborhood: "Lincoln Square",
    price: 48,
    category: "Local goods",
    image: "./assets/candle.png",
    link: "https://www.google.com/search?q=Neighborly+Chicago+Lincoln+Square",
    pickup: "Pickup or local shipping",
    tags: ["home", "artisan", "giftable"],
    reason:
      "A warm home gift lands well when she likes simple, useful things and avoids anything too flashy."
  },
  {
    id: "tea",
    name: "Tea sampler and honey",
    merchant: "Rare Tea Cellar",
    neighborhood: "Ravenswood",
    price: 45,
    category: "Coffee/tea",
    image: "./assets/tea.png",
    link: "https://www.google.com/search?q=Rare+Tea+Cellar+Chicago",
    pickup: "Ships locally; check pickup availability",
    tags: ["quiet night", "foodie", "small luxury"],
    reason:
      "This is a relaxed evening gift, especially if she enjoys cooking and a calm ritual after a long day."
  }
];

const app = document.querySelector("#app");

function nextSirseeDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function visibleGifts() {
  const max = Number(state.profile.budget);
  return gifts.filter((gift) => gift.price <= max).slice(0, 5);
}

function render() {
  app.innerHTML = `
    ${topbar()}
    ${screen()}
    ${toast()}
  `;
  bindEvents();
}

function topbar() {
  const steps = ["welcome", "quiz", "cadence", "dashboard"];
  const activeIndex = Math.max(0, steps.indexOf(state.step));
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">S</div>
        <div>
          <p class="brand-title">Sirsee</p>
          <p class="brand-caption">A practical system for small gifts.</p>
        </div>
      </div>
      <div class="progress" aria-label="Progress">
        ${steps.map((_, index) => `<span class="dot ${index <= activeIndex ? "is-active" : ""}"></span>`).join("")}
      </div>
    </header>
  `;
}

function screen() {
  if (state.step === "quiz") return quizScreen();
  if (state.step === "cadence") return cadenceScreen();
  if (state.step === "dashboard") return dashboardScreen();
  if (state.step === "gift") return giftScreen();
  return welcomeScreen();
}

function welcomeScreen() {
  return `
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">Chicago pilot</p>
        <h1>Remember the small gift before it becomes overdue.</h1>
        <p class="hero-text">
          Set a rhythm, capture what she likes, and get a short list of local Chicago gifts that feel considered without turning into another errand.
        </p>
        <div class="hero-actions">
          <button class="primary" data-go="quiz">Build her profile</button>
          <button class="secondary" data-go="dashboard">View demo dashboard</button>
        </div>
      </div>
      <div class="visual-band">
        <img src="./assets/hero.png" alt="A wrapped gift, notebook, coffee, and flowers on a table" />
        <div class="visual-note">
          <strong>Quarterly by default</strong>
          Local flowers, bakery goods, books, coffee, and artisan goods in the $25-$50 range.
        </div>
      </div>
    </section>
  `;
}

function quizScreen() {
  return `
    <section class="layout">
      <div class="panel">
        <p class="eyebrow">Step 1</p>
        <h2>Build a simple gift profile.</h2>
        <p>Keep the inputs practical. Sirsee uses these clues to make the first set of recommendations specific.</p>
        <div class="quiz-grid">
          ${inputField("wifeName", "Her first name", state.profile.wifeName)}
          ${inputField("neighborhood", "Your Chicago neighborhood", state.profile.neighborhood)}
          ${inputField("email", "Reminder email", state.profile.email, "email")}
          ${inputField("treats", "Favorite treats", state.profile.treats)}
          ${inputField("hobbies", "Interests or rituals", state.profile.hobbies)}
          ${inputField("dislikes", "Avoid these", state.profile.dislikes)}
        </div>
      </div>
      <div class="panel">
        <h3>Gift lanes</h3>
        <p>Select the categories that are usually a safe bet.</p>
        <div class="chip-row" data-chip-group="categories">
          ${["Flowers", "Sweets", "Coffee/tea", "Books", "Candles", "Local goods"].map((label) => chip(label, state.profile.categories.includes(label))).join("")}
        </div>
        <h3 style="margin-top: 20px;">Color cues</h3>
        <div class="chip-row" data-chip-group="colors">
          ${["Green", "White", "Blue", "Warm neutrals", "Deep colors", "Bright colors"].map((label) => chip(label, state.profile.colors.includes(label))).join("")}
        </div>
        <h3 style="margin-top: 20px;">Delivery preference</h3>
        <select class="select" data-profile="delivery">
          ${["Pickup or local delivery", "Pickup is fine", "Delivery preferred"].map((option) => `<option ${state.profile.delivery === option ? "selected" : ""}>${option}</option>`).join("")}
        </select>
        <div class="footer-actions">
          <button class="ghost" data-go="welcome">Back</button>
          <button class="primary" data-go="cadence">Set cadence</button>
        </div>
      </div>
    </section>
  `;
}

function cadenceScreen() {
  return `
    <section class="layout">
      <div class="panel">
        <p class="eyebrow">Step 2</p>
        <h2>Set the operating rhythm.</h2>
        <p>Quarterly keeps the habit manageable. Sirsee can still surface seasonal ideas inside the same budget.</p>
        <div class="field">
          <label for="cadence">Gift cadence</label>
          <select id="cadence" class="select" data-profile="cadence">
            ${["Quarterly", "Every 2 months", "Monthly"].map((option) => `<option ${state.profile.cadence === option ? "selected" : ""}>${option}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="margin-top: 18px;">
          <span class="field-title">Max gift price</span>
          <div class="slider-row">
            <input class="range" data-profile="budget" type="range" min="25" max="100" step="5" value="${state.profile.budget}" />
            <span class="budget-value">$${state.profile.budget}</span>
          </div>
        </div>
      </div>
      <div class="panel">
        <h3>Reminder brief</h3>
        <div class="summary-grid">
          <div class="summary-item"><span>Next reminder</span><strong>${nextSirseeDate()}</strong></div>
          <div class="summary-item"><span>Default spend</span><strong>$25-$${state.profile.budget}</strong></div>
          <div class="summary-item"><span>Market</span><strong>Chicago local</strong></div>
          <div class="summary-item"><span>Channel</span><strong>Email concept</strong></div>
        </div>
        <p class="notice">Demo note: reminders are simulated in this MVP. No emails are sent and merchant availability is not live.</p>
        <div class="footer-actions">
          <button class="ghost" data-go="quiz">Back</button>
          <button class="primary" data-go="dashboard">See recommendations</button>
        </div>
      </div>
    </section>
  `;
}

function dashboardScreen() {
  const recs = visibleGifts();
  return `
    <section class="layout">
      <div class="panel dashboard-main">
        <p class="eyebrow">Your Sirsee plan</p>
        <h2>${state.profile.wifeName}'s next gift brief is ready.</h2>
        <div class="stats-grid">
          <div class="stat"><span>Next reminder</span><strong>${nextSirseeDate()}</strong></div>
          <div class="stat"><span>Cadence</span><strong>${state.profile.cadence}</strong></div>
          <div class="stat"><span>Budget</span><strong>Up to $${state.profile.budget}</strong></div>
          <div class="stat"><span>Market</span><strong>Chicago</strong></div>
        </div>
      </div>
      <div class="panel">
        <h3>Her profile</h3>
        <div class="summary-grid">
          <div class="summary-item"><span>Gift lanes</span><strong>${state.profile.categories.join(", ")}</strong></div>
          <div class="summary-item"><span>Favorite treats</span><strong>${state.profile.treats}</strong></div>
          <div class="summary-item"><span>Interests</span><strong>${state.profile.hobbies}</strong></div>
          <div class="summary-item"><span>Avoid</span><strong>${state.profile.dislikes}</strong></div>
        </div>
        <div class="footer-actions">
          <button class="secondary" data-go="quiz">Edit profile</button>
          <button class="secondary" data-go="cadence">Edit cadence</button>
        </div>
      </div>
      <div class="panel">
        <h3>Saved ideas</h3>
        ${
          state.saved.length
            ? state.saved.map((id) => {
                const gift = gifts.find((item) => item.id === id);
                return `<div class="saved-item"><strong>${gift.name}</strong><span>${gift.merchant}</span></div>`;
              }).join("")
            : `<p>No saved gifts yet. Save one when it looks like the right move.</p>`
        }
      </div>
      <div class="panel dashboard-main">
        <h3>This quarter's short list</h3>
        <div class="recommendation-grid">
          ${recs.map(recommendationCard).join("")}
        </div>
      </div>
    </section>
  `;
}

function giftScreen() {
  const gift = gifts.find((item) => item.id === state.selectedGiftId) || gifts[0];
  const isSaved = state.saved.includes(gift.id);
  return `
    <section class="gift-detail">
      <div>
        <img src="${gift.image}" alt="${gift.name}" />
      </div>
      <div class="panel">
        <p class="eyebrow">${gift.category} · ${gift.neighborhood}</p>
        <h2>${gift.name}</h2>
        <p>${gift.reason}</p>
        <div class="merchant-box">
          <span class="merchant-meta">Merchant</span>
          <h3>${gift.merchant}</h3>
          <p>${gift.pickup}</p>
          <strong class="price">$${gift.price} estimated</strong>
        </div>
        <div class="tag-list" style="margin-top: 14px;">
          ${gift.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
        </div>
        <p class="notice">Sirsee links out to the merchant. This MVP does not confirm live price, inventory, delivery, or pickup windows.</p>
        <div class="footer-actions">
          <button class="ghost" data-go="dashboard">Back</button>
          <button class="secondary" data-save="${gift.id}">${isSaved ? "Saved" : "Save idea"}</button>
          <a class="primary" href="${gift.link}" target="_blank" rel="noreferrer" style="display:inline-grid;place-items:center;text-decoration:none;">View merchant</a>
        </div>
      </div>
    </section>
  `;
}

function inputField(key, label, value, type = "text") {
  return `
    <div class="field">
      <label for="${key}">${label}</label>
      <input id="${key}" class="input" data-profile="${key}" type="${type}" value="${escapeHtml(value)}" />
    </div>
  `;
}

function chip(label, selected) {
  return `<button class="chip ${selected ? "is-selected" : ""}" data-chip="${label}" type="button">${label}</button>`;
}

function recommendationCard(gift) {
  return `
    <article class="recommendation-card">
      <img src="${gift.image}" alt="${gift.name}" />
      <div class="recommendation-body">
        <div class="recommendation-head">
          <h3>${gift.name}</h3>
          <span class="price">$${gift.price}</span>
        </div>
        <span class="card-meta">${gift.merchant} · ${gift.neighborhood}</span>
        <p>${gift.reason}</p>
        <div class="tag-list">
          ${gift.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
        </div>
        <button class="primary" data-gift="${gift.id}">View gift</button>
      </div>
    </article>
  `;
}

function toast() {
  return `<div class="toast ${state.toastMessage ? "" : "hidden"}" role="status">${state.toastMessage}</div>`;
}

function bindEvents() {
  document.querySelectorAll("[data-go]").forEach((button) => {
    button.addEventListener("click", () => {
      state.step = button.dataset.go;
      render();
    });
  });

  document.querySelectorAll("[data-profile]").forEach((field) => {
    field.addEventListener("input", () => updateProfile(field));
    field.addEventListener("change", () => updateProfile(field));
  });

  document.querySelectorAll("[data-chip]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = button.closest("[data-chip-group]").dataset.chipGroup;
      const value = button.dataset.chip;
      const list = state.profile[group];
      state.profile[group] = list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
      render();
    });
  });

  document.querySelectorAll("[data-gift]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedGiftId = button.dataset.gift;
      state.step = "gift";
      render();
    });
  });

  document.querySelectorAll("[data-save]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.save;
      if (!state.saved.includes(id)) state.saved.push(id);
      state.toastMessage = "Saved to this quarter's Sirsee ideas.";
      render();
      window.setTimeout(() => {
        state.toastMessage = "";
        render();
      }, 1800);
    });
  });
}

function updateProfile(field) {
  const key = field.dataset.profile;
  state.profile[key] = field.type === "range" ? Number(field.value) : field.value;
  if (field.type === "range") {
    const value = document.querySelector(".budget-value");
    if (value) value.textContent = `$${field.value}`;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

render();
