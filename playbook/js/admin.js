import {
	initPlaybookFirebase,
	ensureAdminSeed,
	listUsers,
	listAdminLogs,
	deleteUser,
	logAdminAction
} from "./logged_in_user/firebase-crud-operations.js";

initPlaybookFirebase();
ensureAdminSeed();

const sessionRaw = localStorage.getItem("playbook_session");
if (!sessionRaw) {
	window.location.href = "index.html";
	throw new Error("Missing session");
}
const session = JSON.parse(sessionRaw || "{}");

const adminSummary = document.getElementById("admin-summary");
const usersList = document.getElementById("users-list");
const logsList = document.getElementById("logs-list");

adminSummary.textContent = `Signed in as ${session.username}`;

if (session.role !== "admin") {
	window.location.href = "playbook.html";
	throw new Error("Admin access required");
}

function renderUsers(users) {
	usersList.innerHTML = "";
	users.forEach(user => {
		const row = document.createElement("div");
		row.className = "list-item";
		row.innerHTML = `
			<strong>${user.username}</strong>
			<div>Role: ${user.role || "user"}</div>
			<div>Last sign in: ${user.last_sign_in ? new Date(user.last_sign_in).toLocaleString() : "Never"}</div>
		`;
		if (user.usernameKey !== "admin") {
			const deleteButton = document.createElement("button");
			deleteButton.className = "ghost";
			deleteButton.textContent = "Delete user";
			deleteButton.addEventListener("click", async () => {
				if (!window.confirm(`Delete ${user.username}?`)) return;
				await deleteUser(user.usernameKey);
				await logAdminAction({
					actor: session.username,
					action: "delete_user",
					target: user.usernameKey,
					details: "Deleted user account"
				});
				await refreshAdmin();
			});
			row.appendChild(deleteButton);
		}
		usersList.appendChild(row);
	});
}

function renderLogs(logs) {
	logsList.innerHTML = "";
	logs.forEach(log => {
		const row = document.createElement("div");
		row.className = "list-item";
		row.innerHTML = `
			<strong>${log.action}</strong>
			<div>Actor: ${log.actor}</div>
			<div>Target: ${log.target}</div>
			<div>${log.created_at ? new Date(log.created_at).toLocaleString() : ""}</div>
			<div>${log.details || ""}</div>
		`;
		logsList.appendChild(row);
	});
}

async function refreshAdmin() {
	const [users, logs] = await Promise.all([listUsers(), listAdminLogs()]);
	renderUsers(users);
	renderLogs(logs);
}

refreshAdmin();
