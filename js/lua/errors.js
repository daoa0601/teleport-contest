// nhlua.c:nhl_error() adds the immediate caller's line and source before raising.
export class NethackLuaError extends Error {
}
// luaL_argerror needs the active Lua call to name the function and discount self.
export class LuaArgumentError extends Error {
    argument;
    constructor(argument, message, options) {
        super(message, options);
        this.argument = argument;
    }
}
//# sourceMappingURL=errors.js.map