class Player {
    constructor(id, x, y, team, role) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.startX = x; // Remember start for reset
        this.startY = y;
        this.team = team; // "offense" or "defense"
        this.role = role; // "QB", "WR", "LB"
        
        // MOVEMENT DATA
        this.path = []; // The recorded line
        this.pathIndex = 0; // Where are they on the line?
        this.speed = (role === "QB") ? 3 : (role === "WR" ? 5 : 2.5); // Different speeds
        
        this.hasBall = (role === "QB"); // Only QB starts with ball
        this.isDead = false;
    }

    reset() {
        this.x = this.startX;
        this.y = this.startY;
        this.path = [];
        this.pathIndex = 0;
        this.isDead = false;
        this.hasBall = (this.role === "QB");
    }
}

// DEFINE THE ROSTER
// Coordinates: 0,0 is Top-Left. 
// Offense is at bottom (Y=600), Defense at top (Y=200)

const roster = [
    // --- OFFENSE (Blue) ---
    new Player(1, 200, 600, "offense", "QB"), // Quarterback (Center)
    new Player(2, 100, 580, "offense", "WR"), // Left Receiver
    new Player(3, 300, 580, "offense", "WR"), // Right Receiver
    new Player(4, 200, 550, "offense", "RB"), // Running Back

    // --- DEFENSE (Red) ---
    new Player(5, 200, 300, "defense", "LB"), // Linebacker
    new Player(6, 100, 200, "defense", "CB"), // Corner
    new Player(7, 300, 200, "defense", "CB"), // Corner
    new Player(8, 200, 150, "defense", "S"),  // Safety
];