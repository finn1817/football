export const DIFFICULTY_CONFIG = {
	1: { 
		name: "Easy", 
		defSpeedMult: 0.9, 
		rushDelayMin: 4, 
		rushDelayMax: 8, 
		rushPushThrough: 0.4, 
		tackleHold: 1.2, 
		interceptionRadius: 10 
	},
	2: { 
		name: "Medium", 
		defSpeedMult: 1.15, 
		rushDelayMin: 2, 
		rushDelayMax: 5, 
		rushPushThrough: 0.8, 
		tackleHold: 0.8, 
		interceptionRadius: 20 
	},
	3: { 
		name: "Hard", 
		defSpeedMult: 1.35, 
		rushDelayMin: 1, 
		rushDelayMax: 2.5, 
		rushPushThrough: 1.0, 
		tackleHold: 0.4, 
		interceptionRadius: 35 
	}
};
