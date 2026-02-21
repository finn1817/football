import { FIELD_CONFIG, yardLineToY } from "./characters.js";

export function lerp(a, b, t) {
	return a + (b - a) * t;
}

export function getJumpOffset(player) {
	if (!player?.isJumping) return 0;
	const now = performance.now();
	const elapsed = now - (player.jumpStart ?? 0);
	const JUMP_DURATION_MS = 350;
	if (elapsed >= JUMP_DURATION_MS) {
		player.isJumping = false;
		return 0;
	}
	const t = elapsed / JUMP_DURATION_MS;
	const JUMP_HEIGHT = 16;
	return Math.sin(Math.PI * t) * JUMP_HEIGHT;
}

export function drawField(ctx, canvas, game) {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	
	// Endzones
	ctx.fillStyle = "rgba(0,0,100,0.2)";
	ctx.fillRect(0, 0, canvas.width, FIELD_CONFIG.endzoneHeight);
	ctx.fillRect(0, canvas.height - FIELD_CONFIG.endzoneHeight, canvas.width, FIELD_CONFIG.endzoneHeight);

	// Yard lines
	for (let yard = 0; yard <= 100; yard += 5) {
		const y = yardLineToY(game.field, yard);
		ctx.strokeStyle = "rgba(255,255,255,0.25)";
		ctx.lineWidth = (yard % 10 === 0) ? 2 : 1;
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(canvas.width, y);
		ctx.stroke();
	}

	// Yard numbers
	ctx.fillStyle = "rgba(255,255,255,0.9)";
	ctx.font = "11px Arial";
	ctx.textAlign = "left";
	for (let yard = 10; yard <= 90; yard += 10) {
		const label = yard <= 50 ? yard : 100 - yard;
		const y = yardLineToY(game.field, yard);
		ctx.fillText(String(label), 6, y + 4);
	}

	// Line of scrimmage
	const losY = game.lineOfScrimmageY;
	ctx.strokeStyle = "rgba(255,255,255,0.8)";
	ctx.lineWidth = 3;
	ctx.setLineDash([10, 6]);
	ctx.beginPath();
	ctx.moveTo(0, losY);
	ctx.lineTo(canvas.width, losY);
	ctx.stroke();
	ctx.setLineDash([]);

	// First down line
	const firstDownY = game.downsState.lineToGainY ?? (losY - (10 * game.pixelsPerYard));
	ctx.strokeStyle = "#ffd54a";
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(0, firstDownY);
	ctx.lineTo(canvas.width, firstDownY);
	ctx.stroke();
}

export function drawPlayers(ctx, game) {
	// Draw lob shadow if active
	if (game.ballFlight?.active && game.ballFlight.lob) {
		ctx.fillStyle = "rgba(0,0,0,0.3)";
		const progress = game.ballFlight.progress;
		const groundY = lerp(game.ballFlight.startY, game.ballFlight.target.y, progress);
		ctx.beginPath();
		ctx.arc(game.ballFlight.x, groundY, 10, 0, Math.PI * 2);
		ctx.fill();
	}

	// Draw all players
	game.roster.forEach(player => {
		const jumpOffset = getJumpOffset(player);
		const drawY = player.y - jumpOffset;
		
		// Shadow
		ctx.fillStyle = "rgba(0,0,0,0.5)";
		ctx.beginPath();
		ctx.arc(player.x + 2, player.y + 2, 15, 0, Math.PI * 2);
		ctx.fill();

		// Player color
		let fillColor = player.team === "offense" ? "#0099ff" : "#ff3300";
		if (player.team === "defense" && player.role === "DL") {
			fillColor = "#ff6655";
		}
		if (player.team === "defense") {
			const stunnedUntil = game.defenseStunUntil.get(player.id) ?? 0;
			if (stunnedUntil > performance.now()) {
				fillColor = "#9a9a9a";
			}
		}
		ctx.fillStyle = fillColor;
		ctx.beginPath();
		ctx.arc(player.x, drawY, 15, 0, Math.PI * 2);
		ctx.fill();

		// Ball indicator
		if (player.hasBall) {
			ctx.fillStyle = "brown";
			ctx.beginPath();
			ctx.arc(player.x, drawY, 8, 0, Math.PI * 2);
			ctx.fill();
		}

		// Role label
		ctx.fillStyle = "white";
		ctx.font = "10px Arial";
		ctx.textAlign = "center";
		ctx.fillText(player.role, player.x, drawY + 4);
	});

	// Draw ball in flight
	if (game.ballFlight?.active) {
		ctx.fillStyle = game.ballFlight.lob ? "#d2b48c" : "brown";
		ctx.beginPath();
		ctx.arc(game.ballFlight.x, game.ballFlight.y, game.ballFlight.lob ? 7 : 6, 0, Math.PI * 2);
		ctx.fill();
	}
}

export function drawRoutes(ctx, game) {
	game.roster.forEach(player => {
		if (player.team !== "offense" || player.path.length < 2) return;
		ctx.beginPath();
		ctx.strokeStyle = "yellow";
		ctx.lineWidth = 3;
		ctx.moveTo(player.path[0].x, player.path[0].y);
		player.path.forEach(point => {
			ctx.lineTo(point.x, point.y);
		});
		ctx.stroke();
	});
}

export function drawPrepCountdown(ctx, canvas, game) {
	if (!game.state.prepPhase || game.state.gameActive || game.state.playEnded) return;
	const seconds = Math.max(0, Math.ceil(game.prepRemaining));
	
	ctx.fillStyle = "rgba(0,0,0,0.35)";
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	
	ctx.fillStyle = "#ffd54a";
	ctx.font = "bold 72px Arial";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillText(String(seconds), canvas.width / 2, canvas.height / 2);
	
	ctx.font = "bold 16px Arial";
	ctx.fillStyle = "white";
	ctx.fillText("DRAW ROUTES", canvas.width / 2, canvas.height / 2 + 52);
}
