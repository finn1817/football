export function movePlayers(roster, pixelsPerYard, deltaSeconds) {
	roster.forEach(player => {
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
		const speedPx = (player.speed ?? 6) * pixelsPerYard;
		const step = speedPx * deltaSeconds;
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
