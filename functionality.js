let gameActive = false;
let prepPhase = true;
let countdown = 5;
let ballCarrier = roster[0]; // Start with QB

// --- INPUT HANDLING (Drawing Paths) ---
let selectedPlayer = null;

function handleInput(type, x, y) {
    if (!prepPhase) return; // Can't draw after snap (unless we add throwing logic here)

    if (type === 'start') {
        // Find if user clicked a player
        roster.forEach(p => {
            if (p.team === "offense") {
                let dist = Math.hypot(p.x - x, p.y - y);
                if (dist < 30) {
                    selectedPlayer = p;
                    p.path = []; // RESET path: "Last made route is what should be followed"
                    p.path.push({x, y});
                }
            }
        });
    } 
    else if (type === 'move' && selectedPlayer) {
        // Record the drag
        selectedPlayer.path.push({x, y});
    } 
    else if (type === 'end') {
        selectedPlayer = null;
    }
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

    // 2. MOVE DEFENSE (AI)
    roster.forEach(def => {
        if (def.team === "defense") {
            // AI Logic: Chase the ball carrier
            let dx = ballCarrier.x - def.x;
            let dy = ballCarrier.y - def.y;
            let dist = Math.hypot(dx, dy);
            
            // Simple chase speed
            let speed = 2.0; 
            def.x += (dx / dist) * speed;
            def.y += (dy / dist) * speed;

            // 3. COLLISION (Tackle)
            if (dist < 20) {
                gameActive = false;
                alert("TACKLED! Down.");
                resetGame();
            }
        }
    });

    // 4. CHECK TOUCHDOWN
    if (ballCarrier.y < 50) { // Reached Top Endzone
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
    document.getElementById('timer').innerText = "PREP: 5";
}