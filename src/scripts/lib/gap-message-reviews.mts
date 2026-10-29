import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { stringValue } from './session-types.mjs';

export interface MessageIdentity { file: string; owner: string; piece: string }
export type MessageVerdict = 'composed' | 'dead' | 'out-of-scope' | 'diagnostic';
export interface MessageReview extends MessageIdentity { verdict: MessageVerdict; reason: string }
export interface StaleMessageReview { review: MessageReview; reason: string }
export interface MessageReviews {
    reviewed: ReadonlyMap<string, MessageReview>;
    stale: StaleMessageReview[];
}

export function messageLedgerKey(row: MessageIdentity): string {
    return `${row.file}\t${row.owner}\t${row.piece.replace(/[\t\n\r\\]/g, ch => JSON.stringify(ch).slice(1, -1))}`;
}

// The first part of a composition's reason is a source location. Prefer a
// function name: line numbers move when nearby code changes.
const PORT_LOCATION = /(src\/js\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts):([A-Za-z_$][\w$]*|[1-9]\d*)(?=;|\s|$)/g;

export function checkMessageReviews(root: string, path: string, literals: readonly MessageIdentity[]): MessageReviews {
    const reviews = readReviews(readFileSync(path, 'utf8'), path);
    const current = new Set(literals.map(messageLedgerKey));
    const reviewed = new Map<string, MessageReview>();
    const stale: StaleMessageReview[] = [];
    const sources = new Map<string, ts.SourceFile>();
    for (const review of reviews) {
        const key = messageLedgerKey(review);
        const reason = !current.has(key) ? 'C literal no longer exists'
            : review.verdict === 'composed' ? stalePortLocations(root, review.reason, sources) : null;
        if (reason) stale.push({ review, reason });
        else reviewed.set(key, review);
    }
    return { reviewed, stale };
}

function readReviews(value: unknown, label: string): MessageReview[] {
    const text = stringValue(value, label);
    const reviews: MessageReview[] = [];
    const seen = new Set<string>();
    for (const [index, line] of text.split(/\r?\n/).entries()) {
        if (!line.trim() || line.startsWith('#')) continue;
        const where = `${label}:${index + 1}`;
        const columns = line.split('\t');
        if (columns.length !== 5) throw new Error(`${where}: expected five tab-separated columns (file, owner, piece, verdict, reason)`);
        const [file, owner, encodedPiece, verdict, reason] = columns;
        if (!file || !/^[A-Za-z0-9_]+\.c$/.test(file)) throw new Error(`${where}: invalid C file name`);
        if (!owner || !/^[A-Za-z_]\w*$/.test(owner)) throw new Error(`${where}: invalid C owner name`);
        if (!encodedPiece?.trim()) throw new Error(`${where}: piece must not be empty`);
        if (verdict !== 'composed' && verdict !== 'dead' && verdict !== 'out-of-scope' && verdict !== 'diagnostic')
            throw new Error(`${where}: invalid verdict ${JSON.stringify(verdict)}`);
        if (!reason?.trim()) throw new Error(`${where}: reason must not be empty`);
        if (verdict === 'composed' && [...reason.matchAll(PORT_LOCATION)][0]?.index !== 0)
            throw new Error(`${where}: composed reason must start with a port location, src/js/FILE.ts:FUNCTION or :LINE`);
        const piece = decodePiece(encodedPiece, where);
        const review: MessageReview = { file, owner, piece, verdict, reason };
        const key = messageLedgerKey(review);
        if (seen.has(key)) throw new Error(`${where}: duplicate reviewed literal ${file}:${owner}: ${encodedPiece}`);
        seen.add(key);
        reviews.push(review);
    }
    return reviews;
}

function decodePiece(text: string, label: string): string {
    return text.replace(/\\(.)|\\$/g, (_match, escaped: unknown) => {
        switch (escaped) {
        case 't': return '\t';
        case 'n': return '\n';
        case 'r': return '\r';
        case '\\': return '\\';
        default: throw new Error(`${label}: piece has an invalid escape; use \\t, \\n, \\r or \\\\`);
        }
    });
}

function stalePortLocations(root: string, reason: string, sources: Map<string, ts.SourceFile>): string | null {
    for (const location of reason.matchAll(PORT_LOCATION)) {
        const file = location[1], anchor = location[2];
        if (!file || !anchor) throw new Error('Composition lacks a validated port location');
        const stale = stalePortLocation(root, file, anchor, sources);
        if (stale) return stale;
    }
    return null;
}

function stalePortLocation(root: string, file: string, anchor: string, sources: Map<string, ts.SourceFile>): string | null {
    const path = join(root, file);
    if (!existsSync(path)) return `port file no longer exists: ${file}`;
    let source = sources.get(file);
    if (!source) {
        source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, false);
        sources.set(file, source);
    }
    if (/^\d+$/.test(anchor)) {
        return Number(anchor) <= source.getLineStarts().length ? null : `port line no longer exists: ${file}:${anchor}`;
    }
    return definesFunction(source, anchor) ? null : `port function no longer exists: ${file}:${anchor}`;
}

function definesFunction(source: ts.SourceFile, name: string): boolean {
    let found = false;
    const visit = (node: ts.Node): void => {
        if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isMethodDeclaration(node))
            && node.body && node.name && ts.isIdentifier(node.name) && node.name.text === name) found = true;
        else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name
            && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) found = true;
        if (!found) ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
}
