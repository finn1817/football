/**
 * Formation presets for offense
 * Each formation defines the relative positions of players
 */

export const FORMATIONS = {
	STANDARD: "standard",
	I_FORMATION: "i-formation",
	SHOTGUN: "shotgun",
	TRIPS: "trips",
	EMPTY: "empty"
};

/**
 * Get formation configuration
 * Returns positions relative to center of field and line of scrimmage
 * @param {string} formationName - Name of the formation
 * @param {object} field - Field dimensions
 * @returns {object} Formation configuration with player positions
 */
export function getFormationConfig(formationName, field) {
	const centerX = field.width * 0.5;
	const lineSpacing = field.width * 0.093; // Distance between O-line positions
	const teInset = field.width * 0.065;
	const wrInset = field.width * 0.148;
	
	const baseConfig = {
		OL: [
			{ x: centerX - lineSpacing * 2, yOffset: 20 }, // Left Tackle
			{ x: centerX - lineSpacing, yOffset: 20 },     // Left Guard
			{ x: centerX, yOffset: 20 },                    // Center
			{ x: centerX + lineSpacing, yOffset: 20 },     // Right Guard
			{ x: centerX + lineSpacing * 2, yOffset: 20 }  // Right Tackle
		]
	};

	const formations = {
		[FORMATIONS.STANDARD]: {
			...baseConfig,
			QB: { x: centerX, yOffset: 70 },
			RB: { x: centerX, yOffset: 120 },
			WR: [
				{ x: centerX - lineSpacing * 2 - wrInset, yOffset: 20 }, // Left WR
				{ x: centerX + lineSpacing * 2 + wrInset, yOffset: 20 }  // Right WR
			],
			TE: [
				{ x: centerX - lineSpacing * 2 - teInset, yOffset: 20 }, // Left TE
				{ x: centerX + lineSpacing * 2 + teInset, yOffset: 20 }  // Right TE
			]
		},
		
		[FORMATIONS.I_FORMATION]: {
			...baseConfig,
			QB: { x: centerX, yOffset: 70 },
			RB: { x: centerX, yOffset: 140 },              // Halfback deeper
			FB: { x: centerX, yOffset: 95 },               // Fullback (replaces TE2)
			WR: [
				{ x: centerX - lineSpacing * 2 - wrInset, yOffset: 20 },
				{ x: centerX + lineSpacing * 2 + wrInset, yOffset: 20 }
			],
			TE: [
				{ x: centerX - lineSpacing * 2 - teInset, yOffset: 20 }  // Only 1 TE
			]
		},
		
		[FORMATIONS.SHOTGUN]: {
			...baseConfig,
			QB: { x: centerX, yOffset: 110 },              // QB in shotgun
			RB: { x: centerX - lineSpacing * 1.5, yOffset: 110 }, // RB beside QB
			WR: [
				{ x: centerX - lineSpacing * 2 - wrInset, yOffset: 20 },
				{ x: centerX + lineSpacing * 2 + wrInset, yOffset: 20 }
			],
			TE: [
				{ x: centerX - lineSpacing * 2 - teInset, yOffset: 20 },
				{ x: centerX + lineSpacing * 2 + teInset, yOffset: 20 }
			]
		},
		
		[FORMATIONS.TRIPS]: {
			...baseConfig,
			QB: { x: centerX, yOffset: 70 },
			RB: { x: centerX, yOffset: 120 },
			WR: [
				{ x: centerX + lineSpacing * 2 + wrInset, yOffset: 20 },           // Right WR1
				{ x: centerX + lineSpacing * 2 + wrInset + 60, yOffset: 20 },     // Right WR2
				{ x: centerX + lineSpacing * 2 + wrInset + 120, yOffset: 20 }     // Right WR3
			],
			TE: [
				{ x: centerX - lineSpacing * 2 - teInset, yOffset: 20 }            // Left TE
			]
		},
		
		[FORMATIONS.EMPTY]: {
			...baseConfig,
			QB: { x: centerX, yOffset: 110 },              // QB in shotgun
			WR: [
				{ x: centerX - lineSpacing * 2 - wrInset, yOffset: 20 },          // Left WR
				{ x: centerX - lineSpacing * 2 - wrInset + 60, yOffset: 20 },    // Left Slot
				{ x: centerX + lineSpacing * 2 + wrInset - 60, yOffset: 20 },    // Right Slot
				{ x: centerX + lineSpacing * 2 + wrInset, yOffset: 20 }          // Right WR
			],
			TE: [
				{ x: centerX - lineSpacing * 2 - teInset, yOffset: 20 }           // Left TE
			]
		}
	};

	return formations[formationName] || formations[FORMATIONS.STANDARD];
}

