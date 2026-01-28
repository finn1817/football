export function applyPlayerAdjustments(player, updates) {
	if (!player) return;
	const next = { ...updates };
	if (typeof next.speed === "number") player.speed = next.speed;
	if (typeof next.strength === "number") player.strength = next.strength;
	if (typeof next.stamina === "number") player.stamina = next.stamina;
	if (typeof next.role === "string") player.role = next.role;
	if (typeof next.x === "number") player.x = next.x;
	if (typeof next.y === "number") player.y = next.y;
}

export function serializePlayer(player) {
	return {
		id: player.id,
		team: player.team,
		role: player.role,
		x: player.x,
		y: player.y,
		speed: player.speed,
		strength: player.strength,
		stamina: player.stamina,
		path: player.path ?? []
	};
}
