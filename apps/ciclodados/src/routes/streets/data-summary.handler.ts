import type { Context } from "hono";
import { StreetService } from "../../lib/street-service.js";

const streetService = new StreetService();

export const handleStreetDataSummary = async (c: Context) => {
	const streetId = c.req.param("streetId");

	const dataSummary = await streetService.getStreetDataSummary(streetId);

	if (!dataSummary) {
		return c.json({
			street_id: streetId || "",
			street_name: "Unknown",
			data_summary: null,
		});
	}

	return c.json({
		street_id: dataSummary.street_id,
		street_name: dataSummary.street_name,
		data_summary: dataSummary.data_summary,
	});
};
