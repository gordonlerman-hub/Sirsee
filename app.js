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
    recipientName: "",
    recipientGender: "female",
    budget: 50,
    zipCode: "",
    likes: ["flowers", "coffee", "sweets"],
    customLike: ""
  },
  selectedGiftId: null,
  gifts: [],
  location: null,
  matchMeta: null,
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
  pendingReminderRecipientName: null,
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
const wifeLikeOptions = [
  { id: "flowers", label: "Flowers or plants", image: "./assets/likes/flowers-plants.png", categories: ["Flowers"] },
  { id: "sweets", label: "Chocolate & pastries", image: "./assets/likes/chocolate-pastries.png", categories: ["Sweets"] },
  { id: "coffee", label: "Coffee or tea", image: "./assets/likes/coffee-tea.png", categories: ["Coffee/tea", "Sweets"] },
  { id: "home", label: "Candles & home", image: "./assets/likes/candles-home.png", categories: ["Local goods"] },
  { id: "foodie", label: "Foodie treats", image: "./assets/likes/foodie-treats.png", categories: ["Sweets", "Coffee/tea"] },
  { id: "cozy", label: "Cozy evening", image: "./assets/likes/cozy-night.png", categories: ["Coffee/tea", "Local goods"] }
];

function render() {
  app.innerHTML = `
    ${topbar()}
    ${screen()}
  `;
  bindEvents();
}

function historyUrl() {
  return `${window.location.pathname}${window.location.search}`;
}

function navigationHistoryState() {
  return { sirseeScreen: state.screen };
}

function syncNavigationHistory(mode = "push") {
  const snapshot = navigationHistoryState();
  const url = historyUrl();
  if (mode === "replace") {
    window.history.replaceState(snapshot, "", url);
  } else {
    window.history.pushState(snapshot, "", url);
  }
}

function setScreen(screen, { historyMode = "push" } = {}) {
  state.screen = screen;
  syncNavigationHistory(historyMode);
}

