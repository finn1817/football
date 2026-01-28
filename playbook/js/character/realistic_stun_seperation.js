export function separateOverlaps(roster, minDistance = 22) {
	for (let i = 0; i < roster.length; i += 1) {
		for (let j = i + 1; j < roster.length; j += 1) {
			const a = roster[i];
			const b = roster[j];
			const dx = b.x - a.x;
			const dy = b.y - a.y;
			const dist = Math.hypot(dx, dy);
			if (dist === 0 || dist >= minDistance) continue;
			const overlap = (minDistance - dist) / 2;
			const nx = dx / dist;
			const ny = dy / dist;
			a.x -= nx * overlap;
			a.y -= ny * overlap;
			b.x += nx * overlap;
			b.y += ny * overlap;
		}
	}
}
