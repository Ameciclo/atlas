import type { AppRouteHandler } from "../../lib/types.js";
import type * as routes from "./example.routes.js";

export const list: AppRouteHandler<routes.ListRoute> = async (c) => {
	return c.json([
		{
			id: 1,
			message: "Hello from CarSpeed!",
			timestamp: new Date().toISOString(),
		},
	]);
};
