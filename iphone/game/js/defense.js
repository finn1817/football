export function assignDefenseTargets(game) {
	const assignments = new Map();
	const wrs = game.roster.filter(player => player.team === "offense" && player.role === "WR").sort((a, b) => a.x - b.x);
	const tes = game.roster.filter(player => player.team === "offense" && player.role === "TE").sort((a, b) => a.x - b.x);
	const rbs = game.roster.filter(player => player.team === "offense" && player.role === "RB").sort((a, b) => a.x - b.x);
	const cbs = game.roster.filter(player => player.team === "defense" && player.role === "CB").sort((a, b) => a.x - b.x);
	const lbs = game.roster.filter(player => player.team === "defense" && player.role === "LB").sort((a, b) => a.x - b.x);

	if (cbs[0] && wrs[0]) assignments.set(cbs[0].id, wrs[0].id);
	if (cbs[1] && wrs[1]) assignments.set(cbs[1].id, wrs[1].id);

	const lbTargets = [...tes, ...rbs].sort((a, b) => a.x - b.x);
	if (lbs[0] && lbTargets[0]) assignments.set(lbs[0].id, lbTargets[0].id);
	if (lbs[1] && lbTargets[lbTargets.length - 1]) assignments.set(lbs[1].id, lbTargets[lbTargets.length - 1].id);

	return assignments;
}
