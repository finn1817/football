export const FIELD_CONFIG = {
	width: 900,
	height: 600,
	endzoneHeight: 40,
	yardsPerField: 100
};

export class Player {
	constructor({ id, team, role, x, y }) {
		this.id = id;
		this.team = team;
		this.role = role;
		this.x = x;
		this.y = y;
		this.startX = x;
		this.startY = y;
		this.path = [];
		this.pathIndex = 0;
		this.speed = 6.5;
		this.strength = 6.0;
		this.stamina = 6.0;
		this.hasBall = role === "QB";
	}

	resetPosition() {
		this.x = this.startX;
		this.y = this.startY;
		this.pathIndex = 0;
	}
}

export const SPEED_PRESETS = {
	QB: 5.8,
	RB: 6.4,
	WR: 6.7,
	TE: 6.1,
	OL: 5.6,
	DL: 5.4,
	LB: 6.1,
	MLB: 6.0,
	CB: 6.6,
	S: 6.4
};

export function yardLineToY(field, yardLine) {
	const clamped = Math.max(0, Math.min(100, yardLine));
	const percent = clamped / FIELD_CONFIG.yardsPerField;
	return field.bottomY - (percent * field.playHeight);
}

export function yToYardLine(field, yPos) {
	const clampedY = Math.max(field.topY, Math.min(field.bottomY, yPos));
	const percent = (field.bottomY - clampedY) / field.playHeight;
	return percent * FIELD_CONFIG.yardsPerField;
}

export function createFieldDimensions(canvas) {
	const width = canvas.width || FIELD_CONFIG.width;
	const height = canvas.height || FIELD_CONFIG.height;
	return {
		width,
		height,
		topY: FIELD_CONFIG.endzoneHeight,
		bottomY: height - FIELD_CONFIG.endzoneHeight,
		playHeight: height - FIELD_CONFIG.endzoneHeight * 2,
		pixelsPerYard: (height - FIELD_CONFIG.endzoneHeight * 2) / FIELD_CONFIG.yardsPerField
	};
}

export function buildDefaultRoster(field) {
	let nextId = 1;
	const players = [];
	const lineLeft = field.width * 0.33;
	const lineRight = field.width * 0.67;
	const lineCount = 5;
	const lineXs = [];
	for (let i = 0; i < lineCount; i += 1) {
		const t = lineCount === 1 ? 0.5 : i / (lineCount - 1);
		lineXs.push(lineLeft + (lineRight - lineLeft) * t);
	}
	const wrLeftX = field.width * 0.22;
	const wrRightX = field.width * 0.78;
	const teLeftX = field.width * 0.28;
	const teRightX = field.width * 0.72;
	const losY = field.bottomY - field.playHeight * 0.25;

	players.push(new Player({ id: nextId++, team: "offense", role: "QB", x: field.width * 0.5, y: losY + 60 }));
	players.push(new Player({ id: nextId++, team: "offense", role: "RB", x: field.width * 0.5, y: losY + 90 }));
	players.push(new Player({ id: nextId++, team: "offense", role: "WR", x: wrLeftX, y: losY + 60 }));
	players.push(new Player({ id: nextId++, team: "offense", role: "WR", x: wrRightX, y: losY + 60 }));
	players.push(new Player({ id: nextId++, team: "offense", role: "TE", x: teLeftX, y: losY + 40 }));
	players.push(new Player({ id: nextId++, team: "offense", role: "TE", x: teRightX, y: losY + 40 }));
	lineXs.forEach(x => players.push(new Player({ id: nextId++, team: "offense", role: "OL", x, y: losY + 40 })));

	players.push(new Player({ id: nextId++, team: "defense", role: "MLB", x: field.width * 0.5, y: losY - 20 }));
	players.push(new Player({ id: nextId++, team: "defense", role: "LB", x: field.width * 0.35, y: losY - 20 }));
	players.push(new Player({ id: nextId++, team: "defense", role: "LB", x: field.width * 0.65, y: losY - 20 }));
	players.push(new Player({ id: nextId++, team: "defense", role: "CB", x: wrLeftX, y: losY - 80 }));
	players.push(new Player({ id: nextId++, team: "defense", role: "CB", x: wrRightX, y: losY - 80 }));
	players.push(new Player({ id: nextId++, team: "defense", role: "S", x: field.width * 0.5, y: losY - 140 }));
	lineXs.forEach(x => players.push(new Player({ id: nextId++, team: "defense", role: "DL", x, y: losY - 10 })));

	players.forEach(player => {
		player.speed = SPEED_PRESETS[player.role] ?? player.speed;
	});

	return players;
}
