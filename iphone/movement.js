import { assignDefenseTargets } from "./defense.js";

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
	const now = performance.now();
	const rushActive = game.isRushActive?.() ?? false;
	const assignments = assignDefenseTargets(game);
	const qb = game.roster.find(player => player.role === "QB" && player.team === "offense");
	const chaseTarget = game.ballCarrier ?? game.ballFlight?.target ?? qb;

	game.roster.forEach(defender => {
		if (defender.team !== "defense") return;
		const stunnedUntil = game.defenseStunUntil.get(defender.id) ?? 0;
		if (stunnedUntil > now) return;
		let target = null;
		if (defender.role === "CB" || defender.role === "LB") {
			const assignedId = assignments.get(defender.id);
			target = game.roster.find(player => player.id === assignedId) ?? null;
		}
		if (defender.role === "MLB" || defender.role === "S") {
			target = rushActive ? (qb ?? chaseTarget) : chaseTarget;
		}
		if (defender.role === "DL") {
			target = qb ?? chaseTarget;
		}
		if (!target) {
			target = { x: defender.x, y: game.lineOfScrimmageY - 60 };
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
