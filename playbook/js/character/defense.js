export function defaultDefensePlays() {
	return [
		{
			name: "Cover 2",
			type: "defense",
			tags: ["zone"],
			notes: "Two deep safeties.",
			allowMotion: false
		},
		{
			name: "Man Blitz",
			type: "defense",
			tags: ["blitz"],
			notes: "Aggressive man pressure.",
			allowMotion: false
		}
	];
}
