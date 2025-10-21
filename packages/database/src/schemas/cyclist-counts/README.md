# Cyclist Counts Schema

This schema is designed to store and analyze cyclist counting data collected at various locations over time.

## Schema Overview

The schema uses a **normalized relational structure** with some strategic use of JSONB for flexibility:

```
counting_locations (where counts happen)
    ↓
counting_events (a specific day of counting at a location)
    ↓
counting_sessions (hourly periods within an event)
    ↓
session_movements (directional flow data for each session)
```

## Tables

### 1. `counting_locations`

Stores the physical locations where cyclist counts are performed.

**Key fields:**
- `name`: Intersection or location name (e.g., "Av. Rui Barbosa x R. Amélia")
- `city`, `state`: Geographic identifiers for filtering/grouping
- `latitude`, `longitude`: Precise coordinates for mapping
- `metadata`: JSONB containing flexible data:
  - `ibge_city_id`: IBGE city code (e.g., 2611606)
  - `state_full`: Full state name (e.g., "Pernambuco")
  - `is_rmr`: Whether location is in Região Metropolitana do Recife
  - `directions`: Neighborhood names in each direction (for human context)
  - `notes`: Any additional observations

**Why separate?** Locations are reused across multiple counting events.

**Why JSONB for metadata?** These fields are useful for context but not queried frequently. Keeping them in JSONB keeps the schema clean while preserving all information.

### 2. `counting_events`

Represents a single day of counting at a specific location.

**Key fields:**
- `location_id`: References the counting location
- `counting_date`: The date of the count
- `start_time`, `end_time`: Time window (e.g., 06:00 - 20:00)
- `total_cyclists`: Total count for the day (denormalized for performance)
- `max_hour_cyclists`: Peak hour count
- `weather_conditions`: JSONB for flexible weather data

**Why separate?** You can count at the same location on multiple days.

### 3. `counting_sessions`

Hourly time periods within a counting event.

**Key fields:**
- `event_id`: References the parent counting event
- `session_label`: Human-readable label (e.g., "06-07", "07-08")
- `start_time`, `end_time`: Exact timestamps
- `total_cyclists`: Total for this hour
- `characteristics`: JSONB containing qualitative observations

**Why JSONB for characteristics?** The categories you track may evolve over time (new bike types, new behaviors, etc.). JSONB provides flexibility while still allowing queries.

### 4. `session_movements`

Directional flow data showing how cyclists moved through the intersection.

**Key fields:**
- `session_id`: References the counting session
- `from_direction`: Where cyclists came from (north/east/south/west)
- `to_direction`: Where cyclists went to (north/east/south/west)
- `count`: Number of cyclists making this movement

**Why separate?** This allows easy querying of flow patterns:
- "How many cyclists went north to south?"
- "What's the most common movement pattern?"
- "Which direction has the most incoming traffic?"

## Benefits of This Structure

### 1. **Easy Aggregations**
```sql
-- Total cyclists per location
SELECT l.name, SUM(e.total_cyclists) as total
FROM counting_locations l
JOIN counting_events e ON e.location_id = l.id
GROUP BY l.id, l.name;

-- Peak hours across all events
SELECT session_label, AVG(total_cyclists) as avg_cyclists
FROM counting_sessions
GROUP BY session_label
ORDER BY avg_cyclists DESC;
```

### 2. **Efficient Queries**
```sql
-- Find all counts in Recife in 2013
SELECT * FROM counting_events e
JOIN counting_locations l ON l.id = e.location_id
WHERE l.city_name = 'Recife' 
  AND EXTRACT(YEAR FROM e.counting_date) = 2013;

-- Get movement patterns for a specific session
SELECT from_direction, to_direction, count
FROM session_movements
WHERE session_id = 123;
```

### 3. **Flexible Characteristics**
```sql
-- Query characteristics using JSONB operators
SELECT session_label, 
       (characteristics->>'women')::int as women_count,
       (characteristics->>'helmet')::int as helmet_count
FROM counting_sessions
WHERE event_id = 1;

-- Find sessions with high helmet usage
SELECT * FROM counting_sessions
WHERE (characteristics->>'helmet')::int > 20;
```

### 4. **Spatial Queries** (with PostGIS)
```sql
-- Find all counting locations within 5km of a point
SELECT * FROM counting_locations
WHERE ST_DWithin(
  ST_MakePoint(longitude::float, latitude::float)::geography,
  ST_MakePoint(-34.90207, -8.04511)::geography,
  5000
);
```

## Data Migration Example

Here's how to transform your current JSON structure into this schema:

