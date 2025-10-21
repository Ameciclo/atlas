# Seed Data

This directory contains seed data for the Atlas database.

## Files

### `cyclist-counts.json`

Historical cyclist counting data from Ameciclo's counting events.

**Format:**
```json
[
  {
    "id": 1,
    "metadata": {
      "name": "Location name",
      "date": "YYYY-MM-DD",
      "city": {
        "id": 2611606,
        "name": "Recife",
        "state": "PE",
        "full_state": "Pernambuco",
        "rmr": true
      },
      "directions": {
        "north": "Neighborhood name",
        "east": "Neighborhood name",
        "south": "Neighborhood name",
        "west": "Neighborhood name"
      },
      "coordinates": {
        "latitude": -8.04511,
        "longitude": -34.90207
      }
    },
    "data": {
      "sessions": [
        {
          "session": "06-07",
          "start_time": "ISO timestamp",
          "end_time": "ISO timestamp",
          "total_cyclists": 143,
          "quantitative": {
            "north_west": 0,
            "north_south": 52,
            // ... all 12 directional movements
          },
          "characteristics": {
            "cargo": 11,
            "helmet": 3,
            "juveniles": 0,
            // ... all characteristics
          }
        }
      ]
    }
  }
]
```

**Statistics:**
- 61 counting events
- Multiple sessions per event (hourly periods)
- Directional movement data (12 possible directions)
- Qualitative characteristics (14 categories)

## Usage

### Development

```bash
# Run migrations first
pnpm --filter @atlas/database db:migrate

# Seed the database
pnpm --filter @atlas/database db:seed

# Or reset everything (migrate + seed)
pnpm --filter @atlas/database db:reset
```

### Production

The seed script can be run in production using environment variables:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname pnpm --filter @atlas/database db:seed
```

Or as a one-time job in your deployment:

```bash
# In Portainer or Docker Compose
docker run --rm \
  -e DATABASE_URL=postgresql://user:pass@host:5432/dbname \
  ghcr.io/ameciclo/atlas/cyclist-counts:latest \
  node -e "import('./packages/database/dist/seed.js').then(m => m.seedCyclistCounts())"
```

## Data Transformation

The seed script transforms the legacy JSON format to the new normalized schema:

1. **Locations**: Extracts unique locations, creates `counting_locations` records
2. **Events**: Creates `counting_events` for each counting day
3. **Sessions**: Creates `counting_sessions` for each hourly period
4. **Movements**: Transforms flat directional data into `session_movements` records

### Example Transformation

**Legacy format:**
```json
{
  "quantitative": {
    "north_south": 52,
    "west_east": 47
  }
}
```

**New format:**
```sql
INSERT INTO session_movements (session_id, from_direction, to_direction, count)
VALUES 
  (1, 'north', 'south', 52),
  (1, 'west', 'east', 47);
```

## Notes

- The seed script is **idempotent** for locations (won't create duplicates)
- Events, sessions, and movements are always created fresh
- If you need to re-seed, drop the tables or use `db:reset`
- Missing coordinates default to (0, 0) - update manually if needed

