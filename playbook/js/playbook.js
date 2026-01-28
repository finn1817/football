import {
	initPlaybookFirebase,
	ensureAdminSeed,
	savePlay,
	deletePlay,
	makePlaySharable,
	listPlays
} from "./logged_in_user/firebase-crud-operations.js";
import { createPlaybookScene } from "./playback-creator/game_scene.js";
import { loadPlayList } from "./playback-creator/review_or_edit_old_scene.js";

initPlaybookFirebase();
ensureAdminSeed();

const sessionRaw = localStorage.getItem("playbook_session");
if (!sessionRaw) {
	window.location.href = "index.html";
	throw new Error("Missing session");
}
const session = JSON.parse(sessionRaw || "{}");

const userSummary = document.getElementById("user-summary");
const logoutButton = document.getElementById("logout-button");
const adminLink = document.querySelector("a[href='admin.html']");
const canvas = document.getElementById("playbook-canvas");
const playerDetails = document.getElementById("player-details");
const playsList = document.getElementById("plays-list");
const refreshPlays = document.getElementById("refresh-plays");
const savePlayButton = document.getElementById("save-play");
const sharePlayButton = document.getElementById("share-play");
const deletePlayButton = document.getElementById("delete-play");
const newPlayButton = document.getElementById("new-play");
const clearRouteButton = document.getElementById("clear-route");
const clearAllRoutesButton = document.getElementById("clear-all-routes");
const playNameInput = document.getElementById("play-name");
const playTypeInput = document.getElementById("play-type");
const playDescriptionInput = document.getElementById("play-description");
const shareCode = document.getElementById("share-code");
const simulateToggle = document.getElementById("simulate-toggle");
const resetRosterButton = document.getElementById("reset-roster");
let settingsButton = document.getElementById("settings-button");
let settingsModal = document.getElementById("settings-modal");
let settingsClose = document.getElementById("settings-close");
let fieldViewSelect = document.getElementById("field-view-select");
let toggleNumbers = document.getElementById("toggle-numbers");
let toggleHash = document.getElementById("toggle-hash");

const statPlays = document.getElementById("stat-plays");
const statShares = document.getElementById("stat-shares");
const statUpdated = document.getElementById("stat-updated");

userSummary.textContent = `Signed in as ${session.username}`;
if (session.role !== "admin" && adminLink) {
	adminLink.style.display = "none";
}

let currentPlay = null;
let selectedPlayerId = null;

function renderPlayerDetails(player) {
	if (!player) {
		playerDetails.innerHTML = "<p>Select a player to view details.</p>";
		return;
	}
	selectedPlayerId = player.id;
	playerDetails.innerHTML = `
		<div><strong>${player.role}</strong></div>
		<label>
			Role
			<select id="player-role">
				<option value="QB">QB</option>
				<option value="RB">RB</option>
				<option value="WR">WR</option>
				<option value="TE">TE</option>
				<option value="OL">OL</option>
				<option value="DL">DL</option>
				<option value="LB">LB</option>
				<option value="MLB">MLB</option>
				<option value="CB">CB</option>
				<option value="S">S</option>
			</select>
		</label>
		<label>
			Speed
			<input id="player-speed" type="number" step="0.1" min="1" max="10" value="${player.speed}" />
		</label>
		<label>
			Strength
			<input id="player-strength" type="number" step="0.1" min="1" max="10" value="${player.strength}" />
		</label>
		<label>
			Stamina
			<input id="player-stamina" type="number" step="0.1" min="1" max="10" value="${player.stamina}" />
		</label>
		<label>
			X
			<input id="player-x" type="number" step="1" value="${Math.round(player.x)}" />
		</label>
		<label>
			Y
			<input id="player-y" type="number" step="1" value="${Math.round(player.y)}" />
		</label>
		<div class="text-muted">Team: ${player.team}</div>
	`;

	const roleInput = document.getElementById("player-role");
	roleInput.value = player.role;
	roleInput.addEventListener("change", () => {
		scene.updatePlayer(selectedPlayerId, { role: roleInput.value });
		renderPlayerDetails(scene.getSelectedPlayer());
	});

	const bindNumber = (id, key) => {
		const input = document.getElementById(id);
		input.addEventListener("input", () => {
			const value = Number(input.value);
			if (Number.isFinite(value)) {
				scene.updatePlayer(selectedPlayerId, { [key]: value });
			}
		});
	};

	bindNumber("player-speed", "speed");
	bindNumber("player-strength", "strength");
	bindNumber("player-stamina", "stamina");
	bindNumber("player-x", "x");
	bindNumber("player-y", "y");
}

