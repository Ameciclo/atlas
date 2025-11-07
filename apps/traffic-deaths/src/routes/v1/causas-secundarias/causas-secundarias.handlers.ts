import type { AppRouteHandler } from "../../../lib/types.js";
import type { getCausasSecundariasV1 } from "./causas-secundarias.routes.js";

export const getCausasSecundariasV1Handler: AppRouteHandler<typeof getCausasSecundariasV1> = async (c) => {
	// TODO: Implement actual secondary causes analysis
	return c.json({
		causas: [
			{
				codigo: "V299",
				descricao: "Motociclista traumatizado em acidente de transporte não especificado",
				total: 150,
				percentual: 35.5,
			},
			{
				codigo: "V499",
				descricao: "Ocupante de automóvel traumatizado em acidente de transporte não especificado",
				total: 100,
				percentual: 23.7,
			},
		],
		total: 422,
	});
};