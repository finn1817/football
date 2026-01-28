import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import {
	addDoc,
	collection,
	doc,
	getDoc,
	getDocs,
	getFirestore,
	limit,
	orderBy,
	query,
	setDoc,
	updateDoc,
	deleteDoc
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const firebaseConfig = {
	apiKey: "AIzaSyCrMtnY0hXlZwpGAib2MmiOmyHRUk_hDc4",
	authDomain: "file-transfer-c98a2.firebaseapp.com",
	projectId: "file-transfer-c98a2",
	storageBucket: "file-transfer-c98a2.firebasestorage.app",
	messagingSenderId: "945533109103",
	appId: "1:945533109103:web:7f98391abdab148af9de9a",
	measurementId: "G-P2YXP42K48"
};

const USERS_COLLECTION = "playbook";
const ADMIN_LOGS_COLLECTION = "playbook_admin_logs";
const SHARED_PLAYS_COLLECTION = "playbook_shared";

let appInstance = null;
let dbInstance = null;

function ensureDb() {
	if (!appInstance) {
		appInstance = initializeApp(firebaseConfig);
	}
	if (!dbInstance) {
		dbInstance = getFirestore(appInstance);
	}
	return dbInstance;
}

function nowIso() {
	return new Date().toISOString();
}

function normalizeUsername(username) {
	return String(username ?? "").trim().toLowerCase();
}

function userDocRef(db, usernameKey) {
	return doc(db, USERS_COLLECTION, usernameKey);
}

function playsCollectionRef(db, usernameKey) {
	return collection(db, USERS_COLLECTION, usernameKey, "plays");
}

function statsDocRef(db, usernameKey) {
	return doc(db, USERS_COLLECTION, usernameKey, "stats", "summary");
}

function generateShareCode() {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let code = "";
	for (let i = 0; i < 8; i += 1) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}

async function seedDefaultPlays(db, usernameKey) {
	const defaults = [
		{
			id: "default-offense",
			name: "Default Offense",
			type: "offense",
			tags: ["default"],
			notes: "Starter offensive play.",
			created_at: nowIso(),
			updated_at: nowIso(),
			sharable: false,
			share_code: null,
			roster: [],
			stats: {
				simulations: 0,
				avgYards: 0,
				intRate: 0,
				successRate: 0,
				lastRunAt: null
			}
		},
		{
			id: "default-defense",
			name: "Default Defense",
			type: "defense",
			tags: ["default"],
			notes: "Starter defensive play.",
			created_at: nowIso(),
			updated_at: nowIso(),
			sharable: false,
			share_code: null,
			roster: [],
			stats: {
				simulations: 0,
				avgYards: 0,
				intRate: 0,
				successRate: 0,
				lastRunAt: null
			}
		}
	];

	for (const play of defaults) {
		const playRef = doc(db, USERS_COLLECTION, usernameKey, "plays", play.id);
		const existing = await getDoc(playRef);
		if (!existing.exists()) {
			await setDoc(playRef, play);
		}
	}
}

export function initPlaybookFirebase() {
	ensureDb();
}

export async function ensureAdminSeed() {
	const db = ensureDb();
	const adminKey = "admin";
	const adminRef = userDocRef(db, adminKey);
	const snapshot = await getDoc(adminRef);
	if (snapshot.exists()) return;
	await setDoc(adminRef, {
		username: "admin",
		usernameKey: adminKey,
		password: "password1",
		role: "admin",
		created_at: nowIso(),
		last_sign_in: null,
		defaults_seeded: true,
		playbook_type: "all",
		settings: { allowMotion: true }
	});
	await seedDefaultPlays(db, adminKey);
	await setDoc(statsDocRef(db, adminKey), {
		playsCreated: 0,
		playsRun: 0,
		avgYards: 0,
		intRate: 0,
		lastUpdated: nowIso()
	});
}

export async function createUser({ username, password, role = "user" }) {
	const db = ensureDb();
	const usernameKey = normalizeUsername(username);
	if (!usernameKey) throw new Error("Username required");
	const userRef = userDocRef(db, usernameKey);
	const snapshot = await getDoc(userRef);
	if (snapshot.exists()) throw new Error("Username already exists");
	await setDoc(userRef, {
		username: String(username).trim(),
		usernameKey,
		password: String(password ?? ""),
		role,
		created_at: nowIso(),
		last_sign_in: null,
		defaults_seeded: true,
		playbook_type: "all",
		settings: { allowMotion: true }
	});
	await seedDefaultPlays(db, usernameKey);
	await setDoc(statsDocRef(db, usernameKey), {
		playsCreated: 0,
		playsRun: 0,
		avgYards: 0,
		intRate: 0,
		lastUpdated: nowIso()
	});
	return { usernameKey };
}

export async function signInUser(username, password) {
	const db = ensureDb();
	const usernameKey = normalizeUsername(username);
	const userRef = userDocRef(db, usernameKey);
	const snapshot = await getDoc(userRef);
	if (!snapshot.exists()) throw new Error("User not found");
	const data = snapshot.data();
	if (String(data.password) !== String(password ?? "")) throw new Error("Invalid password");
	await updateDoc(userRef, { last_sign_in: nowIso() });
	return data;
}

export async function listUsers() {
	const db = ensureDb();
	const snapshot = await getDocs(collection(db, USERS_COLLECTION));
	return snapshot.docs.map(docSnap => docSnap.data());
}

export async function updateUser(username, updates) {
	const db = ensureDb();
	const usernameKey = normalizeUsername(username);
	const userRef = userDocRef(db, usernameKey);
	await updateDoc(userRef, { ...updates, lastUpdated: nowIso() });
}

export async function deleteUser(username) {
	const db = ensureDb();
	const usernameKey = normalizeUsername(username);
	await deleteDoc(userDocRef(db, usernameKey));
}

export async function savePlay(username, play) {
	const db = ensureDb();
	const usernameKey = normalizeUsername(username);
	const playId = play.id ?? crypto.randomUUID();
	const playRef = doc(db, USERS_COLLECTION, usernameKey, "plays", playId);
	const payload = {
		...play,
		id: playId,
		updated_at: nowIso()
	};
	if (!payload.created_at) payload.created_at = nowIso();
	await setDoc(playRef, payload, { merge: true });
	return playId;
}

export async function listPlays(username) {
	const db = ensureDb();
	const usernameKey = normalizeUsername(username);
	const snapshot = await getDocs(query(playsCollectionRef(db, usernameKey), orderBy("updated_at", "desc"), limit(50)));
	return snapshot.docs.map(docSnap => docSnap.data());
}

export async function getPlay(username, playId) {
	const db = ensureDb();
	const usernameKey = normalizeUsername(username);
	const playRef = doc(db, USERS_COLLECTION, usernameKey, "plays", playId);
	const snapshot = await getDoc(playRef);
	return snapshot.exists() ? snapshot.data() : null;
}

export async function deletePlay(username, playId) {
	const db = ensureDb();
	const usernameKey = normalizeUsername(username);
	await deleteDoc(doc(db, USERS_COLLECTION, usernameKey, "plays", playId));
}

export async function updatePlayStats(username, playId, stats) {
	const db = ensureDb();
	const usernameKey = normalizeUsername(username);
	await updateDoc(doc(db, USERS_COLLECTION, usernameKey, "plays", playId), {
		stats: { ...stats },
		updated_at: nowIso()
	});
}

export async function makePlaySharable(username, playId, sharable) {
	const db = ensureDb();
	const usernameKey = normalizeUsername(username);
	const playRef = doc(db, USERS_COLLECTION, usernameKey, "plays", playId);
	const snapshot = await getDoc(playRef);
	if (!snapshot.exists()) return null;
	const play = snapshot.data();
	let shareCode = play.share_code ?? null;
	if (sharable && !shareCode) {
		shareCode = generateShareCode();
		await setDoc(doc(db, SHARED_PLAYS_COLLECTION, shareCode), {
			share_code: shareCode,
			username: play.username ?? usernameKey,
			usernameKey,
			playId,
			created_at: nowIso()
		});
	}
	await updateDoc(playRef, {
		sharable: !!sharable,
		share_code: sharable ? shareCode : null,
		updated_at: nowIso()
	});
	return shareCode;
}

export async function logAdminAction({ actor, action, target, details }) {
	const db = ensureDb();
	await addDoc(collection(db, ADMIN_LOGS_COLLECTION), {
		actor,
		action,
		target,
		details: details ?? "",
		created_at: nowIso()
	});
}

export async function listAdminLogs(max = 50) {
	const db = ensureDb();
	const snapshot = await getDocs(query(collection(db, ADMIN_LOGS_COLLECTION), orderBy("created_at", "desc"), limit(max)));
	return snapshot.docs.map(docSnap => docSnap.data());
}
