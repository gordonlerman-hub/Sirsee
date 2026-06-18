import {
  externalAuthAppUrl,
  getAccessToken,
  getSessionUser,
  initAuth,
  isAuthConfigured,
  isEmbeddedAuthBrowser,
  onAuthStateChange,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  signUpWithPassword
} from "./auth.js";

const state = {
  screen: "brief",
  brief: {
    recipientName: "Nora",
    recipientGender: "female",
    budget: 50,
    zipCode: "60614",
    likes: ["flowers", "coffee", "sweets"],
    customLike: ""
  },
  selectedGiftId: null,
  gifts: [],
  location: null,
  loading: false,
  loadingRefresh: false,
  hasMore: false,
  shownGiftIds: [],
  error: null,
  reminderDraft: {
    frequency: "quarterly"
  },
  reminders: [],
  reminderSaving: false,
  reminderError: null,
  editingReminderName: null,
  reminderEditDraft: {
    frequency: "quarterly"
  },
  authReady: false,
  authConfigured: false,
  authLoading: false,
  authUser: null,
  authMode: "signup",
  authError: null,
  authNotice: null,
  authReturnScreen: null,
  pendingReminderSignup: false,
  authEmbeddedBrowser: false,
  authDraft: {
    email: "",
    password: "",
    confirmPassword: ""
  }
};

const app = document.querySelector("#app");
const budgetOptions = [25, 50];
const SEARCH_MIN_DELAY_MS = 2200;
const REFRESH_MIN_DELAY_MS = 1400;
const reminderFrequencyOptions = [
  { id: "monthly", label: "Monthly", summary: "every month" },
  { id: "quarterly", label: "Quarterly", summary: "every 3 months" },
  { id: "biannual", label: "Twice a year", summary: "every 6 months" }
];
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
    { id: "foodie", label: "Foodie treats", image: "./assets/likes/foodie-treats.png", categories: ["Sweets", "Coffee/tea"] },
    { id: "cozy", label: "Cozy night in", image: "./assets/likes/cozy-night.png", categories: ["Coffee/tea", "Local goods"] }
  ],
  male: [
    { id: "coffee", label: "Coffee beans or tea", image: "./assets/likes/coffee-tea.png", categories: ["Coffee/tea", "Sweets"] },
    { id: "sweets", label: "Bakery treats", image: "./assets/likes/chocolate-pastries.png", categories: ["Sweets"] },
    { id: "home", label: "Home goods", image: "./assets/likes/home-goods.png", categories: ["Local goods"] },
    { id: "plants", label: "Plants", image: "./assets/likes/flowers-plants.png", categories: ["Flowers"] },
    { id: "foodie", label: "Foodie treats", image: "./assets/likes/foodie-treats.png", categories: ["Sweets", "Coffee/tea"] },
    { id: "bar", label: "Bar cart", image: "./assets/likes/bar-cart.png", categories: ["Bar & spirits"] }
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
  const onAccount = state.screen === "reminders" || state.screen === "reminder-settings";
  return `
    <header class="topbar">
      <button class="brand" type="button" data-go="brief" aria-label="Start over">
        <span class="brand-mark" aria-hidden="true">S</span>
        <span>
          <span class="brand-title">Sirsee</span>
          <span class="brand-caption">Small spontaneous gifts in Chicagoland.</span>
        </span>
      </button>
      <div class="topbar-nav">
        <button class="topbar-link ${onAccount ? "is-active" : ""}" type="button" data-go="reminders">Account</button>
        ${state.authUser ? `<button class="topbar-link" type="button" data-auth-sign-out>Sign out</button>` : ""}
        <span class="city-badge">Chicagoland pilot</span>
      </div>
    </header>
  `;
}

function screen() {
  if (state.loading) return loadingScreen();
  if (state.screen === "results") return resultsScreen();
  if (state.screen === "detail") return detailScreen();
  if (state.screen === "reminder-settings") return reminderSettingsScreen();
  if (state.screen === "reminders") return remindersScreen();
  return briefScreen();
}

function loadingScreen() {
  const heading = state.loadingRefresh
    ? `Finding more ideas for ${escapeHtml(state.brief.recipientName)}.`
    : `Searching Chicagoland for ${escapeHtml(state.brief.recipientName)}.`;
  const copy = state.loadingRefresh
    ? "Pulling another set of nearby merchants that fit this brief."
    : `Matching your brief to real nearby merchants around ZIP ${escapeHtml(state.brief.zipCode)}.`;

  return `
    <section class="loading-screen" aria-live="polite" aria-busy="true">
      <div class="loading-card">
        <p class="eyebrow">${state.loadingRefresh ? "Refreshing picks" : "Finding local shops"}</p>
        <h1>${heading}</h1>
        <p>${copy}</p>
        ${loadingLikesList()}
        <div class="loading-spinner" aria-hidden="true"></div>
      </div>
    </section>
  `;
}

