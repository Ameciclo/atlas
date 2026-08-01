import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { createMessageObjectSchema } from "stoker/openapi/schemas";

export const ZOD_ERROR_MESSAGES = {
	REQUIRED: "Required",
	EXPECTED_NUMBER: "Expected number, received nan",
	NO_UPDATES: "No updates provided",
};

export const ZOD_ERROR_CODES = {
	INVALID_UPDATES: "invalid_updates",
};

export const notFoundSchema = createMessageObjectSchema(
	HttpStatusPhrases.NOT_FOUND,
);

export const RMR_CITIES = [
	2600054, 2601052, 2602902, 2603454, 2606804, 2607208, 2607604, 2607752,
	2607901, 2609402, 2609600, 2610707, 2611606, 2613701,
];

export function isRmrCity(cityId: number): boolean {
	return RMR_CITIES.includes(cityId);
}
