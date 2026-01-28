import { listPlays } from "../logged_in_user/firebase-crud-operations.js";

export async function loadPlayList({ usernameKey, container, onSelect }) {
	container.innerHTML = "";
	const plays = await listPlays(usernameKey);
	if (!plays.length) {
		const empty = document.createElement("div");
		empty.className = "empty-state";
		empty.textContent = "No saved plays yet. Create one to get started.";
		container.appendChild(empty);
		return;
	}
	plays.forEach(play => {
		const card = document.createElement("button");
		card.type = "button";
		card.className = "play-card";
		const summary = play.description || play.notes || "No description";
		card.innerHTML = `
			<div class="play-card__title">${play.name}</div>
			<div class="play-card__meta">${summary}</div>
			<div class="play-card__meta">Updated ${play.updated_at ? new Date(play.updated_at).toLocaleDateString() : ""}</div>
		`;
		card.addEventListener("click", () => onSelect(play));
		container.appendChild(card);
	});
}
