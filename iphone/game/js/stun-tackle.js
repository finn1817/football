import { handleTackleResult } from "./next-play.js";

const COLLISION_DISTANCE = 30;
const TACKLE_DISTANCE = 22;
const DEFENDER_STUN_MS = 900;

function getTackleHoldMultiplier(role) {
	switch (role) {
		case "QB":
			return 0.7;
		case "RB":
		case "FB":
			return 1.2;
		case "WR":
			return 1.25;
		case "TE":
			return 1.15;
		default:
			return 1;
	}
}

function stunDefender(game, player) {
	if (!player || player.team !== "defense") return;
	const now = performance.now();
	const stunnedUntil = game.defenseStunUntil.get(player.id) ?? 0;
	if (stunnedUntil > now) return;
	game.defenseStunUntil.set(player.id, now + DEFENDER_STUN_MS);
}

export function resolveCollisions(game) {
	const rushActive = game.isRushActive?.() ?? false;
	const currentCollisions = new Set();
	for (let i = 0; i < game.roster.length; i += 1) {
		for (let j = i + 1; j < game.roster.length; j += 1) {
			const playerA = game.roster[i];
			const playerB = game.roster[j];
			const involvesBallCarrier = game.ballCarrier && (playerA === game.ballCarrier || playerB === game.ballCarrier);
			const dx = playerB.x - playerA.x;
			const dy = playerB.y - playerA.y;
			const dist = Math.hypot(dx, dy);
			if (dist === 0 || dist >= COLLISION_DISTANCE) continue;
			const key = playerA.id < playerB.id ? `${playerA.id}-${playerB.id}` : `${playerB.id}-${playerA.id}`;
			currentCollisions.add(key);
			const wasColliding = game.previousCollisions.has(key);
			const overlap = (COLLISION_DISTANCE - dist) / 2;
			const nx = dx / dist;
			const ny = dy / dist;
			if (!involvesBallCarrier && !wasColliding && playerA.team !== playerB.team) {
				stunDefender(game, playerA);
				stunDefender(game, playerB);
			}
			if (playerA.team === playerB.team) {
				// Same team: ball carrier pushes teammates aside completely
				if (game.ballCarrier && playerA === game.ballCarrier) {
					playerB.x += nx * overlap * 3;
					playerB.y += ny * overlap * 3;
				} else if (game.ballCarrier && playerB === game.ballCarrier) {
					playerA.x -= nx * overlap * 3;
					playerA.y -= ny * overlap * 3;
				} else {
					// Non-ball carriers move smoothly past each other
					playerA.x -= nx * overlap * 0.5;
					playerA.y -= ny * overlap * 0.5;
					playerB.x += nx * overlap * 0.5;
					playerB.y += ny * overlap * 0.5;
				}
			} else {
				// Opposing teams: ball carrier can push through defenders
				const aStunned = playerA.team === "defense" && (game.defenseStunUntil.get(playerA.id) ?? 0) > performance.now();
				const bStunned = playerB.team === "defense" && (game.defenseStunUntil.get(playerB.id) ?? 0) > performance.now();
				
				// D-Line gets extra push power to penetrate O-line when not stunned
				const aIsDLine = playerA.team === "defense" && playerA.role === "DL";
				const bIsDLine = playerB.team === "defense" && playerB.role === "DL";
				
				// Ball carrier gets push advantage for tush push
				const aIsBallCarrier = game.ballCarrier && playerA === game.ballCarrier;
				const bIsBallCarrier = game.ballCarrier && playerB === game.ballCarrier;
				
				if (playerA.team === "defense") {
					if (aStunned) {
						// Stunned defender gets pushed back hard
						playerA.x -= nx * overlap * 4;
						playerA.y -= ny * overlap * 4;
					} else if (bIsBallCarrier) {
						// Ball carrier gets slight leverage without breaking tackle contact
						playerA.x -= nx * overlap * 0.35;
						playerA.y -= ny * overlap * 0.35;
						playerB.x -= nx * overlap * 0.15;
						playerB.y -= ny * overlap * 0.15;
					} else if (aIsDLine || (rushActive && (game.isRusher?.(playerA) ?? false))) {
						// D-Line gets moderate push when not blocked
						const pushPower = aIsDLine ? Math.max(0.4, game.rushPushThrough * 0.7) : game.rushPushThrough;
						playerA.x += nx * overlap * pushPower * 0.5;
						playerA.y += ny * overlap * pushPower * 0.5;
						playerB.x += nx * overlap * (2 - pushPower);
						playerB.y += ny * overlap * (2 - pushPower);
					} else {
						// Regular collision
						playerA.x -= nx * overlap;
						playerA.y -= ny * overlap;
						playerB.x += nx * overlap;
						playerB.y += ny * overlap;
					}
				} else if (playerB.team === "defense") {
					if (bStunned) {
						// Stunned defender gets pushed back hard
						playerB.x += nx * overlap * 4;
						playerB.y += ny * overlap * 4;
					} else if (aIsBallCarrier) {
						// Ball carrier gets slight leverage without breaking tackle contact
						playerB.x += nx * overlap * 0.35;
						playerB.y += ny * overlap * 0.35;
						playerA.x += nx * overlap * 0.15;
						playerA.y += ny * overlap * 0.15;
					} else if (bIsDLine || (rushActive && (game.isRusher?.(playerB) ?? false))) {
						// D-Line gets moderate push when not blocked
						const pushPower = bIsDLine ? Math.max(0.4, game.rushPushThrough * 0.7) : game.rushPushThrough;
						playerB.x -= nx * overlap * pushPower * 0.5;
						playerB.y -= ny * overlap * pushPower * 0.5;
						playerA.x -= nx * overlap * (2 - pushPower);
						playerA.y -= ny * overlap * (2 - pushPower);
					} else {
						// Regular collision
						playerA.x -= nx * overlap;
						playerA.y -= ny * overlap;
						playerB.x += nx * overlap;
						playerB.y += ny * overlap;
					}
				}
				if (playerA.team === "offense") {
					const stackBoost = game.getStackBoost?.(playerA, nx, ny) ?? 1;
					if (stackBoost > 1) {
						playerA.x -= nx * overlap * (stackBoost - 1);
						playerA.y -= ny * overlap * (stackBoost - 1);
					}
				} else if (playerB.team === "offense") {
					const stackBoost = game.getStackBoost?.(playerB, nx, ny) ?? 1;
					if (stackBoost > 1) {
						playerB.x += nx * overlap * (stackBoost - 1);
						playerB.y += ny * overlap * (stackBoost - 1);
					}
				}
			}
		}
	}
	game.previousCollisions = currentCollisions;
}

export function checkTackle(game) {
	if (!game.state.gameActive || game.state.isPaused) return;
	if (!game.ballCarrier || game.ballCarrier.team !== "offense") return;
	const now = performance.now();
	const roleMultiplier = getTackleHoldMultiplier(game.ballCarrier.role);
	const adjustedTackleTime = game.tackleHoldSeconds * roleMultiplier;
	const activeIds = new Set();
	const tackled = game.roster.some(defender => {
		if (defender.team !== "defense") return false;
		const dist = Math.hypot(defender.x - game.ballCarrier.x, defender.y - game.ballCarrier.y);
		if (dist <= TACKLE_DISTANCE) {
			activeIds.add(defender.id);
			const startedAt = game.tackleContact.get(defender.id) ?? now;
			game.tackleContact.set(defender.id, startedAt);
			return (now - startedAt) / 1000 >= adjustedTackleTime;
		}
		return false;
	});
	game.tackleContact.forEach((_, id) => {
		if (!activeIds.has(id)) {
			game.tackleContact.delete(id);
		}
	});
	if (tackled) {
		handleTackleResult(game);
	}
}
