/**
 * Seed Template for Atlas Database
 *
 * This file serves as a template for creating new seed functions.
 * Copy this file to `seed-{app-name}.ts` and customize for your app.
 *
 * Key Principles:
 * 1. Idempotency: Running the seed multiple times should produce the same result
 * 2. Error Handling: Gracefully handle errors and continue with other seeds
 * 3. Logging: Provide clear feedback about what's being seeded
 * 4. Performance: Batch operations when possible
 */

import chalk from "chalk";
import { eq, sql } from "drizzle-orm";
import type { Database } from "./index.js";

/**
 * Seed function for {app-name}
 *
 * This function seeds the database with initial data for {app-name}.
 * It is idempotent - running it multiple times will not create duplicates.
 *
 * @param db - Database instance
 * @returns Promise that resolves when seeding is complete
 *
 * @example
 * ```typescript
 * import seedMyApp from "./seed-my-app.js";
 * const result = await seedMyApp(db);
 * console.log(`Created: ${result.created}, Skipped: ${result.skipped}`);
 * ```
 */
export default async function seedMyApp(db: Database) {
	let created = 0;
	let skipped = 0;
	let errors = 0;

	try {
		// Example 1: Simple data insertion with duplicate checking
		// ========================================================

		const dataToInsert = [
			{ id: 1, name: "Item 1", description: "First item" },
			{ id: 2, name: "Item 2", description: "Second item" },
			{ id: 3, name: "Item 3", description: "Third item" },
		];

		for (const item of dataToInsert) {
			try {
				// Check if item already exists (idempotency check)
				const existing = await db
					.select()
					.from(myAppSchema.items)
					.where(eq(myAppSchema.items.id, item.id))
					.limit(1);

				if (existing.length > 0) {
					console.log(chalk.gray(`  ↪ Item ${item.id} already exists`));
					skipped++;
					continue;
				}

				// Insert new item
				await db.insert(myAppSchema.items).values(item);
				console.log(chalk.green(`  ✓ Created item ${item.id}`));
				created++;
			} catch (error) {
				console.error(chalk.red(`  ✗ Error creating item ${item.id}:`, error));
				errors++;
			}
		}

		// Example 2: Batch insertion with JSONB metadata
		// ===============================================

		const profilesData = [
			{
				id: "profile-1",
				data: { name: "Profile 1" },
				metadata: { source: "import", version: 1 },
			},
			{
				id: "profile-2",
				data: { name: "Profile 2" },
				metadata: { source: "import", version: 1 },
			},
		];

		for (const profile of profilesData) {
			try {
				// Check if profile exists using JSONB containment operator
				// This is more efficient than comparing entire objects
				const existing = await db
					.select()
					.from(myAppSchema.profiles)
					.where(
						sql`${myAppSchema.profiles.metadata} @> ${JSON.stringify({ id: profile.id })}`,
					)
					.limit(1);

				if (existing.length > 0) {
					console.log(chalk.gray(`  ↪ Profile ${profile.id} already exists`));
					skipped++;
					continue;
				}

				// Insert with metadata
				await db.insert(myAppSchema.profiles).values({
					...profile,
					metadata: { ...profile.metadata, id: profile.id },
				});
				console.log(chalk.green(`  ✓ Created profile ${profile.id}`));
				created++;
			} catch (error) {
				console.error(
					chalk.red(`  ✗ Error creating profile ${profile.id}:`, error),
				);
				errors++;
			}
		}

		// Example 3: Conditional seeding based on environment
		// ====================================================

		if (process.env.NODE_ENV === "development") {
			// Only seed test data in development
			const testData = [{ id: "test-1", name: "Test Item" }];

			for (const item of testData) {
				try {
					const existing = await db
						.select()
						.from(myAppSchema.items)
						.where(eq(myAppSchema.items.id, item.id))
						.limit(1);

					if (existing.length === 0) {
						await db.insert(myAppSchema.items).values(item);
						created++;
					} else {
						skipped++;
					}
				} catch (error) {
					console.error(chalk.red(`  ✗ Error with test data:`, error));
					errors++;
				}
			}
		}

		// Return summary
		return { created, skipped, errors };
	} catch (error) {
		console.error(chalk.red("Fatal error during seeding:"), error);
		throw error;
	}
}

/**
 * Best Practices for Seed Functions
 *
 * 1. IDEMPOTENCY
 *    - Always check if data exists before inserting
 *    - Use unique constraints to prevent duplicates
 *    - Use JSONB containment operator (@>) for complex checks
 *
 * 2. ERROR HANDLING
 *    - Wrap individual operations in try-catch
 *    - Log errors but continue with other data
 *    - Return summary of created/skipped/errors
 *
 * 3. LOGGING
 *    - Use chalk for colored output
 *    - Show progress for long operations
 *    - Include IDs/names for easy debugging
 *
 * 4. PERFORMANCE
 *    - Batch operations when possible
 *    - Use indexes for lookup queries
 *    - Avoid N+1 queries
 *
 * 5. TESTING
 *    - Test with fresh database
 *    - Test running seed multiple times
 *    - Test with partial data
 *    - Test error scenarios
 *
 * Example Test:
 * ```typescript
 * describe("seedMyApp", () => {
 *   it("should be idempotent", async () => {
 *     const result1 = await seedMyApp(db);
 *     const result2 = await seedMyApp(db);
 *
 *     expect(result1.created).toBe(3);
 *     expect(result2.created).toBe(0);
 *     expect(result2.skipped).toBe(3);
 *   });
 * });
 * ```
 */

/**
 * JSONB Containment Operator (@>)
 *
 * PostgreSQL's JSONB @> operator checks if the left value contains the right value.
 * This is useful for checking if a JSONB field contains specific key-value pairs.
 *
 * Example:
 * ```typescript
 * // Check if metadata contains {"id": "profile-1"}
 * const existing = await db
 *   .select()
 *   .from(schema.profiles)
 *   .where(
 *     sql`${schema.profiles.metadata} @> ${JSON.stringify({ id: "profile-1" })}`
 *   );
 * ```
 *
 * This is more efficient than:
 * ```typescript
 * // DON'T DO THIS - compares entire objects
 * .where(eq(schema.profiles.metadata, JSON.stringify({ id: "profile-1" })))
 * ```
 */
