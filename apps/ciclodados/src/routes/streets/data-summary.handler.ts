import { StreetService } from "../../lib/street-service.js";

const streetService = new StreetService();

export async function handleStreetDataSummary(c: any) {
	const streetId = c.req.param('streetId');
	
	const dataSummary = await streetService.getStreetDataSummary(streetId);
	
	if (!dataSummary) {
		return c.json(
			{
				error: "Not Found",
				message: "Street not found",
			},
			404
		);
	}

	return c.json(dataSummary);
}