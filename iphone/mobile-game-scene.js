import {
	FIELD_CONFIG,
	applyFormationToLine,
	applySpeeds,
	buildRoster,
	getLineOfScrimmageY,
	setFormationOffsets,
	yardLineToY,
	yToYardLine
} from "./characters.js";
import { moveDefense, moveOffense } from "./movement.js";
import { advanceBallFlight, attemptThrow, getThrowTargets, LOB_HOLD_MS } from "./throw.js";
import { resetForNextPlay, startPlay } from "./next-play.js";
import { checkTackle, resolveCollisions } from "./stun-tackle.js";
import { checkTouchdown } from "./touchdown.js";
import { fetchHighscores, initFirebase, submitHighscore } from "../firebase/firebase.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const timerLabel = document.getElementById("timerLabel");
const downLabel = document.getElementById("downLabel");
const ytgLabel = document.getElementById("ytgLabel");
const ballLabel = document.getElementById("ballLabel");
const scoreLabel = document.getElementById("scoreLabel");
const tinyScore = document.getElementById("tinyScore");
const nextPlayBtn = document.getElementById("nextPlayBtn");
const backBtn = document.getElementById("backBtn");
const mobileLeaderboardList = document.getElementById("mobileLeaderboardList");
const mobileScoreNameInput = document.getElementById("mobileScoreNameInput");
const mobileSubmitScoreBtn = document.getElementById("mobileSubmitScoreBtn");

const game = {
	field: {
		width: 540,
		height: 900,
		topY: FIELD_CONFIG.endzoneHeight,
		bottomY: 900 - FIELD_CONFIG.endzoneHeight,
		playHeight: 900 - FIELD_CONFIG.endzoneHeight * 2
	},
	state: {
		prepPhase: true,
		gameActive: false,
		isRouting: false,
		isPaused: false,
		playEnded: false
	},
	stats: {
		score: 0,
		touchdowns: 0
	},
	downStateDefaults: {
		down: 1,
		lineToGainY: null,
		ballSpotY: null,
		playEnded: false,
		gameOver: false
	},
	downStateReset() {
		this.downsState = { ...this.downStateDefaults };
	},
	downsState: {
		down: 1,
		lineToGainY: null,
		ballSpotY: null,
		playEnded: false,
		gameOver: false
	},
	roster: [],
	ballCarrier: null,
	ballFlight: null,
	pixelsPerYard: 1,
	lineOfScrimmageY: 0,
	prepRemaining: 6,
	lastFrameTime: null,
	playClockSeconds: 0,
	rushDelaySeconds: 6,
	rushDelayMin: 4,
	rushDelayMax: 10,
	rushSpeedMultiplier: 1.35,
	rushPushThrough: 0.55,
	previousCollisions: new Set(),
	defenseStunUntil: new Map(),
	tackleContact: new Map(),
	tackleHoldSeconds: 1.0,
	resetRushClock() {
		this.playClockSeconds = 0;
		this.rushDelaySeconds = this.rushDelayMin + Math.random() * (this.rushDelayMax - this.rushDelayMin);
	},
	isRushActive() {
		return this.state.gameActive && this.playClockSeconds >= this.rushDelaySeconds;
	},
	isRusher(player) {
		return player?.team === "defense" && (player.role === "DL" || player.role === "MLB" || player.role === "S");
	},
	getStackBoost(player, nx, ny) {
		const backDepth = 26;
		const sideTol = 14;
		const stackDirX = -nx;
		const stackDirY = -ny;
		for (const teammate of this.roster) {
			if (teammate === player) continue;
			if (teammate.team !== player.team) continue;
			const dx = teammate.x - player.x;
			const dy = teammate.y - player.y;
			const depth = dx * stackDirX + dy * stackDirY;
			const lateral = Math.abs(dx * nx + dy * ny);
			if (depth > 4 && depth <= backDepth && lateral <= sideTol) {
				return 1.6;
			}
		}
		return 1;
	},
	setTimerText(text) {
		if (timerLabel) timerLabel.textContent = text;
	},
	setNextPlayVisible(visible) {
		if (!nextPlayBtn) return;
		nextPlayBtn.classList.toggle("active", visible);
	},
	setSubmitEnabled(enabled) {
		if (mobileSubmitScoreBtn) mobileSubmitScoreBtn.disabled = !enabled;
		if (mobileScoreNameInput) mobileScoreNameInput.disabled = !enabled;
	},
	updateDownsPanel() {
		if (!downLabel || !ytgLabel || !ballLabel) return;
		const lineY = this.downsState.ballSpotY ?? this.lineOfScrimmageY;
		const ytg = this.downsState.lineToGainY === null
			? 10
			: Math.max(0, Math.round((lineY - this.downsState.lineToGainY) / this.pixelsPerYard));
		downLabel.textContent = `Down: ${this.downsState.down}`;
		ytgLabel.textContent = `YTG: ${ytg}`;
		ballLabel.textContent = `Ball: ${Math.round(yToYardLine(this.field, lineY))}`;
		if (scoreLabel) scoreLabel.textContent = `Score: ${this.stats.score}`;
		if (tinyScore) tinyScore.textContent = `Score ${this.stats.score}`;
	}
};

