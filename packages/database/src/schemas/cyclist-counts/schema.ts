import {
	boolean,
	date,
	decimal,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	serial,
	text,
	time,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Enums for directions
export const directionEnum = pgEnum("direction", [
	"north",
	"east",
	"south",
	"west",
]);

// ============================================================================
// COUNTING LOCATIONS
// ============================================================================

export const countingLocations = pgTable("counting_locations", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),

	// City information
	city: varchar("city", { length: 100 }).notNull(),
	state: varchar("state", { length: 2 }).notNull(),

	// Coordinates
	latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
	longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),

	// Flexible metadata (IBGE ID, RMR status, directions, notes, etc.)
	metadata: jsonb("metadata"),

	// Timestamps
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// COUNTING EVENTS
// ============================================================================

export const countingEvents = pgTable("counting_events", {
	id: serial("id").primaryKey(),
	location_id: integer("location_id")
		.notNull()
		.references(() => countingLocations.id, { onDelete: "cascade" }),

	counting_date: date("counting_date").notNull(),
	start_time: time("start_time").notNull(), // e.g., "06:00:00"
	end_time: time("end_time").notNull(), // e.g., "20:00:00"

	// Summary statistics (denormalized for performance)
	total_cyclists: integer("total_cyclists").notNull().default(0),
	max_hour_cyclists: integer("max_hour_cyclists").notNull().default(0),

	// Flexible fields for weather and other conditions
	weather_conditions: jsonb("weather_conditions"),
	notes: text("notes"),

	// Metadata
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// COUNTING SESSIONS (Hourly periods)
// ============================================================================

export const countingSessions = pgTable("counting_sessions", {
	id: serial("id").primaryKey(),
	event_id: integer("event_id")
		.notNull()
		.references(() => countingEvents.id, { onDelete: "cascade" }),

	session_label: varchar("session_label", { length: 10 }).notNull(), // "06-07", "07-08", etc.
	start_time: timestamp("start_time").notNull(),
	end_time: timestamp("end_time").notNull(),
	total_cyclists: integer("total_cyclists").notNull().default(0),

	// Qualitative characteristics (JSONB for flexibility)
	characteristics: jsonb("characteristics").notNull(),

	// Metadata
	created_at: timestamp("created_at").defaultNow().notNull(),
	updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// SESSION MOVEMENTS (Directional flow)
// ============================================================================

export const sessionMovements = pgTable("session_movements", {
	id: serial("id").primaryKey(),
	session_id: integer("session_id")
		.notNull()
		.references(() => countingSessions.id, { onDelete: "cascade" }),

	from_direction: directionEnum("from_direction").notNull(),
	to_direction: directionEnum("to_direction").notNull(),
	count: integer("count").notNull().default(0),

	// Metadata
	created_at: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

// Characteristics schema for validation
export const characteristicsSchema = z.object({
	cargo: z.number().int().min(0).default(0),
	helmet: z.number().int().min(0).default(0),
	juveniles: z.number().int().min(0).default(0),
	motor: z.number().int().min(0).default(0),
	other_active_modes: z.number().int().min(0).default(0),
	other_behaviors: z.number().int().min(0).default(0),
	others: z.number().int().min(0).default(0),
	rain: z.number().int().min(0).default(0),
	ride: z.number().int().min(0).default(0),
	service: z.number().int().min(0).default(0),
	shared_bike: z.number().int().min(0).default(0),
	sidewalk: z.number().int().min(0).default(0),
	women: z.number().int().min(0).default(0),
	wrong_way: z.number().int().min(0).default(0),
});

// Weather conditions schema
export const weatherConditionsSchema = z
	.object({
		temperature: z.number().optional(),
		humidity: z.number().optional(),
		precipitation: z.number().optional(),
		wind_speed: z.number().optional(),
		conditions: z.string().optional(),
	})
	.optional();

// Location metadata schema
export const locationMetadataSchema = z
	.object({
		ibge_city_id: z.number().int().optional(),
		state_full: z.string().optional(),
		is_rmr: z.boolean().optional(),
		directions: z
			.object({
				north: z.string().optional(),
				east: z.string().optional(),
				south: z.string().optional(),
				west: z.string().optional(),
			})
			.optional(),
		notes: z.string().optional(),
	})
	.optional();

// Counting Locations
export const selectCountingLocationSchema =
	createSelectSchema(countingLocations);
export const insertCountingLocationSchema = createInsertSchema(
	countingLocations,
	{
		latitude: z.string().regex(/^-?\d+\.\d+$/),
		longitude: z.string().regex(/^-?\d+\.\d+$/),
		metadata: locationMetadataSchema,
	},
);

// Counting Events
export const selectCountingEventSchema = createSelectSchema(countingEvents);
export const insertCountingEventSchema = createInsertSchema(countingEvents, {
	weather_conditions: weatherConditionsSchema,
});

// Counting Sessions
export const selectCountingSessionSchema = createSelectSchema(countingSessions);
export const insertCountingSessionSchema = createInsertSchema(
	countingSessions,
	{
		characteristics: characteristicsSchema,
	},
);

// Session Movements
export const selectSessionMovementSchema = createSelectSchema(sessionMovements);
export const insertSessionMovementSchema = createInsertSchema(sessionMovements);

// ============================================================================
// TYPESCRIPT TYPES
// ============================================================================

export type CountingLocation = typeof countingLocations.$inferSelect;
export type NewCountingLocation = typeof countingLocations.$inferInsert;

export type CountingEvent = typeof countingEvents.$inferSelect;
export type NewCountingEvent = typeof countingEvents.$inferInsert;

export type CountingSession = typeof countingSessions.$inferSelect;
export type NewCountingSession = typeof countingSessions.$inferInsert;

export type SessionMovement = typeof sessionMovements.$inferSelect;
export type NewSessionMovement = typeof sessionMovements.$inferInsert;

export type Characteristics = z.infer<typeof characteristicsSchema>;
export type WeatherConditions = z.infer<typeof weatherConditionsSchema>;
export type LocationMetadata = z.infer<typeof locationMetadataSchema>;
