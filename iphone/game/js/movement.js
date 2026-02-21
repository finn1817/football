function getOffenseByRole(game, role) {
	return game.roster.filter(player => player.team === "offense" && player.role === role);
}

function getDefenseByRole(game, role) {
	return game.roster.filter(player => player.team === "defense" && player.role === role);
}

function getCoverageAssignments(game) {
	const assignments = new Map();
	const cbs = getDefenseByRole(game, "CB").sort((a, b) => a.x - b.x);
	const lbs = getDefenseByRole(game, "LB").sort((a, b) => a.x - b.x);
	const tes = getOffenseByRole(game, "TE").sort((a, b) => a.x - b.x);
	const rbs = getOffenseByRole(game, "RB").sort((a, b) => a.x - b.x);
	const wrs = getOffenseByRole(game, "WR").sort((a, b) => a.x - b.x);
	const used = new Set();
	const allReceivers = [...wrs, ...tes, ...rbs];
	const coverageDefs = [...cbs, ...lbs];
	coverageDefs.forEach(def => {
		if (!allReceivers.length) return;
		let best = null;
		let bestDist = Infinity;
		allReceivers.forEach(rec => {
			if (used.has(rec.id)) return;
			const dist = Math.hypot(def.x - rec.x, def.y - rec.y);
			if (dist < bestDist) {
				bestDist = dist;
				best = rec;
			}
		});
		if (!best) {
			allReceivers.forEach(rec => {
				const dist = Math.hypot(def.x - rec.x, def.y - rec.y);
				if (dist < bestDist) {
					bestDist = dist;
					best = rec;
				}
			});
		}
		if (best) {
			assignments.set(def.id, best.id);
			used.add(best.id);
		}
	});
	return assignments;
}

export function setDefenseScheme(game) {
	const roll = Math.random();
	if (roll < 0.34) game.defenseScheme = "man";
	else if (roll < 0.67) game.defenseScheme = "zone";
	else game.defenseScheme = "blitz";
}

function getDefenseScheme(game) {
	if (game.defenseScheme) return game.defenseScheme;
	return "man";
}

export function moveOffense(game, deltaSeconds) {
	if (!game.state.gameActive || game.state.isRouting || game.state.isPaused) return;
	game.roster.forEach(player => {
		if (player.team !== "offense") return;
		if (!player.path || player.path.length < 2) return;
		if (player.pathIndex >= player.path.length) return;
		let target = player.path[player.pathIndex];
		let dx = target.x - player.x;
		let dy = target.y - player.y;
		let dist = Math.hypot(dx, dy);
		if (dist === 0) {
			player.pathIndex = Math.min(player.pathIndex + 1, player.path.length - 1);
			target = player.path[player.pathIndex];
			dx = target.x - player.x;
			dy = target.y - player.y;
			dist = Math.hypot(dx, dy);
			if (dist === 0) return;
		}
		const speedPx = player.speedYps * game.pixelsPerYard;
		const speedMultiplier = player.hasBall ? 0.85 : 1;
		const step = speedPx * speedMultiplier * deltaSeconds;
		if (dist <= step) {
			player.x = target.x;
			player.y = target.y;
			player.pathIndex = Math.min(player.pathIndex + 1, player.path.length - 1);
		} else {
			player.x += (dx / dist) * step;
			player.y += (dy / dist) * step;
		}
	});
}

export function moveDefense(game, deltaSeconds) {
	if (!game.state.gameActive || game.state.isRouting || game.state.isPaused) return;
	if (!game.defenseAssigned) {
		game.defenseAssigned = true;
	}
	const now = performance.now();
	const rushActive = game.isRushActive?.() ?? false;
	const assignments = getCoverageAssignments(game);
	const losY = game.lineOfScrimmageY;
	const qb = game.roster.find(player => player.role === "QB" && player.team === "offense");
	const chaseTarget = game.ballCarrier ?? (game.ballFlight?.target ?? qb);
	const qbRunning = game.ballCarrier && game.ballCarrier.role === "QB" && game.ballCarrier.y < (losY - 2);
	const defensePlayers = game.roster.filter(player => player.team === "defense");
	const deepestDefenders = defensePlayers.slice().sort((a, b) => a.y - b.y).slice(0, 2);
	const deepestIds = new Set(deepestDefenders.map(def => def.id));
	const zoneTop = game.field.topY + 30;
	const zoneBottom = losY - 80;
	const scheme = getDefenseScheme(game);

	game.roster.forEach(defender => {
		if (defender.team !== "defense") return;
		const stunnedUntil = game.defenseStunUntil.get(defender.id) ?? 0;
		if (stunnedUntil > now) return;
		let target = null;
		if (defender.role === "DL") {
			target = chaseTarget;
		} else if ((game.passAttempted || game.ballFlight?.active || qbRunning) && chaseTarget) {
			target = chaseTarget;
		} else {
			if (scheme === "zone" || (scheme === "blitz" && deepestIds.has(defender.id))) {
				const assignedId = assignments.get(defender.id);
				const assignedTarget = game.roster.find(player => player.id === assignedId) ?? null;
				const anchorX = defender.startX;
				const anchorY = Math.max(zoneTop, Math.min(zoneBottom, Math.min(defender.startY, losY - 140)));
				if (assignedTarget && assignedTarget.y < anchorY - 60) {
					target = assignedTarget;
				} else if (assignedTarget) {
					const shadeX = anchorX + (assignedTarget.x - anchorX) * 0.35;
					const shadeY = Math.min(anchorY, assignedTarget.y + 40);
					target = { x: shadeX, y: shadeY };
				} else {
					target = { x: anchorX, y: anchorY };
				}
			} else {
				if (defender.role === "CB" || defender.role === "LB") {
					const assignedId = assignments.get(defender.id);
					target = game.roster.find(player => player.id === assignedId) ?? null;
				}
				if (scheme === "blitz" && (defender.role === "MLB" || defender.role === "S" || defender.role === "DL")) {
					target = qb ?? chaseTarget;
				} else {
					if (defender.role === "MLB") {
						target = rushActive ? (qb ?? chaseTarget) : chaseTarget;
					}
					if (defender.role === "S") {
						target = rushActive ? (qb ?? chaseTarget) : chaseTarget;
					}
					if (defender.role === "DL") {
						target = chaseTarget;
					}
				}
			}
		}
		if (!target) {
			target = { x: defender.x, y: losY - 60 };
		}

		const dx = target.x - defender.x;
		const dy = target.y - defender.y;
		const dist = Math.hypot(dx, dy);
		if (dist === 0) return;
		const rushBoost = rushActive && (game.isRusher?.(defender) ?? false) ? game.rushSpeedMultiplier : 1;
		const speedPx = defender.speedYps * game.pixelsPerYard * rushBoost;
		const step = speedPx * deltaSeconds;
		if (dist <= step) {
			defender.x = target.x;
			defender.y = target.y;
		} else {
			defender.x += (dx / dist) * step;
			defender.y += (dy / dist) * step;
		}
	});
}
