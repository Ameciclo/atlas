import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { createErrorSchema, IdParamsSchema } from "stoker/openapi/schemas";

import { selectCyclistProfileSchema } from "../../db/schema.js";
import { notFoundSchema } from "../../lib/constants.js";

const tags = ["Cyclist Profiles"];

export const list = createRoute({
	path: "/cyclist-profiles",
	method: "get",
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectCyclistProfileSchema),
			"The list of cyclist profiles",
		),
	},
});

// export const create = createRoute({
// 	path: "/cyclist-profiles",
// 	method: "post",
// 	request: {
// 		body: jsonContentRequired(insertTasksSchema, "The task to create"),
// 	},
// 	tags,
// 	responses: {
// 		[HttpStatusCodes.OK]: jsonContent(selectTasksSchema, "The created task"),
// 		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
// 			createErrorSchema(insertTasksSchema),
// 			"The validation error(s)",
// 		),
// 	},
// });

export const getOne = createRoute({
	path: "/cyclist-profiles/{id}",
	method: "get",
	request: {
		params: IdParamsSchema,
	},
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			selectCyclistProfileSchema,
			"The requested cyclist profile",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			notFoundSchema,
			"Cyclist profile not found",
		),
		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
			createErrorSchema(IdParamsSchema),
			"Invalid id error",
		),
	},
});

// export const patch = createRoute({
// 	path: "/tasks/{id}",
// 	method: "patch",
// 	request: {
// 		params: IdParamsSchema,
// 		body: jsonContentRequired(patchTasksSchema, "The task updates"),
// 	},
// 	tags,
// 	responses: {
// 		[HttpStatusCodes.OK]: jsonContent(selectTasksSchema, "The updated task"),
// 		[HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Task not found"),
// 		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
// 			createErrorSchema(patchTasksSchema).or(createErrorSchema(IdParamsSchema)),
// 			"The validation error(s)",
// 		),
// 	},
// });

// export const remove = createRoute({
// 	path: "/tasks/{id}",
// 	method: "delete",
// 	request: {
// 		params: IdParamsSchema,
// 	},
// 	tags,
// 	responses: {
// 		[HttpStatusCodes.NO_CONTENT]: {
// 			description: "Task deleted",
// 		},
// 		[HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "Task not found"),
// 		[HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(
// 			createErrorSchema(IdParamsSchema),
// 			"Invalid id error",
// 		),
// 	},
// });

export type ListRoute = typeof list;
// export type CreateRoute = typeof create;
export type GetOneRoute = typeof getOne;
// export type PatchRoute = typeof patch;
// export type RemoveRoute = typeof remove;
