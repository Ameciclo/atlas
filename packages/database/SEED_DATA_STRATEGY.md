# Seed Data Strategy: Git + S3 Hybrid Approach

## Overview

This document outlines a hybrid approach for managing seed data:
- **Seed scripts and metadata** stay in Git (reproducible, auditable)
- **Large data files** are stored in S3 (scalable, no repo bloat)
- **Manifest file** tracks all data sources and versions

This approach provides the best of both worlds: reproducibility + scalability.

---

## Architecture

### Current State (Git-only)
```
packages/database/
├── src/
│   ├── seed-traffic-deaths.ts
│   ├── seed-cyclist-profiles.ts
│   └── seed-cyclist-counts.ts
├── seed-data/
│   ├── traffic-deaths/
│   │   └── mortes_transito_*.csv    ← Large files in git
│   ├── cyclist-profiles/
│   │   └── data.json
│   └── cyclist-counts/
│       └── data.json
```

### Future State (Git + S3 Hybrid)
```
packages/database/
├── src/
│   ├── seed-traffic-deaths.ts       ← Script (unchanged)
│   ├── seed-cyclist-profiles.ts     ← Script (unchanged)
│   ├── seed-cyclist-counts.ts       ← Script (unchanged)
│   └── utils/
│       └── seed-data-loader.ts      ← NEW: Downloads from S3
├── seed-data/
│   ├── manifest.json                ← NEW: Metadata for all datasets
│   ├── .cache/                      ← NEW: Local cache (gitignored)
│   ├── traffic-deaths/              ← Keep small files in git
│   │   └── metadata.json            ← NEW: Schema, checksums
│   ├── cyclist-profiles/
│   │   └── data.json
│   └── cyclist-counts/
│       └── data.json
```

---

## The Manifest File

### Purpose
The manifest is a **single source of truth** for all seed data:
- Where data is stored (Git or S3)
- What version is current
- How to validate data integrity
- Metadata about the dataset

### Structure

**File:** `packages/database/seed-data/manifest.json`

```json
{
  "version": "1.0",
  "lastUpdated": "2024-10-30",
  "datasets": {
    "traffic-deaths": {
      "name": "Traffic Deaths (DATASUS)",
      "description": "Brazilian traffic mortality data 2015-2023",
      "storage": "s3",
      "s3": {
        "bucket": "atlas-seed-data",
        "prefix": "traffic-deaths/",
        "files": [
          {
            "name": "mortes_transito_2015-2023.zip",
            "key": "traffic-deaths/mortes_transito_2015-2023.zip",
            "size": "97 MB",
            "checksum": "sha256:abc123def456...",
            "version": "2024-01",
            "uploadedAt": "2024-01-15T10:30:00Z"
          }
        ]
      },
      "local": {
        "cachePath": "seed-data/.cache/traffic-deaths/",
        "ttl": 2592000000
      },
      "metadata": {
        "recordCount": 320000,
        "years": [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023],
        "format": "csv",
        "encoding": "utf-8"
      }
    },
    "cyclist-profiles": {
      "name": "Cyclist Profiles",
      "description": "Sample cyclist profile data",
      "storage": "git",
      "git": {
        "path": "seed-data/cyclist-profiles/data.json",
        "checksum": "sha256:xyz789..."
      },
      "metadata": {
        "recordCount": 500,
        "format": "json"
      }
    },
    "cyclist-counts": {
      "name": "Cyclist Counts",
      "description": "Cyclist counting event data",
      "storage": "git",
      "git": {
        "path": "seed-data/cyclist-counts/data.json",
        "checksum": "sha256:uvw456..."
      },
      "metadata": {
        "recordCount": 8923,
        "format": "json"
      }
    }
  }
}
```

### Manifest Fields Explained

| Field | Purpose |
|-------|---------|
| `version` | Manifest schema version (for future compatibility) |
| `lastUpdated` | When manifest was last updated |
| `datasets` | Map of all seed datasets |
| `storage` | Where data is stored: `"git"` or `"s3"` |
| `s3.bucket` | S3 bucket name |
| `s3.prefix` | S3 folder prefix |
| `s3.files` | Array of files in S3 |
| `checksum` | SHA256 hash for integrity verification |
| `version` | Data version (e.g., "2024-01" for Jan 2024) |
| `local.cachePath` | Where to cache downloaded files |
| `local.ttl` | Cache time-to-live in milliseconds |
| `metadata` | Dataset-specific info (record count, format, etc.) |

---

## Implementation Plan

### Phase 1: Add Data Loader Utility (Week 1)

**File:** `packages/database/src/utils/seed-data-loader.ts`

```typescript
interface DataSource {
  storage: 'git' | 's3';
  path?: string;           // For git
  s3?: S3Config;          // For s3
  cachePath?: string;
  ttl?: number;
}

class SeedDataLoader {
  async loadData(datasetId: string): Promise<Buffer> {
    // 1. Load manifest
    // 2. Get dataset config
    // 3. If git: read from filesystem
    // 4. If s3: check cache, download if needed, verify checksum
    // 5. Return data
  }

  private async downloadFromS3(config: S3Config): Promise<Buffer> {
    // Download from S3
    // Verify checksum
    // Cache locally
  }

  private async verifyChecksum(data: Buffer, expected: string): Promise<boolean> {
    // Verify SHA256 checksum
  }

  private isCacheValid(cachePath: string, ttl: number): boolean {
    // Check if cached file exists and is fresh
  }
}
```

