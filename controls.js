const receiverList = document.getElementById("receiverList");

function renderReceiverList() {
	if (!receiverList || typeof getThrowTargets !== "function") return;

	const targets = getThrowTargets();
	receiverList.innerHTML = "";

	targets.slice(0, 5).forEach((player, index) => {
		const item = document.createElement("li");
		item.textContent = `${index + 1}: ${player.role} #${player.id}`;
		receiverList.appendChild(item);
	});
}

function syncControls() {
	renderReceiverList();
	requestAnimationFrame(syncControls);
}

syncControls();
