import { yardLineToY } from "./characters.js";

const COLLISION_DISTANCE = 30;
const TACKLE_DISTANCE = 22;
const DEFENDER_STUN_MS = 900;

function stunDefender(game, player) {
	if (!player || player.team !== "defense") return;
	const now = performance.now();
	const stunnedUntil = game.defenseStunUntil.get(player.id) ?? 0;
	if (stunnedUntil > now) return;
	game.defenseStunUntil.set(player.id, now + DEFENDER_STUN_MS);
}

export function resolveCollisions(game) {
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
			if (!involvesBallCarrier && !wasColliding) {
				stunDefender(game, playerA);
				stunDefender(game, playerB);
			}
			if (playerA.team === playerB.team) {
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
					continue;
				}
				if (playerA.team === "defense") {
					playerA.x -= nx * overlap * 2;
					playerA.y -= ny * overlap * 2;
				} else if (playerB.team === "defense") {
					playerB.x += nx * overlap * 2;
					playerB.y += ny * overlap * 2;
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
	const tackled = game.roster.some(defender => {
		if (defender.team !== "defense") return false;
		const dist = Math.hypot(defender.x - game.ballCarrier.x, defender.y - game.ballCarrier.y);
		if (dist <= TACKLE_DISTANCE) {
			activeIds.add(defender.id);
			const startedAt = game.tackleContact.get(defender.id) ?? now;
			game.tackleContact.set(defender.id, startedAt);
			return (now - startedAt) / 1000 >= game.tackleHoldSeconds;
		}
		return false;
	});
	game.tackleContact.forEach((_, id) => {
		if (!activeIds.has(id)) {
			game.tackleContact.delete(id);
		}
	});
	if (tackled) {
		game.state.gameActive = false;
		game.state.playEnded = true;
		game.downsState.ballSpotY = game.ballCarrier.y;
		if (game.downsState.ballSpotY <= game.downsState.lineToGainY) {
			game.downsState.down = 1;
			game.downsState.lineToGainY = game.downsState.ballSpotY - (10 * game.pixelsPerYard);
		} else {
			if (game.downsState.down >= 4) {
				game.downsState.gameOver = true;
			} else {
				game.downsState.down += 1;
			}
		}
		game.setTimerText(game.downsState.gameOver ? "GAME OVER" : "TACKLED");
		game.updateDownsPanel();
		if (game.downsState.gameOver) {
			game.setNextPlayVisible(false);
		} else {
			game.setNextPlayVisible(true);
		}
	}
}

export function checkTouchdown(game) {
	if (!game.state.gameActive || game.state.isPaused) return;
	if (!game.ballCarrier || game.ballCarrier.team !== "offense") return;
	if (game.ballCarrier.y <= game.field.topY) {
		game.state.gameActive = false;
		game.state.playEnded = true;
		game.setTimerText("TOUCHDOWN!");
		game.stats.touchdowns += 1;
		game.stats.score += 7;
		game.downsState.down = 1;
		localStorage.setItem("iphone-yard-line", "25");
		game.downsState.ballSpotY = yardLineToY(game.field, 25);
		game.downsState.lineToGainY = game.downsState.ballSpotY - (10 * game.pixelsPerYard);
		game.updateDownsPanel();
		game.setNextPlayVisible(true);
	}
}
