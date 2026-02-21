import { handleTackleResult } from "./next-play.js";

const COLLISION_DISTANCE = 30;
const TACKLE_DISTANCE = 24;
const DEFENDER_STUN_MS = 900;
const FORCE_BY_ROLE = {
	QB: 0.95,
	RB: 1.25,
	FB: 1.35,
	WR: 0.9,
	TE: 1.15,
	OL: 1.4,
	DL: 1.35,
	LB: 1.1,
	MLB: 1.2,
	CB: 0.95,
	S: 1.0
};

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

function getRoleForce(player) {
	return FORCE_BY_ROLE[player.role] ?? 1;
}

function getTeammatePushMultiplier(game, player, pushDirX, pushDirY) {
	let supportCount = 0;
	const maxBackDepth = 34;
	const maxLateral = 18;
	for (const teammate of game.roster) {
		if (teammate === player) continue;
		if (teammate.team !== player.team) continue;
		const dx = teammate.x - player.x;
		const dy = teammate.y - player.y;
		const backDepth = -(dx * pushDirX + dy * pushDirY);
		const lateral = Math.abs(dx * -pushDirY + dy * pushDirX);
		if (backDepth >= 4 && backDepth <= maxBackDepth && lateral <= maxLateral) {
			supportCount += 1;
		}
	}
	return 1 + Math.min(0.75, supportCount * 0.25);
}

function getPushForce(game, player, pushDirX, pushDirY, stunned, rushActive) {
	let force = getRoleForce(player);
	if (player.team === "defense" && rushActive && (game.isRusher?.(player) ?? false)) {
		force *= 1.12;
	}
	if (player === game.ballCarrier && player.team === "offense") {
		force *= 1.08;
	}
	if (stunned) {
		force *= 0.45;
	}
	force *= getTeammatePushMultiplier(game, player, pushDirX, pushDirY);
	return force;
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
				// Opposing teams: force contest with teammate-assisted push
				const aStunned = playerA.team === "defense" && (game.defenseStunUntil.get(playerA.id) ?? 0) > performance.now();
				const bStunned = playerB.team === "defense" && (game.defenseStunUntil.get(playerB.id) ?? 0) > performance.now();

				const aForce = getPushForce(game, playerA, nx, ny, aStunned, rushActive);
				const bForce = getPushForce(game, playerB, -nx, -ny, bStunned, rushActive);
				const forceTotal = Math.max(0.001, aForce + bForce);
				const aShare = aForce / forceTotal;
				const bShare = bForce / forceTotal;

				// Keep contact while allowing stronger side to win the scrum
				const contestSeparation = overlap * 0.9;
				playerA.x -= nx * contestSeparation * bShare;
				playerA.y -= ny * contestSeparation * bShare;
				playerB.x += nx * contestSeparation * aShare;
				playerB.y += ny * contestSeparation * aShare;
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
