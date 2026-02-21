import { handleTackleResult } from "./next-play.js";

const COLLISION_DISTANCE = 30;
const TACKLE_DISTANCE = 26;
const DEFENDER_STUN_MS = 1000;

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
				// Same team: ball carrier can be pushed forward by teammates
				if (game.ballCarrier && playerA === game.ballCarrier) {
					playerB.x += nx * overlap * 2;
					playerB.y += ny * overlap * 2;
				} else if (game.ballCarrier && playerB === game.ballCarrier) {
					playerA.x -= nx * overlap * 2;
					playerA.y -= ny * overlap * 2;
				} else {
					playerA.x -= nx * overlap;
					playerA.y -= ny * overlap;
					playerB.x += nx * overlap;
					playerB.y += ny * overlap;
				}
			} else {
				if (involvesBallCarrier) {
					// Allow defenders to overlap the ball carrier; no push apart here.
					continue;
				}
				if (playerA.team === "defense") {
					const slip = rushActive && (game.isRusher?.(playerA) ?? false) ? (1 - game.rushPushThrough) : 1;
					const stackBoost = game.getStackBoost?.(playerA, nx, ny) ?? 1;
					playerA.x -= nx * overlap * 2 * slip * stackBoost;
					playerA.y -= ny * overlap * 2 * slip * stackBoost;
				} else if (playerB.team === "defense") {
					const slip = rushActive && (game.isRusher?.(playerB) ?? false) ? (1 - game.rushPushThrough) : 1;
					const stackBoost = game.getStackBoost?.(playerB, nx, ny) ?? 1;
					playerB.x += nx * overlap * 2 * slip * stackBoost;
					playerB.y += ny * overlap * 2 * slip * stackBoost;
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
	const activeIds = new Set();
	const adjustedTackleTime = 1.0;
	const tackled = game.roster.some(defender => {
		if (defender.team !== "defense") return false;
		const dist = Math.hypot(defender.x - game.ballCarrier.x, defender.y - game.ballCarrier.y);
		if (dist <= COLLISION_DISTANCE) {
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
