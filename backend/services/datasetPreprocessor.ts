import fs from 'fs';
import path from 'path';

export interface KarnatakaPreprocessingQualitySummary {
  sourceFile: string;
  processedAt: string;
  totalRawRows: number;
  validCleanedRows: number;
  duplicateRowsRemoved: number;
  outlierRowsFlagged: number;
  missingValueCounts: Record<string, number>;
  unitConsistencyVerified: boolean;
  districtsCovered: string[];
  statesCovered: string[];
  anomalies: Array<{ rowNumber: number; state: string; district: string; village: string; reason: string }>;
}

export function runKarnatakaDatasetValidation(
  rawCsvPath = path.resolve(process.cwd(), 'data', 'raw', 'soil_health_india', 'national_pilot_sample.csv'),
  writeProcessedOutputs = true,
): KarnatakaPreprocessingQualitySummary {
  if (!fs.existsSync(rawCsvPath)) {
    throw new Error(`Raw All-India dataset not found at ${rawCsvPath}`);
  }

  const content = fs.readFileSync(rawCsvPath, 'utf-8').trim();
  const lines = content.split(/\r?\n/);
  const headers = lines[0].split(',').map((h) => h.trim());

  const missingValueCounts: Record<string, number> = {};
  for (const h of headers) missingValueCounts[h] = 0;

  const seenFingerprints = new Set<string>();
  const cleanedLines: string[] = [headers.join(',')];
  const anomalies: Array<{ rowNumber: number; state: string; district: string; village: string; reason: string }> = [];
  const districts = new Set<string>();
  const states = new Set<string>();

  let duplicateRowsRemoved = 0;
  let outlierRowsFlagged = 0;
  let unitConsistencyVerified = true;

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      const val = (cols[idx] ?? '').trim();
      row[h] = val;
      if (val === '') {
        missingValueCounts[h] = (missingValueCounts[h] ?? 0) + 1;
      }
    });

    if (row.district) districts.add(row.district);
    if (row.state) states.add(row.state);

    if (row.unit_npk && row.unit_npk.toLowerCase() !== 'kg/ha') {
      unitConsistencyVerified = false;
      anomalies.push({
        rowNumber: i + 1,
        state: row.state,
        district: row.district,
        village: row.village,
        reason: `Incompatible NPK unit "${row.unit_npk}" (expected kg/ha).`,
      });
    }

    const fingerprint = `${row.fiscal_year}|${row.state}|${row.district}|${row.village}|${row.ph}|${row.nitrogen}|${row.phosphorus}|${row.potassium}`;
    if (seenFingerprints.has(fingerprint)) {
      duplicateRowsRemoved += 1;
      anomalies.push({
        rowNumber: i + 1,
        state: row.state,
        district: row.district,
        village: row.village,
        reason: 'Exact geographic-temporal duplicate record removed.',
      });
      continue;
    }
    seenFingerprints.add(fingerprint);

    const ph = Number(row.ph);
    const lat = Number(row.latitude);
    const lon = Number(row.longitude);

    let hasOutlier = false;
    if (!Number.isFinite(ph) || ph < 3.0 || ph > 10.5) {
      hasOutlier = true;
      anomalies.push({
        rowNumber: i + 1,
        state: row.state,
        district: row.district,
        village: row.village,
        reason: `Out-of-range soil pH (${row.ph}); valid agronomic bounds are 3.0–10.5.`,
      });
    }
    // All-India geographic bounding box: lat 6.5–37.5 N, lon 68.0–97.5 E
    if (Number.isFinite(lat) && (lat < 6.5 || lat > 37.5)) {
      hasOutlier = true;
      anomalies.push({
        rowNumber: i + 1,
        state: row.state,
        district: row.district,
        village: row.village,
        reason: `Latitude (${lat}) outside India geographic bounds [6.5, 37.5].`,
      });
    }
    if (Number.isFinite(lon) && (lon < 68.0 || lon > 97.5)) {
      hasOutlier = true;
      anomalies.push({
        rowNumber: i + 1,
        state: row.state,
        district: row.district,
        village: row.village,
        reason: `Longitude (${lon}) outside India geographic bounds [68.0, 97.5].`,
      });
    }

    if (hasOutlier) {
      outlierRowsFlagged += 1;
      continue;
    }

    cleanedLines.push(line);
  }

  const summary: KarnatakaPreprocessingQualitySummary = {
    sourceFile: 'data/raw/soil_health_india/national_pilot_sample.csv',
    processedAt: new Date().toISOString(),
    totalRawRows: Math.max(0, lines.length - 1),
    validCleanedRows: cleanedLines.length - 1,
    duplicateRowsRemoved,
    outlierRowsFlagged,
    missingValueCounts,
    unitConsistencyVerified,
    districtsCovered: Array.from(districts).sort(),
    statesCovered: Array.from(states).sort(),
    anomalies,
  };

  if (writeProcessedOutputs && process.env.VERCEL !== '1') {
    try {
      const processedDir = path.resolve(process.cwd(), 'data', 'processed', 'soil_health');
      if (!fs.existsSync(processedDir)) {
        fs.mkdirSync(processedDir, { recursive: true });
      }
      fs.writeFileSync(path.join(processedDir, 'india_national_cleaned.csv'), cleanedLines.join('\n') + '\n');
      fs.writeFileSync(path.join(processedDir, 'quality_summary.json'), JSON.stringify(summary, null, 2));
    } catch (err) {
      console.warn('Could not write processed dataset output:', err instanceof Error ? err.message : err);
    }
  }

  return summary;
}

if (process.argv[1] && process.argv[1].includes('datasetPreprocessor')) {
  const result = runKarnatakaDatasetValidation();
  console.log('All-India Soil Health Dataset Validation Complete:');
  console.log(JSON.stringify(result, null, 2));
}
