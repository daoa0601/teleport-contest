import { luaChunkId } from './syntax_error.js';

interface LuaFrame {
    readonly source: string;
    readonly description: string;
    line: number;
    hidden: boolean;
    readonly tailCall: boolean;
}

// nhlua.c:traceback_handler() uses luaL_traceback() before Lua unwinds.
// Retain Lua frames on the original exception; JavaScript frames are unrelated.
export class LuaTraceback {
    private readonly frames: LuaFrame[] = [];
    private readonly failures = new WeakMap<object, readonly LuaFrame[]>();

    enter(filename: string | null, line: number, description: string, tailCall = false): void {
        const caller = this.frames.at(-1);
        if (tailCall && caller) caller.hidden = true;
        this.frames.push({
            source: filename === null ? '[C]' : luaChunkId(filename),
            line, description, hidden: false, tailCall,
        });
    }

    leave(): void {
        this.frames.pop();
        const caller = this.frames.at(-1);
        if (caller) caller.hidden = false;
    }

    setLine(line: number): void {
        const frame = this.frames.at(-1);
        if (frame) frame.line = line;
    }

    where(level: number): string {
        const frame = this.frames.filter(frame => !frame.hidden).at(-1 - level);
        return frame && frame.line > 0 ? `${frame.source}:${frame.line}: ` : '';
    }

    remember(error: unknown): void {
        if (!(error instanceof Error) || this.failures.has(error)) return;
        this.failures.set(error, this.frames.filter(frame => !frame.hidden)
            .map(frame => ({ ...frame })).reverse());
    }

    format(error: unknown): string {
        const message = error instanceof Error ? error.message : String(error);
        const frames = error instanceof Error ? this.failures.get(error) ?? [] : [];
        const lines = [message, 'stack traceback:', '\t[C]: in ?'];
        // luaL_traceback() shows ten initial frames and eleven final frames,
        // including its own handler frame, when a stack exceeds 22 entries.
        for (let index = 0; index < frames.length; index++) {
            if (frames.length > 21 && index === 9) {
                const skipped = frames.length - 21;
                lines.push(`\t...\t(skipping ${skipped} levels)`);
                index += skipped;
                continue;
            }
            const frame = frames[index];
            if (!frame) continue;
            const location = frame.line > 0 ? `${frame.source}:${frame.line}` : frame.source;
            lines.push(`\t${location}: in ${frame.description}`);
            if (frame.tailCall) lines.push('\t(...tail calls...)');
        }
        return lines.join('\n');
    }
}
