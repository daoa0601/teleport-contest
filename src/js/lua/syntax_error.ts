// C llex.c:lexerror(): luaG_addinfo() prefixes the chunk name and line,
// then "%s near %s" appends the offending token; luaO_chunkid() renders
// the chunk name.
export function luaSyntaxError(
    chunkName: string, line: number, message: string, near: string,
): SyntaxError {
    return new SyntaxError(`${luaChunkId(chunkName)}:${line}: ${message} near ${near}`);
}

// C lobject.c:luaO_chunkid(): renders a chunk name for error messages,
// truncated to LUA_IDSIZE.
export function luaChunkId(source: string): string {
    // LUA_IDSIZE includes the terminating null byte.
    if (source.startsWith('=')) return source.slice(1, 60);
    if (source.startsWith('@')) {
        return source.length <= 60 ? source.slice(1) : `...${source.slice(-56)}`;
    }
    const firstLine = source.split('\n', 1)[0] ?? '';
    const shortened = source.length >= 45 || firstLine.length < source.length;
    return `[string "${firstLine.slice(0, 45)}${shortened ? '...' : ''}"]`;
}
