// ============================================================================
// Agent mapping
// ============================================================================

export const AGENT_INFO: Record<
	number,
	{ description: string; category: "eletronico" | "manual" }
> = {
	0: { description: "NA", category: "manual" },
	1: { description: "Convênio BPTRAN", category: "manual" },
	2: { description: "Zona Azul - Talão Manual", category: "manual" },
	3: { description: "Lombada Eletrônica", category: "eletronico" },
	4: { description: "Radar", category: "eletronico" },
	5: { description: "Fotosensor", category: "eletronico" },
	6: { description: "Autos no Talão Manual", category: "manual" },
	7: { description: "Zona Azul - Talão Eletrônico", category: "manual" },
	8: { description: "Autos no Talão Eletrônico", category: "manual" },
	9: { description: "Faixa Azul", category: "eletronico" },
};
