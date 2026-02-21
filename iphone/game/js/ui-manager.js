import { yToYardLine } from "./characters.js";
import { fetchHighscores, submitHighscore } from "../../../firebase/firebase.js";
import { resetForNextPlay, startPlay } from "./next-play.js";
import { FORMATIONS, getFormationsList, applyFormation } from "./starting-formation.js";

const timerLabel = document.getElementById("timerLabel");
const downLabel = document.getElementById("downLabel");
const ytgLabel = document.getElementById("ytgLabel");
const ballLabel = document.getElementById("ballLabel");
const scoreLabel = document.getElementById("scoreLabel");
const tinyScore = document.getElementById("tinyScore");
const nextPlayBtn = document.getElementById("nextPlayBtn");
const backBtn = document.getElementById("backBtn");
const pauseModal = document.getElementById("pauseModal");
const pauseOverlay = document.getElementById("pauseOverlay");
const resumeBtn = document.getElementById("resumeBtn");
const pauseBackBtn = document.getElementById("pauseBackBtn");
const pauseBtn = document.getElementById("pauseBtn");
const leaderboardBtn = document.getElementById("leaderboardBtn");
const formationBtn = document.getElementById("formationBtn");
const mobileLeaderboard = document.getElementById("mobileLeaderboard");
const mobileLeaderboardList = document.getElementById("mobileLeaderboardList");
const mobileScoreNameInput = document.getElementById("mobileScoreNameInput");
const mobileSubmitScoreBtn = document.getElementById("mobileSubmitScoreBtn");

export function setTimerText(text) {
	if (timerLabel) timerLabel.textContent = text;
}

export function setPaused(game, paused) {
	game.state.isPaused = paused;
	if (pauseModal) pauseModal.classList.toggle("active", paused);
	if (pauseOverlay) pauseOverlay.classList.toggle("active", paused);
	if (paused) {
		setTimerText("PAUSED");
	} else {
		if (game.state.prepPhase) {
			setTimerText(`PREP: ${Math.ceil(game.prepRemaining)}`);
		} else if (game.state.gameActive) {
			setTimerText("GO!");
		}
	}
	game.lastFrameTime = null;
}

export function setNextPlayVisible(visible) {
	if (!nextPlayBtn) return;
	nextPlayBtn.classList.toggle("active", visible);
}

export function setSubmitEnabled(enabled) {
	if (mobileSubmitScoreBtn) mobileSubmitScoreBtn.disabled = !enabled;
	if (mobileScoreNameInput) mobileScoreNameInput.disabled = !enabled;
}

export function updateDownsPanel(game) {
	if (!downLabel || !ytgLabel || !ballLabel) return;
	const lineY = game.downsState.ballSpotY ?? game.lineOfScrimmageY;
	const ytg = game.downsState.lineToGainY === null
		? 10
		: Math.max(0, Math.round((lineY - game.downsState.lineToGainY) / game.pixelsPerYard));
	const yardsToGoal = Math.max(0, Math.round((lineY - game.field.topY) / game.pixelsPerYard));
	const goalToGo = game.downsState.lineToGainY !== null && game.downsState.lineToGainY < game.field.topY;
	
	const getOrdinal = (down) => {
		switch (down) {
			case 1: return "1st";
			case 2: return "2nd";
			case 3: return "3rd";
			default: return "4th";
		}
	};
	
	const downText = goalToGo ? `${getOrdinal(game.downsState.down)} & Goal` : getOrdinal(game.downsState.down);
	downLabel.textContent = `Down: ${downText}`;
	ytgLabel.textContent = goalToGo ? `YTG: ${Math.max(1, yardsToGoal)}` : `YTG: ${ytg}`;
	ballLabel.textContent = `Ball: ${Math.round(yToYardLine(game.field, lineY))}`;
	if (scoreLabel) scoreLabel.textContent = `Score: ${game.stats.score}`;
	if (tinyScore) tinyScore.textContent = `Score ${game.stats.score}`;
}

export function updateTimer(game, deltaSeconds) {
	if (!game.state.prepPhase || game.state.gameActive || game.state.playEnded || game.state.isPaused || game.state.isRouting) return;
	game.prepRemaining = Math.max(0, game.prepRemaining - deltaSeconds);
	setTimerText(`PREP: ${Math.ceil(game.prepRemaining)}`);
	if (game.prepRemaining <= 0) {
		startPlay(game);
	}
}

