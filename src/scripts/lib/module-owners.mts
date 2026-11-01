// module-owners.mts — the C files each port module's mapped functions come from.
//
// The `edges` report names, for every C function with a port counterpart, the
// port functions it maps to (same name, an alias, or a `name()` citation).
// Folded by module, that answers the structure question the consolidation
// units work towards: which C file a module ports, and where its functions
// stray into other C files. A module that ports exactly one C file is a
// predictable landing spot for a C change; `module-owners.tsv` freezes those,
// so a module that was single-owner and gains a function from another C file
// loses its ledger entry and fails the check.

// A C function and the port counterparts the edges mapping found for it,
// located as `src/js/file.ts:line`.
export interface OwnerEdge {
    file: string;
    function: string;
    port: string[];
}

// A module counts as mixed beyond tolerance once it holds more minority
// functions than this; one or two strays are still listed, but as nearly
// single-owner rather than a structure problem.
export const MIXED_TOLERANCE = 2;

export interface ModuleOwnerRow {
    module: string;
    // Distinct C functions mapped into the module.
    mapped: number;
    // C files those functions come from, most functions first.
    counts: { file: string; count: number }[];
    dominant: string;
    // The C functions from every other C file, with their file.
    minority: { file: string; functions: string[] }[];
    beyondTolerance: boolean;
}

export interface CFileSpreadRow {
    file: string;
    // Distinct C functions of this file that have port counterparts at all.
    mapped: number;
    // Modules holding at least one of them, most functions first.
    modules: { module: string; count: number }[];
}

export interface OwnershipReport {
    modules: ModuleOwnerRow[];
    cFiles: CFileSpreadRow[];
    // `module<TAB>C file` for modules whose mapped functions all come from
    // one C file: the rows of docs/ledger/module-owners.tsv.
    singleOwnerKeys: string[];
}

// `src/js/foo.ts:123` -> `src/js/foo.ts`.
function moduleOf(location: string): string {
    const cut = location.lastIndexOf(':');
    return cut < 0 ? location : location.slice(0, cut);
}

export function moduleOwnership(edges: readonly OwnerEdge[]): OwnershipReport {
    // module -> C file -> the C functions mapped into it there.
    const byModule = new Map<string, Map<string, Set<string>>>();
    for (const edge of edges) {
        for (const location of edge.port) {
            const module = moduleOf(location);
            const ofModule = byModule.get(module) ?? new Map<string, Set<string>>();
            byModule.set(module, ofModule);
            ofModule.set(edge.file, new Set([...(ofModule.get(edge.file) ?? []), edge.function]));
        }
    }

    const modules: ModuleOwnerRow[] = [];
    // C file -> the modules holding its functions, and every mapped function
    // of the file once (a function mapped into two modules is spread, not two).
    const byCFile = new Map<string, { functions: Set<string>; spread: Map<string, number> }>();
    for (const [module, ofModule] of byModule) {
        const counts = [...ofModule]
            .map(([file, functions]) => ({ file, count: functions.size }))
            .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));
        const dominant = counts[0]?.file ?? '';
        const minority = counts
            .filter(entry => entry.file !== dominant)
            .map(entry => ({ file: entry.file, functions: [...(ofModule.get(entry.file) ?? [])].sort() }));
        const strays = minority.reduce((total, entry) => total + entry.functions.length, 0);
        modules.push({
            module,
            mapped: counts.reduce((total, entry) => total + entry.count, 0),
            counts,
            dominant,
            minority,
            beyondTolerance: strays > MIXED_TOLERANCE,
        });
        for (const { file, count } of counts) {
            const entry = byCFile.get(file) ?? { functions: new Set<string>(), spread: new Map<string, number>() };
            byCFile.set(file, entry);
            entry.functions = new Set([...entry.functions, ...(ofModule.get(file) ?? [])]);
            entry.spread.set(module, (entry.spread.get(module) ?? 0) + count);
        }
    }
    modules.sort((a, b) => b.mapped - a.mapped || a.module.localeCompare(b.module));

    const cFiles: CFileSpreadRow[] = [...byCFile]
        .map(([file, { functions, spread }]) => ({
            file,
            mapped: functions.size,
            modules: [...spread]
                .map(([module, count]) => ({ module, count }))
                .sort((a, b) => b.count - a.count || a.module.localeCompare(b.module)),
        }))
        .sort((a, b) => b.modules.length - a.modules.length || a.mapped - b.mapped
            || a.file.localeCompare(b.file));

    const singleOwnerKeys = modules
        .filter(row => row.minority.length === 0)
        .map(row => `${row.module}\t${row.dominant}`)
        .sort();
    return { modules, cFiles, singleOwnerKeys };
}