### Phase 2: Update Seed Scripts (Week 1-2)

Modify existing seed scripts to use the loader:

**Before:**
```typescript
const csvContent = readFileSync(csvPath, "utf-8");
```

**After:**
```typescript
const loader = new SeedDataLoader();
const csvBuffer = await loader.loadData('traffic-deaths');
const csvContent = csvBuffer.toString('utf-8');
```

### Phase 3: Set Up S3 Bucket (Week 2)

**AWS Setup:**
1. Create S3 bucket: `atlas-seed-data`
2. Enable versioning
3. Set up IAM policy for production access
4. Upload DATASUS CSV files (compressed as ZIP)

**IAM Policy Example:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::atlas-seed-data",
        "arn:aws:s3:::atlas-seed-data/*"
      ]
    }
  ]
}
```

### Phase 4: Update Manifest (Week 2)

Update `packages/database/seed-data/manifest.json` with S3 details:
- S3 bucket and keys
- File checksums
- Version information

### Phase 5: Testing & Documentation (Week 3)

- Test downloading from S3
- Test cache behavior
- Test checksum verification
- Update MASTER_SEED_GUIDE.md
- Document S3 setup for team

---

## Migration Timeline

### Immediate (Keep Current)
- ✅ DATASUS data stays in Git for now
- ✅ All seed scripts work as-is
- ✅ No changes needed

### When Ready to Migrate (Optional)
1. Create S3 bucket
2. Upload DATASUS CSV files
3. Add data loader utility
4. Update seed scripts
5. Remove CSV files from Git
6. Update manifest

**No rush** - can do this incrementally as repo grows.

---

## Benefits of This Approach

### Reproducibility
- ✅ Manifest in Git = exact data versions tracked
- ✅ Checksums ensure data integrity
- ✅ Can reproduce any past state

### Scalability
- ✅ S3 handles multi-GB datasets
- ✅ No Git repository bloat
- ✅ Easy to add new large datasets

### Flexibility
- ✅ Small files stay in Git (simple)
- ✅ Large files go to S3 (efficient)
- ✅ Mix and match as needed

### Offline Support
- ✅ Local caching allows offline seeding
- ✅ Cache TTL prevents stale data
- ✅ Works in CI/CD without S3 access (if cached)

### Auditability
- ✅ Manifest tracks all data versions
- ✅ Git history shows when data changed
- ✅ Checksums prevent tampering

---

## Environment Variables

For production S3 access:

```bash
# .env.production
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<production-key>
AWS_SECRET_ACCESS_KEY=<production-secret>
SEED_DATA_S3_BUCKET=atlas-seed-data
SEED_DATA_CACHE_TTL=2592000000  # 30 days in ms
```

For development (optional):
```bash
# .env.development
SEED_DATA_USE_LOCAL_ONLY=true  # Skip S3, use git files only
```

---

## Updating Data

### Adding New Year of DATASUS Data

1. **Get new CSV from DATASUS**
2. **Compress:** `zip mortes_transito_2015-2024.zip mortes_transito_*.csv`
3. **Upload to S3:** `aws s3 cp mortes_transito_2015-2024.zip s3://atlas-seed-data/traffic-deaths/`
4. **Calculate checksum:** `sha256sum mortes_transito_2015-2024.zip`
5. **Update manifest.json:**
   ```json
   {
     "name": "mortes_transito_2015-2024.zip",
     "key": "traffic-deaths/mortes_transito_2015-2024.zip",
     "checksum": "sha256:new-hash-here",
     "version": "2025-01",
     "uploadedAt": "2025-01-15T10:30:00Z"
   }
   ```
6. **Commit manifest to Git**
7. **Run seed:** `pnpm db:seed --only=deaths`

---

## Fallback Strategy

If S3 is unavailable:

```typescript
// In seed-data-loader.ts
async loadData(datasetId: string): Promise<Buffer> {
  try {
    return await this.loadFromS3(datasetId);
  } catch (error) {
    console.warn('S3 unavailable, trying local cache...');
    if (this.hasLocalCache(datasetId)) {
      return this.loadFromCache(datasetId);
    }
    throw new Error(`Cannot load ${datasetId}: S3 unavailable and no cache`);
  }
}
```

---

## Future Enhancements

- **Compression:** Automatically compress large files
- **Incremental updates:** Only download changed files
- **Data validation:** Schema validation before seeding
- **Metrics:** Track download times, cache hits, etc.
- **Multi-region:** Replicate to multiple S3 buckets
- **Encryption:** Encrypt sensitive data at rest

---

## Summary

This hybrid approach gives you:
1. **Simplicity now** - Keep using Git for small files
2. **Scalability later** - Move to S3 when needed
3. **Reproducibility always** - Manifest tracks everything
4. **Flexibility** - Mix Git and S3 as needed

Start with Git, migrate to S3 when your datasets grow beyond ~200 MB total.