function topbar() {
  const onAccount = state.screen === "reminders" || state.screen === "reminder-settings";
  return `
    <header class="topbar">
      <button class="brand" type="button" data-go="brief" aria-label="Start over">
        <span class="brand-mark" aria-hidden="true">S</span>
        <span>
          <span class="brand-title">Sirsee</span>
          <span class="brand-caption">Thoughtful local gifts for your wife.</span>
        </span>
      </button>
      <div class="topbar-nav">
        <button class="topbar-link ${onAccount ? "is-active" : ""}" type="button" data-go="reminders">Account</button>
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
    ? `Finding more gifts for ${escapeHtml(state.brief.recipientName)}.`
    : `Finding local gifts for ${escapeHtml(state.brief.recipientName)}.`;
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
        <p class="eyebrow">Chicagoland · gifts for her</p>
        <h1>A small gift she didn't see coming.</h1>
        <p>
          Sirsee helps Chicagoland husbands surprise their wives with real gifts from local shops — one strong pick and two backups, matched to her tastes and your budget.
        </p>
        <div class="promise-list" aria-label="What Sirsee returns">
          <span>Artisanal local shops</span>
          <span>Delivery first</span>
          <span>Best pick first</span>
          <span>No chain-store filler</span>
        </div>
      </div>

      <form class="brief-panel" data-brief-form>
        ${state.error ? `<div class="error-banner" role="alert">${escapeHtml(state.error)}</div>` : ""}
        <div class="section-heading">
          <p class="eyebrow">Her brief</p>
          <h2>What does she like?</h2>
        </div>
        <div class="field-grid">
          ${inputField("recipientName", "Her name", state.brief.recipientName, "text", "her name", "", true)}
          ${inputField("zipCode", "Chicagoland ZIP code", state.brief.zipCode, "text", "enter zip code", "numeric", true)}
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
        <button class="primary full-width" type="submit">Find gift ideas for her</button>
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
          <h1>Gift ideas for ${escapeHtml(state.brief.recipientName)}</h1>
          <p class="results-match-line">${escapeHtml(resultsMatchLine())}</p>
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
  if (count === 1) return "One more matched idea.";
  return `${count} more matched ideas.`;
}

function resultsMatchLine() {
  const count = recommendations().length;
  const meta = state.matchMeta;

  if (!count) {
    return "Still looking for strong local matches.";
  }
  if (count === 1) {
    return "1 strong local match for this brief.";
  }
  if (meta?.eligible && meta.eligible > count) {
    return `${count} strong local matches for this brief (${meta.eligible} passed our quality bar).`;
  }
  return `${count} strong local matches for this brief.`;
}

function detailScreen() {
  const gift = recommendations().find((item) => item.id === state.selectedGiftId) || recommendations()[0];
  if (!gift) {
    setScreen("brief", { historyMode: "replace" });
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

function accountSignOutButton() {
  return `
    <button class="text-button account-sign-out-button" type="button" data-auth-sign-out ${state.authLoading ? "disabled" : ""}>
      Sign out
    </button>
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
      ? `<p>Sign in or create an account to get ${escapeHtml(frequencySummary(state.reminderDraft.frequency))} gift reminders for <strong>${escapeHtml(name)}</strong>.</p>`
      : "<p>Create an account or sign in to save email reminders and keep surprising her on schedule.</p>";

    return `
      <section class="reminders-screen">
        <div class="section-heading">
          <p class="eyebrow">Account</p>
          <h1>${name ? `Sign in for ${escapeHtml(name)}` : "Sign in to save her reminders"}</h1>
          ${reminderContext}
        </div>
        ${authPanel("signup")}
        ${state.authReturnScreen === "results" ? `<button class="secondary full-width" type="button" data-go="results">Back to her gift ideas</button>` : `<button class="secondary full-width" type="button" data-go="brief">Back to gift finder</button>`}
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
        <p class="reminder-copy">Gift reminders for your wife on a schedule. Tap <strong>Settings</strong> to change timing or cancel.</p>
        ${state.reminderError ? `<p class="reminder-note reminder-note--error">${escapeHtml(state.reminderError)}</p>` : ""}
        ${state.reminders.length ? reminderList(state.reminders) : emptyRemindersState()}
      </div>
      <div class="account-actions">
        <button class="secondary" type="button" data-go="brief">Start a new brief</button>
        ${accountSignOutButton()}
      </div>
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
      ? "Create an account to save gift reminders for your wife."
      : "Connect with Google or use email and password.";

  const appUrl = externalAuthAppUrl();
  const embeddedGoogleCopy = state.authEmbeddedBrowser
    ? `
      <p class="auth-passkey-notice">
        Google sign-in does not work in Cursor's preview browser.
        <a class="auth-external-link" href="${escapeAttribute(appUrl)}" target="_blank" rel="noopener noreferrer">Open Sirsee on your phone or in your browser</a>
        and connect your account there.
      </p>
    `
    : "";

  return `
    <section class="auth-panel" aria-label="Sign in to your account">
      <p class="reminder-copy">${signupCopy}</p>
      ${embeddedGoogleCopy}
      <button class="secondary full-width auth-google-button" type="button" data-auth-google ${state.authLoading ? "disabled" : ""}>
        ${state.authEmbeddedBrowser ? "Copy link to open elsewhere" : "Connect with Google"}
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
        <p>Adjust how often Sirsee emails you with gift ideas for her, or cancel reminders.</p>
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
          data-reminder-id="${escapeAttribute(reminder.id || "")}"
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
  const name = state.brief.recipientName.trim() || "her";
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
        <p class="eyebrow">Don't let it slip</p>
        <h2>Get email reminders for ${escapeHtml(name)}.</h2>
        <p>Pick a schedule and Sirsee will send fresh local gift ideas so you keep surprising her.</p>
      </div>
      ${reminderSignupForm(name)}
    </section>
  `;
}

function reminderSignupForm(name) {
  const signedIn = Boolean(state.authUser);

  return `
      <form class="reminder-form" data-reminder-form>
        <input type="hidden" data-reminder-recipient value="${escapeAttribute(name)}" />
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
        <p class="reminder-note">${signedIn ? "We will email you on that schedule with fresh Chicagoland picks matched to her brief." : "You will sign in or create an account next."}</p>
      </form>
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
      <button
        class="secondary reminder-settings-button"
        type="button"
        data-manage-reminder="${escapeAttribute(reminder.recipientName)}"
        data-reminder-id="${escapeAttribute(reminder.id || "")}"
      >Settings</button>
    </li>
  `;
}

function emptyRemindersState() {
  return `
    <div class="empty-reminders">
      <p>No wife reminders yet.</p>
      <p>Find gifts for her first, sign in on the results screen, then choose how often to get reminders.</p>
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
  return reminder.recipientGender === "male" ? "Gifts for him" : "Gifts for her";
}

