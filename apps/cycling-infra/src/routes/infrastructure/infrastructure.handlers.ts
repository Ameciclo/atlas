import * as HttpStatusCodes from "stoker/http-status-codes";

export const list = async (c: any) => {
	return c.json({
		message:
			"This endpoint is deprecated. The ciclomapa_infra table has been removed. Use /v1/ways/all-ways and /v1/ways/summary instead.",
	}, HttpStatusCodes.GONE);
};

export const getById = async (c: any) => {
	return c.json({
		message:
			"This endpoint is deprecated. The ciclomapa_infra table has been removed. Use /v1/ways/all-ways and /v1/ways/summary instead.",
	}, HttpStatusCodes.GONE);
};

export const getGeoJSON = async (c: any) => {
	return c.json({
		message:
			"This endpoint is deprecated. The ciclomapa_infra table has been removed. Use /v1/ways/all-ways and /v1/ways/summary instead.",
	}, HttpStatusCodes.GONE);
};

export const getNearby = async (c: any) => {
	return c.json({
		message:
			"This endpoint is deprecated. The ciclomapa_infra table has been removed. Use /v1/ways/all-ways and /v1/ways/summary instead.",
	}, HttpStatusCodes.GONE);
};
