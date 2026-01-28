import {
	initPlaybookFirebase,
	ensureAdminSeed,
	savePlay,
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
const simulateToggle = document.getElementById("simulate-toggle");
const resetRosterButton = document.getElementById("reset-roster");

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
		<div>Team: ${player.team}</div>
		<label>
			Speed
			<input id="player-speed" type="number" step="0.1" value="${player.speed}" />
		</label>
		<label>
			Strength
			<input id="player-strength" type="number" step="0.1" value="${player.strength}" />
		</label>
		<label>
			Stamina
			<input id="player-stamina" type="number" step="0.1" value="${player.stamina}" />
		</label>
		<button id="apply-player" class="ghost">Apply adjustments</button>
	`;

	const applyButton = document.getElementById("apply-player");
	applyButton.addEventListener("click", () => {
		const speed = Number(document.getElementById("player-speed").value);
		const strength = Number(document.getElementById("player-strength").value);
		const stamina = Number(document.getElementById("player-stamina").value);
		scene.updatePlayer(selectedPlayerId, { speed, strength, stamina });
	});
}

const scene = createPlaybookScene({
	canvas,
		onSelectPlayer: renderPlayerDetails
});

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
	const name = window.prompt("Play name", currentPlay?.name || "New concept");
	if (!name) return;
	const description = window.prompt("Description", currentPlay?.description || "");
	const payload = {
		id: currentPlay?.id,
		name,
		description,
		roster: scene.exportPlay().roster,
		updated_at: new Date().toISOString()
	};
	const playId = await savePlay(session.usernameKey, payload);
	currentPlay = { ...payload, id: playId };
	await refreshPlayList();
});

sharePlayButton.addEventListener("click", async () => {
	if (!currentPlay?.id) {
		window.alert("Save the play first.");
		return;
	}
	const code = await makePlaySharable(session.usernameKey, currentPlay.id, true);
	window.alert(`Share code: ${code}`);
	await refreshPlayList();
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
});

document.querySelectorAll("[data-mode]").forEach(button => {
	button.addEventListener("click", () => {
		const mode = button.dataset.mode;
		scene.setMode(mode);
		setModeButton(mode);
	});
});

refreshPlayList();
