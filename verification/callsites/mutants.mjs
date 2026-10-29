// Invalid-domain arguments in memory only. Keep the original argument in a
// multiplication by zero so nested calls stay in the runtime call inventory.
import path from 'node:path';
import ts from 'typescript';

export function domainMutants(program, drawName, repo) {
    const overrides = new Map();
    const printer = ts.createPrinter();
    for (const file of program.getSourceFiles()) {
        const relative = path.relative(repo, file.fileName);
        if (!relative.startsWith('js/') || relative === 'js/rng.js') continue;
        let changed = false;
        const transform = context => {
            const visit = node => {
                const draw = ts.isCallExpression(node) ? drawName(node) : null;
                const visited = ts.visitEachChild(node, visit, context);
                if (!draw || !visited.arguments.length) return visited;
                const first = visited.arguments[0];
                let bad = ts.factory.createBinaryExpression(
                    ts.factory.createParenthesizedExpression(first), ts.SyntaxKind.AsteriskToken,
                    ts.factory.createNumericLiteral(0));
                if (draw === 'd') bad = ts.factory.createBinaryExpression(bad,
                    ts.SyntaxKind.MinusToken, ts.factory.createNumericLiteral(1));
                if (draw === 'rnz') bad = ts.factory.createBinaryExpression(bad,
                    ts.SyntaxKind.PlusToken, ts.factory.createNumericLiteral(100000001));
                changed = true;
                return ts.factory.updateCallExpression(visited, visited.expression,
                    visited.typeArguments, [bad, ...visited.arguments.slice(1)]);
            };
            return file => ts.visitNode(file, visit);
        };
        const result = ts.transform(file, [transform]);
        if (changed) overrides.set(path.resolve(file.fileName), printer.printFile(result.transformed[0]));
        result.dispose();
    }
    return overrides;
}
