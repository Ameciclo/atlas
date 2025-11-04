# Master Seed Orchestrator Guide

## Overview

The Atlas database now features a sophisticated **Master Seed Orchestrator** that manages seeding for all applications in a single, coordinated workflow. This system ensures:

- ✅ **Idempotency**: Run seeds multiple times without creating duplicates
- ✅ **Modularity**: Each app has its own seed script that can run independently
- ✅ **Orchestration**: Master script coordinates all seeds with proper error handling
- ✅ **Reporting**: Detailed summary report with timing and statistics

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│         Master Seed Orchestrator (seed.ts)              │
│  Coordinates all seeds, error handling, and reporting   │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        │          │          │
        ▼          ▼          ▼
   ┌────────┐ ┌────────┐ ┌────────┐
   │Cyclist │ │Cyclist │ │Traffic │
   │ Counts │ │Profiles│ │ Deaths │
   └────────┘ └────────┘ └────────┘
```

## Available Commands

### Master Seed (All Apps)
```bash
pnpm db:seed
```
Runs all seed scripts in sequence:
1. Cyclist Counts
2. Cyclist Profiles
3. Traffic Deaths

### Individual Seeds
```bash
# Seed only cyclist counts
pnpm db:seed:counts

# Seed only cyclist profiles
pnpm db:seed:profiles

# Seed only traffic deaths
pnpm db:seed:deaths
```

## Seed Scripts

### 1. Cyclist Counts (`seed-cyclist-counts.ts`)

**Location**: `packages/database/src/seed-cyclist-counts.ts`

**Data Source**: `packages/database/seed-data/cyclist-counts/data.json`

**Idempotency Strategy**:
- Locations: Checked by name
- Events: Checked by (location_id, counting_date) combination
- Sessions: Skipped if event already exists
- Movements: Created fresh for new sessions

**Statistics**:
- 33 locations
- 61 events
- 848 sessions
- 8,923 movements

### 2. Cyclist Profiles (`seed-cyclist-profiles.ts`)

**Location**: `packages/database/src/seed-cyclist-profiles.ts`

**Data Source**: `packages/database/seed-data/cyclist-profiles/data.json`

**Idempotency Strategy**:
- Checked by `metadata.id` field
- Skips profiles that already exist

**Status**: Ready for data (currently empty)

### 3. Traffic Deaths (`seed-traffic-deaths.ts`)

**Location**: `packages/database/src/seed-traffic-deaths.ts`

**Data Source**: `packages/database/seed-data/traffic-deaths/mortes_transito_*.csv`

**Idempotency Strategy**:
- Checked by `data_year` field
- Skips entire year if already imported
- Uses `import_batch` to track import sessions

**Status**: Ready for CSV data (2015-2023)

## Workflow

### First Run (Fresh Database)
```bash
pnpm db:reset      # Clean database
pnpm db:migrate    # Run migrations
pnpm db:seed       # Run all seeds
```

### Subsequent Runs (Idempotent)
```bash
pnpm db:seed       # Safe to run multiple times
```

The master seed will:
1. Check for existing data
2. Skip already-imported records
3. Only create new records
4. Report what was created vs. skipped

## Output Example

```
╔════════════════════════════════════════════════════════════╗
║          🌱 ATLAS DATABASE MASTER SEED ORCHESTRATOR 🌱      ║
╚════════════════════════════════════════════════════════════╝

🚴 Seeding Cyclist Counts...
────────────────────────────────────────────────────────────
✅ Cyclist Counts completed in 3.68s

👤 Seeding Cyclist Profiles...
────────────────────────────────────────────────────────────
✅ Cyclist Profiles completed in 0.01s

🚗 Seeding Traffic Deaths...
────────────────────────────────────────────────────────────
✅ Traffic Deaths completed in 0.02s

╔════════════════════════════════════════════════════════════╗
║                    📊 SEED SUMMARY REPORT 📊                ║
╚════════════════════════════════════════════════════════════╝

✅ Cyclist Counts       | 3.68s
   └─ locationsCreated: 33
   └─ eventsCreated: 61
   └─ sessionsCreated: 848
   └─ movementsCreated: 8923

✅ Cyclist Profiles     | 0.01s
   └─ profilesCreated: 0
   └─ profilesSkipped: 0

✅ Traffic Deaths       | 0.02s
   └─ totalInserted: 0
   └─ totalSkipped: 0
   └─ totalErrors: 0

────────────────────────────────────────────────────────────
Total: 3 succeeded, 0 failed
Total time: 3.71s
────────────────────────────────────────────────────────────

🎉 All seeds completed successfully!
```

## Adding New Seeds

To add a new seed script:

1. **Create seed file**: `packages/database/src/seed-{app-name}.ts`

2. **Export function**:
```typescript
export async function seed{AppName}(config: DatabaseConfig = {}) {
  // Your seeding logic
  return { /* statistics */ };
}
```

3. **Add to master orchestrator** in `seed.ts`:
```typescript
const seedTasks = [
  // ... existing tasks
  {
    name: "Your App",
    icon: "🎯",
    fn: seedYourApp,
  },
];
```

4. **Add npm script** in `package.json`:
```json
"db:seed:yourapp": "tsx src/seed-{app-name}.ts"
```

## Error Handling

The master orchestrator:
- Catches errors from individual seeds
- Continues with next seed if one fails
- Reports all errors in summary
- Exits with code 1 if any seed fails
- Exits with code 0 if all succeed

## Best Practices

1. **Always make seeds idempotent**
   - Check for existing data before inserting
   - Use unique identifiers for duplicate detection

2. **Provide clear logging**
   - Show what's being created
   - Show what's being skipped
   - Report statistics

3. **Handle errors gracefully**
   - Don't crash on individual record errors
   - Continue processing
   - Report errors in summary

4. **Keep seeds fast**
   - Batch operations when possible
   - Use efficient queries
   - Avoid unnecessary loops

## Troubleshooting

### Seed fails with "file not found"
- Check that seed data files exist in `seed-data/` directory
- Verify file paths in seed script

### Duplicates are being created
- Ensure idempotency checks are working
- Verify unique identifier logic
- Check database for existing data

### Seed runs but creates nothing
- Check if data already exists
- Verify seed data files have content
- Check database connection

## See Also

- [Seed Data README](./seed-data/cyclist-counts/README.md)
- [Database Schema](./src/schemas/)
- [Migrations](./src/migrations/)

