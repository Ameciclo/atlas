import { StreetService } from "../../lib/street-service.js";

const streetService = new StreetService();

export const handleStreetDataSummary = async (c: any) => {
	const { streetId } = c.req.valid("param");

	const dataSummary = await streetService.getStreetDataSummary(streetId);

	if (!dataSummary) {
		return c.json(
			{
				error: "Not Found",
				message: "Street not found",
			},
			404,
		);
	}

	return c.json({
		street_id: dataSummary.street_id,
		street_name: dataSummary.street_name,
		data_summary: dataSummary.data_summary,
	});
}
