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
	const cfg = game.difficultyConfig ?? { interceptionRadius: 20 };
	const threshold = cfg.interceptionRadius;
	let closest = null;
	let closestDist = Infinity;
	const now = performance.now();
	game.roster.forEach(def => {
		if (def.team !== "defense") return;
		if (def.role === "DL") return;
		const stunnedUntil = game.defenseStunUntil.get(def.id) ?? 0;
		if (stunnedUntil > now) return;
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
	game.passAttempted = true;
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

function canAutoJump(player) {
	if (!player || player.team !== "offense") return false;
	return player.role === "WR" || player.role === "TE" || player.role === "RB" || player.role === "QB";
}

function triggerJump(player) {
	if (!canAutoJump(player)) return;
	const now = performance.now();
	if (now < (player.jumpCooldownUntil ?? 0)) return;
	player.isJumping = true;
	player.jumpStart = now;
	player.jumpCooldownUntil = now + 900;
}

function resolveContestedCatch(interceptor, receiver, groundX, groundY) {
	if (!interceptor || !receiver) return interceptor ?? receiver;
	let defDist = Math.hypot(interceptor.x - groundX, interceptor.y - groundY);
	let offDist = Math.hypot(receiver.x - groundX, receiver.y - groundY);
	if (receiver.isJumping) {
		offDist = Math.max(0, offDist - 8);
	}
	return offDist <= defDist ? receiver : interceptor;
}

export function advanceBallFlight(game) {
	if (!game.ballFlight?.active) return;
	let progress = Math.min(1, game.ballFlight.progress + game.ballFlight.speed);
	game.ballFlight.progress = progress;
	const activeTarget = game.ballFlight.lob ? game.ballFlight.target : (game.ballFlight.interceptTarget ?? game.ballFlight.target);
	const endX = activeTarget.x;
	const endY = activeTarget.y;
	const arcOffset = game.ballFlight.lob ? Math.sin(Math.PI * progress) * game.ballFlight.arcHeight : 0;
	game.ballFlight.x = lerp(game.ballFlight.startX, endX, progress);
	game.ballFlight.y = lerp(game.ballFlight.startY, endY, progress) - arcOffset;
	const groundY = lerp(game.ballFlight.startY, endY, progress);

	const reachableHeight = 35;
	if (game.ballFlight.lob && arcOffset < reachableHeight) {
		const shallowLob = game.ballFlight.arcHeight <= 60;
		const now = performance.now();
		const cfg = game.difficultyConfig ?? { interceptionRadius: 20 };
		const tightCoverageRadius = Math.min(18, cfg.interceptionRadius * 0.6);
		
		for (const def of game.roster) {
			if (def.team !== "defense") continue;
			if (def.role === "DL" && progress > 0.2) continue;
			const stunnedUntil = game.defenseStunUntil.get(def.id) ?? 0;
			if (stunnedUntil > now) continue;
			
			// Check if defender is TIGHT on the target receiver
			const distToTarget = Math.hypot(def.x - game.ballFlight.target.x, def.y - game.ballFlight.target.y);
			const isTightCoverage = distToTarget < tightCoverageRadius;
			
			const distToShadow = Math.hypot(def.x - game.ballFlight.x, def.y - groundY);
			const distToStart = Math.hypot(def.x - game.ballFlight.startX, def.y - game.ballFlight.startY);
			const inEarlyWindow = progress < 0.12 && distToStart < 24;
			const inLateWindow = progress > 0.65 && isTightCoverage;
			
			// Intercept if defender is tight on receiver during late flight, or other conditions
			if (distToShadow < 20 && (shallowLob || inEarlyWindow || inLateWindow)) {
				game.ballFlight.interceptTarget = def;
				progress = 1;
				game.ballFlight.progress = 1;
				break;
			}
		}
	}

	if (game.ballFlight.lob && progress > 0.7 && arcOffset < reachableHeight + 10) {
		for (const player of game.roster) {
			if (!canAutoJump(player)) continue;
			const dist = Math.hypot(player.x - game.ballFlight.x, player.y - groundY);
			if (dist <= 30) {
				triggerJump(player);
			}
		}
	}

	if (progress >= 1) {
		if (game.ballFlight.interceptTarget) {
			const contestWinner = (game.ballFlight.lob && game.ballFlight.target?.team === "offense")
				? resolveContestedCatch(game.ballFlight.interceptTarget, game.ballFlight.target, game.ballFlight.x, groundY)
				: game.ballFlight.interceptTarget;
			if (contestWinner.team === "defense") {
				handleInterception(game, contestWinner);
			} else {
				contestWinner.hasBall = true;
				game.ballCarrier = contestWinner;
			}
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