function loadPlayDetails(play) {
	playNameInput.value = play?.name || "";
	playTypeInput.value = play?.type || "offense";
	playDescriptionInput.value = play?.description || play?.notes || "";
	shareCode.textContent = play?.share_code || "--";
}

const scene = createPlaybookScene({
	canvas,
	onSelectPlayer: renderPlayerDetails
});

function ensureSettingsUi() {
	if (!settingsButton) {
		const topBar = document.querySelector(".top-bar");
		const actions = document.querySelector(".top-bar__actions");
		let center = document.querySelector(".top-bar__center");
		if (!center && topBar) {
			center = document.createElement("div");
			center.className = "top-bar__center";
			if (actions) {
				topBar.insertBefore(center, actions);
			} else {
				topBar.appendChild(center);
			}
		}
		if (center) {
			settingsButton = document.createElement("button");
			settingsButton.id = "settings-button";
			settingsButton.className = "ghost";
			settingsButton.textContent = "Field settings";
			center.appendChild(settingsButton);
		}
	}

	if (!settingsModal) {
		settingsModal = document.createElement("div");
		settingsModal.id = "settings-modal";
		settingsModal.className = "modal is-hidden";
		settingsModal.setAttribute("role", "dialog");
		settingsModal.setAttribute("aria-modal", "true");
		settingsModal.innerHTML = `
			<div class="modal__backdrop"></div>
			<div class="modal__content">
				<header class="modal__header">
					<h3>Field settings</h3>
					<button id="settings-close" class="ghost">Close</button>
				</header>
				<div class="modal__body">
					<div class="form-grid">
						<label>
							Field view
							<select id="field-view-select">
								<option value="full">Full field (0-100)</option>
								<option value="opponent">Opponent half (50-100)</option>
								<option value="redzone">Red zone (80-100)</option>
								<option value="goal-line">Goal line (90-100)</option>
							</select>
						</label>
						<label>
							Show yard numbers
							<div class="toggle-row">
								<input id="toggle-numbers" type="checkbox" checked />
								<span>On</span>
							</div>
						</label>
						<label>
							Show hash marks
							<div class="toggle-row">
								<input id="toggle-hash" type="checkbox" checked />
								<span>On</span>
							</div>
						</label>
					</div>
				</div>
			</div>
		`;
		document.body.appendChild(settingsModal);
	}

	settingsClose = document.getElementById("settings-close");
	fieldViewSelect = document.getElementById("field-view-select");
	toggleNumbers = document.getElementById("toggle-numbers");
	toggleHash = document.getElementById("toggle-hash");
}

function applyFieldSettings() {
	if (!fieldViewSelect) return;
	scene.setFieldView({
		viewId: fieldViewSelect.value,
		showNumbers: toggleNumbers?.checked ?? true,
		showHash: toggleHash?.checked ?? true
	});
}

function setModalOpen(open) {
	settingsModal?.classList.toggle("is-hidden", !open);
}

ensureSettingsUi();

settingsButton?.addEventListener("click", () => setModalOpen(true));
settingsClose?.addEventListener("click", () => setModalOpen(false));
settingsModal?.addEventListener("click", event => {
	if (event.target.classList.contains("modal__backdrop")) {
		setModalOpen(false);
	}
});

