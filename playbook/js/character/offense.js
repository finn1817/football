export function defaultOffensePlays() {
	return [
		{
			name: "Quick Slant",
			type: "offense",
			tags: ["quick", "pass"],
			notes: "Short timing throw.",
			allowMotion: true
		},
		{
			name: "Jet Sweep",
			type: "offense",
			tags: ["motion", "run"],
			notes: "Pre-snap motion allowed.",
			allowMotion: true
		}
	];
}
