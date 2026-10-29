// port-program.mts — the port's game sources as one type-checked program.

import { join } from 'node:path';
import ts from 'typescript';

let cached: { root: string; program: ts.Program } | null = null;

// `src/js` under the repository's own compiler options, built once per run.
export function portProgram(root: string): ts.Program {
    if (cached?.root === root) return cached.program;
    const configPath = join(root, 'tsconfig.json');
    const read = ts.readConfigFile(configPath, path => ts.sys.readFile(path));
    if (read.error) throw new Error(`cannot read ${configPath}`);
    const options = ts.parseJsonConfigFileContent(read.config, ts.sys, root).options;
    const program = ts.createProgram(ts.sys.readDirectory(join(root, 'src', 'js'), ['.ts', '.mts']), options);
    cached = { root, program };
    return program;
}

export function isPortSource(root: string, source: ts.SourceFile): boolean {
    return !source.isDeclarationFile && source.fileName.startsWith(join(root, 'src', 'js'));
}
