export const CATEGORY_MAP: Record<string, string> = {
	ACIDENTMOTO: "sinistro_moto",
	"ACIDENTE DE TRANSITO ENVOLVENDO MOTO": "sinistro_moto",
	ACIDENTCARRO: "sinistro_carro",
	"ACIDENTE DE TRANSITO COM CARROS": "sinistro_carro",
	ACIDENTBIKE: "sinistro_bicicleta",
	"ACIDENTE DE TRANSITO ENVOLVENDO BICICLETA": "sinistro_bicicleta",
	ACIDENTONIBUS: "sinistro_onibus_caminhao",
	"ACIDENTE DE TRANSITO ENVOLVENDO ONIBUS OU CAMINHAO": "sinistro_onibus_caminhao",
	ATROPELCARRO: "atropelamento_carro",
	"ATROPELAMENTO POR CARRO": "atropelamento_carro",
	ATROPELMOTO: "atropelamento_moto",
	"ATROPELAMENTO POR MOTO": "atropelamento_moto",
	ATROPELONIBUS: "atropelamento_onibus_caminhao",
	"ATROPELAMENTO POR ONIBUS OU CAMINHAO": "atropelamento_onibus_caminhao",
	ATROPELBIKE: "atropelamento_bicicleta",
	"ATROPELAMENTO POR BICICLETA": "atropelamento_bicicleta",
	ACIDENTANIMT: "outro",
	ACIDENTANIMM: "outro",
	"ACIDENTE COM ANIMAIS TERRESTRES": "outro",
	"ACIDENTE COM ANIMAIS MARINHOS": "outro",
};

export const CATEGORY_BUCKETS = [
	"sinistro_moto",
	"sinistro_carro",
	"sinistro_bicicleta",
	"sinistro_onibus_caminhao",
	"atropelamento_carro",
	"atropelamento_moto",
	"atropelamento_onibus_caminhao",
	"atropelamento_bicicleta",
	"outro",
] as const;

export function normalizeCategories(
	raw: Record<string, number>,
): Record<string, number> {
	const result: Record<string, number> = {};
	for (const bucket of CATEGORY_BUCKETS) {
		result[bucket] = 0;
	}
	for (const [key, value] of Object.entries(raw)) {
		const bucket = CATEGORY_MAP[key] || "outro";
		result[bucket] = (result[bucket] || 0) + (value || 0);
	}
	return result;
}