export async function refreshLeaderboard() {
	if (!mobileLeaderboardList) return;
	mobileLeaderboardList.innerHTML = "<li>Loading...</li>";
	try {
		const entries = await fetchHighscores(10);
		mobileLeaderboardList.innerHTML = "";
		if (!entries.length) {
			mobileLeaderboardList.innerHTML = "<li>No scores yet.</li>";
			return;
		}
		let rank = 1;
		entries.forEach(entry => {
			const name = String(entry.username ?? "Anonymous").slice(0, 16);
			const score = Number(entry.score ?? 0);
			const date = entry.date ? String(entry.date) : "";
			const time = entry.time ? String(entry.time) : "";
			const stamp = date && time ? ` • ${date} ${time}` : "";
			const item = document.createElement("li");
			item.textContent = `${rank}. ${name} — ${score}${stamp}`;
			mobileLeaderboardList.appendChild(item);
			rank += 1;
		});
	} catch (error) {
		mobileLeaderboardList.innerHTML = "<li>Unable to load scores.</li>";
		console.error(error);
	}
}

async function submitScore(game) {
	if (!mobileSubmitScoreBtn || mobileSubmitScoreBtn.disabled) return;
	const name = mobileScoreNameInput?.value.trim() ?? "";
	if (!name) return;
	const score = Number(game.stats?.score ?? 0);
	try {
		mobileSubmitScoreBtn.disabled = true;
		await submitHighscore({ username: name.slice(0, 16), score });
		localStorage.setItem("iphone-player-name", name.slice(0, 16));
		await refreshLeaderboard();
	} catch (error) {
		console.error(error);
	} finally {
		mobileSubmitScoreBtn.disabled = false;
	}
}

export function initUIHandlers(game) {
	const abbr = {
		[FORMATIONS.STANDARD]: "STD",
		[FORMATIONS.I_FORMATION]: "I-FRM",
		[FORMATIONS.SHOTGUN]: "SHOT",
		[FORMATIONS.TRIPS]: "TRIPS",
		[FORMATIONS.EMPTY]: "EMPTY"
	};

	if (formationBtn) {
		formationBtn.textContent = `📋 ${abbr[game.currentFormation] || "STD"}`;
	}

	// Load saved player name
	if (mobileScoreNameInput) {
		const storedName = localStorage.getItem("iphone-player-name");
		if (storedName) mobileScoreNameInput.value = storedName;
	}

	// Submit score
	if (mobileSubmitScoreBtn) {
		mobileSubmitScoreBtn.addEventListener("click", () => submitScore(game));
	}

	// Next play button
	nextPlayBtn?.addEventListener("click", () => {
		resetForNextPlay(game);
	});

	// Back button
	backBtn?.addEventListener("click", () => {
		window.location.href = "../index.html";
	});

	// Resume button
	resumeBtn?.addEventListener("click", () => {
		setPaused(game, false);
	});

	// Pause back button
	pauseBackBtn?.addEventListener("click", () => {
		window.location.href = "../index.html";
	});

	// Pause button
	pauseBtn?.addEventListener("click", () => {
		setPaused(game, !game.state.isPaused);
		if (game.state.isPaused) {
			pauseBtn.textContent = "▶ RESUME";
		} else {
			pauseBtn.textContent = "⏸ PAUSE";
		}
	});

	// Leaderboard toggle
	leaderboardBtn?.addEventListener("click", () => {
		if (mobileLeaderboard) {
			mobileLeaderboard.classList.toggle("active");
		}
	});

	// Formation selector
	formationBtn?.addEventListener("click", () => {
		const formations = getFormationsList();
		const currentIndex = formations.findIndex(f => f.name === game.currentFormation);
		const nextIndex = (currentIndex + 1) % formations.length;
		game.currentFormation = formations[nextIndex].name;
		
		// Update button text with abbreviation
		formationBtn.textContent = `📋 ${abbr[game.currentFormation] || "STD"}`;
		
		// Apply formation immediately if in prep phase
		if (game.state.prepPhase && !game.state.gameActive) {
			applyFormation(game.roster, game.currentFormation, game.field, game.lineOfScrimmageY);
		}
	});

	// Game callbacks
	game.onGameOver = () => {
		setSubmitEnabled(true);
	};

	game.onPlayReset = () => {
		setSubmitEnabled(false);
	};
}
