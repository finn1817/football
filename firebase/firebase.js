import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-analytics.js";
import { addDoc, collection, getDocs, getFirestore, limit, orderBy, query } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const firebaseConfig = {
	apiKey: "AIzaSyCrMtnY0hXlZwpGAib2MmiOmyHRUk_hDc4",
	authDomain: "file-transfer-c98a2.firebaseapp.com",
	projectId: "file-transfer-c98a2",
	storageBucket: "file-transfer-c98a2.firebasestorage.app",
	messagingSenderId: "945533109103",
	appId: "1:945533109103:web:7f98391abdab148af9de9a",
	measurementId: "G-P2YXP42K48"
};

const COLLECTION = "highscores";

let appInstance = null;
let dbInstance = null;

function ensureApp() {
	if (!appInstance) {
		appInstance = initializeApp(firebaseConfig);
		try {
			getAnalytics(appInstance);
		} catch (error) {
			console.warn("Analytics unavailable:", error);
		}
	}
	if (!dbInstance) {
		dbInstance = getFirestore(appInstance);
	}
	return dbInstance;
}

function formatDateTime(now) {
	const pad = (value) => String(value).padStart(2, "0");
	const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
	return { date, time };
}

export function initFirebase() {
	ensureApp();
}

export async function submitHighscore({ username, score }) {
	if (!username) return;
	const numericScore = Number(score ?? 0);
	const trimmed = String(username).trim().slice(0, 16);
	if (!trimmed) return;
	const db = ensureApp();
	const now = new Date();
	const { date, time } = formatDateTime(now);
	await addDoc(collection(db, COLLECTION), {
		username: trimmed,
		score: numericScore,
		date,
		time
	});
}

export async function fetchHighscores(max = 10) {
	const db = ensureApp();
	const highscoresQuery = query(collection(db, COLLECTION), orderBy("score", "desc"), limit(max));
	const snapshot = await getDocs(highscoresQuery);
	return snapshot.docs.map(doc => doc.data());
}