/**
 * Apply formation to the roster
 * @param {Array} roster - Array of player objects
 * @param {string} formationName - Name of formation to apply
 * @param {object} field - Field dimensions
 * @param {number} lineOfScrimmageY - Y position of line of scrimmage
 */
export function applyFormation(roster, formationName, field, lineOfScrimmageY) {
	const formation = getFormationConfig(formationName, field);

	// Reset temporary FB conversions before rebuilding role groups
	roster.forEach(player => {
		if (player.team === "offense" && player.role === "FB") {
			player.role = "TE";
		}
	});
	
	// group players - by role
	const playersByRole = {};
	roster.forEach(player => {
		if (player.team !== "offense") return;
		if (!playersByRole[player.role]) {
			playersByRole[player.role] = [];
		}
		playersByRole[player.role].push(player);
	});
	
	// apply QB position
	if (formation.QB && playersByRole.QB && playersByRole.QB[0]) {
		const qb = playersByRole.QB[0];
		qb.x = formation.QB.x;
		qb.y = lineOfScrimmageY + formation.QB.yOffset;
		qb.startX = qb.x;
		qb.startY = qb.y;
		qb.baseX = qb.x;
		qb.baseYOffset = formation.QB.yOffset;
	}
	
	// apply RB position
	if (formation.RB && playersByRole.RB && playersByRole.RB[0]) {
		const rb = playersByRole.RB[0];
		rb.x = formation.RB.x;
		rb.y = lineOfScrimmageY + formation.RB.yOffset;
		rb.startX = rb.x;
		rb.startY = rb.y;
		rb.baseX = rb.x;
		rb.baseYOffset = formation.RB.yOffset;
		rb.role = "RB"; // Ensure it stays RB
	}
	
	// apply FB position (I-Formation only - convert second RB or TE to FB)
	if (formation.FB) {
		let fb = playersByRole.RB && playersByRole.RB[1]; // try second RB first
		if (!fb && playersByRole.TE && playersByRole.TE[1]) {
			fb = playersByRole.TE[1]; // convert the TE2 to a FB
		}
		if (fb) {
			fb.x = formation.FB.x;
			fb.y = lineOfScrimmageY + formation.FB.yOffset;
			fb.startX = fb.x;
			fb.startY = fb.y;
			fb.baseX = fb.x;
			fb.baseYOffset = formation.FB.yOffset;
			fb.role = "FB"; // Change role to FB
		}
	}
	
	// Apply O-Line positions
	if (formation.OL && playersByRole.OL) {
		formation.OL.forEach((pos, index) => {
			if (playersByRole.OL[index]) {
				const player = playersByRole.OL[index];
				player.x = pos.x;
				player.y = lineOfScrimmageY + pos.yOffset;
				player.startX = player.x;
				player.startY = player.y;
				player.baseX = player.x;
				player.baseYOffset = pos.yOffset;
			}
		});
	}
	
	// Apply WR positions
	if (formation.WR && playersByRole.WR) {
		formation.WR.forEach((pos, index) => {
			if (playersByRole.WR[index]) {
				const player = playersByRole.WR[index];
				player.x = pos.x;
				player.y = lineOfScrimmageY + pos.yOffset;
				player.startX = player.x;
				player.startY = player.y;
				player.baseX = player.x;
				player.baseYOffset = pos.yOffset;
			}
		});
	}
	
	// Apply TE positions
	if (formation.TE && playersByRole.TE) {
		formation.TE.forEach((pos, index) => {
			// Skip TE if it was converted to FB
			const te = playersByRole.TE[index];
			if (te && te.role === "TE") {
				te.x = pos.x;
				te.y = lineOfScrimmageY + pos.yOffset;
				te.startX = te.x;
				te.startY = te.y;
				te.baseX = te.x;
				te.baseYOffset = pos.yOffset;
			}
		});
	}
}

/**
 * Get available formations list for UI
 * @returns {Array} Array of formation names
 */
export function getFormationsList() {
	return [
		{ name: FORMATIONS.STANDARD, display: "Standard" },
		{ name: FORMATIONS.I_FORMATION, display: "I-Formation (FB)" },
		{ name: FORMATIONS.SHOTGUN, display: "Shotgun" },
		{ name: FORMATIONS.TRIPS, display: "Trips Right" },
		{ name: FORMATIONS.EMPTY, display: "Empty Set" }
	];
}
