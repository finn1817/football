import {
	initPlaybookFirebase,
	ensureAdminSeed,
	createUser,
	signInUser
} from "./logged_in_user/firebase-crud-operations.js";

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const loginError = document.getElementById("login-error");
const signupError = document.getElementById("signup-error");

function setActiveTab(target) {
	document.querySelectorAll(".tab-button").forEach(button => {
		button.classList.toggle("is-active", button.dataset.panel === target);
	});
	document.querySelectorAll(".auth-form").forEach(form => {
		form.classList.toggle("is-hidden", form.id !== `${target}-form`);
	});
}

function storeSession(user) {
	const payload = {
		username: user.username,
		usernameKey: user.usernameKey,
		role: user.role
	};
	localStorage.setItem("playbook_session", JSON.stringify(payload));
}

initPlaybookFirebase();
ensureAdminSeed();

const existing = localStorage.getItem("playbook_session");
if (existing) {
	window.location.href = "playbook.html";
}

document.querySelectorAll(".tab-button").forEach(button => {
	button.addEventListener("click", () => setActiveTab(button.dataset.panel));
});

loginForm.addEventListener("submit", async event => {
	event.preventDefault();
	loginError.textContent = "";
	try {
		const username = document.getElementById("login-username").value;
		const password = document.getElementById("login-password").value;
		const user = await signInUser(username, password);
		storeSession(user);
		window.location.href = "playbook.html";
	} catch (error) {
		loginError.textContent = error.message;
	}
});

signupForm.addEventListener("submit", async event => {
	event.preventDefault();
	signupError.textContent = "";
	try {
		const username = document.getElementById("signup-username").value;
		const password = document.getElementById("signup-password").value;
		const user = await createUser({ username, password });
		storeSession({ username, usernameKey: user.usernameKey, role: "user" });
		window.location.href = "playbook.html";
	} catch (error) {
		signupError.textContent = error.message;
	}
});
