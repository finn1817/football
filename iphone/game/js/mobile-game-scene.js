import { FIELD_CONFIG, applyFormationToLine, applySpeeds, buildRoster, getLineOfScrimmageY, setFormationOffsets } from "./characters.js";
import { moveDefense, moveOffense } from "./movement.js";
import { advanceBallFlight } from "./throw.js";
import { checkTackle, resolveCollisions } from "./stun-tackle.js";
import { checkTouchdown } from "./touchdown.js";
import { initFirebase } from "../../../firebase/firebase.js";
import { DIFFICULTY_CONFIG } from "./config.js";
import { drawField, drawPlayers, drawRoutes, drawPrepCountdown } from "./renderer.js";
import { initInputHandlers } from "./input-handler.js";
import { initUIHandlers, setTimerText, setNextPlayVisible, setSubmitEnabled, updateDownsPanel, updateTimer, refreshLeaderboard, setPaused } from "./ui-manager.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let currentDifficulty = Number(localStorage.getItem("iphone-difficulty") ?? "2");

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
	defenseScheme: "",
	passAttempted: false,
	defenseAssigned: false,
	pixelsPerYard: 1,
	lineOfScrimmageY: 0,
	prepRemaining: 6,
	lastFrameTime: null,
	playClockSeconds: 0,
	rushDelaySeconds: 6,
	rushDelayMin: 2,
	rushDelayMax: 5,
	rushSpeedMultiplier: 1.5,
	rushPushThrough: 0.8,
	previousCollisions: new Set(),
	defenseStunUntil: new Map(),
	tackleContact: new Map(),
	tackleHoldSeconds: 0.8,
	difficultyConfig: null,
	
	resetRushClock() {
		const cfg = DIFFICULTY_CONFIG[currentDifficulty];
		this.playClockSeconds = 0;
		this.rushDelaySeconds = cfg.rushDelayMin + Math.random() * (cfg.rushDelayMax - cfg.rushDelayMin);
		this.rushPushThrough = cfg.rushPushThrough;
		this.tackleHoldSeconds = cfg.tackleHold;
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
	
	// UI methods (delegated to ui-manager)
	setTimerText(text) {
		setTimerText(text);
	},
	
	setPaused(paused) {
		setPaused(this, paused);
	},
	
	setNextPlayVisible(visible) {
		setNextPlayVisible(visible);
	},
	
	setSubmitEnabled(enabled) {
		setSubmitEnabled(enabled);
	},
	
	updateDownsPanel() {
		updateDownsPanel(this);
	},
	
	onGameOver: null,
	onPlayReset: null
};

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
	
	const cfg = DIFFICULTY_CONFIG[currentDifficulty];
	applySpeeds(game.roster, cfg.defSpeedMult);
	game.difficultyConfig = cfg;
	
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

function render(timestamp) {
	if (!game.lastFrameTime) game.lastFrameTime = timestamp;
	const deltaSeconds = Math.min(0.05, (timestamp - game.lastFrameTime) / 1000);
	game.lastFrameTime = timestamp;

	if (!game.state.isPaused) {
		if (game.state.gameActive) {
			game.playClockSeconds += deltaSeconds;
		}
		updateTimer(game, deltaSeconds);
		advanceBallFlight(game);
		moveOffense(game, deltaSeconds);
		moveDefense(game, deltaSeconds);
		checkTouchdown(game);
		checkTackle(game);
		resolveCollisions(game);
		game.lineOfScrimmageY = game.downsState.ballSpotY ?? game.lineOfScrimmageY;
	}

	drawField(ctx, canvas, game);
	drawRoutes(ctx, game);
	drawPlayers(ctx, game);
	drawPrepCountdown(ctx, canvas, game);
	
	requestAnimationFrame(render);
}

// Initialize everything
initFirebase();
initializeGameState();
initInputHandlers(canvas, game);
initUIHandlers(game);
refreshLeaderboard();

window.addEventListener("resize", () => {
	initializeGameState();
});

requestAnimationFrame(render);

