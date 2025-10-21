# Cyclist Counts Schema - Quick Reference

## Tables Overview

```
counting_locations (8 columns)
    ↓
counting_events (11 columns)
    ↓
counting_sessions (9 columns)
    ↓
session_movements (6 columns)
```

## Table Definitions

### `counting_locations`
Physical locations where counts are performed.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `name` | varchar(255) | Intersection name (e.g., "Av. Rui Barbosa x R. Amélia") |
| `city` | varchar(100) | City name (e.g., "Recife") |
| `state` | varchar(2) | State code (e.g., "PE") |
| `latitude` | decimal(10,7) | Latitude coordinate |
| `longitude` | decimal(10,7) | Longitude coordinate |
| `metadata` | jsonb | Flexible data (see below) |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

**Metadata structure:**
```json
{
  "ibge_city_id": 2611606,
  "state_full": "Pernambuco",
  "is_rmr": true,
  "directions": {
    "north": "Parnamirim",
    "east": "Espinheiro",
    "south": "Centro",
    "west": "Torre"
  },
  "notes": "Optional notes about the location"
}
```

### `counting_events`
A specific day of counting at a location.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `location_id` | integer | FK to counting_locations |
| `counting_date` | date | Date of the count |
| `start_time` | time | Start time (e.g., "06:00:00") |
| `end_time` | time | End time (e.g., "20:00:00") |
| `total_cyclists` | integer | Total count for the day |
| `max_hour_cyclists` | integer | Peak hour count |
| `weather_conditions` | jsonb | Weather data (optional) |
| `notes` | text | Event notes (optional) |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

### `counting_sessions`
Hourly periods within a counting event.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `event_id` | integer | FK to counting_events |
| `session_label` | varchar(10) | Label (e.g., "06-07", "07-08") |
| `start_time` | timestamp | Session start |
| `end_time` | timestamp | Session end |
| `total_cyclists` | integer | Total for this hour |
| `characteristics` | jsonb | Qualitative observations |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

**Characteristics structure:**
```json
{
  "cargo": 11,
  "helmet": 3,
  "juveniles": 0,
  "motor": 0,
  "other_active_modes": 0,
  "other_behaviors": 0,
  "others": 0,
  "rain": 20,
  "ride": 3,
  "service": 1,
  "shared_bike": 0,
  "sidewalk": 0,
  "women": 16,
  "wrong_way": 11
}
```

### `session_movements`
Directional flow data for each session.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `session_id` | integer | FK to counting_sessions |
| `from_direction` | enum | Origin direction (north/east/south/west) |
| `to_direction` | enum | Destination direction (north/east/south/west) |
| `count` | integer | Number of cyclists |
| `created_at` | timestamp | Creation timestamp |

## Design Decisions

### Why simplified locations table?
- **Reduced from 15 to 8 columns**
- City attributes (IBGE ID, RMR status) moved to metadata
- Directional references moved to metadata (used for human context only)
- Keeps frequently-queried fields (city, state, coordinates) as columns
- JSONB metadata for everything else

### Why JSONB for characteristics?
- Categories may evolve over time
- Not all characteristics tracked in all counts
- Easy to add new fields without schema migrations
- Still queryable with PostgreSQL JSONB operators

### Why separate movements table?
- Avoids 12 columns (north_south, north_east, etc.)
- Easy to filter by direction
- Flexible for adding new directions
- Better for aggregation queries

## Common Queries

### Get all locations in Recife
```sql
SELECT * FROM counting_locations 
WHERE city = 'Recife';
```

### Get locations in RMR
```sql
SELECT * FROM counting_locations 
WHERE metadata->>'is_rmr' = 'true';
```

### Peak hours analysis
```sql
SELECT session_label, AVG(total_cyclists) as avg_cyclists
FROM counting_sessions
GROUP BY session_label
ORDER BY avg_cyclists DESC;
```

### Movement patterns
```sql
SELECT from_direction, to_direction, SUM(count) as total
FROM session_movements
GROUP BY from_direction, to_direction
ORDER BY total DESC;
```

### High helmet usage sessions
```sql
SELECT * FROM counting_sessions
WHERE (characteristics->>'helmet')::int > 20;
```

## Next Steps

1. **Add indexes** for common queries
2. **Add PostGIS** for spatial queries
3. **Create views** for common aggregations
4. **Import existing data** using migration script

