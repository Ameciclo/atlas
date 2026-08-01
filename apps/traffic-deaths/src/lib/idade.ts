export function idadeObitoAnos(raw: number | null): number | null {
	if (raw == null || raw === 0 || raw === 999) return null;
	const d1 = Math.floor(raw / 100);
	const d23 = raw % 100;
	if (d1 >= 0 && d1 < 4) return 0;
	if (d1 >= 4 && d1 <= 5) return (d1 - 4) * 100 + d23;
	return null;
}

const AGE_GROUPS = [
	{ label: "Menos de 1 ano", min: -Infinity, max: 0 },
	{ label: "1 a 4 anos", min: 1, max: 4 },
	{ label: "5 a 9 anos", min: 5, max: 9 },
	{ label: "10 a 14 anos", min: 10, max: 14 },
	{ label: "15 a 19 anos", min: 15, max: 19 },
	{ label: "20 a 24 anos", min: 20, max: 24 },
	{ label: "25 a 29 anos", min: 25, max: 29 },
	{ label: "30 a 34 anos", min: 30, max: 34 },
	{ label: "35 a 39 anos", min: 35, max: 39 },
	{ label: "40 a 44 anos", min: 40, max: 44 },
	{ label: "45 a 49 anos", min: 45, max: 49 },
	{ label: "50 a 54 anos", min: 50, max: 54 },
	{ label: "55 a 59 anos", min: 55, max: 59 },
	{ label: "60 a 64 anos", min: 60, max: 64 },
	{ label: "65 a 69 anos", min: 65, max: 69 },
	{ label: "70 a 74 anos", min: 70, max: 74 },
	{ label: "75 a 79 anos", min: 75, max: 79 },
	{ label: "80 anos ou mais", min: 80, max: Infinity },
];

export function classifyFaixaEtaria(idadeAnos: number | null): string {
	if (idadeAnos === null || idadeAnos === undefined) return "Ignorado";
	for (const group of AGE_GROUPS) {
		if (idadeAnos >= group.min && idadeAnos <= group.max) return group.label;
	}
	return "Ignorado";
}
