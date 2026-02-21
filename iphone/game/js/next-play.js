import { applyFormationToLine, getLineOfScrimmageY, yardLineToY, yToYardLine } from "./characters.js";
import { setDefenseScheme } from "./movement.js";

export function startPlay(game) {
	if (game.state.gameActive || game.state.isPaused || game.state.playEnded) return;
	setDefenseScheme(game);
	game.passAttempted = false;
	game.state.prepPhase = false;
	game.state.gameActive = true;
	game.setTimerText("GO!");
	game.lineOfScrimmageY = game.downsState.ballSpotY ?? getLineOfScrimmageY(game.field);
	if (game.downsState.lineToGainY === null) {
		game.downsState.lineToGainY = game.lineOfScrimmageY - (10 * game.pixelsPerYard);
	}
	game.updateDownsPanel();
	if (typeof game.resetRushClock === "function") {
		game.resetRushClock();
	}
}

export function resetForNextPlay(game) {
	if (game.downsState.gameOver) return;
	game.defenseScheme = "";
	game.passAttempted = false;
	game.defenseAssigned = false;
	const spotY = game.downsState.ballSpotY ?? getLineOfScrimmageY(game.field);
	const yardLine = Math.round(yToYardLine(game.field, spotY));
	localStorage.setItem("iphone-yard-line", String(yardLine));
	applyFormationToLine(game.roster, yardLineToY(game.field, yardLine));
	game.roster.forEach(player => player.reset());
	game.ballCarrier = game.roster.find(player => player.role === "QB") ?? game.roster[0];
	game.roster.forEach(player => {
		player.hasBall = (player === game.ballCarrier);
		player.pathIndex = 0;
	});
	game.ballFlight = null;
	game.state.prepPhase = true;
	game.state.gameActive = false;
	game.state.playEnded = false;
	game.state.isRouting = false;
	game.prepRemaining = 6;
	game.previousCollisions.clear();
	game.defenseStunUntil.clear();
	game.tackleContact.clear();
	game.lineOfScrimmageY = yardLineToY(game.field, yardLine);
	game.setNextPlayVisible(false);
	game.setTimerText("PREP: 6");
	game.updateDownsPanel();
	if (typeof game.resetRushClock === "function") {
		game.resetRushClock();
	}
	if (typeof game.onPlayReset === "function") {
		game.onPlayReset();
	}
}

export function handleTackleResult(game) {
	game.state.gameActive = false;
	game.state.playEnded = true;
	game.downsState.ballSpotY = game.ballCarrier.y;
	if (game.downsState.ballSpotY <= game.downsState.lineToGainY) {
		game.downsState.down = 1;
		game.downsState.lineToGainY = game.downsState.ballSpotY - (10 * game.pixelsPerYard);
	} else {
		if (game.downsState.down >= 4) {
			game.downsState.gameOver = true;
		} else {
			game.downsState.down += 1;
		}
	}
	game.setTimerText(game.downsState.gameOver ? "GAME OVER" : "TACKLED");
	game.updateDownsPanel();
	if (game.downsState.gameOver) {
		game.setNextPlayVisible(false);
		if (typeof game.onGameOver === "function") {
			game.onGameOver();
		}
	} else {
		game.setNextPlayVisible(true);
	}
}

export function handleInterception(game, interceptor) {
	interceptor.hasBall = true;
	game.ballCarrier = interceptor;
	game.state.gameActive = false;
	game.state.playEnded = true;
	game.downsState.gameOver = true;
	game.setTimerText("INTERCEPTED - GAME OVER");
	game.setNextPlayVisible(false);
	game.stats.score = 0;
	game.stats.touchdowns = 0;
	game.downsState.down = 1;
	localStorage.setItem("iphone-yard-line", "25");
	game.downsState.ballSpotY = yardLineToY(game.field, 25);
	game.downsState.lineToGainY = game.downsState.ballSpotY - (10 * game.pixelsPerYard);
	game.updateDownsPanel();
	if (typeof game.onGameOver === "function") {
		game.onGameOver();
	}
}
