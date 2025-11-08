# Ciclodados API

API service for comprehensive cyclist data analysis and street information retrieval.

## Overview

The Ciclodados API provides intelligent street search and comprehensive cyclist data aggregation for the Atlas platform. It serves as a central hub for retrieving street information, traffic data, cycling infrastructure, and nearby amenities based on street names or geographic coordinates.

## Core Features

### 1. Street Search & Matching
- Fuzzy search for street names in `pcr_streets`
- Returns best matches with confidence scores
- Handles typos and partial matches

### 2. Complete Street Information
- Full street data including geometry (GeoJSON)
- Street metadata and attributes
- Geographic boundaries and coordinates

### 3. Traffic Data Integration
- Traffic violations data by street
- Traffic crashes information
- Historical incident patterns

### 4. Nearby Amenities & Infrastructure
- Cycling counts within configurable buffer
- Cyclist profile data
- Cycling infrastructure (bike lanes, paths)
- Shared bicycle stations
- Bike racks locations

### 5. Point-based Analysis
- Reverse geocoding from coordinates
- Nearby streets discovery
- Comprehensive area analysis

## API Endpoints

### Street Search Endpoints

#### `GET /streets/search`
Fuzzy search for streets by name.

**Parameters:**
- `q` (string, required): Search query
- `limit` (number, optional): Max results (default: 10)

**Response:**
```json
{
  "matches": [
    {
      "id": "street_id",
      "name": "RUA EXAMPLE",
      "confidence": 0.95,
      "municipality": "Recife"
    }
  ]
}
```

#### `GET /streets/{streetId}`
Get complete street information including geometry.

**Parameters:**
- `streetId` (string, required): Street identifier

**Response:**
```json
{
  "id": "street_id",
  "name": "RUA EXAMPLE",
  "geometry": { "type": "LineString", "coordinates": [...] },
  "properties": { ... }
}
```

### Traffic Data Endpoints

#### `GET /streets/{streetId}/traffic-violations`
Get traffic violations for a specific street.

#### `GET /streets/{streetId}/traffic-crashes`
Get traffic crashes for a specific street.

### Nearby Data Endpoints

#### `GET /streets/{streetId}/nearby`
Get all nearby cycling-related data within buffer.

**Parameters:**
- `buffer` (number, optional): Buffer distance in meters (default: 50)

**Response:**
```json
{
  "cycling_counts": [...],
  "cycling_profile": [...],
  "cycle_infra": [...],
  "shared_bicycles": [...],
  "bike_racks": [...]
}
```

### Point-based Analysis

#### `POST /analyze/point`
Analyze area around a geographic point.

**Body:**
```json
{
  "lat": -8.0476,
  "lng": -34.8770,
  "buffer": 100
}
```

**Response:**
```json
{
  "nearby_streets": [...],
  "traffic_data": {...},
  "cycling_data": {...}
}
```

## Database Tables Used

- `pcr_streets` - Street geometries and names
- `traffic_violations` - Traffic violation incidents
- `traffic_crashes` - Traffic crash data
- `cycling_counts` - Bicycle counting data
- `cycling_profile` - Cyclist profile information
- `cycle_infra` - Cycling infrastructure
- `shared_bicycles` - Shared bicycle stations
- `bike_racks` - Bicycle parking facilities

## Implementation Plan

### Phase 1: Core Street Search ✅
- [x] Project scaffolding created
- [x] Database connection setup
- [x] Street search endpoint (`/streets/search`)
- [x] Fuzzy matching algorithm
- [x] Basic error handling
- [x] OpenAPI documentation generated

### Phase 2: Street Details ✅
- [x] Street details endpoint (`/streets/{streetId}`)
- [x] GeoJSON geometry response
- [x] Street metadata integration

### Phase 3: Traffic Data Integration ⏳
- [ ] Traffic violations endpoint
- [ ] Traffic crashes endpoint
- [ ] Data aggregation by street name

### Phase 4: Nearby Data Services ⏳
- [ ] Nearby data endpoint with buffer
- [ ] Cycling counts integration
- [ ] Cycling profile data
- [ ] Infrastructure data
- [ ] Shared bicycles data
- [ ] Bike racks data

### Phase 5: Point Analysis ✅
- [x] Point analysis endpoint
- [x] Reverse geocoding (basic)
- [x] Area-based data aggregation (structure)
- [x] Comprehensive response formatting

### Phase 6: Optimization & Testing ⏳
- [ ] Performance optimization
- [ ] Caching implementation
- [ ] Comprehensive test suite
- [x] API documentation
- [x] Error handling improvements

## Technical Considerations

### Performance
- Implement spatial indexing for geographic queries
- Cache frequently accessed street data
- Optimize buffer queries with PostGIS

### Data Quality
- Handle missing or incomplete street data
- Validate geographic coordinates
- Implement confidence scoring for matches

### Scalability
- Paginate large result sets
- Implement rate limiting
- Monitor query performance

## Configuration

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string
- `DEFAULT_BUFFER_METERS` - Default buffer distance (50)
- `MAX_SEARCH_RESULTS` - Maximum search results (100)
- `CACHE_TTL_SECONDS` - Cache time-to-live (3600)

### Buffer Distances
- Default: 50 meters
- Minimum: 10 meters  
- Maximum: 500 meters
- Configurable per request

## Error Handling

- 400: Invalid parameters
- 404: Street not found
- 422: Invalid coordinates
- 500: Database/server errors

## Future Enhancements

- Real-time traffic data integration
- Machine learning for better street matching
- Historical data analysis
- Mobile-optimized responses
- Batch processing endpoints