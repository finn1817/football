const receiverList = document.getElementById("receiverList");
let lastTargetsKey = "";
const holdStarts = new Map();

function renderReceiverList(targets) {
	if (!receiverList) return;
	receiverList.innerHTML = "";

	targets.slice(0, 5).forEach((player, index) => {
		const item = document.createElement("li");
		const button = document.createElement("button");
		button.type = "button";
		button.tabIndex = -1;
		button.textContent = `${index + 1}: ${player.role} #${player.id}`;
		button.addEventListener("pointerdown", () => {
			holdStarts.set(index, Date.now());
		});
		button.addEventListener("pointerup", () => {
			const started = holdStarts.get(index);
			holdStarts.delete(index);
			if (!started) return;
			const heldMs = Date.now() - started;
			const isLob = heldMs >= (window.LOB_HOLD_MS ?? 400);
			if (typeof attemptThrow === "function") {
				attemptThrow(targets[index], isLob);
			}
		});
		button.addEventListener("pointerleave", () => {
			holdStarts.delete(index);
		});
		item.appendChild(button);
		receiverList.appendChild(item);
	});
}

function syncControls() {
	if (!receiverList || typeof getThrowTargets !== "function") {
		requestAnimationFrame(syncControls);
		return;
	}
	const targets = getThrowTargets();
	const key = targets.slice(0, 5).map(p => p.id).join(",");
	if (key !== lastTargetsKey) {
		lastTargetsKey = key;
		renderReceiverList(targets);
	}
	requestAnimationFrame(syncControls);
}

syncControls();