function openReminderSettings(name) {
  const reminder = reminderForRecipient(name);
  if (!reminder) return;

  state.editingReminderName = reminder.recipientName;
  state.reminderEditDraft.frequency = reminder.frequency;
  state.reminderError = null;
  setScreen("reminder-settings");
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

function resolveReminderRecipientName() {
  const field = document.querySelector("[data-reminder-recipient]");
  if (field?.value?.trim()) {
    return field.value.trim();
  }
  if (state.pendingReminderRecipientName?.trim()) {
    return state.pendingReminderRecipientName.trim();
  }
  return state.brief.recipientName.trim();
}

async function saveReminder(recipientNameOverride) {
  const recipientName = (recipientNameOverride || resolveReminderRecipientName()).trim();
  if (!recipientName) return;

  if (!state.authUser) {
    state.pendingReminderRecipientName = recipientName;
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
  const recipientName = resolveReminderRecipientName();
  if (!recipientName) return;

  state.pendingReminderRecipientName = recipientName;
  state.brief.recipientName = recipientName;
  state.authReturnScreen = "results";
  state.pendingReminderSignup = true;
  state.authMode = "signup";
  state.authError = null;
  state.authNotice = null;
  state.reminderError = null;
  persistNotificationIntent();
  setScreen("reminders");
  render();
}

function persistNotificationIntent() {
  try {
    sessionStorage.setItem("sirsee-pending-reminder-signup", "1");
    sessionStorage.setItem(
      "sirsee-reminder-intent",
      JSON.stringify({
        brief: state.brief,
        recipientName: state.pendingReminderRecipientName || state.brief.recipientName.trim(),
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

    const returningFromAuth = new URLSearchParams(window.location.search).has("code");
    if (!returningFromAuth) {
      clearNotificationIntent();
      return false;
    }

    const raw = sessionStorage.getItem("sirsee-reminder-intent");
    if (!raw) {
      return false;
    }
    const intent = JSON.parse(raw);
    state.brief = intent.brief;
    state.reminderDraft.frequency = intent.frequency || state.reminderDraft.frequency;
    const recipientName = (intent.recipientName || intent.brief?.recipientName || "").trim();
    if (recipientName) {
      state.pendingReminderRecipientName = recipientName;
      state.brief.recipientName = recipientName;
    }
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

  const recipientName = resolveReminderRecipientName();
  if (!recipientName) {
    state.pendingReminderSignup = false;
    state.pendingReminderRecipientName = null;
    clearNotificationIntent();
    return false;
  }

  state.pendingReminderSignup = false;
  state.pendingReminderRecipientName = recipientName;
  state.brief.recipientName = recipientName;
  state.authReturnScreen = null;
  clearNotificationIntent();
  setScreen("results", { historyMode: "replace" });

  if (!state.gifts.length) {
    await fetchRecommendations();
  }
  await fetchReminders();
  await saveReminder(recipientName);
  state.pendingReminderRecipientName = null;
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
    setScreen("reminders");
  } catch (error) {
    state.reminderError = error.message || "Could not save your changes.";
  } finally {
    state.reminderSaving = false;
    render();
  }
}

async function removeReminder(name, reminderId = "") {
  const normalized = name.trim().toLowerCase();
  const reminder = state.reminders.find(
    (item) =>
      (reminderId && item.id === reminderId) ||
      item.recipientName.trim().toLowerCase() === normalized
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
        id: reminder.id || reminderId || null,
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
      setScreen("reminders");
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

function inputField(key, label, value, type = "text", placeholder = "", inputMode = "", required = false) {
  const requiredAttr = required ? ' required aria-required="true"' : "";
  const zipAttrs = key === "zipCode" ? ' maxlength="5" pattern="\\d{5}"' : "";
  return `
    <div class="field">
      <label for="${key}">${label}</label>
      <input id="${key}" class="input" data-brief="${key}" type="${type}" value="${escapeAttribute(value)}" placeholder="${escapeAttribute(placeholder)}" inputmode="${escapeAttribute(inputMode)}"${requiredAttr}${zipAttrs} />
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

function activeLikeOptions() {
  return wifeLikeOptions;
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
  document.querySelectorAll("[data-brief-form] [data-brief]").forEach((field) => {
    state.brief[field.dataset.brief] = field.value;
  });
}

function briefSearchValidationError() {
  const recipientName = state.brief.recipientName.trim();
  const zipCode = state.brief.zipCode.trim().replace(/\D/g, "").slice(0, 5);

  if (!recipientName) {
    return "Enter her name.";
  }
  if (!/^\d{5}$/.test(zipCode)) {
    return "Enter a valid 5-digit Chicagoland ZIP code.";
  }

  state.brief.recipientName = recipientName;
  state.brief.recipientGender = "female";
  state.brief.zipCode = zipCode;
  return null;
}

async function fetchRecommendations({ refresh = false } = {}) {
  syncBriefFromForm();
  if (!refresh) {
    const validationError = briefSearchValidationError();
    if (validationError) {
      state.error = validationError;
      setScreen("brief", { historyMode: "replace" });
      render();
      return;
    }
  }
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
    state.matchMeta = payload.matchMeta || null;
    state.hasMore = Boolean(payload.hasMore);
    state.shownGiftIds = [...new Set([...state.shownGiftIds, ...payload.gifts.map((gift) => gift.id)])];
    state.loading = false;
    state.loadingRefresh = false;
    setScreen("results");
    render();
  } catch (error) {
    state.loading = false;
    state.loadingRefresh = false;
    state.error = error.message || "Could not load local gift ideas.";
    setScreen(refresh ? "results" : "brief", { historyMode: "replace" });
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
  const body = `Sirsee surfaced them from nearby Chicagoland map data, and ${lowerGiftName(gift)} is a practical gift she'd appreciate.`;
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
    return `${reason.replace(/^It is/, "They are")} For a gift for her, consider their ${lowerName}.`;
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
  return "Gifts for her";
}

function bindEvents() {
  document.querySelectorAll("[data-go]").forEach((control) => {
    control.addEventListener("click", async () => {
      const nextScreen = control.dataset.go;
      state.error = null;
      if (nextScreen !== "reminder-settings") {
        state.editingReminderName = null;
      }
      if (nextScreen !== "results" && nextScreen !== "reminders") {
        state.authReturnScreen = null;
        state.pendingReminderSignup = false;
        clearNotificationIntent();
      }
      if (nextScreen === "results") {
        state.authReturnScreen = null;
        state.pendingReminderSignup = false;
        clearNotificationIntent();
      }
      if (nextScreen === "reminders" && state.authUser) {
        await fetchReminders();
      }
      setScreen(nextScreen);
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
      setScreen("detail");
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
      removeReminder(button.dataset.removeReminder, button.dataset.reminderId || "");
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
      if (!form.reportValidity()) return;
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
        "Copied the Sirsee link. Open it on your phone or in your browser, then connect with Google.";
      state.authLoading = false;
      render();
      return;
    }
    await signInWithGoogle();
    state.authUser = await getSessionUser();
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
      setScreen("reminders", { historyMode: "replace" });
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

  window.addEventListener("popstate", (event) => {
    if (state.loading) {
      syncNavigationHistory("push");
      return;
    }

    const screen = event.state?.sirseeScreen;
    if (!screen) {
      return;
    }

    state.screen = screen;
    state.error = null;
    if (screen !== "reminder-settings") {
      state.editingReminderName = null;
    }
    render();
  });

  if (state.authUser) {
    if (await completePendingReminderSignup()) {
      return;
    }
    await fetchReminders();
  }
  syncNavigationHistory("replace");
  render();
}

bootstrap();