```typescript
// Original data
const originalData = {
  id: 1,
  metadata: { name: "...", date: "2013-3-25", ... },
  data: { sessions: [...], summary: {...} },
  coordinates: { x: -34.90207, y: -8.04511 }
};

// 1. Insert location
const [location] = await db.insert(countingLocations).values({
  name: originalData.metadata.name,
  city: originalData.metadata.city.name,
  state: originalData.metadata.city.state,
  latitude: originalData.coordinates.y.toString(),
  longitude: originalData.coordinates.x.toString(),
  metadata: {
    ibge_city_id: originalData.metadata.city.id,
    state_full: originalData.metadata.city.full_state,
    is_rmr: originalData.metadata.city.rmr,
    directions: originalData.metadata.directions,
  },
}).returning();

// 2. Insert event
const [event] = await db.insert(countingEvents).values({
  location_id: location.id,
  counting_date: originalData.metadata.date,
  start_time: "06:00:00",
  end_time: "20:00:00",
  total_cyclists: originalData.data.summary.total_cyclists,
  max_hour_cyclists: originalData.data.summary.max_hour,
}).returning();

// 3. Insert sessions and movements
for (const session of originalData.data.sessions) {
  const [insertedSession] = await db.insert(countingSessions).values({
    event_id: event.id,
    session_label: session.session,
    start_time: session.start_time,
    end_time: session.end_time,
    total_cyclists: session.total_cyclists,
    characteristics: session.characteristics,
  }).returning();

  // 4. Insert movements
  const movements = [];
  for (const [key, count] of Object.entries(session.quantitative)) {
    const [from, to] = key.split('_'); // "north_south" -> ["north", "south"]
    movements.push({
      session_id: insertedSession.id,
      from_direction: from,
      to_direction: to,
      count: count as number,
    });
  }
  
  await db.insert(sessionMovements).values(movements);
}
```

## Query Examples

### Get complete event with all sessions
```typescript
const eventWithSessions = await db.query.countingEvents.findFirst({
  where: eq(countingEvents.id, eventId),
  with: {
    location: true,
    sessions: {
      with: {
        movements: true,
      },
    },
  },
});
```

### Analyze peak hours
```typescript
const peakHours = await db
  .select({
    session_label: countingSessions.session_label,
    avg_cyclists: avg(countingSessions.total_cyclists),
    max_cyclists: max(countingSessions.total_cyclists),
  })
  .from(countingSessions)
  .groupBy(countingSessions.session_label)
  .orderBy(desc(avg(countingSessions.total_cyclists)));
```

### Movement patterns analysis
```typescript
const movements = await db
  .select({
    from: sessionMovements.from_direction,
    to: sessionMovements.to_direction,
    total: sum(sessionMovements.count),
  })
  .from(sessionMovements)
  .innerJoin(countingSessions, eq(sessionMovements.session_id, countingSessions.id))
  .innerJoin(countingEvents, eq(countingSessions.event_id, countingEvents.id))
  .where(eq(countingEvents.location_id, locationId))
  .groupBy(sessionMovements.from_direction, sessionMovements.to_direction);
```

## Design Decisions

### Why not store everything in JSONB?
- **Performance**: Indexed columns are much faster for filtering and aggregation
- **Type safety**: Drizzle provides full TypeScript types for structured data
- **Data integrity**: Foreign keys ensure referential integrity
- **Query simplicity**: SQL queries are more readable than JSONB path queries

### Why use JSONB for characteristics?
- **Flexibility**: Categories may change over time (new bike types, new behaviors)
- **Sparse data**: Not all characteristics are tracked in all counts
- **Evolution**: Easy to add new fields without schema migrations

### Why separate movements table?
- **Normalization**: Avoids storing 12 columns (north_south, north_east, etc.) in sessions
- **Queryability**: Easy to filter by direction
- **Flexibility**: Can add new directions without schema changes

## Next Steps

1. **Add indexes** for common queries:
   ```sql
   CREATE INDEX idx_events_location_date ON counting_events(location_id, counting_date);
   CREATE INDEX idx_sessions_event ON counting_sessions(event_id);
   CREATE INDEX idx_movements_session ON session_movements(session_id);
   ```

2. **Add PostGIS** for spatial queries:
   ```sql
   ALTER TABLE counting_locations 
   ADD COLUMN geom GEOMETRY(Point, 4326);
   
   UPDATE counting_locations 
   SET geom = ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326);
   
   CREATE INDEX idx_locations_geom ON counting_locations USING GIST(geom);
   ```

3. **Add computed columns** or views for common aggregations

4. **Consider partitioning** `counting_events` by year if you have many years of data

