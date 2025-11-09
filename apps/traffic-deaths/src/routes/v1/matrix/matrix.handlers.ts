import type { AppRouteHandler } from "../../../lib/types.js";
import type { getMatrixV1 } from "./matrix.routes.js";

export const getMatrixV1Handler: AppRouteHandler<typeof getMatrixV1> = async (
	c,
) => {
	// TODO: Implement actual matrix analysis
	return c.json({
		matrix: [
			[10, 20, 30],
			[15, 25, 35],
			[5, 15, 25],
		],
		labels: {
			rows: ["Recife", "Olinda", "Jaboatão"],
			columns: ["2020", "2021", "2022"],
		},
	});
};
