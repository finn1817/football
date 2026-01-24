let gameActive = false;
let prepPhase = true;
let countdown = 5;
let ballCarrier = roster[0]; // Start with QB

const LOB_HOLD_MS = 400;
const KEY_THROW_MAX = 5;
let keyHoldStart = {};
let ballFlight = null;

// --- INPUT HANDLING (Drawing Paths) ---
let selectedPlayer = null;

function handleInput(type, x, y) {
    if (prepPhase) {
        if (type === 'start') {
            // Find if user clicked a player to set a route
            roster.forEach(p => {
                if (p.team === "offense") {
                    let dist = Math.hypot(p.x - x, p.y - y);
                    if (dist < 30) {
                        selectedPlayer = p;
                        p.path = []; // Last made route is what should be followed
                        p.path.push({x, y});
                    }
                }
            });
        } else if (type === 'move' && selectedPlayer) {
            selectedPlayer.path.push({x, y});
        } else if (type === 'end') {
            selectedPlayer = null;
        }
        return;
    }

    if (!gameActive || ballFlight?.active) return;
}

// --- GAME LOGIC ---

function snapBall() {
    if (!prepPhase) return;
    prepPhase = false;
    gameActive = true;
    document.getElementById('timer').innerText = "GO!";
}

function updateGame() {
    if (!gameActive) return;

    // 1. MOVE OFFENSE (Follow user path)
    roster.forEach(p => {
        if (p.team === "offense" && !p.isDead && p.path.length > 0) {
            // "Not Instant" - Move towards next point in path
            let target = p.path[p.pathIndex];
            
            // Move logic
            let dx = target.x - p.x;
            let dy = target.y - p.y;
            let dist = Math.hypot(dx, dy);

            if (dist < p.speed) {
                // Reached point, go to next
                p.pathIndex++;
                if (p.pathIndex >= p.path.length) p.pathIndex = p.path.length - 1; // Stop at end
            } else {
                // Smooth move
                p.x += (dx / dist) * p.speed;
                p.y += (dy / dist) * p.speed;
            }
        }
    });

    // Update ball flight before defenders react
    advanceBallFlight();

    const ballPos = getBallPosition();

    // 2. MOVE DEFENSE (AI)
    roster.forEach(def => {
        if (def.team === "defense") {
            // AI Logic: Chase the ball carrier
            let dx = ballPos.x - def.x;
            let dy = ballPos.y - def.y;
            let dist = Math.hypot(dx, dy);

            if (dist > 0.1) {
                const speed = (def.speed ?? 2.0) * 0.75;
                def.x += (dx / dist) * speed;
                def.y += (dy / dist) * speed;
            }

            // 3. COLLISION (Tackle)
            if (!ballFlight?.active && ballCarrier && dist < 20) {
                gameActive = false;
                alert("TACKLED! Down.");
                resetGame();
            }
        }
    });

    // 4. CHECK TOUCHDOWN
    if (!ballFlight?.active && ballCarrier && ballCarrier.y < 50) { // Reached Top Endzone
        gameActive = false;
        alert("TOUCHDOWN!");
        resetGame();
    }
}

function resetGame() {
    prepPhase = true;
    countdown = 5;
    roster.forEach(p => p.reset());
    ballCarrier = roster[0];
    keyHoldStart = {};
    ballFlight = null;
    document.getElementById('timer').innerText = "PREP: 5";
}

function attemptThrow(targetPlayer, isLob) {
    if (!gameActive || prepPhase) return;
    if (!ballCarrier || !ballCarrier.hasBall || ballCarrier.team !== "offense") return;
    if (!targetPlayer || targetPlayer.team !== "offense") return;

    const start = { x: ballCarrier.x, y: ballCarrier.y };
    const end = { x: targetPlayer.x, y: targetPlayer.y };

    ballCarrier.hasBall = false;

    if (!isLob && defenderOnLine(start, end)) {
        gameActive = false;
        alert("INTERCEPTED! Turnover.");
        resetGame();
        return;
    }

    ballFlight = {
        active: true,
        lob: isLob,
        startX: start.x,
        startY: start.y,
        x: start.x,
        y: start.y,
        target: targetPlayer,
        progress: 0,
        speed: isLob ? 0.012 : 0.03,
        arcHeight: isLob ? 120 : 0
    };

    ballCarrier = null;
}

function advanceBallFlight() {
    if (!ballFlight?.active) return;

    const progress = Math.min(1, ballFlight.progress + ballFlight.speed);
    ballFlight.progress = progress;

    const endX = ballFlight.target.x;
    const endY = ballFlight.target.y;
    const arcOffset = ballFlight.lob ? Math.sin(Math.PI * progress) * ballFlight.arcHeight : 0;

    ballFlight.x = lerp(ballFlight.startX, endX, progress);
    ballFlight.y = lerp(ballFlight.startY, endY, progress) - arcOffset;

    if (progress >= 1) {
        ballFlight.target.hasBall = true;
        ballCarrier = ballFlight.target;
        ballFlight.active = false;
    }
}

function getBallPosition() {
    if (ballFlight?.active) {
        return { x: ballFlight.x, y: ballFlight.y };
    }
    if (ballCarrier) {
        return { x: ballCarrier.x, y: ballCarrier.y };
    }
    return { x: roster[0].startX, y: roster[0].startY };
}

function defenderOnLine(start, end) {
    const threshold = 20;
    return roster.some(def => {
        if (def.team !== "defense") return false;
        const dist = pointToSegmentDistance(def.x, def.y, start.x, start.y, end.x, end.y);
        return dist < threshold;
    });
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);

    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function getThrowTargets() {
    return roster.filter(p => p.team === "offense" && p.role !== "QB");
}

function handleThrowKeyDown(key) {
    if (!gameActive || prepPhase || ballFlight?.active) return;
    if (keyHoldStart[key]) return;
    keyHoldStart[key] = Date.now();
}

function handleThrowKeyUp(key) {
    if (!gameActive || prepPhase || ballFlight?.active) return;
    const started = keyHoldStart[key];
    if (!started) return;
    delete keyHoldStart[key];

    const index = Number(key) - 1;
    if (Number.isNaN(index) || index < 0 || index >= KEY_THROW_MAX) return;

    const targets = getThrowTargets();
    const target = targets[index];
    if (!target) return;

    const heldMs = Date.now() - started;
    attemptThrow(target, heldMs >= LOB_HOLD_MS);
}

window.addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.key >= '1' && e.key <= String(KEY_THROW_MAX)) {
        handleThrowKeyDown(e.key);
    }
});

window.addEventListener('keyup', e => {
    if (e.key >= '1' && e.key <= String(KEY_THROW_MAX)) {
        handleThrowKeyUp(e.key);
    }
});