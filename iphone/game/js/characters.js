export const FIELD_CONFIG = {
	endzoneHeight: 50,
	yardsPerField: 100,
	defaultYardLine: 25
};

export class Player {
	constructor(id, x, y, team, role) {
		this.id = id;
		this.x = x;
		this.y = y;
		this.startX = x;
		this.startY = y;
		this.baseX = x;
		this.baseYOffset = 0;
		this.team = team;
		this.role = role;
		this.path = [];
		this.pathIndex = 0;
		this.speedYps = 6.7;
		this.hasBall = (role === "QB");
		this.isDead = false;
		this.isJumping = false;
		this.jumpStart = 0;
		this.jumpCooldownUntil = 0;
	}

	reset() {
		this.x = this.startX;
		this.y = this.startY;
		this.path = [];
		this.pathIndex = 0;
		this.isDead = false;
		this.hasBall = (this.role === "QB");
		this.isJumping = false;
		this.jumpStart = 0;
		this.jumpCooldownUntil = 0;
	}
}

export const SPEED_YPS = {
	QB: 5.8,
	RB: 6.4,
	FB: 6.0,
	WR: 6.7,
	SL: 6.6,
	TE: 6.1,
	OL: 5.6,
	MLB: 6.0,
	LB: 6.1,
	DL: 5.4,
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

export function getLineOfScrimmageY(field, storedKey = "iphone-yard-line") {
	const stored = Number(localStorage.getItem(storedKey) ?? FIELD_CONFIG.defaultYardLine);
	return yardLineToY(field, stored);
}

export function buildRoster(field) {
	let nextId = 1;
	const players = [];
	const lineCount = 5;
	const lineLeft = field.width * 0.315;
	const lineRight = field.width * 0.685;
	const teInset = field.width * 0.065;
	const wrInset = field.width * 0.148;
	const clampX = (value) => Math.max(35, Math.min(field.width - 35, value));

	const lineXs = [];
	for (let i = 0; i < lineCount; i += 1) {
		const t = lineCount === 1 ? 0.5 : i / (lineCount - 1);
		lineXs.push(lineLeft + (lineRight - lineLeft) * t);
	}

	const teLeftX = clampX(lineLeft - teInset);
	const teRightX = clampX(lineRight + teInset);
	const wrLeftX = clampX(lineLeft - wrInset);
	const wrRightX = clampX(lineRight + wrInset);

	players.push(new Player(nextId++, field.width * 0.5, field.bottomY - 90, "offense", "QB"));
	players.push(new Player(nextId++, field.width * 0.5, field.bottomY - 90, "offense", "RB"));
	players.push(new Player(nextId++, wrLeftX, field.bottomY - 90, "offense", "WR"));
	players.push(new Player(nextId++, wrRightX, field.bottomY - 90, "offense", "WR"));
	players.push(new Player(nextId++, teLeftX, field.bottomY - 90, "offense", "TE"));
	players.push(new Player(nextId++, teRightX, field.bottomY - 90, "offense", "TE"));
	lineXs.forEach(x => {
		players.push(new Player(nextId++, x, field.bottomY - 90, "offense", "OL"));
	});

	const defenseLineXs = lineXs.slice();
	const lbLeftX = clampX(teLeftX);
	const lbRightX = clampX(teRightX);

	players.push(new Player(nextId++, field.width * 0.5, field.bottomY - 150, "defense", "MLB"));
	players.push(new Player(nextId++, lbLeftX, field.bottomY - 150, "defense", "LB"));
	players.push(new Player(nextId++, lbRightX, field.bottomY - 150, "defense", "LB"));
	players.push(new Player(nextId++, wrLeftX, field.bottomY - 230, "defense", "CB"));
	players.push(new Player(nextId++, wrRightX, field.bottomY - 230, "defense", "CB"));
	players.push(new Player(nextId++, field.width * 0.5, field.bottomY - 290, "defense", "S"));
	defenseLineXs.forEach(x => {
		players.push(new Player(nextId++, x, field.bottomY - 150, "defense", "DL"));
	});

	return players;
}

export function setFormationOffsets(roster) {
	const roleOffsetY = {
		QB: 70,
		RB: 120,
		WR: 20,
		SL: 20,
		TE: 20,
		OL: 20,
		DL: -40,
		LB: -80,
		MLB: -90,
		CB: -140,
		S: -200
	};

	roster.forEach(player => {
		player.baseX = player.x;
		player.baseYOffset = roleOffsetY[player.role] ?? 0;
	});
}

export function applyFormationToLine(roster, lineY) {
	roster.forEach(player => {
		player.x = player.baseX;
		player.y = lineY + player.baseYOffset;
		player.startX = player.x;
		player.startY = player.y;
	});
}

export function applySpeeds(roster, defenseMultiplier = 1.1) {
	roster.forEach(player => {
		const baseMult = player.team === "defense" ? defenseMultiplier : 1.1;
		player.speedYps = (SPEED_YPS[player.role] ?? 6.0) * baseMult;
	});
}
