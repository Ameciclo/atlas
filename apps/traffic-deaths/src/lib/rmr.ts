export const RMR_CITIES: Record<number, string> = {
	2600054: "Abreu e Lima",
	2601052: "Araçoiaba",
	2602902: "Cabo de Santo Agostinho",
	2603454: "Camaragibe",
	2606804: "Igarassu",
	2607604: "Ilha de Itamaracá",
	2607208: "Ipojuca",
	2607752: "Itapissuma",
	2607901: "Jaboatão dos Guararapes",
	2609402: "Moreno",
	2609600: "Olinda",
	2610707: "Paulista",
	2611606: "Recife",
	2613701: "São Lourenço da Mata",
};

const _rmr7 = Object.keys(RMR_CITIES).map(Number);

export const RMR_6_DIGIT_CODES: number[] = _rmr7.map((code) =>
	Math.floor(code / 10),
);

export const RMR_6_TO_7: Record<number, number> = {};
export const RMR_6_DIGIT_NAMES: Record<number, string> = {};
for (const code7 of _rmr7) {
	const code6 = Math.floor(code7 / 10);
	RMR_6_TO_7[code6] = code7;
	const name = RMR_CITIES[code7];
	if (name) RMR_6_DIGIT_NAMES[code6] = name;
}
