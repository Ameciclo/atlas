import { inArray, notInArray } from "drizzle-orm";
import { emergencyCalls } from "../db/schema.js";

export const VALID_OUTCOMES = [
	"Atendimento Concluído com Êxito",
	"Removido pelos Bombeiros/CIODS",
	"Removido por Particulares",
	"Óbito no Local/Atendimento",
] as const;

export const validOutcomes = () =>
	inArray(emergencyCalls.outcome_category, [...VALID_OUTCOMES]);

export const invalidOutcomes = () =>
	notInArray(emergencyCalls.outcome_category, [...VALID_OUTCOMES]);