function loadingLikesList() {
  const labels = briefLikeLabels();
  if (!labels.length) return "";

  return `
    <div class="loading-likes">
      <p class="loading-likes-label">Searching for</p>
      <ul class="loading-likes-list">
        ${labels.map((label) => `<li>${escapeHtml(label)}</li>`).join("")}
      </ul>
    </div>
  `;
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
      </div>

      ${savedRemindersPreview()}

      <form class="brief-panel" data-brief-form>
        ${state.error ? `<div class="error-banner" role="alert">${escapeHtml(state.error)}</div>` : ""}
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
          ${inputField("zipCode", "Chicagoland ZIP code", state.brief.zipCode, "text", "60025", "numeric")}
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
          </div>
        </div>
        <button class="primary full-width" type="submit">Find gift ideas</button>
      </form>
    </section>
  `;
}

function resultsScreen() {
  const gifts = recommendations();
  const [best, ...backups] = gifts;
  const placeLabel = state.location?.place ? `Near ${state.location.place}` : "Chicagoland";

  return `
    <section class="results-screen">
      <div class="results-header">
        <div>
          <p class="eyebrow">${escapeHtml(placeLabel)} · ZIP ${escapeHtml(state.location?.zipCode || state.brief.zipCode)}</p>
          <h1>Spontaneous gift ideas for ${escapeHtml(state.brief.recipientName)}</h1>
          <p>${briefSummary()}</p>
        </div>
        <div class="results-actions">
          <button class="secondary" type="button" data-refresh ${state.hasMore ? "" : "disabled"}>Show other ideas</button>
          <button class="secondary" type="button" data-go="brief">Edit brief</button>
        </div>
      </div>

      ${best ? bestCard(best) : ""}

      ${backups.length ? `
        <section class="backup-section" aria-label="More gift ideas">
          <div class="section-heading">
            <p class="eyebrow">More options</p>
            <h2>${escapeHtml(backupSectionHeading(backups.length))}</h2>
          </div>
          <div class="backup-grid">
            ${backups.map(backupCard).join("")}
          </div>
        </section>
      ` : ""}

      ${reminderPanel()}
    </section>
  `;
}

function backupSectionHeading(count) {
  if (count === 1) return "One easy alternative.";
  if (count === 2) return "Two easy alternatives.";
  return `${count} more options to explore.`;
}

function detailScreen() {
  const gift = recommendations().find((item) => item.id === state.selectedGiftId) || recommendations()[0];
  if (!gift) {
    state.screen = "brief";
    return briefScreen();
  }

  return `
    <section class="detail-screen">
      <button class="text-button back-link" type="button" data-go="results">Back to results</button>
      <div class="detail-layout">
        <img class="detail-image" src="${gift.image}" alt="${escapeHtml(gift.name)}" />
        <div class="detail-panel">
          <p class="eyebrow">${escapeHtml(locationSummary(gift))}</p>
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
            <button class="secondary" type="button" data-go="results">${recommendations().length > 3 ? "See all options" : "See backups"}</button>
            <a class="primary" href="${gift.link}" target="_blank" rel="noreferrer">View merchant</a>
          </div>
        </div>
      </div>
    </section>
  `;
}

function remindersScreen() {
  if (!state.authReady) {
    return `
      <section class="reminders-screen">
        <p class="reminder-copy">Checking sign-in…</p>
      </section>
    `;
  }

  if (!state.authUser) {
    const name = state.authReturnScreen === "results" ? state.brief.recipientName.trim() : "";
    const reminderContext = name
      ? `<p>Sign in or create an account to get ${escapeHtml(frequencySummary(state.reminderDraft.frequency))} email reminders for <strong>${escapeHtml(name)}</strong>.</p>`
      : "<p>Create an account or sign in to save email reminders and manage your gift nudges.</p>";

    return `
      <section class="reminders-screen">
        <div class="section-heading">
          <p class="eyebrow">Account</p>
          <h1>${name ? `Sign in for ${escapeHtml(name)}` : "Sign in to Sirsee"}</h1>
          ${reminderContext}
        </div>
        ${authPanel("signup")}
        ${state.authReturnScreen === "results" ? `<button class="secondary full-width" type="button" data-go="results">Back to gift ideas</button>` : `<button class="secondary full-width" type="button" data-go="brief">Back to gift finder</button>`}
      </section>
    `;
  }

  return `
    <section class="reminders-screen">
      <div class="section-heading">
        <p class="eyebrow">Account</p>
        <h1>Your account</h1>
        <p class="reminder-account-note">Signed in as <strong>${escapeHtml(state.authUser.email)}</strong></p>
      </div>
      <div class="account-reminders-section">
        <h2 class="account-section-title">Email reminders</h2>
        <p class="reminder-copy">People Sirsee nudges you about on a schedule. Tap <strong>Settings</strong> to change timing or cancel.</p>
        ${state.reminderError ? `<p class="reminder-note reminder-note--error">${escapeHtml(state.reminderError)}</p>` : ""}
        ${state.reminders.length ? reminderList(state.reminders) : emptyRemindersState()}
      </div>
      <button class="secondary" type="button" data-go="brief">Start a new brief</button>
    </section>
  `;
}

function authPanel(context = "signup") {
  if (!state.authConfigured) {
    return `
      <div class="auth-panel auth-panel--disabled">
        <p class="reminder-copy">Sign-in is not configured yet. Copy <code>.env.example</code> to <code>.env</code>, add your Supabase URL and anon key, then restart <code>python3 server.py</code>.</p>
      </div>
    `;
  }

  const signupCopy =
    context === "signup"
      ? "Create an account to save email reminders for this person."
      : "Connect with Google or use email and password.";

  const appUrl = externalAuthAppUrl();
  const embeddedGoogleCopy = state.authEmbeddedBrowser
    ? `
      <p class="auth-passkey-notice">
        Google passkeys cannot reach your phone from the Cursor browser.
        <a class="auth-external-link" href="${escapeAttribute(appUrl)}" target="_blank" rel="noopener noreferrer">Open Sirsee in Chrome or Safari</a>
        and use Connect with Google there.
      </p>
    `
    : `
      <p class="auth-passkey-notice auth-passkey-notice--subtle">
        If Google asks for a passkey and your phone does not get a notification, open
        <a class="auth-external-link" href="${escapeAttribute(appUrl)}" target="_blank" rel="noopener noreferrer">Sirsee in Chrome or Safari</a>.
      </p>
    `;

  return `
    <section class="auth-panel" aria-label="Sign in to your account">
      <p class="reminder-copy">${signupCopy}</p>
      ${embeddedGoogleCopy}
      <button class="secondary full-width auth-google-button" type="button" data-auth-google ${state.authLoading ? "disabled" : ""}>
        ${state.authEmbeddedBrowser ? "Copy link for Chrome or Safari" : "Connect with Google"}
      </button>
      <div class="auth-divider" aria-hidden="true"><span>or</span></div>
      <form class="auth-form" data-auth-form>
        <div class="field">
          <label for="authEmail">${state.authMode === "signup" ? "Email address" : "Email"}</label>
          <input
            id="authEmail"
            class="input"
            data-auth-email
            type="email"
            value="${escapeAttribute(state.authDraft.email)}"
            placeholder="you@example.com"
            autocomplete="email"
            required
          />
        </div>
        <div class="field">
          <label for="authPassword">Password</label>
          <input
            id="authPassword"
            class="input"
            data-auth-password
            type="password"
            value="${escapeAttribute(state.authDraft.password)}"
            minlength="8"
            autocomplete="${state.authMode === "signup" ? "new-password" : "current-password"}"
            required
          />
        </div>
        ${state.authMode === "signup" ? `
          <div class="field">
            <label for="authConfirmPassword">Confirm password</label>
            <input
              id="authConfirmPassword"
              class="input"
              data-auth-confirm-password
              type="password"
              value="${escapeAttribute(state.authDraft.confirmPassword)}"
              minlength="8"
              autocomplete="new-password"
              required
            />
          </div>
        ` : ""}
        <button class="primary full-width" type="submit" ${state.authLoading ? "disabled" : ""}>
          ${state.authLoading ? "Working…" : state.authMode === "signup" ? "Create account" : "Sign in"}
        </button>
        <button class="text-button auth-toggle-button" type="button" data-auth-toggle-mode>
          ${state.authMode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </form>
      ${state.authError ? `<p class="reminder-note reminder-note--error">${escapeHtml(state.authError)}</p>` : ""}
      ${state.authNotice ? `<p class="reminder-note">${escapeHtml(state.authNotice)}</p>` : ""}
    </section>
  `;
}

function reminderSettingsScreen() {
  const reminder = reminderForRecipient(state.editingReminderName || "");
  if (!reminder) {
    return `
      <section class="reminder-settings-screen">
        <p class="reminder-copy">That reminder could not be found.</p>
        <button class="secondary" type="button" data-go="reminders">Back to account</button>
      </section>
    `;
  }

  return `
    <section class="reminder-settings-screen">
      <div class="section-heading">
        <p class="eyebrow">Notification settings</p>
        <h1>${escapeHtml(reminder.recipientName)}</h1>
        <p>Adjust how often Sirsee emails you, or cancel reminders for this person.</p>
      </div>

      <div class="reminder-settings-summary">
        <p class="reminder-meta">Emails go to <strong>${escapeHtml(reminder.email)}</strong></p>
        <p class="reminder-meta">${escapeHtml(reminderGenderSummary(reminder))} · ${escapeHtml(reminderBriefSummary(reminder))}</p>
      </div>

      <form class="reminder-form" data-reminder-settings-form>
        <div class="field">
          <span class="field-title">How often?</span>
          <div class="segment-group reminder-frequency-group" role="group" aria-label="Reminder frequency">
            ${reminderFrequencyOptions.map(reminderEditFrequencyButton).join("")}
          </div>
        </div>
        <button class="primary full-width" type="submit" ${state.reminderSaving ? "disabled" : ""}>
          ${state.reminderSaving ? "Saving changes…" : "Save changes"}
        </button>
        ${state.reminderError ? `<p class="reminder-note reminder-note--error">${escapeHtml(state.reminderError)}</p>` : ""}
      </form>

      <div class="reminder-settings-footer">
        <button
          class="secondary full-width reminder-cancel-button"
          type="button"
          data-remove-reminder="${escapeAttribute(reminder.recipientName)}"
          ${state.reminderSaving ? "disabled" : ""}
        >
          Cancel reminders for ${escapeHtml(reminder.recipientName)}
        </button>
        <button class="text-button" type="button" data-go="reminders">Back to account</button>
      </div>
    </section>
  `;
}

function reminderPanel() {
  const name = state.brief.recipientName.trim() || "them";
  const existing = reminderForRecipient(name);

  if (existing) {
    return `
      <section class="reminder-panel reminder-panel--saved" aria-label="Recurring reminder for ${escapeHtml(name)}">
        <div class="section-heading">
          <p class="eyebrow">Recurring reminder</p>
          <h2>We will check in for ${escapeHtml(name)}.</h2>
        </div>
        <p class="reminder-copy">
          ${escapeHtml(frequencySummary(existing.frequency))} at <strong>${escapeHtml(existing.email)}</strong> with fresh Chicagoland picks using this brief.
        </p>
        <div class="action-row">
          <button class="text-button" type="button" data-go="reminders">View all reminders</button>
          <button class="secondary" type="button" data-manage-reminder="${escapeAttribute(name)}">Notification settings</button>
        </div>
      </section>
    `;
  }

  return `
    <section class="reminder-panel" aria-label="Set a recurring reminder for ${escapeHtml(name)}">
      <div class="section-heading">
        <p class="eyebrow">Keep the habit going</p>
        <h2>Get email reminders for ${escapeHtml(name)}.</h2>
        <p>Pick a schedule and Sirsee will send fresh local gift ideas so spontaneous gifting does not slip.</p>
      </div>
      ${reminderSignupForm(name)}
    </section>
  `;
}

function reminderSignupForm(name) {
  const signedIn = Boolean(state.authUser);

  return `
      <form class="reminder-form" data-reminder-form>
        <div class="field">
          <span class="field-title">How often?</span>
          <div class="segment-group reminder-frequency-group" role="group" aria-label="Reminder frequency">
            ${reminderFrequencyOptions.map(reminderFrequencyButton).join("")}
          </div>
        </div>
        ${signedIn ? `<p class="reminder-account-note">Signed in as <strong>${escapeHtml(state.authUser.email)}</strong></p>` : ""}
        <button class="primary full-width" type="submit" ${state.reminderSaving ? "disabled" : ""}>
          ${state.reminderSaving ? "Saving…" : signedIn ? `Set reminder for ${escapeHtml(name)}` : "Sign up for notifications"}
        </button>
        ${state.reminderError ? `<p class="reminder-note reminder-note--error">${escapeHtml(state.reminderError)}</p>` : ""}
        <p class="reminder-note">${signedIn ? "We will email you on that schedule with fresh Chicagoland picks for this brief." : "You will sign in or create an account next."}</p>
      </form>
  `;
}

function savedRemindersPreview() {
  if (!state.authUser || !state.reminders.length) return "";

  return `
    <aside class="saved-reminders" aria-label="Saved recurring reminders">
      <div class="saved-reminders-header">
        <p class="eyebrow">Your reminders</p>
        <button class="text-button" type="button" data-go="reminders">Account</button>
      </div>
      ${reminderList(state.reminders.slice(0, 2))}
    </aside>
  `;
}

function reminderList(reminders) {
  return `
    <ul class="reminder-list">
      ${reminders.map(reminderListItem).join("")}
    </ul>
  `;
}

function reminderListItem(reminder) {
  return `
    <li class="reminder-card">
      <div>
        <h3>${escapeHtml(reminder.recipientName)}</h3>
        <p class="reminder-meta">${escapeHtml(frequencySummary(reminder.frequency))} · ${escapeHtml(reminder.email)}</p>
        <p class="reminder-meta">${escapeHtml(reminderBriefSummary(reminder))}</p>
      </div>
      <button class="secondary reminder-settings-button" type="button" data-manage-reminder="${escapeAttribute(reminder.recipientName)}">Settings</button>
    </li>
  `;
}

function emptyRemindersState() {
  return `
    <div class="empty-reminders">
      <p>No one is on your reminder list yet.</p>
      <p>Find gift ideas for someone, sign in on the results screen, then choose how often to get nudges.</p>
    </div>
  `;
}

function reminderFrequencyButton(option) {
  return reminderFrequencyChoiceButton(option, state.reminderDraft.frequency, "data-reminder-frequency");
}

function reminderEditFrequencyButton(option) {
  return reminderFrequencyChoiceButton(option, state.reminderEditDraft.frequency, "data-edit-reminder-frequency");
}

function reminderFrequencyChoiceButton(option, selectedFrequency, dataAttribute) {
  const selected = selectedFrequency === option.id;
  return `
    <button class="segment ${selected ? "is-selected" : ""}" type="button" ${dataAttribute}="${option.id}" aria-pressed="${selected}">
      ${option.label}
    </button>
  `;
}

function reminderForRecipient(name) {
  const normalized = name.trim().toLowerCase();
  return state.reminders.find((reminder) => reminder.recipientName.trim().toLowerCase() === normalized);
}

function frequencySummary(frequencyId) {
  return reminderFrequencyOptions.find((option) => option.id === frequencyId)?.summary || "on your schedule";
}

function reminderBriefSummary(reminder) {
  return `Up to $${reminder.budget} · ZIP ${reminder.zipCode} · ${reminder.likesSummary}`;
}

function reminderGenderSummary(reminder) {
  return genderOptions.find((option) => option.id === reminder.recipientGender)?.summary || "Shopping for them";
}

function openReminderSettings(name) {
  const reminder = reminderForRecipient(name);
  if (!reminder) return;

  state.editingReminderName = reminder.recipientName;
  state.reminderEditDraft.frequency = reminder.frequency;
  state.reminderError = null;
  state.screen = "reminder-settings";
  render();
}

async function reminderAuthHeaders() {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Sign in to manage email reminders.");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

async function postReminder(reminder) {
  const headers = await reminderAuthHeaders();
  const response = await fetch("/api/reminders", {
    method: "POST",
    headers,
    body: JSON.stringify(reminder)
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Could not save your reminder.");
  }
  return payload.reminder;
}

async function fetchReminders() {
  if (!state.authUser) {
    state.reminders = [];
    return;
  }

  try {
    const headers = await reminderAuthHeaders();
    const response = await fetch("/api/reminders", { headers });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load your reminders.");
    }
    state.reminders = payload.reminders || [];
    state.reminderError = null;
  } catch (error) {
    state.reminderError = error.message || "Could not load your reminders.";
  }
}

async function saveReminder() {
  const recipientName = state.brief.recipientName.trim();
  if (!recipientName) return;

  if (!state.authUser) {
    goToAuthForNotifications();
    return;
  }

  state.reminderSaving = true;
  state.reminderError = null;
  render();

  const reminder = {
    recipientName,
    frequency: state.reminderDraft.frequency,
    recipientGender: state.brief.recipientGender,
    budget: state.brief.budget,
    zipCode: state.brief.zipCode,
    likes: [...state.brief.likes],
    customLike: state.brief.customLike,
    likesSummary: likesSummary()
  };

  try {
    const saved = await postReminder(reminder);
    state.reminders = [
      ...state.reminders.filter(
        (item) => item.recipientName.trim().toLowerCase() !== recipientName.toLowerCase()
      ),
      saved
    ];
    state.reminderError = null;
  } catch (error) {
    state.reminderError = error.message || "Could not save your reminder.";
  } finally {
    state.reminderSaving = false;
    render();
  }
}

function goToAuthForNotifications() {
  state.authReturnScreen = "results";
  state.pendingReminderSignup = true;
  state.authMode = "signup";
  state.authError = null;
  state.authNotice = null;
  state.reminderError = null;
  persistNotificationIntent();
  state.screen = "reminders";
  render();
}

function persistNotificationIntent() {
  try {
    sessionStorage.setItem("sirsee-pending-reminder-signup", "1");
    sessionStorage.setItem(
      "sirsee-reminder-intent",
      JSON.stringify({
        brief: state.brief,
        frequency: state.reminderDraft.frequency
      })
    );
  } catch {
    // Ignore storage failures in private browsing or restricted contexts.
  }
}

function restoreNotificationIntent() {
  try {
    if (sessionStorage.getItem("sirsee-pending-reminder-signup") !== "1") {
      return false;
    }
    const raw = sessionStorage.getItem("sirsee-reminder-intent");
    if (!raw) {
      return false;
    }
    const intent = JSON.parse(raw);
    state.brief = intent.brief;
    state.reminderDraft.frequency = intent.frequency || state.reminderDraft.frequency;
    state.pendingReminderSignup = true;
    state.authReturnScreen = "results";
    return true;
  } catch {
    return false;
  }
}

function clearNotificationIntent() {
  try {
    sessionStorage.removeItem("sirsee-pending-reminder-signup");
    sessionStorage.removeItem("sirsee-reminder-intent");
  } catch {
    // Ignore storage failures in private browsing or restricted contexts.
  }
}

async function completePendingReminderSignup() {
  if (!state.pendingReminderSignup || !state.authUser) {
    return false;
  }

  state.pendingReminderSignup = false;
  state.authReturnScreen = null;
  clearNotificationIntent();
  state.screen = "results";

  if (!state.gifts.length) {
    await fetchRecommendations();
  }
  await fetchReminders();
  await saveReminder();
  return true;
}

async function updateReminderSettings() {
  const reminder = reminderForRecipient(state.editingReminderName || "");
  if (!reminder) return;

  state.reminderSaving = true;
  state.reminderError = null;
  render();

  try {
    const saved = await postReminder({
      ...reminder,
      frequency: state.reminderEditDraft.frequency
    });
    state.reminders = [
      ...state.reminders.filter(
        (item) =>
          item.recipientName.trim().toLowerCase() !== reminder.recipientName.trim().toLowerCase()
      ),
      saved
    ];
    state.reminderError = null;
    state.editingReminderName = null;
    state.screen = "reminders";
  } catch (error) {
    state.reminderError = error.message || "Could not save your changes.";
  } finally {
    state.reminderSaving = false;
    render();
  }
}

async function removeReminder(name) {
  const normalized = name.trim().toLowerCase();
  const reminder = state.reminders.find(
    (item) => item.recipientName.trim().toLowerCase() === normalized
  );
  if (!reminder) return;

  const wasEditing =
    state.editingReminderName &&
    state.editingReminderName.trim().toLowerCase() === normalized;

  state.reminderSaving = true;
  state.reminderError = null;
  render();

  try {
    const headers = await reminderAuthHeaders();
    const response = await fetch("/api/reminders", {
      method: "DELETE",
      headers,
      body: JSON.stringify({
        recipientName: reminder.recipientName
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not remove your reminder.");
    }

    state.reminders = state.reminders.filter(
      (item) => item.recipientName.trim().toLowerCase() !== normalized
    );
    state.reminderError = null;
    if (wasEditing) {
      state.editingReminderName = null;
      state.screen = "reminders";
    }
  } catch (error) {
    state.reminderError = error.message || "Could not remove your reminder.";
  } finally {
    state.reminderSaving = false;
    render();
  }
}

function bestCard(gift) {
  const likeLabel = matchedLikeLabel(gift);
  return `
    <article class="best-card">
      <img src="${gift.image}" alt="${escapeHtml(gift.merchant)}" loading="lazy" />
      <div class="best-body">
        <div class="card-kicker">
          <span class="pill">Best pick</span>
          ${likeLabel ? `<span class="like-match">${escapeHtml(likeLabel)}</span>` : ""}
          <span>${escapeHtml(budgetFit(gift))}</span>
        </div>
        <h2>${escapeHtml(gift.name)}</h2>
        <p class="merchant-line">${merchantMeta(gift)}</p>
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
  const likeLabel = matchedLikeLabel(gift);
  return `
    <article class="backup-card">
      <img src="${gift.image}" alt="${escapeHtml(gift.merchant)}" loading="lazy" />
      <div class="backup-body">
        <div>
          <span class="card-meta">${merchantMeta(gift)}</span>
          ${likeLabel ? `<p class="like-match">${escapeHtml(likeLabel)}</p>` : ""}
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

function recommendations() {
  return state.gifts;
}

function matchedLikeLabel(gift) {
  if (!gift.matchedLike) return "";
  return activeLikeOptions().find((option) => option.id === gift.matchedLike)?.label || "";
}

function merchantMeta(gift) {
  const parts = [gift.merchant, gift.neighborhood];
  if (typeof gift.distanceMiles === "number") {
    parts.push(`${gift.distanceMiles} mi`);
  }
  parts.push(`$${gift.price}`);
  return escapeHtml(parts.join(" · "));
}

function locationSummary(gift) {
  const place = state.location?.place || "Chicagoland";
  const distance = typeof gift.distanceMiles === "number" ? ` · ${gift.distanceMiles} mi away` : "";
  return `${place} · ${gift.category} · ${gift.neighborhood}${distance}`;
}

function syncBriefFromForm() {
  document.querySelectorAll("[data-brief]").forEach((field) => {
    state.brief[field.dataset.brief] = field.value;
  });
}

async function fetchRecommendations({ refresh = false } = {}) {
  syncBriefFromForm();
  state.loading = true;
  state.loadingRefresh = refresh;
  state.error = null;
  if (!refresh) {
    state.shownGiftIds = [];
    state.hasMore = false;
  }
  render();

  const startedAt = Date.now();
  const minDelayMs = refresh ? REFRESH_MIN_DELAY_MS : SEARCH_MIN_DELAY_MS;

  try {
    const response = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        zipCode: state.brief.zipCode,
        budget: state.brief.budget,
        likes: state.brief.likes,
        customLike: state.brief.customLike,
        recipientGender: state.brief.recipientGender,
        excludeIds: refresh ? state.shownGiftIds : []
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Could not load local gift ideas.");
    }

    const remainingDelay = minDelayMs - (Date.now() - startedAt);
    if (remainingDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, remainingDelay));
    }

    state.gifts = payload.gifts;
    state.location = payload.location;
    state.hasMore = Boolean(payload.hasMore);
    state.shownGiftIds = [...new Set([...state.shownGiftIds, ...payload.gifts.map((gift) => gift.id)])];
    state.loading = false;
    state.loadingRefresh = false;
    state.screen = "results";
    render();
  } catch (error) {
    state.loading = false;
    state.loadingRefresh = false;
    state.error = error.message || "Could not load local gift ideas.";
    state.screen = refresh ? "results" : "brief";
    render();
  }
}

function whyThisWorks(gift) {
  if (gift.source === "openstreetmap") {
    return openStreetMapBlurb(gift);
  }

  return [companySentence(gift), bodyParagraph(gift), deliverySentence(gift)].filter(Boolean).join(" ");
}

function openStreetMapBlurb(gift) {
  const company = `${gift.merchant} is a local ${merchantDescriptor(gift)} ${placePhrase(gift)}.`;
  const body = `Sirsee surfaced them from nearby Chicagoland map data, and ${lowerGiftName(gift)} is a practical spontaneous-gift starting point.`;
  const delivery = deliverySentence(gift) || "Check the merchant site for local pickup or delivery options.";
  return [company, body, delivery].join(" ");
}

function companySentence(gift) {
  const tags = distinctiveTags(gift);

  if (tags.some((tag) => /north shore/i.test(tag))) {
    return `${gift.merchant} is a North Shore ${merchantDescriptor(gift)} ${placePhrase(gift)}.`;
  }

  if (tags.some((tag) => /chicago/i.test(tag))) {
    return `${gift.merchant} is a Chicago ${merchantDescriptor(gift)} ${placePhrase(gift)}.`;
  }

  if (tags.length) {
    return `${gift.merchant} is a ${tags[0]} ${merchantDescriptor(gift)} ${placePhrase(gift)}.`;
  }

  return `${gift.merchant} is a ${merchantDescriptor(gift)} ${placePhrase(gift)}.`;
}

function bodyParagraph(gift) {
  const reason = capitalizeSentence(gift.reason);
  const lowerName = lowerGiftName(gift);

  if (!reason) {
    return `A strong pick from their menu is ${lowerName}.`;
  }

  if (/^It is a\b|^It is an\b|^It is right\b|^It is close\b|^It is a reliable\b/i.test(reason)) {
    return `${reason.replace(/^It is/, "They are")} For a spontaneous gift, consider their ${lowerName}.`;
  }

  if (/^The |^Their /i.test(reason)) {
    return `${reason} Their ${lowerName} is an easy place to start.`;
  }

  return `Their ${lowerName} is a strong pick here — ${reason.charAt(0).toLowerCase() + reason.slice(1)}`;
}

function deliverySentence(gift) {
  const delivery = (gift.delivery || "").trim();
  if (!delivery) return "";
  return capitalizeSentence(delivery.endsWith(".") ? delivery : `${delivery}.`);
}

function merchantDescriptor(gift) {
  const descriptors = {
    Flowers: "florist",
    Sweets: "bakery and confectionery",
    "Coffee/tea": "coffee and tea shop",
    "Local goods": "gift and home goods shop"
  };
  return descriptors[gift.category] || "shop";
}

function placePhrase(gift) {
  const neighborhood = gift.neighborhood?.trim();
  if (!neighborhood || neighborhood === "Nearby") {
    return "in Chicagoland";
  }
  return `in ${neighborhood}`;
}

function distinctiveTags(gift) {
  const generic = new Set([
    "delivery",
    "local",
    "openstreetmap",
    "florist",
    "bakery",
    "coffee",
    "handmade",
    "curated",
    "artisan",
    "useful",
    "home",
    "foodie",
    "small luxury"
  ]);

  return (gift.tags || [])
    .map((tag) => tag.replace(/_/g, " "))
    .filter((tag) => !generic.has(tag.toLowerCase()))
    .slice(0, 2);
}

function lowerGiftName(gift) {
  const name = gift.name?.trim() || "this gift";
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function capitalizeSentence(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
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
  const labels = briefLikeLabels();
  return labels.join(", ") || "small local surprises";
}

function briefLikeLabels() {
  return state.brief.likes
    .map((id) => activeLikeOptions().find((option) => option.id === id)?.label)
    .filter(Boolean)
    .concat(state.brief.customLike.trim() ? [state.brief.customLike.trim()] : []);
}

function genderSummary() {
  return genderOptions.find((option) => option.id === state.brief.recipientGender)?.summary || "Shopping for them";
}

function bindEvents() {
  document.querySelectorAll("[data-go]").forEach((control) => {
    control.addEventListener("click", async () => {
      state.screen = control.dataset.go;
      state.error = null;
      if (control.dataset.go !== "reminder-settings") {
        state.editingReminderName = null;
      }
      if (control.dataset.go !== "results" && control.dataset.go !== "reminders") {
        state.authReturnScreen = null;
        state.pendingReminderSignup = false;
        clearNotificationIntent();
      }
      if (control.dataset.go === "results") {
        state.authReturnScreen = null;
        state.pendingReminderSignup = false;
        clearNotificationIntent();
      }
      if (control.dataset.go === "reminders" && state.authUser) {
        await fetchReminders();
      }
      render();
    });
  });

  document.querySelectorAll("[data-brief]").forEach((field) => {
    field.addEventListener("input", () => {
      state.brief[field.dataset.brief] = field.value;
      state.error = null;
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

  document.querySelectorAll("[data-reminder-frequency]").forEach((button) => {
    button.addEventListener("click", () => {
      state.reminderDraft.frequency = button.dataset.reminderFrequency;
      render();
    });
  });

  document.querySelectorAll("[data-edit-reminder-frequency]").forEach((button) => {
    button.addEventListener("click", () => {
      state.reminderEditDraft.frequency = button.dataset.editReminderFrequency;
      render();
    });
  });

  document.querySelectorAll("[data-manage-reminder]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.reminderSaving) return;
      openReminderSettings(button.dataset.manageReminder);
    });
  });

  document.querySelectorAll("[data-remove-reminder]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.reminderSaving) return;
      removeReminder(button.dataset.removeReminder);
    });
  });

  const reminderForm = document.querySelector("[data-reminder-form]");
  if (reminderForm) {
    reminderForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.reminderSaving) return;
      saveReminder();
    });
  }

  const reminderSettingsForm = document.querySelector("[data-reminder-settings-form]");
  if (reminderSettingsForm) {
    reminderSettingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.reminderSaving) return;
      updateReminderSettings();
    });
  }

  document.querySelectorAll("[data-refresh]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      fetchRecommendations({ refresh: true });
    });
  });

  const form = document.querySelector("[data-brief-form]");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      fetchRecommendations();
    });
  }

  document.querySelectorAll("[data-auth-google]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.authLoading) return;
      handleGoogleAuth();
    });
  });

  document.querySelectorAll("[data-auth-toggle-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authMode = state.authMode === "signup" ? "signin" : "signup";
      state.authError = null;
      render();
    });
  });

  document.querySelectorAll("[data-auth-email]").forEach((field) => {
    field.addEventListener("input", () => {
      state.authDraft.email = field.value;
    });
  });

  document.querySelectorAll("[data-auth-password]").forEach((field) => {
    field.addEventListener("input", () => {
      state.authDraft.password = field.value;
    });
  });

  document.querySelectorAll("[data-auth-confirm-password]").forEach((field) => {
    field.addEventListener("input", () => {
      state.authDraft.confirmPassword = field.value;
    });
  });

  document.querySelectorAll("[data-auth-sign-out]").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.authLoading) return;
      handleSignOut();
    });
  });

  const authForm = document.querySelector("[data-auth-form]");
  if (authForm) {
    authForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.authLoading) return;
      handleAuthFormSubmit();
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

async function handleGoogleAuth() {
  state.authLoading = true;
  state.authError = null;
  state.authNotice = null;
  render();
  try {
    if (state.authEmbeddedBrowser) {
      const appUrl = externalAuthAppUrl();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(appUrl);
      }
      state.authNotice =
        "Copied the Sirsee link. Paste it into Chrome or Safari, then click Connect with Google.";
      state.authLoading = false;
      render();
      return;
    }
    await signInWithGoogle();
  } catch (error) {
    state.authLoading = false;
    state.authError = error.message || "Could not connect with Google.";
    render();
  }
}

async function handleAuthFormSubmit() {
  const email = state.authDraft.email.trim();
  const password = state.authDraft.password;
  const confirmPassword = state.authDraft.confirmPassword;

  if (!email || !password) {
    state.authError = "Enter your email and password.";
    render();
    return;
  }

  if (state.authMode === "signup" && password !== confirmPassword) {
    state.authError = "Passwords do not match.";
    render();
    return;
  }

  state.authLoading = true;
  state.authError = null;
  render();

  try {
    if (state.authMode === "signup") {
      const result = await signUpWithPassword(email, password);
      if (!result.session) {
        state.authMode = "signin";
        state.authError = null;
        state.authDraft.password = "";
        state.authDraft.confirmPassword = "";
        state.reminderError = null;
        state.authNotice = "Account created. Check your email to confirm, then sign in.";
        return;
      }
    } else {
      await signInWithPassword(email, password);
    }
    state.authDraft.password = "";
    state.authDraft.confirmPassword = "";
    state.authError = null;
    state.authNotice = null;
  } catch (error) {
    state.authError = error.message || "Could not sign you in.";
  } finally {
    state.authLoading = false;
    render();
  }
}

async function handleSignOut() {
  state.authLoading = true;
  state.authError = null;
  render();
  try {
    await signOut();
    state.reminders = [];
    state.editingReminderName = null;
    if (state.screen === "reminder-settings") {
      state.screen = "reminders";
    }
  } catch (error) {
    state.authError = error.message || "Could not sign out.";
  } finally {
    state.authLoading = false;
    render();
  }
}

async function bootstrap() {
  try {
    state.authConfigured = await initAuth();
  } catch (error) {
    state.authConfigured = isAuthConfigured();
    state.authError = error.message || "Could not finish sign-in.";
  }

  onAuthStateChange(async (user) => {
    state.authUser = user;
    state.authLoading = false;
    if (user) {
      if (await completePendingReminderSignup()) {
        return;
      }
      await fetchReminders();
    } else {
      state.reminders = [];
    }
    render();
  });

  restoreNotificationIntent();
  state.authEmbeddedBrowser = isEmbeddedAuthBrowser();
  state.authUser = await getSessionUser();
  state.authReady = true;
  if (state.authUser) {
    if (await completePendingReminderSignup()) {
      return;
    }
    await fetchReminders();
  }
  render();
}

bootstrap();
