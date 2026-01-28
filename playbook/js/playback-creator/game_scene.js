import { createFieldDimensions, buildDefaultRoster, yardLineToY, FIELD_CONFIG } from "../character/characters.js";
import { movePlayers } from "../character/movement.js";
import { applyPlayerAdjustments, serializePlayer } from "../character/player-adjustments.js";
import { separateOverlaps } from "../character/realistic_stun_seperation.js";

export function createPlaybookScene({ canvas, onSelectPlayer }) {
	const ctx = canvas.getContext("2d");
	const scene = {
		canvas,
		ctx,
		field: createFieldDimensions(canvas),
		roster: [],
		mode: "route",
		selectedPlayer: null,
		isSimulating: false,
		lastFrameTime: null,
		onSelectPlayer
	};

	function resetRoster() {
		scene.field = createFieldDimensions(canvas);
		scene.roster = buildDefaultRoster(scene.field);
		scene.roster.forEach(player => {
			player.path = [];
			player.pathIndex = 0;
		});
	}

	function drawField() {
		const { width, height } = canvas;
		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = "#2e8b57";
		ctx.fillRect(0, 0, width, height);

		ctx.fillStyle = "rgba(0,0,90,0.3)";
		ctx.fillRect(0, 0, width, FIELD_CONFIG.endzoneHeight);
		ctx.fillRect(0, height - FIELD_CONFIG.endzoneHeight, width, FIELD_CONFIG.endzoneHeight);

		for (let yard = 0; yard <= 100; yard += 5) {
			const y = yardLineToY(scene.field, yard);
			ctx.strokeStyle = "rgba(255,255,255,0.2)";
			ctx.lineWidth = yard % 10 === 0 ? 2 : 1;
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(width, y);
			ctx.stroke();
		}
	}

	function drawRoutes() {
		scene.roster.forEach(player => {
			if (!player.path || player.path.length < 2) return;
			ctx.beginPath();
			ctx.strokeStyle = player.team === "offense" ? "#ffd54a" : "#ff9c7a";
			ctx.lineWidth = 3;
			ctx.moveTo(player.path[0].x, player.path[0].y);
			player.path.forEach(point => ctx.lineTo(point.x, point.y));
			ctx.stroke();
		});
	}

	function drawPlayers() {
		scene.roster.forEach(player => {
			ctx.fillStyle = "rgba(0,0,0,0.35)";
			ctx.beginPath();
			ctx.arc(player.x + 2, player.y + 2, 14, 0, Math.PI * 2);
			ctx.fill();

			let fill = player.team === "offense" ? "#3bb4ff" : "#ff4f4f";
			if (player === scene.selectedPlayer) fill = "#ffd54a";
			ctx.fillStyle = fill;
			ctx.beginPath();
			ctx.arc(player.x, player.y, 14, 0, Math.PI * 2);
			ctx.fill();

			ctx.fillStyle = "white";
			ctx.font = "11px Arial";
			ctx.textAlign = "center";
			ctx.fillText(player.role, player.x, player.y + 4);
		});
	}

	function render(timestamp) {
		if (!scene.lastFrameTime) scene.lastFrameTime = timestamp;
		const deltaSeconds = Math.min(0.05, (timestamp - scene.lastFrameTime) / 1000);
		scene.lastFrameTime = timestamp;
		if (scene.isSimulating) {
			movePlayers(scene.roster, scene.field.pixelsPerYard, deltaSeconds);
			separateOverlaps(scene.roster);
		}
		drawField();
		drawRoutes();
		drawPlayers();
		requestAnimationFrame(render);
	}

	function clamp(value, min, max) {
		return Math.max(min, Math.min(max, value));
	}

	function getPointerPos(event) {
		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		const rawX = (event.clientX - rect.left) * scaleX;
		const rawY = (event.clientY - rect.top) * scaleY;
		const x = clamp(rawX, 12, canvas.width - 12);
		const y = clamp(rawY, 12, canvas.height - 12);
		return { x, y };
	}

	let dragPlayer = null;
	let drawingRoute = null;
	let isPointerDown = false;
	let pointerMoved = false;

	canvas.addEventListener("pointerdown", event => {
		const { x, y } = getPointerPos(event);
		const hit = scene.roster.find(player => Math.hypot(player.x - x, player.y - y) < 18);
		isPointerDown = true;
		pointerMoved = false;
		canvas.setPointerCapture(event.pointerId);
		if (!hit) {
			scene.selectedPlayer = null;
			if (scene.onSelectPlayer) scene.onSelectPlayer(null);
			return;
		}
		scene.selectedPlayer = hit;
		if (scene.onSelectPlayer) scene.onSelectPlayer(hit);
		if (scene.mode === "move") {
			dragPlayer = hit;
		} else if (scene.mode === "route") {
			drawingRoute = hit;
			hit.path = [{ x: hit.x, y: hit.y }];
		}
	});

	canvas.addEventListener("pointermove", event => {
		const { x, y } = getPointerPos(event);
		if (!isPointerDown) return;
		pointerMoved = true;
		if (dragPlayer) {
			dragPlayer.x = x;
			dragPlayer.y = y;
		} else if (drawingRoute) {
			const last = drawingRoute.path[drawingRoute.path.length - 1];
			if (!last || Math.hypot(last.x - x, last.y - y) > 6) {
				drawingRoute.path.push({ x, y });
			}
		}
	});

	canvas.addEventListener("pointerup", event => {
		isPointerDown = false;
		if (drawingRoute && !pointerMoved) {
			drawingRoute.path = [{ x: drawingRoute.x, y: drawingRoute.y }];
		}
		dragPlayer = null;
		drawingRoute = null;
		canvas.releasePointerCapture(event.pointerId);
	});

	canvas.addEventListener("pointerleave", () => {
		isPointerDown = false;
		dragPlayer = null;
		drawingRoute = null;
	});

	resetRoster();
	requestAnimationFrame(render);

	return {
		getRoster: () => scene.roster,
		setMode: (mode) => { scene.mode = mode; },
		setSimulating: (value) => { scene.isSimulating = value; },
		loadPlay: (play) => {
			if (!play) return;
			scene.roster = play.roster?.map(p => ({ ...p, pathIndex: 0 })) ?? buildDefaultRoster(scene.field);
			scene.roster.forEach(player => {
				player.path = player.path ?? [];
			});
		},
		exportPlay: () => ({
			roster: scene.roster.map(serializePlayer)
		}),
		updatePlayer: (playerId, updates) => {
			const player = scene.roster.find(p => p.id === playerId);
			applyPlayerAdjustments(player, updates);
		},
		resetRoster,
		clearSelectedRoute: () => {
			if (scene.selectedPlayer) {
				scene.selectedPlayer.path = [];
			}
		},
		clearAllRoutes: () => {
			scene.roster.forEach(player => {
				player.path = [];
			});
		},
		getSelectedPlayer: () => scene.selectedPlayer
	};
}
