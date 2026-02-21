import { attemptThrow, LOB_HOLD_MS } from "./throw.js";

const gesture = {
	active: false,
	player: null,
	startX: 0,
	startY: 0,
	startTime: 0,
	mode: "none"
};

const DRAG_THRESHOLD = 12;

function getClosestOffensePlayer(game, x, y, maxDist = 28) {
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

function handleInput(game, type, x, y) {
	if (game.state.isPaused) return;
	if (game.state.playEnded) return;

	if (type === "start") {
		const target = getClosestOffensePlayer(game, x, y, 32);
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

function getPos(canvas, event) {
	const rect = canvas.getBoundingClientRect();
	const point = event.touches ? event.touches[0] : event;
	return {
		x: point.clientX - rect.left,
		y: point.clientY - rect.top
	};
}

export function initInputHandlers(canvas, game) {
	canvas.addEventListener("pointerdown", event => {
		event.preventDefault();
		const pos = getPos(canvas, event);
		handleInput(game, "start", pos.x, pos.y);
	}, { passive: false });

	canvas.addEventListener("pointermove", event => {
		event.preventDefault();
		const pos = getPos(canvas, event);
		handleInput(game, "move", pos.x, pos.y);
	}, { passive: false });

	canvas.addEventListener("pointerup", event => {
		event.preventDefault();
		const pos = getPos(canvas, event);
		handleInput(game, "end", pos.x, pos.y);
	}, { passive: false });

	canvas.addEventListener("pointercancel", event => {
		event.preventDefault();
		const pos = getPos(canvas, event);
		handleInput(game, "end", pos.x, pos.y);
	}, { passive: false });
}
