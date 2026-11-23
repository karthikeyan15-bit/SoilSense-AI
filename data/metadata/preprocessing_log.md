# SoilSense AI — Dataset Preprocessing & Quality Log

## Governance Rules Applied
1. Raw datasets under `data/raw/` are strictly immutable and never modified in place.
2. Datasets A through F are kept isolated by domain responsibility and are never merged without verified unit and extraction-method compatibility.
3. All-India soil validation checks verify:
   - Missing value counts per column
   - Exact and geographic-temporal duplicate detection (`state + district + village + fiscal_year + pH + N + P + K`)
   - Physiological and geographic outlier flags (e.g., pH outside `[3.0, 10.5]`, India lat/lng outside `[6.5–37.5°N, 68.0–97.5°E]`)
   - Strict unit separation (`kg/ha` vs `mg/kg` / `ppm`)
4. Geographical and temporal holdout splits are enforced for any downstream regional analytics or ML benchmarking.

## All-India National Sample Validation Summary
- Reference sample (`data/raw/soil_health_india/national_pilot_sample.csv`) contains curated multi-state records across 13 Indian states (Punjab, Haryana, Uttar Pradesh, Bihar, West Bengal, Assam, Madhya Pradesh, Rajasthan, Gujarat, Maharashtra, Karnataka, Tamil Nadu, and Kerala) plus intentional QA edge cases (missing micronutrients, exact duplicate record, and pH 11.9 outlier) exercised by the automated validation pipeline.
