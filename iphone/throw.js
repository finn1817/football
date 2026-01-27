import { handleInterception } from "./next-play.js";

export const LOB_HOLD_MS = 400;

export function getThrowTargets(game) {
	const validRoles = new Set(["WR", "TE", "RB"]);
	const targets = game.roster.filter(player => player.team === "offense" && validRoles.has(player.role));
	const roleOrder = { WR: 1, TE: 2, RB: 3 };
	targets.sort((a, b) => {
		const roleDiff = (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9);
		if (roleDiff !== 0) return roleDiff;
		return a.x - b.x;
	});
	const qb = game.roster.find(player => player.role === "QB");
	if (game.ballCarrier && game.ballCarrier.role !== "QB" && qb && qb !== game.ballCarrier) {
		targets.push(qb);
	}
	return targets;
}

function canThrowFromPosition(game) {
	if (!game.ballCarrier) return false;
	return game.ballCarrier.y >= (game.lineOfScrimmageY - 2);
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const lenSq = dx * dx + dy * dy;
	if (lenSq === 0) return Math.hypot(px - x1, py - y1);
	let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
	t = Math.max(0, Math.min(1, t));
	const projX = x1 + t * dx;
	const projY = y1 + t * dy;
	return Math.hypot(px - projX, py - projY);
}

function getInterceptorOnLine(game, start, end) {
	const threshold = 20;
	let closest = null;
	let closestDist = Infinity;
	game.roster.forEach(def => {
		if (def.team !== "defense") return;
		if (def.role === "DL") return;
		const dist = pointToSegmentDistance(def.x, def.y, start.x, start.y, end.x, end.y);
		if (dist < threshold && dist < closestDist) {
			closestDist = dist;
			closest = def;
		}
	});
	return closest;
}

export function attemptThrow(game, targetPlayer, isLob) {
	if (!game.state.gameActive || game.state.isPaused) return;
	if (!game.ballCarrier || game.ballCarrier.team !== "offense") return;
	if (!targetPlayer || targetPlayer.team !== "offense") return;
	if (game.ballFlight?.active) return;
	const isBackward = targetPlayer.y > (game.ballCarrier.y + 2);
	if (!isBackward && !canThrowFromPosition(game)) return;
	if (!isBackward && targetPlayer.role === "QB" && targetPlayer.y < (game.lineOfScrimmageY - 2)) return;

	const start = { x: game.ballCarrier.x, y: game.ballCarrier.y };
	const end = { x: targetPlayer.x, y: targetPlayer.y };
	game.ballCarrier.hasBall = false;
	const interceptor = !isLob ? getInterceptorOnLine(game, start, end) : null;

	game.ballFlight = {
		active: true,
		lob: isLob,
		startX: start.x,
		startY: start.y,
		x: start.x,
		y: start.y,
		target: targetPlayer,
		interceptTarget: interceptor,
		progress: 0,
		speed: isLob ? 0.012 : 0.03,
		arcHeight: isLob ? 120 : 0
	};

	game.ballCarrier = null;
}

export function advanceBallFlight(game) {
	if (!game.ballFlight?.active) return;
	const progress = Math.min(1, game.ballFlight.progress + game.ballFlight.speed);
	game.ballFlight.progress = progress;
	const activeTarget = game.ballFlight.interceptTarget ?? game.ballFlight.target;
	const endX = activeTarget.x;
	const endY = activeTarget.y;
	const arcOffset = game.ballFlight.lob ? Math.sin(Math.PI * progress) * game.ballFlight.arcHeight : 0;
	game.ballFlight.x = lerp(game.ballFlight.startX, endX, progress);
	game.ballFlight.y = lerp(game.ballFlight.startY, endY, progress) - arcOffset;
	if (progress >= 1) {
		if (game.ballFlight.interceptTarget) {
			handleInterception(game, game.ballFlight.interceptTarget);
		} else {
			game.ballFlight.target.hasBall = true;
			game.ballCarrier = game.ballFlight.target;
		}
		game.ballFlight.active = false;
	}
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}
