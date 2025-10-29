# Data Seeding Guide for Production

This guide explains how to seed data for Atlas services in production using Portainer.

## Overview

Different services have different seeding requirements:

| Service | Seeding Required? | Data Size | Method |
|---------|------------------|-----------|--------|
| **cyclist-profile** | Optional | Small (~KB) | Automatic via seed service |
| **cyclist-counts** | Optional | Medium (~MB) | Automatic via seed service |
| **traffic-deaths** | **Required** | Large (~97 MB, 320K records) | **Manual (Option 2)** |

---

## Traffic Deaths Data Seeding

The traffic-deaths service requires initial data seeding with DATASUS mortality data (2015-2023).

### Prerequisites

1. ✅ Atlas stack deployed in Portainer
2. ✅ Migrations completed successfully
3. ✅ CSV files available locally (9 files, ~10-15 MB total)

### CSV Files Required

```
apps/traffic-deaths/src/db/mortes_transito_2015.csv
apps/traffic-deaths/src/db/mortes_transito_2016.csv
apps/traffic-deaths/src/db/mortes_transito_2017.csv
apps/traffic-deaths/src/db/mortes_transito_2018.csv
apps/traffic-deaths/src/db/mortes_transito_2019.csv
apps/traffic-deaths/src/db/mortes_transito_2020.csv
apps/traffic-deaths/src/db/mortes_transito_2021.csv
apps/traffic-deaths/src/db/mortes_transito_2022.csv
apps/traffic-deaths/src/db/mortes_transito_2023.csv
```

---

## Seeding Method: External Seed Script (Option 2)

This is the recommended approach for production.

### Step 1: Prepare CSV Files on Production Server

Upload the CSV files to your production server:

```bash
# From your local machine
cd /path/to/atlas

# Create directory on server
ssh user@your-server "mkdir -p /data/traffic-deaths"

# Upload all CSV files
scp apps/traffic-deaths/src/db/mortes_transito_*.csv \
  user@your-server:/data/traffic-deaths/
```

### Step 2: Verify Files on Server

```bash
# SSH into server
ssh user@your-server

# Check files
ls -lh /data/traffic-deaths/
# Should show 9 CSV files, ~10-15 MB total
```

### Step 3: Run Seed Container

#### Option A: Using Docker CLI

```bash
# On production server

# DigitalOcean managed database - sslmode=require is sufficient
docker run --rm \
  -v /data/traffic-deaths:/app/apps/traffic-deaths/src/db \
  -e DATABASE_URL="postgresql://atlas:AVNS_NK_FoQ5fDFAz6tu7hzs@private-ameciclo-postgres-db-do-user-18311227-0.i.db.ondigitalocean.com:25060/atlas?sslmode=require" \
  --network kong-gateway_kong-net \
  ghcr.io/ameciclo/atlas/traffic-deaths:latest \
  node apps/traffic-deaths/dist/db/seed.js
```

#### Option B: Using Portainer UI

1. **Go to Portainer** → Containers → Add container

2. **Configure container:**
   - **Name:** `atlas-traffic-deaths-seed-temp`
   - **Image:** `ghcr.io/ameciclo/atlas/traffic-deaths:latest`
   - **Command:** `node apps/traffic-deaths/dist/db/seed.js`
   - **Network:** `kong-gateway_kong-net`
   - **Restart policy:** `Never`

3. **Add volume:**
   - **Container path:** `/app/apps/traffic-deaths/src/db`
   - **Host path:** `/data/traffic-deaths`

4. **Add environment variables:**
   - `DATABASE_URL`: Your PostgreSQL connection string (with `?sslmode=require`)
   - `NODE_ENV`: `production`

5. **Deploy container**

6. **Monitor logs:**
   - Go to container logs
   - Watch for progress:
     ```
     🚀 Starting traffic deaths data seeding...
     📦 Batch ID: seed-2025-10-29T...
     
     📂 Reading CSV file: .../mortes_transito_2015.csv
     📊 Parsing CSV data for year 2015...
        Found 35,000 records
     💾 Inserting records into database...
        Inserted 1000/35000 records...
        Inserted 2000/35000 records...
     ...
     ✅ Year 2015 completed: 35000 inserted, 0 errors
     
     [Repeats for years 2016-2023]
     
     ============================================================
     🎉 Seeding completed successfully!
        Total records inserted: 320,320
        Total errors: 0
     ============================================================
     ```

7. **Verify completion:**
   - Container should exit with code 0
   - Check database:
     ```sql
     SELECT COUNT(*) FROM traffic_deaths;
     -- Should return ~320,320
     
     SELECT data_year, COUNT(*) 
     FROM traffic_deaths 
     GROUP BY data_year 
     ORDER BY data_year;
     -- Should show counts for 2015-2023
     ```

