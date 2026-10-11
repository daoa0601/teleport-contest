// Use the judge-owned adapters without overwriting the working tree.
// Keep the js/ URL so relative imports, including storage's gstate, retain
// the same module identity as the physical overlay in frozen/score.sh.
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
const replacements = new Map(['isaac64.js', 'terminal.js', 'storage.js'].map(name => [
    new URL(`../../js/${name}`, import.meta.url).href,
    new URL(`../../frozen/${name}`, import.meta.url),
]));
registerHooks({
    load(url, context, nextLoad) {
        const frozen = replacements.get(url);
        if (!frozen)
            return nextLoad(url, context);
        return { format: 'module', source: readFileSync(frozen, 'utf8'), shortCircuit: true };
    },
});
//# sourceMappingURL=frozen-adapters.mjs.map