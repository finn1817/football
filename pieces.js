const SPEED_MAP = {
    QB: 2.6,
    WR: 4.2,
    SL: 3.8,
    TE: 3.5,
    RB: 3.4,
    HB: 3.4,
    FB: 3.2,
    LB: 2.8,
    MLB: 2.9,
    CB: 3.6,
    S: 3.4,
    DL: 2.6
};

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
        this.speed = SPEED_MAP[role] ?? 3.0; // Slightly slower baseline
        
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
    new Player(1, 270, 780, "offense", "QB"), // Quarterback
    new Player(2, 170, 760, "offense", "WR"), // Wide Left
    new Player(3, 370, 760, "offense", "WR"), // Wide Right
    new Player(4, 270, 820, "offense", "RB"), // Running Back
    new Player(5, 220, 800, "offense", "SL"), // Slot Left
    new Player(6, 320, 800, "offense", "SL"), // Slot Right
    new Player(7, 270, 850, "offense", "TE"), // Tight End inline

    // --- DEFENSE (Red) ---
    new Player(8, 270, 380, "defense", "MLB"), // Middle Linebacker
    new Player(9, 150, 330, "defense", "LB"),  // Outside Backer
    new Player(10, 390, 330, "defense", "LB"), // Outside Backer
    new Player(11, 120, 250, "defense", "CB"), // Corner Left
    new Player(12, 420, 250, "defense", "CB"), // Corner Right
    new Player(13, 270, 220, "defense", "S"),  // Safety
    new Player(14, 200, 350, "defense", "DL"), // Left Tackle
    new Player(15, 340, 350, "defense", "DL"), // Right Tackle
];