8. **Remove temporary container:**
   - Portainer → Containers → atlas-traffic-deaths-seed-temp → Remove

---

## Expected Seeding Time

| Records | Time (Estimated) |
|---------|------------------|
| 320,320 | 2-5 minutes |

Factors affecting speed:
- Database connection speed
- Server CPU/memory
- Network latency (if using managed database)

---

## Troubleshooting

### Issue: "CSV file not found"

**Cause:** Volume mount incorrect or files not uploaded

**Solution:**
```bash
# Check files exist on server
ssh user@server "ls -lh /data/traffic-deaths/"

# Verify volume mount in container
docker exec atlas-traffic-deaths-seed-temp ls -lh /app/apps/traffic-deaths/src/db/
```

### Issue: "Database connection failed"

**Cause:** DATABASE_URL incorrect or network issue

**Solution:**
```bash
# Test database connection
docker run --rm \
  -e DATABASE_URL="your-connection-string" \
  --network kong-gateway_kong-net \
  postgres:16-alpine \
  psql "$DATABASE_URL" -c "SELECT 1;"
```

### Issue: "SSL certificate verification failed"

**Cause:** Missing `sslmode=require` in DATABASE_URL

**Solution:**
```bash
# Ensure DATABASE_URL includes sslmode parameter
# Correct format:
DATABASE_URL="postgresql://user:pass@host:5432/atlas?sslmode=require"

# For DigitalOcean managed databases, sslmode=require is sufficient
# No need for custom CA certificates
```

### Issue: Seeding stops mid-way

**Cause:** Container killed due to memory limits or timeout

**Solution:**
```bash
# Increase memory limit when creating container
# In Portainer: Advanced container settings → Resources → Memory limit: 1GB

# Or via CLI:
docker run --rm \
  --memory=1g \
  -v /data/traffic-deaths:/app/apps/traffic-deaths/src/db \
  ...
```

### Issue: Duplicate key errors

**Cause:** Data already seeded

**Solution:**
```bash
# Check if data exists
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM traffic_deaths;"

# If you need to re-seed, truncate table first:
psql "$DATABASE_URL" -c "TRUNCATE TABLE traffic_deaths;"
```

---

## Verification

After seeding, verify the data:

```sql
-- Total records
SELECT COUNT(*) FROM traffic_deaths;
-- Expected: ~320,320

-- Records by year
SELECT data_year, COUNT(*) as total
FROM traffic_deaths
GROUP BY data_year
ORDER BY data_year;

-- Cyclist deaths (CID-10: V10-V19)
SELECT COUNT(*) FROM traffic_deaths
WHERE causabas LIKE 'V1%';
-- Expected: ~12,189 (3.81% of total)

-- Sample record
SELECT * FROM traffic_deaths LIMIT 1;
```

---

## Cleanup

After successful seeding:

1. **Remove CSV files from server** (optional, to save space):
   ```bash
   ssh user@server "rm -rf /data/traffic-deaths"
   ```

2. **Remove temporary container** (if using Portainer UI):
   - Portainer → Containers → atlas-traffic-deaths-seed-temp → Remove

3. **Verify API works:**
   ```bash
   # Via Kong Gateway
   curl https://your-domain.com/api/traffic-deaths/health
   curl https://your-domain.com/api/traffic-deaths/v1/summary
   
   # Or directly (if exposed)
   curl http://atlas-traffic-deaths:3003/health
   curl http://atlas-traffic-deaths:3003/v1/summary
   ```

---

## Future Updates

If you need to update the data (e.g., add 2024 data):

1. Add new CSV file: `mortes_transito_2024.csv`
2. Update seed script to include 2024
3. Upload new CSV to server
4. Run seed container again (it will skip existing years)

Or use incremental seeding:

```typescript
// Modify seed.ts to only seed specific years
const years = [2024]; // Only new year
```

---

## Notes

- ✅ Seeding is **idempotent** - running it multiple times won't create duplicates (uses `onConflictDoNothing()`)
- ✅ Data is **version-controlled** - CSV files are in git repository
- ✅ Seeding is **separate from deployment** - App can run without data (will return empty results)
- ⚠️ **Large dataset** - 320K records, ~97 MB in database
- ⚠️ **One-time operation** - Only needed for initial deployment

---

## See Also

- [Traffic Deaths API Documentation](../../apps/traffic-deaths/README.md)
- [Database Schema](../../packages/database/src/schemas/traffic-deaths/schema.ts)
- [Seed Script](../../apps/traffic-deaths/src/db/seed.ts)