fieldViewSelect?.addEventListener("change", applyFieldSettings);
toggleNumbers?.addEventListener("change", applyFieldSettings);
toggleHash?.addEventListener("change", applyFieldSettings);

if (fieldViewSelect) {
	fieldViewSelect.value = "full";
	if (toggleNumbers) toggleNumbers.checked = true;
	if (toggleHash) toggleHash.checked = true;
	applyFieldSettings();
}

const legacyFieldView = document.getElementById("field-view");
if (legacyFieldView) {
	legacyFieldView.style.display = "none";
}

function setModeButton(mode) {
	document.querySelectorAll("[data-mode]").forEach(button => {
		button.classList.toggle("is-active", button.dataset.mode === mode);
	});
}

function updateStats(plays) {
	statPlays.textContent = plays.length;
	statShares.textContent = plays.filter(play => play.share_code).length;
	const lastUpdated = plays[0]?.updated_at ? new Date(plays[0].updated_at).toLocaleDateString() : "--";
	statUpdated.textContent = lastUpdated;
}

async function refreshPlayList() {
	await loadPlayList({
		usernameKey: session.usernameKey,
		container: playsList,
		onSelect: play => {
			currentPlay = play;
			scene.loadPlay(play);
			loadPlayDetails(play);
		}
	});
	const plays = await listPlays(session.usernameKey);
	updateStats(plays);
}

logoutButton.addEventListener("click", () => {
	localStorage.removeItem("playbook_session");
	window.location.href = "index.html";
});

refreshPlays.addEventListener("click", refreshPlayList);

savePlayButton.addEventListener("click", async () => {
	const name = playNameInput.value.trim() || "New concept";
	const description = playDescriptionInput.value.trim();
	const type = playTypeInput.value;
	const payload = {
		id: currentPlay?.id,
		name,
		description,
		type,
		roster: scene.exportPlay().roster,
		updated_at: new Date().toISOString()
	};
	const playId = await savePlay(session.usernameKey, payload);
	currentPlay = { ...payload, id: playId };
	loadPlayDetails(currentPlay);
	await refreshPlayList();
});

sharePlayButton.addEventListener("click", async () => {
	if (!currentPlay?.id) {
		window.alert("Save the play first.");
		return;
	}
	const code = await makePlaySharable(session.usernameKey, currentPlay.id, true);
	shareCode.textContent = code || "--";
	await refreshPlayList();
});

deletePlayButton.addEventListener("click", async () => {
	if (!currentPlay?.id) return;
	if (!window.confirm(`Delete ${currentPlay.name}?`)) return;
	await deletePlay(session.usernameKey, currentPlay.id);
	currentPlay = null;
	scene.resetRoster();
	loadPlayDetails(null);
	renderPlayerDetails(null);
	await refreshPlayList();
});

newPlayButton.addEventListener("click", () => {
	currentPlay = null;
	scene.resetRoster();
	loadPlayDetails(null);
	renderPlayerDetails(null);
});

simulateToggle.addEventListener("click", () => {
	const nextValue = !simulateToggle.classList.contains("is-active");
	simulateToggle.classList.toggle("is-active", nextValue);
	scene.setSimulating(nextValue);
});

resetRosterButton.addEventListener("click", () => {
	scene.resetRoster();
	currentPlay = null;
	renderPlayerDetails(null);
	loadPlayDetails(null);
});

clearRouteButton.addEventListener("click", () => {
	scene.clearSelectedRoute();
});

clearAllRoutesButton.addEventListener("click", () => {
	scene.clearAllRoutes();
});

document.querySelectorAll("[data-mode]").forEach(button => {
	button.addEventListener("click", () => {
		const mode = button.dataset.mode;
		scene.setMode(mode);
		setModeButton(mode);
	});
});

refreshPlayList();
loadPlayDetails(null);
renderPlayerDetails(null);
