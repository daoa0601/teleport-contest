import { readFileSync, writeFileSync } from 'node:fs';
import { arrayValue, booleanValue, numberValue, objectValue, stringValue } from './lib/session-types.mjs';
function main() {
    const output = readFileSync('score-stdout.txt', 'utf8');
    const marker = '__RESULTS_JSON__';
    const position = output.lastIndexOf(marker);
    if (position < 0)
        throw new Error('The scorer did not write a results bundle.');
    const parsed = JSON.parse(output.slice(position + marker.length).trim());
    const bundle = decodeBundle(parsed);
    const passed = bundle.results.filter(result => result.passed).length;
    const total = bundle.results.length;
    const matchedCalls = bundle.results.reduce((sum, result) => sum + (result.rng?.matched ?? 0), 0);
    const totalCalls = bundle.results.reduce((sum, result) => sum + (result.rng?.total || 1), 0);
    const summary = {
        passed, total,
        rngPct: total ? (matchedCalls / totalCalls * 100).toFixed(1) : '0.0',
        timestamp: bundle.timestamp,
    };
    console.log(JSON.stringify(summary));
    writeFileSync('score-summary.json', JSON.stringify({ ...summary, results: bundle.results }, null, 2));
}
function decodeBundle(value) {
    const bundle = objectValue(value, 'score bundle');
    const results = arrayValue(bundle.results, 'score results').map((value, index) => {
        const result = objectValue(value, `result ${index}`);
        const metrics = result.metrics === undefined ? {} : objectValue(result.metrics, `result ${index} metrics`);
        const row = {
            session: stringValue(result.session, `result ${index} session`),
            passed: booleanValue(result.passed, `result ${index} passed`),
        };
        if (metrics.rngCalls !== undefined)
            row.rng = decodeMetric(metrics.rngCalls, 'random calls');
        if (metrics.screens !== undefined)
            row.screen = decodeMetric(metrics.screens, 'screens');
        if (metrics.cursors !== undefined)
            row.cursor = decodeMetric(metrics.cursors, 'cursors');
        return row;
    });
    return { timestamp: stringValue(bundle.timestamp, 'score timestamp'), results };
}
function decodeMetric(value, name) {
    const metric = objectValue(value, name);
    return {
        matched: numberValue(metric.matched, `${name} matched`),
        total: numberValue(metric.total, `${name} total`),
    };
}
main();
//# sourceMappingURL=summarize-score.mjs.map