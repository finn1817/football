export const FIELD_VIEWS = {
	full: {
		id: "full",
		label: "Full field (0-100)",
		startYard: 0,
		endYard: 100,
		showNumbers: true,
		showHash: true
	},
	opponent: {
		id: "opponent",
		label: "Opponent half (50-100)",
		startYard: 50,
		endYard: 100,
		showNumbers: true,
		showHash: true
	},
	redzone: {
		id: "redzone",
		label: "Red zone (80-100)",
		startYard: 80,
		endYard: 100,
		showNumbers: true,
		showHash: true
	},
	"goal-line": {
		id: "goal-line",
		label: "Goal line (90-100)",
		startYard: 90,
		endYard: 100,
		showNumbers: true,
		showHash: true
	}
};

export function getFieldView(id) {
	return FIELD_VIEWS[id] || FIELD_VIEWS.full;
}

export function resolveFieldView({ viewId, showNumbers, showHash }) {
	const base = getFieldView(viewId);
	return {
		...base,
		showNumbers: typeof showNumbers === "boolean" ? showNumbers : base.showNumbers,
		showHash: typeof showHash === "boolean" ? showHash : base.showHash
	};
}
