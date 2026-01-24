const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- EVENT LISTENERS ---
canvas.addEventListener('mousedown', e => getPos(e, 'start'));
canvas.addEventListener('mousemove', e => getPos(e, 'move'));
canvas.addEventListener('mouseup',   e => getPos(e, 'end'));

// For Touchscreens (Mobile support)
canvas.addEventListener('touchstart', e => getPos(e, 'start'));
canvas.addEventListener('touchmove',  e => getPos(e, 'move'));
canvas.addEventListener('touchend',   e => getPos(e, 'end'));

function getPos(e, type) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;
    handleInput(type, x, y);
}

// --- RENDER LOOP ---
function draw() {
    // 1. Clear Screen
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Draw Field (Vertical Yard Lines)
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    for(let i=0; i<canvas.height; i+=50) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    // Endzones
    ctx.fillStyle = "rgba(0,0,100,0.2)"; // Top Endzone
    ctx.fillRect(0, 0, canvas.width, 50);

    // 3. Draw Routes (Yellow Lines)
    roster.forEach(p => {
        if (p.team === "offense" && p.path.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = "yellow";
            ctx.lineWidth = 3;
            ctx.moveTo(p.path[0].x, p.path[0].y);
            for (let point of p.path) {
                ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
        }
    });

    // 4. Draw Players
    roster.forEach(p => {
        // Draw Shadow
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath(); ctx.arc(p.x+2, p.y+2, 15, 0, Math.PI*2); ctx.fill();

        // Draw Body
        ctx.fillStyle = (p.team === "offense") ? "#0099ff" : "#ff3300"; // Blue vs Red
        ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI*2); ctx.fill();

        // Draw Ball Indicator
        if (p.hasBall) {
            ctx.fillStyle = "brown";
            ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI*2); ctx.fill();
        }

        // Draw Role Text
        ctx.fillStyle = "white";
        ctx.font = "10px Arial";
        ctx.textAlign = "center";
        ctx.fillText(p.role, p.x, p.y+4);
    });

    // Loop
    updateGame();
    requestAnimationFrame(draw);
}

// Start the Loop
draw();