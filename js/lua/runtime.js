import { parseLua } from './parser.js';
import { LuaTraceback } from './traceback.js';
import { luaChunkId } from './syntax_error.js';
import { LuaArgumentError } from './errors.js';
import { luaInteger } from './arguments.js';
export class LuaValues {
    values;
    constructor(values = []) {
        this.values = values;
    }
}
class LuaIterator {
    rows;
    constructor(rows) {
        this.rows = rows;
    }
}
class ReturnSignal {
    values;
    constructor(values) {
        this.values = values;
    }
}
class BreakSignal {
}
class Environment {
    parent;
    functionScope;
    values = new Map();
    constructor(parent = null, functionScope = false) {
        this.parent = parent;
        this.functionScope = functionScope;
    }
    referenceName(name) {
        let kind = 'local';
        for (let scope = this; scope; scope = scope.parent) {
            if (scope.values.has(name))
                return `${scope.parent ? kind : 'global'} '${name}'`;
            if (scope.functionScope)
                kind = 'upvalue';
        }
        return `global '${name}'`;
    }
    define(name, value) {
        this.values.set(name, value);
    }
    has(name) {
        return this.values.has(name)
            || (this.parent?.has(name) ?? false);
    }
    get(name) {
        if (this.values.has(name))
            return this.values.get(name);
        if (this.parent)
            return this.parent.get(name);
        return null;
    }
    assignBinding(name, value) {
        if (this.values.has(name)) {
            this.values.set(name, value);
        }
        else if (this.parent?.has(name)) {
            this.parent.assignBinding(name, value);
        }
        else {
            this.root().values.set(name, value);
        }
    }
    root() {
        let environment = this;
        while (environment.parent)
            environment = environment.parent;
        return environment;
    }
}
export class LuaTable {
    values = new Map();
    get(key) {
        return this.values.get(key) ?? null;
    }
    set(key, value) {
        if (key === null || key === undefined)
            throw new TypeError('Lua table index is nil');
        if (value === null || value === undefined)
            this.values.delete(key);
        else
            this.values.set(key, value);
    }
    length() {
        let length = 0;
        while (this.values.has(length + 1))
            length++;
        return length;
    }
    entries() {
        return this.values.entries();
    }
}
export class LuaUserdata {
    value;
    metatable;
    constructor(value, metatable = {}) {
        this.value = value;
        this.metatable = metatable;
    }
    get(key) {
        const index = this.metatable.__index;
        if (typeof index === 'function')
            return syncResult(index(this, key));
        if (index instanceof LuaTable)
            return index.get(key);
        return index?.[propertyKey(key)] ?? null;
    }
    set(key, value) {
        const newIndex = this.metatable.__newindex;
        if (typeof newIndex !== 'function')
            throw new TypeError(`attempt to set userdata field ${String(key)}`);
        syncResult(newIndex(this, key, value));
    }
    metamethod(name) {
        return name ? this.metatable[name] ?? null : null;
    }
}
class LuaGlobals {
    environment;
    constructor(environment) {
        this.environment = environment;
    }
}
class LuaFunction {
    state;
    expression;
    closure;
    constructor(state, expression, closure) {
        this.state = state;
        this.expression = expression;
        this.closure = closure;
    }
    invoke(args) {
        const environment = this.environment(args);
        try {
            this.state.executeBlock(this.expression.body, environment);
        }
        catch (signal) {
            if (signal instanceof ReturnSignal)
                return new LuaValues(signal.values);
            throw signal;
        }
        return new LuaValues();
    }
    async invokeAsync(args) {
        const environment = this.environment(args);
        try {
            await this.state.executeBlockAsync(this.expression.body, environment);
        }
        catch (signal) {
            if (signal instanceof ReturnSignal)
                return new LuaValues(signal.values);
            throw signal;
        }
        return new LuaValues();
    }
    environment(args) {
        const environment = new Environment(this.closure, true);
        const parameters = this.expression.parameters;
        for (const [index, parameter] of parameters.entries())
            environment.define(parameter, args[index] ?? null);
        environment.define('...', new LuaValues(args.slice(parameters.length)));
        return environment;
    }
}
function first(value) {
    return value instanceof LuaValues ? value.values[0] ?? null : value ?? null;
}
function truthy(value) {
    value = first(value);
    return value !== null && value !== false;
}
export function luaType(value) {
    value = first(value);
    if (value === null || value === undefined)
        return 'nil';
    if (value instanceof LuaTable)
        return 'table';
    if (value instanceof LuaFunction || typeof value === 'function')
        return 'function';
    if (typeof value === 'number')
        return 'number';
    if (typeof value === 'string')
        return 'string';
    if (typeof value === 'boolean')
        return 'boolean';
    return 'userdata';
}
// luaL_checkstring() converts numbers and raises lauxlib's bad-argument
// error, carrying the caller's stack index, for every other value.
export function luaCheckString(argument, value) {
    if (typeof value === 'string')
        return value;
    if (typeof value === 'number')
        return String(value);
    throw new LuaArgumentError(argument, `string expected, got ${value === undefined ? 'no value' : luaType(value)}`);
}
// luaL_checkinteger() converts integral numbers and numeric strings and
// raises lauxlib's bad-argument error for anything else.
export function luaCheckInteger(argument, value) {
    const integral = (number) => {
        if (Number.isInteger(number))
            return number;
        throw new LuaArgumentError(argument, 'number has no integer representation');
    };
    if (typeof value === 'number')
        return integral(value);
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)))
        return integral(Number(value));
    throw new LuaArgumentError(argument, `number expected, got ${value === undefined ? 'no value' : luaType(value)}`);
}
function luaString(value) {
    value = first(value);
    if (value === null || value === undefined)
        return 'nil';
    if (value instanceof LuaUserdata) {
        const tostring = value.metamethod('__tostring');
        return tostring ? String(syncResult(tostring(value))) : 'userdata';
    }
    if (value === true)
        return 'true';
    if (value === false)
        return 'false';
    return String(value);
}
function getIndex(targetResult, keyResult) {
    let target = targetResult;
    let key = keyResult;
    target = first(target);
    key = first(key);
    if (target instanceof LuaTable)
        return target.get(key);
    if (target instanceof LuaUserdata)
        return target.get(key);
    if (target instanceof LuaGlobals)
        return target.environment.get(propertyKey(key));
    if (target === null || target === undefined)
        throw new TypeError('attempt to index a nil value');
    if (typeof target === 'string' && key === 'match')
        return luaStringMatch;
    if (isHostObject(target))
        return target[propertyKey(key)] ?? null;
    if (Array.isArray(target))
        return key === 'length' ? target.length : target[Number(key)] ?? null;
    if (typeof target === 'string') {
        if (key === 'length')
            return target.length;
        const index = Number(key);
        return Number.isInteger(index) && String(index) === String(key)
            ? target[index] ?? null : null;
    }
    return null;
}
function setIndex(targetResult, keyResult, valueResult) {
    let target = targetResult;
    let key = keyResult;
    let value = valueResult;
    target = first(target);
    key = first(key);
    value = first(value);
    if (target instanceof LuaTable) {
        target.set(key, value);
        return;
    }
    if (target instanceof LuaUserdata) {
        target.set(key, value);
        return;
    }
    if (target instanceof LuaGlobals) {
        target.environment.assignBinding(propertyKey(key), value);
        return;
    }
    if (target === null || target === undefined)
        throw new TypeError('attempt to index a nil value');
    if (isHostObject(target)) {
        target[propertyKey(key)] = value;
        return;
    }
    if (Array.isArray(target)) {
        target[Number(key)] = value;
        return;
    }
    throw new TypeError(`attempt to index a ${luaType(target)} value`);
}
function formatLuaString(format, args) {
    let index = 0;
    return String(format).replace(/%%|%[sdif]/gu, token => {
        if (token === '%%')
            return '%';
        const value = args[index++] ?? null;
        if (token === '%d' || token === '%i')
            return String(Math.trunc(Number(value)));
        if (token === '%f')
            return String(Number(value));
        return luaString(value);
    });
}
function luaPatternSource(pattern) {
    const classes = {
        a: 'A-Za-z', d: '0-9', l: 'a-z', u: 'A-Z', w: 'A-Za-z0-9_',
        s: '\\s', x: 'A-Fa-f0-9', p: '!-/:-@[-`{-~', c: '\\x00-\\x1f\\x7f',
    };
    let source = '';
    let inClass = false;
    const text = String(pattern);
    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (character === '%') {
            const escaped = text[++index] ?? '';
            const characterClass = classes[escaped.toLowerCase()];
            if (characterClass) {
                const negated = escaped === escaped.toUpperCase();
                source += inClass
                    ? characterClass
                    : `[${negated ? '^' : ''}${characterClass}]`;
            }
            else {
                source += /[\\^$.*+?()[\]{}|/]/u.test(escaped)
                    ? `\\${escaped}` : escaped;
            }
            continue;
        }
        if (character === '[')
            inClass = true;
        else if (character === ']')
            inClass = false;
        if (character === '^' && index > 0 && !inClass)
            source += '\\^';
        else
            source += character;
    }
    return source;
}
function luaStringMatch(value, pattern) {
    const match = new RegExp(luaPatternSource(pattern), 'u').exec(String(value));
    if (!match)
        return null;
    if (match.length === 1)
        return match[0] ?? null;
    if (match.length === 2)
        return match[1] ?? null;
    return new LuaValues(match.slice(1));
}
function unaryValue(operator, value) {
    if (operator === 'not')
        return !truthy(value);
    if (value instanceof LuaUserdata) {
        const methods = {
            '-': '__unm', '~': '__bnot', '#': '__len',
        };
        const method = value.metamethod(methods[operator]);
        if (method)
            return syncResult(method(value));
    }
    if (operator === '-')
        return -Number(value);
    if (operator === '~')
        return ~Number(value);
    if (operator === '#') {
        if (value instanceof LuaTable)
            return value.length();
        if (typeof value === 'string')
            return value.length;
        throw new TypeError('attempt to get length of unsupported value');
    }
    throw new Error(`Unsupported Lua unary operator ${operator}`);
}
function binaryValue(operator, left, right) {
    const methods = {
        '==': '__eq', '~=': '__eq', '<': '__lt', '<=': '__le',
        '..': '__concat', '+': '__add', '-': '__sub', '*': '__mul',
        '/': '__div', '//': '__idiv', '%': '__mod', '^': '__pow',
        '&': '__band', '|': '__bor', '~': '__bxor',
        '<<': '__shl', '>>': '__shr',
    };
    const metamethodName = methods[operator];
    const metamethod = left instanceof LuaUserdata
        ? left.metamethod(metamethodName)
        : right instanceof LuaUserdata
            ? right.metamethod(metamethodName) : null;
    if (metamethod) {
        const result = syncResult(metamethod(left, right));
        return operator === '~=' ? !truthy(result) : result;
    }
    if (operator === '<' || operator === '>' || operator === '<=' || operator === '>=') {
        if (typeof left === 'number' && typeof right === 'number')
            return orderedComparison(operator, left, right);
        if (typeof left === 'string' && typeof right === 'string')
            return orderedComparison(operator, left, right);
        throw new TypeError(`attempt to compare ${luaType(left)} with ${luaType(right)}`);
    }
    switch (operator) {
        case '==': return left === right;
        case '~=': return left !== right;
        case '..': return luaString(left) + luaString(right);
        case '+': return Number(left) + Number(right);
        case '-': return Number(left) - Number(right);
        case '*': return Number(left) * Number(right);
        case '/': return Number(left) / Number(right);
        case '//': return Math.floor(Number(left) / Number(right));
        case '%': return Number(left)
            - Math.floor(Number(left) / Number(right)) * Number(right);
        case '^': return Number(left) ** Number(right);
        case '&': return Number(left) & Number(right);
        case '|': return Number(left) | Number(right);
        case '~': return Number(left) ^ Number(right);
        case '<<': return Number(left) << Number(right);
        case '>>': return Number(left) >> Number(right);
        default: return unreachable(operator);
    }
}
export class LuaState {
    destroyed;
    _destroyPromise;
    cleanup;
    environmentRoot = null;
    loadedModules = new Map();
    traceback = new LuaTraceback();
    get globals() {
        if (!this.environmentRoot)
            throw new Error('Lua state has been destroyed');
        return this.environmentRoot;
    }
    constructor(bindings = {}, cleanup = null) {
        this.destroyed = false;
        this._destroyPromise = null;
        this.cleanup = cleanup;
        this.environmentRoot = new Environment();
        const globals = new LuaGlobals(this.globals);
        this.loadedModules.set('_G', globals);
        this.installStandardLibrary();
        for (const [name, value] of Object.entries(bindings))
            this.globals.define(name, value);
        this.globals.define('_G', globals);
    }
    installStandardLibrary() {
        this.globals.define('type', value => luaType(value));
        this.globals.define('tostring', value => luaString(value));
        this.globals.define('error', (message, level = 1) => {
            const errorLevel = luaInteger(level ?? 1);
            const location = typeof message === 'string' && errorLevel > 0
                ? this.traceback.where(errorLevel) : '';
            throw new Error(location + luaString(message));
        });
        this.globals.define('pairs', table => {
            if (!(table instanceof LuaTable))
                throw new TypeError('pairs expects a Lua table');
            return new LuaIterator([...table.entries()]);
        });
        this.globals.define('ipairs', table => {
            if (!(table instanceof LuaTable))
                throw new TypeError('ipairs expects a Lua table');
            const rows = [];
            for (let index = 1; index <= table.length(); index++)
                rows.push([index, table.get(index)]);
            return new LuaIterator(rows);
        });
        this.globals.define('math', {
            abs: (value) => Math.abs(Number(value)),
            ceil: (value) => Math.ceil(Number(value)),
            floor: (value) => Math.floor(Number(value)),
            max: (...values) => Math.max(...values.map(Number)),
            min: (...values) => Math.min(...values.map(Number)),
            random: () => { throw new Error('nhlib.lua has not loaded'); },
        });
        this.globals.define('string', {
            format: (format, ...args) => formatLuaString(format, args),
            match: luaStringMatch,
        });
        this.globals.define('table', {
            insert: (target, position, value = undefined) => {
                if (!(target instanceof LuaTable))
                    throw new TypeError('table.insert expects a Lua table');
                let index = Number(position);
                let inserted = value;
                if (value === undefined) {
                    index = target.length() + 1;
                    inserted = position;
                }
                for (let current = target.length(); current >= index; current--)
                    target.set(current + 1, target.get(current));
                target.set(index, inserted);
            },
            unpack: table => {
                if (!(table instanceof LuaTable))
                    throw new TypeError('table.unpack expects a Lua table');
                const values = [];
                for (let index = 1; index <= table.length(); index++)
                    values.push(table.get(index));
                return new LuaValues(values);
            },
        });
        for (const name of ['math', 'string', 'table'])
            this.loadedModules.set(name, first(this.globals.get(name)));
    }
    execute(source, filename = '<lua>') {
        if (this.destroyed)
            throw new Error('Lua state has been destroyed');
        const chunk = parseLua(source, filename);
        this.traceback.enter(filename, 1, 'main chunk');
        try {
            this.executeBlock(chunk.body, new Environment(this.globals, true));
        }
        finally {
            this.traceback.leave();
        }
    }
    async executeAsync(source, filename = '<lua>') {
        if (this.destroyed)
            throw new Error('Lua state has been destroyed');
        const chunk = parseLua(source, filename);
        this.traceback.enter(filename, 1, 'main chunk');
        try {
            await this.executeBlockAsync(chunk.body, new Environment(this.globals, true));
        }
        finally {
            this.traceback.leave();
        }
    }
    destroy() {
        if (!this._destroyPromise) {
            this.destroyed = true;
            this._destroyPromise = Promise.resolve().then(async () => {
                try {
                    await this.cleanup?.();
                }
                finally {
                    this.loadedModules.clear();
                    this.environmentRoot = null;
                }
            });
        }
        return this._destroyPromise;
    }
    getGlobal(name) {
        return this.globals.get(name);
    }
    setGlobal(name, value) {
        this.globals.assignBinding(name, value);
    }
    call(name, ...args) {
        return first(this.callValue(this.getGlobal(name), args));
    }
    enterCall(callable, reference, tailCall) {
        if (callable instanceof LuaFunction) {
            const { filename, line } = callable.expression;
            const description = this.globalFunctionName(callable) ?? (tailCall ? null : reference);
            this.traceback.enter(filename, line, description ?? `function <${luaChunkId(filename)}:${line}>`, tailCall);
        }
        else {
            this.traceback.enter(null, -1, this.globalFunctionName(callable) ?? reference ?? '?');
        }
    }
    globalFunctionName(callable) {
        // lauxlib.c searches two table levels from the loaded-module registry.
        // _G is a loaded module; tables stored inside it are one level too deep.
        for (const [name, module] of this.loadedModules) {
            const fields = module instanceof LuaGlobals ? module.environment.values
                : module instanceof LuaTable ? module.entries()
                    : isHostObject(module) ? Object.entries(module) : [];
            for (const [field, entry] of fields) {
                if (typeof field === 'string' && entry === callable)
                    return `function '${name === '_G' ? field : `${name}.${field}`}'`;
            }
        }
        return null;
    }
    callReference(expression, environment) {
        if (expression.type === 'Name')
            return environment.referenceName(expression.name);
        if (expression.type === 'Index' && expression.key.type === 'Literal'
            && typeof expression.key.value === 'string')
            return `field '${expression.key.value}'`;
        return null;
    }
    callValue(callable, args, reference = null, tailCall = false) {
        callable = first(callable);
        if (!(callable instanceof LuaFunction) && typeof callable !== 'function')
            throw new TypeError(`attempt to call a ${luaType(callable)} value`);
        this.enterCall(callable, reference, tailCall);
        try {
            const result = callable instanceof LuaFunction
                ? callable.invoke(args) : syncResult(callable(...args));
            if (result instanceof LuaValues)
                return result;
            return new LuaValues(result === undefined ? [] : [result]);
        }
        catch (error) {
            this.traceback.remember(error);
            throw error;
        }
        finally {
            this.traceback.leave();
        }
    }
    async callValueAsync(callable, args, reference = null, tailCall = false) {
        callable = first(callable);
        if (!(callable instanceof LuaFunction) && typeof callable !== 'function')
            throw new TypeError(`attempt to call a ${luaType(callable)} value`);
        this.enterCall(callable, reference, tailCall);
        try {
            const result = callable instanceof LuaFunction
                ? await callable.invokeAsync(args) : await callable(...args);
            if (result instanceof LuaValues)
                return result;
            return new LuaValues(result === undefined ? [] : [result]);
        }
        catch (error) {
            this.traceback.remember(error);
            throw error;
        }
        finally {
            this.traceback.leave();
        }
    }
    evaluateList(expressions, environment, tailCall = false) {
        const values = [];
        for (const [index, expression] of expressions.entries()) {
            const value = this.evaluate(expression, environment, tailCall && expressions.length === 1);
            if (index === expressions.length - 1 && value instanceof LuaValues)
                values.push(...value.values);
            else
                values.push(first(value));
        }
        return values;
    }
    async evaluateListAsync(expressions, environment, tailCall = false) {
        const values = [];
        for (const [index, expression] of expressions.entries()) {
            const value = await this.evaluateAsync(expression, environment, tailCall && expressions.length === 1);
            if (index === expressions.length - 1 && value instanceof LuaValues)
                values.push(...value.values);
            else
                values.push(first(value));
        }
        return values;
    }
    assignTarget(target, value, environment) {
        if (target.type === 'Name') {
            environment.assignBinding(target.name, value);
            return;
        }
        setIndex(this.evaluate(target.target, environment), this.evaluate(target.key, environment), value);
    }
    async assignAsync(target, value, environment) {
        if (target.type === 'Name') {
            environment.assignBinding(target.name, value);
            return;
        }
        setIndex(await this.evaluateAsync(target.target, environment), await this.evaluateAsync(target.key, environment), value);
    }
    executeBlock(statements, environment) {
        try {
            for (const statement of statements)
                this.executeStatement(statement, environment);
        }
        catch (error) {
            this.traceback.remember(error);
            throw error;
        }
    }
    async executeBlockAsync(statements, environment) {
        try {
            for (const statement of statements)
                await this.executeStatementAsync(statement, environment);
        }
        catch (error) {
            this.traceback.remember(error);
            throw error;
        }
    }
    async executeStatementAsync(statement, environment) {
        this.traceback.setLine(statement.line);
        switch (statement.type) {
            case 'Local': {
                const values = await this.evaluateListAsync(statement.expressions, environment);
                for (const [index, name] of statement.names.entries())
                    environment.define(name, values[index] ?? null);
                return;
            }
            case 'LocalFunction': {
                environment.define(statement.name, null);
                environment.assignBinding(statement.name, new LuaFunction(this, statement.expression, environment));
                return;
            }
            case 'Assign': {
                const values = await this.evaluateListAsync(statement.expressions, environment);
                for (const [index, target] of statement.targets.entries())
                    await this.assignAsync(target, values[index] ?? null, environment);
                return;
            }
            case 'CallStatement':
                await this.evaluateAsync(statement.call, environment);
                return;
            case 'If': {
                for (const clause of statement.clauses) {
                    if (!truthy(await this.evaluateAsync(clause.condition, environment)))
                        continue;
                    await this.executeBlockAsync(clause.body, new Environment(environment));
                    return;
                }
                await this.executeBlockAsync(statement.otherwise, new Environment(environment));
                return;
            }
            case 'ForNumeric': {
                const start = Number(first(await this.evaluateAsync(statement.start, environment)));
                const stop = Number(first(await this.evaluateAsync(statement.stop, environment)));
                const step = Number(first(await this.evaluateAsync(statement.step, environment)));
                if (step === 0)
                    throw new Error('Lua numeric for step is zero');
                const loop = new Environment(environment);
                for (let value = start; step > 0 ? value <= stop : value >= stop; value += step) {
                    loop.define(statement.name, value);
                    try {
                        await this.executeBlockAsync(statement.body, new Environment(loop));
                    }
                    catch (signal) {
                        if (signal instanceof BreakSignal)
                            break;
                        throw signal;
                    }
                }
                return;
            }
            case 'ForGeneric': {
                const source = (await this.evaluateListAsync(statement.expressions, environment))[0];
                if (!(source instanceof LuaIterator))
                    throw new TypeError('generic for expects an iterator');
                for (const row of source.rows) {
                    const loop = new Environment(environment);
                    for (const [index, name] of statement.names.entries())
                        loop.define(name, row[index] ?? null);
                    try {
                        await this.executeBlockAsync(statement.body, loop);
                    }
                    catch (signal) {
                        if (signal instanceof BreakSignal)
                            break;
                        throw signal;
                    }
                }
                return;
            }
            case 'While':
                while (truthy(await this.evaluateAsync(statement.condition, environment))) {
                    try {
                        await this.executeBlockAsync(statement.body, new Environment(environment));
                    }
                    catch (signal) {
                        if (signal instanceof BreakSignal)
                            break;
                        throw signal;
                    }
                }
                return;
            case 'Repeat':
                for (;;) {
                    const iteration = new Environment(environment);
                    try {
                        await this.executeBlockAsync(statement.body, iteration);
                    }
                    catch (signal) {
                        if (signal instanceof BreakSignal)
                            break;
                        throw signal;
                    }
                    if (truthy(await this.evaluateAsync(statement.condition, iteration)))
                        break;
                }
                return;
            case 'Do':
                await this.executeBlockAsync(statement.body, new Environment(environment));
                return;
            case 'Return':
                throw new ReturnSignal(await this.evaluateListAsync(statement.expressions, environment, true));
            case 'Break':
                throw new BreakSignal();
            default:
                return unreachable(statement);
        }
    }
    executeStatement(statement, environment) {
        this.traceback.setLine(statement.line);
        switch (statement.type) {
            case 'Local': {
                const values = this.evaluateList(statement.expressions, environment);
                for (const [index, name] of statement.names.entries())
                    environment.define(name, values[index] ?? null);
                return;
            }
            case 'LocalFunction': {
                environment.define(statement.name, null);
                environment.assignBinding(statement.name, new LuaFunction(this, statement.expression, environment));
                return;
            }
            case 'Assign': {
                const values = this.evaluateList(statement.expressions, environment);
                for (const [index, target] of statement.targets.entries())
                    this.assignTarget(target, values[index] ?? null, environment);
                return;
            }
            case 'CallStatement':
                this.evaluate(statement.call, environment);
                return;
            case 'If': {
                for (const clause of statement.clauses) {
                    if (!truthy(this.evaluate(clause.condition, environment)))
                        continue;
                    this.executeBlock(clause.body, new Environment(environment));
                    return;
                }
                this.executeBlock(statement.otherwise, new Environment(environment));
                return;
            }
            case 'ForNumeric': {
                const start = Number(first(this.evaluate(statement.start, environment)));
                const stop = Number(first(this.evaluate(statement.stop, environment)));
                const step = Number(first(this.evaluate(statement.step, environment)));
                if (step === 0)
                    throw new Error('Lua numeric for step is zero');
                const loop = new Environment(environment);
                for (let value = start; step > 0 ? value <= stop : value >= stop; value += step) {
                    loop.define(statement.name, value);
                    try {
                        this.executeBlock(statement.body, new Environment(loop));
                    }
                    catch (signal) {
                        if (signal instanceof BreakSignal)
                            break;
                        throw signal;
                    }
                }
                return;
            }
            case 'ForGeneric': {
                const source = this.evaluateList(statement.expressions, environment)[0];
                if (!(source instanceof LuaIterator))
                    throw new TypeError('generic for expects an iterator');
                for (const row of source.rows) {
                    const loop = new Environment(environment);
                    for (const [index, name] of statement.names.entries())
                        loop.define(name, row[index] ?? null);
                    try {
                        this.executeBlock(statement.body, loop);
                    }
                    catch (signal) {
                        if (signal instanceof BreakSignal)
                            break;
                        throw signal;
                    }
                }
                return;
            }
            case 'While':
                while (truthy(this.evaluate(statement.condition, environment))) {
                    try {
                        this.executeBlock(statement.body, new Environment(environment));
                    }
                    catch (signal) {
                        if (signal instanceof BreakSignal)
                            break;
                        throw signal;
                    }
                }
                return;
            case 'Repeat':
                for (;;) {
                    const iteration = new Environment(environment);
                    try {
                        this.executeBlock(statement.body, iteration);
                    }
                    catch (signal) {
                        if (signal instanceof BreakSignal)
                            break;
                        throw signal;
                    }
                    if (truthy(this.evaluate(statement.condition, iteration)))
                        break;
                }
                return;
            case 'Do':
                this.executeBlock(statement.body, new Environment(environment));
                return;
            case 'Return':
                throw new ReturnSignal(this.evaluateList(statement.expressions, environment, true));
            case 'Break':
                throw new BreakSignal();
            default:
                return unreachable(statement);
        }
    }
    evaluate(expression, environment, tailCall = false) {
        switch (expression.type) {
            case 'Literal':
                return expression.value;
            case 'Name':
                return environment.get(expression.name);
            case 'Vararg':
                return environment.get('...') || new LuaValues();
            case 'Group':
                return first(this.evaluate(expression.expression, environment));
            case 'Function':
                return new LuaFunction(this, expression, environment);
            case 'Table': {
                const table = new LuaTable();
                let nextIndex = 1;
                for (const [index, field] of expression.fields.entries()) {
                    if (field.key) {
                        table.set(first(this.evaluate(field.key, environment)), first(this.evaluate(field.value, environment)));
                        continue;
                    }
                    const value = this.evaluate(field.value, environment);
                    if (index === expression.fields.length - 1
                        && value instanceof LuaValues) {
                        for (const entry of value.values)
                            table.set(nextIndex++, entry);
                    }
                    else {
                        table.set(nextIndex++, first(value));
                    }
                }
                return table;
            }
            case 'Index':
                return getIndex(this.evaluate(expression.target, environment), this.evaluate(expression.key, environment));
            case 'Call': {
                const callable = this.evaluate(expression.callee, environment);
                const args = this.evaluateList(expression.args, environment);
                this.traceback.setLine(expression.line);
                return this.callValue(callable, args, this.callReference(expression.callee, environment), tailCall);
            }
            case 'MethodCall': {
                const target = first(this.evaluate(expression.target, environment));
                const callable = getIndex(target, expression.method);
                const args = [target, ...this.evaluateList(expression.args, environment)];
                this.traceback.setLine(expression.line);
                return this.callValue(callable, args, `method '${expression.method}'`, tailCall);
            }
            case 'Unary':
                return this.evaluateUnary(expression, environment);
            case 'Binary':
                return this.evaluateBinary(expression, environment);
            default:
                return unreachable(expression);
        }
    }
    async evaluateAsync(expression, environment, tailCall = false) {
        switch (expression.type) {
            case 'Literal':
                return expression.value;
            case 'Name':
                return environment.get(expression.name);
            case 'Vararg':
                return environment.get('...') || new LuaValues();
            case 'Group':
                return first(await this.evaluateAsync(expression.expression, environment));
            case 'Function':
                return new LuaFunction(this, expression, environment);
            case 'Table': {
                const table = new LuaTable();
                let nextIndex = 1;
                for (const [index, field] of expression.fields.entries()) {
                    if (field.key) {
                        table.set(first(await this.evaluateAsync(field.key, environment)), first(await this.evaluateAsync(field.value, environment)));
                        continue;
                    }
                    const value = await this.evaluateAsync(field.value, environment);
                    if (index === expression.fields.length - 1
                        && value instanceof LuaValues) {
                        for (const entry of value.values)
                            table.set(nextIndex++, entry);
                    }
                    else {
                        table.set(nextIndex++, first(value));
                    }
                }
                return table;
            }
            case 'Index':
                return getIndex(await this.evaluateAsync(expression.target, environment), await this.evaluateAsync(expression.key, environment));
            case 'Call': {
                const callable = await this.evaluateAsync(expression.callee, environment);
                const args = await this.evaluateListAsync(expression.args, environment);
                this.traceback.setLine(expression.line);
                return this.callValueAsync(callable, args, this.callReference(expression.callee, environment), tailCall);
            }
            case 'MethodCall': {
                const target = first(await this.evaluateAsync(expression.target, environment));
                const callable = getIndex(target, expression.method);
                const args = [target, ...await this.evaluateListAsync(expression.args, environment)];
                this.traceback.setLine(expression.line);
                return this.callValueAsync(callable, args, `method '${expression.method}'`, tailCall);
            }
            case 'Unary':
                return unaryValue(expression.operator, first(await this.evaluateAsync(expression.expression, environment)));
            case 'Binary': {
                const left = first(await this.evaluateAsync(expression.left, environment));
                if (expression.operator === 'and')
                    return truthy(left) ? first(await this.evaluateAsync(expression.right, environment)) : left;
                if (expression.operator === 'or')
                    return truthy(left) ? left : first(await this.evaluateAsync(expression.right, environment));
                const right = first(await this.evaluateAsync(expression.right, environment));
                return binaryValue(expression.operator, left, right);
            }
            default:
                return unreachable(expression);
        }
    }
    evaluateUnary(expression, environment) {
        const value = first(this.evaluate(expression.expression, environment));
        return unaryValue(expression.operator, value);
    }
    evaluateBinary(expression, environment) {
        const operator = expression.operator;
        const left = first(this.evaluate(expression.left, environment));
        if (operator === 'and')
            return truthy(left) ? first(this.evaluate(expression.right, environment)) : left;
        if (operator === 'or')
            return truthy(left) ? left : first(this.evaluate(expression.right, environment));
        const right = first(this.evaluate(expression.right, environment));
        return binaryValue(operator, left, right);
    }
}
export function luaTableToArray(table) {
    if (!(table instanceof LuaTable))
        return [];
    const values = [];
    for (let index = 1; index <= table.length(); index++)
        values.push(table.get(index));
    return values;
}
export function luaValueToJs(value) {
    if (!(value instanceof LuaTable))
        return value;
    const entries = [...value.entries()];
    const length = value.length();
    if (length === entries.length) {
        return Array.from({ length }, (_entry, index) => luaValueToJs(value.get(index + 1)));
    }
    return Object.fromEntries(entries.map(([key, entry]) => [
        String(key), luaValueToJs(entry),
    ]));
}
export function luaTableToObject(table) {
    if (!(table instanceof LuaTable))
        return {};
    return Object.fromEntries([...table.entries()].map(([key, value]) => [
        String(key), value instanceof LuaTable ? luaTableToObject(value) : value,
    ]));
}
export function objectToLuaTable(object) {
    const table = new LuaTable();
    if (object === null || object === undefined)
        return table;
    for (const [key, value] of Object.entries(object))
        table.set(key, fromHostValue(value));
    return table;
}
function syncResult(result) {
    if (result instanceof Promise)
        throw new TypeError('asynchronous Lua binding requires asynchronous execution');
    if (result === null)
        return null;
    return result ?? undefined;
}
function propertyKey(value) {
    if (typeof value === 'string' || typeof value === 'number')
        return String(value);
    throw new TypeError('host object field must be a string or number');
}
function isHostObject(value) {
    return typeof value === 'object' && value !== null
        && Object.getPrototypeOf(value) === Object.prototype;
}
function orderedComparison(operator, left, right) {
    switch (operator) {
        case '<': return left < right;
        case '>': return left > right;
        case '<=': return left <= right;
        case '>=': return left >= right;
    }
}
function fromHostValue(value) {
    if (value === undefined)
        return null;
    return isHostObject(value) ? objectToLuaTable(value) : value;
}
export function luaVariablesFromTable(table) {
    if (!(table instanceof LuaTable))
        return {};
    const variables = {};
    for (const [key, value] of table.entries())
        variables[String(key)] = serializedValue(value);
    return variables;
}
function serializedValue(value) {
    if (value === null || typeof value === 'boolean'
        || typeof value === 'number' || typeof value === 'string')
        return value;
    if (value instanceof LuaTable)
        return luaVariablesFromTable(value);
    if (Array.isArray(value))
        return value.map(serializedValue);
    throw new TypeError(`cannot save a Lua ${luaType(value)} value`);
}
function unreachable(value) {
    throw new TypeError(`unsupported Lua syntax node: ${String(value)}`);
}
//# sourceMappingURL=runtime.js.map