initFirebase();

async function refreshLeaderboard() {
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

async function submitScore() {
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

function resizeCanvas() {
	const rect = canvas.getBoundingClientRect();
	canvas.width = Math.max(320, Math.floor(rect.width));
	canvas.height = Math.max(520, Math.floor(rect.height));
	game.field.width = canvas.width;
	game.field.height = canvas.height;
	game.field.topY = FIELD_CONFIG.endzoneHeight;
	game.field.bottomY = canvas.height - FIELD_CONFIG.endzoneHeight;
	game.field.playHeight = game.field.bottomY - game.field.topY;
	game.pixelsPerYard = game.field.playHeight / FIELD_CONFIG.yardsPerField;
}

function initializeGameState() {
	resizeCanvas();
	game.roster = buildRoster(game.field);
	setFormationOffsets(game.roster);
	game.lineOfScrimmageY = getLineOfScrimmageY(game.field);
	applyFormationToLine(game.roster, game.lineOfScrimmageY);
	applySpeeds(game.roster);
	game.ballCarrier = game.roster.find(player => player.role === "QB") ?? game.roster[0];
	game.roster.forEach(player => {
		player.hasBall = (player === game.ballCarrier);
		player.pathIndex = 0;
	});
	game.downsState.ballSpotY = game.lineOfScrimmageY;
	game.downsState.lineToGainY = game.downsState.ballSpotY - (10 * game.pixelsPerYard);
	game.updateDownsPanel();
	game.prepRemaining = 6;
	game.state.prepPhase = true;
	game.state.gameActive = false;
	game.state.playEnded = false;
	game.setNextPlayVisible(false);
	game.setTimerText("PREP: 6");
	game.setSubmitEnabled(false);
	game.resetRushClock();
}


function drawField() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "rgba(0,0,100,0.2)";
	ctx.fillRect(0, 0, canvas.width, FIELD_CONFIG.endzoneHeight);
	ctx.fillRect(0, canvas.height - FIELD_CONFIG.endzoneHeight, canvas.width, FIELD_CONFIG.endzoneHeight);

	for (let yard = 0; yard <= 100; yard += 5) {
		const y = yardLineToY(game.field, yard);
		ctx.strokeStyle = "rgba(255,255,255,0.25)";
		ctx.lineWidth = (yard % 10 === 0) ? 2 : 1;
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(canvas.width, y);
		ctx.stroke();
	}

	ctx.fillStyle = "rgba(255,255,255,0.9)";
	ctx.font = "11px Arial";
	ctx.textAlign = "left";
	for (let yard = 10; yard <= 90; yard += 10) {
		const label = yard <= 50 ? yard : 100 - yard;
		const y = yardLineToY(game.field, yard);
		ctx.fillText(String(label), 6, y + 4);
	}

	const losY = game.lineOfScrimmageY;
	ctx.strokeStyle = "rgba(255,255,255,0.8)";
	ctx.lineWidth = 3;
	ctx.setLineDash([10, 6]);
	ctx.beginPath();
	ctx.moveTo(0, losY);
	ctx.lineTo(canvas.width, losY);
	ctx.stroke();
	ctx.setLineDash([]);

	const firstDownY = game.downsState.lineToGainY ?? (losY - (10 * game.pixelsPerYard));
	ctx.strokeStyle = "#ffd54a";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(0, firstDownY);
	ctx.lineTo(canvas.width, firstDownY);
	ctx.stroke();
}

function drawPlayers() {
	game.roster.forEach(player => {
		ctx.fillStyle = "rgba(0,0,0,0.5)";
		ctx.beginPath();
		ctx.arc(player.x + 2, player.y + 2, 15, 0, Math.PI * 2);
		ctx.fill();

		let fillColor = player.team === "offense" ? "#0099ff" : "#ff3300";
		if (player.team === "defense" && player.role === "DL") {
			fillColor = "#ff6655";
		}
		if (player.team === "defense") {
			const stunnedUntil = game.defenseStunUntil.get(player.id) ?? 0;
			if (stunnedUntil > performance.now()) {
				fillColor = "#9a9a9a";
			}
		}
		ctx.fillStyle = fillColor;
		ctx.beginPath();
		ctx.arc(player.x, player.y, 15, 0, Math.PI * 2);
		ctx.fill();

		if (player.hasBall) {
			ctx.fillStyle = "brown";
			ctx.beginPath();
			ctx.arc(player.x, player.y, 8, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.fillStyle = "white";
		ctx.font = "10px Arial";
		ctx.textAlign = "center";
		ctx.fillText(player.role, player.x, player.y + 4);
	});

	if (game.ballFlight?.active) {
		ctx.fillStyle = game.ballFlight.lob ? "#d2b48c" : "brown";
		ctx.beginPath();
		ctx.arc(game.ballFlight.x, game.ballFlight.y, game.ballFlight.lob ? 7 : 6, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawRoutes() {
	game.roster.forEach(player => {
		if (player.team !== "offense" || player.path.length < 2) return;
		ctx.beginPath();
		ctx.strokeStyle = "yellow";
		ctx.lineWidth = 3;
		ctx.moveTo(player.path[0].x, player.path[0].y);
		player.path.forEach(point => {
			ctx.lineTo(point.x, point.y);
		});
		ctx.stroke();
	});
}

function drawPrepCountdown() {
	if (!game.state.prepPhase || game.state.gameActive || game.state.playEnded) return;
	const seconds = Math.max(0, Math.ceil(game.prepRemaining));
	ctx.fillStyle = "rgba(0,0,0,0.35)";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.fillStyle = "#ffd54a";
	ctx.font = "bold 72px Arial";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(String(seconds), canvas.width / 2, canvas.height / 2);
	ctx.font = "bold 16px Arial";
	ctx.fillStyle = "white";
	ctx.fillText("DRAW ROUTES", canvas.width / 2, canvas.height / 2 + 52);
}

const gesture = {
	active: false,
	player: null,
	startX: 0,
	startY: 0,
	startTime: 0,
	mode: "none"
};
const DRAG_THRESHOLD = 12;

function getClosestOffensePlayer(x, y, maxDist = 28) {
	let closest = null;
	let closestDist = maxDist;
	game.roster.forEach(player => {
		if (player.team !== "offense") return;
		const dist = Math.hypot(player.x - x, player.y - y);
		if (dist < closestDist) {
			closestDist = dist;
			closest = player;
		}
	});
	return closest;
}

function handleInput(type, x, y) {
	if (game.state.isPaused || game.state.playEnded) return;

	if (type === "start") {
		const target = getClosestOffensePlayer(x, y, 32);
		if (target) {
			gesture.active = true;
			gesture.player = target;
			gesture.startX = x;
			gesture.startY = y;
			gesture.startTime = Date.now();
			gesture.mode = "pending";
		}
		return;
	}

	if (!gesture.active || !gesture.player) return;

	if (type === "move") {
		if (gesture.mode === "pending") {
			const dragDist = Math.hypot(x - gesture.startX, y - gesture.startY);
			if (dragDist >= DRAG_THRESHOLD) {
				gesture.mode = "route";
				game.state.isRouting = true;
				gesture.player.path = [];
				gesture.player.path.push({ x: gesture.player.x, y: gesture.player.y });
				gesture.player.path.push({ x, y });
				gesture.player.pathIndex = 0;
			}
		} else if (gesture.mode === "route") {
			gesture.player.path.push({ x, y });
		}
		return;
	}

	if (type === "end") {
		if (gesture.mode === "route") {
			game.state.isRouting = false;
		} else if (gesture.mode === "pending") {
			if (game.state.gameActive) {
				const heldMs = Date.now() - gesture.startTime;
				attemptThrow(game, gesture.player, heldMs >= LOB_HOLD_MS);
			}
		}
		gesture.active = false;
		gesture.player = null;
		gesture.mode = "none";
		gesture.startTime = 0;
	}
}

function getPos(event) {
	const rect = canvas.getBoundingClientRect();
	const point = event.touches ? event.touches[0] : event;
	return {
		x: point.clientX - rect.left,
		y: point.clientY - rect.top
	};
}

canvas.addEventListener("pointerdown", event => {
	event.preventDefault();
	const pos = getPos(event);
	handleInput("start", pos.x, pos.y);
}, { passive: false });
canvas.addEventListener("pointermove", event => {
	event.preventDefault();
	const pos = getPos(event);
	handleInput("move", pos.x, pos.y);
}, { passive: false });
canvas.addEventListener("pointerup", event => {
	event.preventDefault();
	const pos = getPos(event);
	handleInput("end", pos.x, pos.y);
}, { passive: false });
canvas.addEventListener("pointercancel", event => {
	event.preventDefault();
	const pos = getPos(event);
	handleInput("end", pos.x, pos.y);
}, { passive: false });

if (mobileScoreNameInput) {
	const storedName = localStorage.getItem("iphone-player-name");
	if (storedName) mobileScoreNameInput.value = storedName;
}
if (mobileSubmitScoreBtn) {
	mobileSubmitScoreBtn.addEventListener("click", submitScore);
}

game.onGameOver = () => {
	game.setSubmitEnabled(true);
};
game.onPlayReset = () => {
	game.setSubmitEnabled(false);
};

nextPlayBtn?.addEventListener("click", () => {
	resetForNextPlay(game);
});

backBtn?.addEventListener("click", () => {
	window.location.href = "./index.html";
});

function updateTimer(deltaSeconds) {
	if (!game.state.prepPhase || game.state.gameActive || game.state.playEnded) return;
	game.prepRemaining = Math.max(0, game.prepRemaining - deltaSeconds);
	game.setTimerText(`PREP: ${Math.ceil(game.prepRemaining)}`);
	if (game.prepRemaining <= 0) {
		startPlay(game);
	}
}

function render(timestamp) {
	if (!game.lastFrameTime) game.lastFrameTime = timestamp;
	const deltaSeconds = Math.min(0.05, (timestamp - game.lastFrameTime) / 1000);
	game.lastFrameTime = timestamp;
	if (game.state.gameActive && !game.state.isPaused) {
		game.playClockSeconds += deltaSeconds;
	}

	updateTimer(deltaSeconds);
	advanceBallFlight(game);
	moveOffense(game, deltaSeconds);
	moveDefense(game, deltaSeconds);
	checkTouchdown(game);
	checkTackle(game);
	resolveCollisions(game);
	game.lineOfScrimmageY = game.downsState.ballSpotY ?? game.lineOfScrimmageY;

	drawField();
	drawRoutes();
	drawPlayers();
	drawPrepCountdown();
	requestAnimationFrame(render);
}

initializeGameState();
refreshLeaderboard();
window.addEventListener("resize", () => {
	initializeGameState();
});
requestAnimationFrame(render);
