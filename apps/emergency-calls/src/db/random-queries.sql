-- Random queries to test emergency_calls database structure
-- Run these to validate data quality and explore the dataset

-- Basic counts and overview
SELECT COUNT(*) as total_records FROM emergency_calls;

SELECT COUNT(DISTINCT municipality) as unique_municipalities FROM emergency_calls;

SELECT COUNT(DISTINCT subtype) as unique_subtypes FROM emergency_calls;

-- Top municipalities by call volume
SELECT 
    municipality, 
    COUNT(*) as call_count
FROM emergency_calls 
WHERE municipality IS NOT NULL
GROUP BY municipality 
ORDER BY call_count DESC 
LIMIT 10;

-- Most common accident types
SELECT 
    subtype, 
    COUNT(*) as count
FROM emergency_calls 
WHERE subtype IS NOT NULL
GROUP BY subtype 
ORDER BY count DESC 
LIMIT 10;

-- Gender distribution
SELECT 
    gender, 
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emergency_calls), 2) as percentage
FROM emergency_calls 
GROUP BY gender 
ORDER BY count DESC;

-- Age distribution (by ranges)
SELECT 
    CASE 
        WHEN age IS NULL THEN 'Unknown'
        WHEN age = 0 THEN 'Not specified'
        WHEN age BETWEEN 1 AND 17 THEN '1-17 (Minor)'
        WHEN age BETWEEN 18 AND 30 THEN '18-30 (Young Adult)'
        WHEN age BETWEEN 31 AND 50 THEN '31-50 (Adult)'
        WHEN age BETWEEN 51 AND 70 THEN '51-70 (Middle Age)'
        WHEN age > 70 THEN '70+ (Senior)'
    END as age_range,
    COUNT(*) as count
FROM emergency_calls 
GROUP BY age_range 
ORDER BY count DESC;

-- Calls by year
SELECT 
    EXTRACT(YEAR FROM date) as year,
    COUNT(*) as calls
FROM emergency_calls 
GROUP BY year 
ORDER BY year;

-- Calls by month (seasonal analysis)
SELECT 
    EXTRACT(MONTH FROM date) as month,
    TO_CHAR(date, 'Month') as month_name,
    COUNT(*) as calls
FROM emergency_calls 
GROUP BY month, month_name
ORDER BY month;

-- Calls by hour (time analysis)
SELECT 
    SUBSTRING(time_minute FROM 1 FOR POSITION(':' IN time_minute) - 1)::INTEGER as hour,
    COUNT(*) as calls
FROM emergency_calls 
WHERE time_minute ~ '^[0-9]+:'
GROUP BY hour 
ORDER BY hour;

-- Top neighborhoods in Recife
SELECT 
    neighborhood,
    COUNT(*) as call_count
FROM emergency_calls 
WHERE municipality = 'RECIFE' AND neighborhood IS NOT NULL
GROUP BY neighborhood 
ORDER BY call_count DESC 
LIMIT 15;

-- Outcome analysis
SELECT 
    outcome_category,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM emergency_calls WHERE outcome_category IS NOT NULL), 2) as percentage
FROM emergency_calls 
WHERE outcome_category IS NOT NULL
GROUP BY outcome_category 
ORDER BY count DESC;

-- Call origin analysis
SELECT 
    call_origin,
    COUNT(*) as count
FROM emergency_calls 
WHERE call_origin IS NOT NULL
GROUP BY call_origin 
ORDER BY count DESC;

-- Motorcycle accidents by municipality (top 10)
SELECT 
    municipality,
    COUNT(*) as motorcycle_accidents
FROM emergency_calls 
WHERE subtype = 'ACIDENTMOTO' AND municipality IS NOT NULL
GROUP BY municipality 
ORDER BY motorcycle_accidents DESC 
LIMIT 10;

-- Car vs Motorcycle accidents
SELECT 
    CASE 
        WHEN subtype = 'ACIDENTCARRO' THEN 'Car Accident'
        WHEN subtype = 'ACIDENTMOTO' THEN 'Motorcycle Accident'
        WHEN subtype = 'ACIDENTBIKE' THEN 'Bicycle Accident'
        WHEN subtype LIKE 'ATROPEL%' THEN 'Pedestrian Hit'
        ELSE 'Other'
    END as accident_type,
    COUNT(*) as count
FROM emergency_calls 
WHERE subtype IS NOT NULL
GROUP BY accident_type 
ORDER BY count DESC;

-- Fatal outcomes
SELECT 
    municipality,
    COUNT(*) as fatal_cases
FROM emergency_calls 
WHERE outcome_reason LIKE '%bito%' AND municipality IS NOT NULL
GROUP BY municipality 
ORDER BY fatal_cases DESC 
LIMIT 10;

-- Weekend vs Weekday analysis
SELECT 
    CASE 
        WHEN EXTRACT(DOW FROM date) IN (0, 6) THEN 'Weekend'
        ELSE 'Weekday'
    END as day_type,
    COUNT(*) as calls
FROM emergency_calls 
GROUP BY day_type;

-- Data quality check - null values
SELECT 
    'municipality' as field, COUNT(*) as null_count FROM emergency_calls WHERE municipality IS NULL
UNION ALL
SELECT 'neighborhood', COUNT(*) FROM emergency_calls WHERE neighborhood IS NULL
UNION ALL
SELECT 'address', COUNT(*) FROM emergency_calls WHERE address IS NULL
UNION ALL
SELECT 'gender', COUNT(*) FROM emergency_calls WHERE gender IS NULL
UNION ALL
SELECT 'age', COUNT(*) FROM emergency_calls WHERE age IS NULL
ORDER BY null_count DESC;

-- Most dangerous streets in Recife (by total accidents)
SELECT 
    COALESCE(pcr_address, address) as street,
    COUNT(*) as total_accidents,
    COUNT(CASE WHEN outcome_reason LIKE '%bito%' THEN 1 END) as fatal_cases,
    ROUND(COUNT(CASE WHEN outcome_reason LIKE '%bito%' THEN 1 END) * 100.0 / COUNT(*), 2) as fatality_rate
FROM emergency_calls 
WHERE municipality = 'RECIFE' 
    AND (pcr_address IS NOT NULL OR address IS NOT NULL)
    AND (pcr_address != '' OR address != '')
GROUP BY COALESCE(pcr_address, address)
HAVING COUNT(*) >= 5  -- Only streets with 5+ accidents
ORDER BY total_accidents DESC 
LIMIT 20;

-- Most dangerous streets in Recife (by fatality rate)
SELECT 
    COALESCE(pcr_address, address) as street,
    COUNT(*) as total_accidents,
    COUNT(CASE WHEN outcome_reason LIKE '%bito%' THEN 1 END) as fatal_cases,
    ROUND(COUNT(CASE WHEN outcome_reason LIKE '%bito%' THEN 1 END) * 100.0 / COUNT(*), 2) as fatality_rate
FROM emergency_calls 
WHERE municipality = 'RECIFE' 
    AND (pcr_address IS NOT NULL OR address IS NOT NULL)
    AND (pcr_address != '' OR address != '')
GROUP BY COALESCE(pcr_address, address)
HAVING COUNT(*) >= 3 AND COUNT(CASE WHEN outcome_reason LIKE '%bito%' THEN 1 END) > 0
ORDER BY fatality_rate DESC, total_accidents DESC 
LIMIT 15;

-- Recent data sample
SELECT 
    date,
    time_minute,
    municipality,
    neighborhood,
    subtype,
    gender,
    age,
    outcome_category
FROM emergency_calls 
ORDER BY date DESC, time_minute DESC 
LIMIT 20;