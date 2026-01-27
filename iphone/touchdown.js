import { yardLineToY } from "./characters.js";

export function checkTouchdown(game) {
	if (!game.state.gameActive || game.state.isPaused) return;
	if (!game.ballCarrier || game.ballCarrier.team !== "offense") return;
	if (game.ballCarrier.y > game.field.topY) return;

	game.state.gameActive = false;
	game.state.playEnded = true;
	game.setTimerText("TOUCHDOWN!");
	game.stats.touchdowns += 1;
	game.stats.score += 7;
	game.downsState.down = 1;
	localStorage.setItem("iphone-yard-line", "25");
	game.downsState.ballSpotY = yardLineToY(game.field, 25);
	game.downsState.lineToGainY = game.downsState.ballSpotY - (10 * game.pixelsPerYard);
	game.updateDownsPanel();
	game.setNextPlayVisible(true);
}
