import { parseLua } from './parser.js';

class LuaValues {
    constructor(values = []) {
        this.values = values;
    }
}

class LuaIterator {
    constructor(rows) {
        this.rows = rows;
    }
}

class ReturnSignal {
    constructor(values) {
        this.values = values;
    }
}

class BreakSignal {}

class Environment {
    constructor(parent = null) {
        this.parent = parent;
        this.values = new Map();
    }

    define(name, value) {
        this.values.set(name, value);
    }

    has(name) {
        return this.values.has(name)
            || (this.parent?.has(name) ?? false);
    }

    get(name) {
        if (this.values.has(name)) return this.values.get(name);
        if (this.parent) return this.parent.get(name);
        return null;
    }

    assign(name, value) {
        if (this.values.has(name)) {
            this.values.set(name, value);
        } else if (this.parent?.has(name)) {
            this.parent.assign(name, value);
        } else {
            this.root().values.set(name, value);
        }
    }

    root() {
        let environment = this;
        while (environment.parent) environment = environment.parent;
        return environment;
    }
}

export class LuaTable {
    constructor() {
        this.values = new Map();
    }

    get(key) {
        return this.values.has(key) ? this.values.get(key) : null;
    }

    set(key, value) {
        if (key === null || key === undefined)
            throw new TypeError('Lua table index is nil');
        if (value === null || value === undefined) this.values.delete(key);
        else this.values.set(key, value);
    }

    length() {
        let length = 0;
        while (this.values.has(length + 1)) length++;
        return length;
    }

    entries() {
        return this.values.entries();
    }
}

export class LuaUserdata {
    constructor(value, metatable = {}) {
        this.value = value;
        this.metatable = metatable;
    }

    get(key) {
        const index = this.metatable.__index;
        if (typeof index === 'function') return index(this, key);
        return index?.[key] ?? null;
    }

    set(key, value) {
        const newIndex = this.metatable.__newindex;
        if (typeof newIndex !== 'function')
            throw new TypeError(`attempt to set userdata field ${String(key)}`);
        newIndex(this, key, value);
    }

    metamethod(name) {
        return this.metatable[name] ?? null;
    }
}

class LuaGlobals {
    constructor(environment) {
        this.environment = environment;
    }
}

class LuaFunction {
    constructor(state, expression, closure) {
        this.state = state;
        this.expression = expression;
        this.closure = closure;
    }

    invoke(args) {
        const environment = new Environment(this.closure);
        const parameters = this.expression.parameters;
        for (let index = 0; index < parameters.length; index++)
            environment.define(parameters[index], args[index] ?? null);
        environment.define('...', new LuaValues(args.slice(parameters.length)));
        try {
            this.state.executeBlock(this.expression.body, environment);
        } catch (signal) {
            if (signal instanceof ReturnSignal)
                return new LuaValues(signal.values);
            throw signal;
        }
        return new LuaValues();
    }
}

function first(value) {
    return value instanceof LuaValues ? value.values[0] ?? null : value;
}

function truthy(value) {
    value = first(value);
    return value !== null && value !== false;
}

function luaType(value) {
    value = first(value);
    if (value === null || value === undefined) return 'nil';
    if (value instanceof LuaTable) return 'table';
    if (value instanceof LuaFunction || typeof value === 'function')
        return 'function';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'boolean') return 'boolean';
    return 'userdata';
}

function luaString(value) {
    value = first(value);
    if (value === null || value === undefined) return 'nil';
    if (value instanceof LuaUserdata) {
        const tostring = value.metamethod('__tostring');
        return tostring ? String(tostring(value)) : 'userdata';
    }
    if (value === true) return 'true';
    if (value === false) return 'false';
    return String(value);
}

function getIndex(target, key) {
    target = first(target);
    key = first(key);
    if (target instanceof LuaTable) return target.get(key);
    if (target instanceof LuaUserdata) return target.get(key);
    if (target instanceof LuaGlobals) return target.environment.get(key);
    if (target === null || target === undefined)
        throw new TypeError('attempt to index a nil value');
    return target[key] ?? null;
}

function setIndex(target, key, value) {
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
        target.environment.assign(key, value);
        return;
    }
    if (target === null || target === undefined)
        throw new TypeError('attempt to index a nil value');
    target[key] = value;
}

function formatLuaString(format, args) {
    let index = 0;
    return String(format).replace(/%%|%[sdif]/gu, token => {
        if (token === '%%') return '%';
        const value = args[index++] ?? null;
        if (token === '%d' || token === '%i') return String(Math.trunc(value));
        if (token === '%f') return String(Number(value));
        return luaString(value);
    });
}

export class LuaState {
    constructor(bindings = {}) {
        this.destroyed = false;
        this.globals = new Environment();
        this.installStandardLibrary();
        for (const [name, value] of Object.entries(bindings))
            this.globals.define(name, value);
        this.globals.define('_G', new LuaGlobals(this.globals));
    }

    installStandardLibrary() {
        this.globals.define('type', value => luaType(value));
        this.globals.define('tostring', value => luaString(value));
        this.globals.define('error', message => {
            throw new Error(luaString(message));
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
            abs: Math.abs,
            ceil: Math.ceil,
            floor: Math.floor,
            max: Math.max,
            min: Math.min,
            random: () => { throw new Error('nhlib.lua has not loaded'); },
        });
        this.globals.define('string', {
            format: (format, ...args) => formatLuaString(format, args),
        });
        this.globals.define('table', {
            unpack: table => {
                if (!(table instanceof LuaTable))
                    throw new TypeError('table.unpack expects a Lua table');
                const values = [];
                for (let index = 1; index <= table.length(); index++)
                    values.push(table.get(index));
                return new LuaValues(values);
            },
        });
    }

    execute(source, filename = '<lua>') {
        if (this.destroyed) throw new Error('Lua state has been destroyed');
        const chunk = parseLua(source, filename);
        this.executeBlock(chunk.body, this.globals);
    }

    destroy() {
        this.destroyed = true;
        this.globals = null;
    }

    getGlobal(name) {
        return this.globals.get(name);
    }

    setGlobal(name, value) {
        this.globals.assign(name, value);
    }

    call(name, ...args) {
        return first(this.callValue(this.getGlobal(name), args));
    }

    callValue(callable, args) {
        callable = first(callable);
        let result;
        if (callable instanceof LuaFunction) result = callable.invoke(args);
        else if (typeof callable === 'function') result = callable(...args);
        else throw new TypeError(`attempt to call a ${luaType(callable)} value`);
        if (result instanceof LuaValues) return result;
        return new LuaValues(result === undefined ? [] : [result]);
    }

    evaluateList(expressions, environment) {
        const values = [];
        for (let index = 0; index < expressions.length; index++) {
            const value = this.evaluate(expressions[index], environment);
            if (index === expressions.length - 1 && value instanceof LuaValues)
                values.push(...value.values);
            else
                values.push(first(value));
        }
        return values;
    }

    assign(target, value, environment) {
        if (target.type === 'Name') {
            environment.assign(target.name, value);
            return;
        }
        setIndex(
            this.evaluate(target.target, environment),
            this.evaluate(target.key, environment),
            value,
        );
    }

    executeBlock(statements, environment) {
        for (const statement of statements)
            this.executeStatement(statement, environment);
    }

    executeStatement(statement, environment) {
        switch (statement.type) {
        case 'Local': {
            const values = this.evaluateList(statement.expressions, environment);
            for (let index = 0; index < statement.names.length; index++)
                environment.define(statement.names[index], values[index] ?? null);
            return;
        }
        case 'LocalFunction': {
            environment.define(statement.name, null);
            environment.assign(statement.name,
                new LuaFunction(this, statement.expression, environment));
            return;
        }
        case 'Assign': {
            const values = this.evaluateList(statement.expressions, environment);
            for (let index = 0; index < statement.targets.length; index++)
                this.assign(statement.targets[index], values[index] ?? null,
                    environment);
            return;
        }
        case 'CallStatement':
            this.evaluate(statement.call, environment);
            return;
        case 'If': {
            for (const clause of statement.clauses) {
                if (!truthy(this.evaluate(clause.condition, environment))) continue;
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
            if (step === 0) throw new Error('Lua numeric for step is zero');
            const loop = new Environment(environment);
            for (let value = start;
                step > 0 ? value <= stop : value >= stop;
                value += step) {
                loop.define(statement.name, value);
                try {
                    this.executeBlock(statement.body, new Environment(loop));
                } catch (signal) {
                    if (signal instanceof BreakSignal) break;
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
                for (let index = 0; index < statement.names.length; index++)
                    loop.define(statement.names[index], row[index] ?? null);
                try {
                    this.executeBlock(statement.body, loop);
                } catch (signal) {
                    if (signal instanceof BreakSignal) break;
                    throw signal;
                }
            }
            return;
        }
        case 'While':
            while (truthy(this.evaluate(statement.condition, environment))) {
                try {
                    this.executeBlock(statement.body, new Environment(environment));
                } catch (signal) {
                    if (signal instanceof BreakSignal) break;
                    throw signal;
                }
            }
            return;
        case 'Repeat':
            for (;;) {
                const iteration = new Environment(environment);
                try {
                    this.executeBlock(statement.body, iteration);
                } catch (signal) {
                    if (signal instanceof BreakSignal) break;
                    throw signal;
                }
                if (truthy(this.evaluate(statement.condition, iteration))) break;
            }
            return;
        case 'Do':
            this.executeBlock(statement.body, new Environment(environment));
            return;
        case 'Return':
            throw new ReturnSignal(this.evaluateList(
                statement.expressions, environment,
            ));
        case 'Break':
            throw new BreakSignal();
        default:
            throw new Error(`Unsupported Lua statement ${statement.type}`);
        }
    }

    evaluate(expression, environment) {
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
            for (let index = 0; index < expression.fields.length; index++) {
                const field = expression.fields[index];
                if (field.key) {
                    table.set(
                        first(this.evaluate(field.key, environment)),
                        first(this.evaluate(field.value, environment)),
                    );
                    continue;
                }
                const value = this.evaluate(field.value, environment);
                if (index === expression.fields.length - 1
                    && value instanceof LuaValues) {
                    for (const entry of value.values) table.set(nextIndex++, entry);
                } else {
                    table.set(nextIndex++, first(value));
                }
            }
            return table;
        }
        case 'Index':
            return getIndex(
                this.evaluate(expression.target, environment),
                this.evaluate(expression.key, environment),
            );
        case 'Call': {
            const callable = this.evaluate(expression.callee, environment);
            const args = this.evaluateList(expression.args, environment);
            return this.callValue(callable, args);
        }
        case 'MethodCall': {
            const target = first(this.evaluate(expression.target, environment));
            const callable = getIndex(target, expression.method);
            const args = [target, ...this.evaluateList(expression.args, environment)];
            return this.callValue(callable, args);
        }
        case 'Unary':
            return this.evaluateUnary(expression, environment);
        case 'Binary':
            return this.evaluateBinary(expression, environment);
        default:
            throw new Error(`Unsupported Lua expression ${expression.type}`);
        }
    }

    evaluateUnary(expression, environment) {
        const value = first(this.evaluate(expression.expression, environment));
        if (expression.operator === 'not') return !truthy(value);
        if (value instanceof LuaUserdata) {
            const method = value.metamethod({
                '-': '__unm', '~': '__bnot', '#': '__len',
            }[expression.operator]);
            if (method) return method(value);
        }
        if (expression.operator === '-') return -Number(value);
        if (expression.operator === '~') return ~Number(value);
        if (expression.operator === '#') {
            if (value instanceof LuaTable) return value.length();
            if (typeof value === 'string') return value.length;
            throw new TypeError('attempt to get length of unsupported value');
        }
        throw new Error(`Unsupported Lua unary operator ${expression.operator}`);
    }

    evaluateBinary(expression, environment) {
        const operator = expression.operator;
        const left = first(this.evaluate(expression.left, environment));
        if (operator === 'and')
            return truthy(left) ? first(this.evaluate(expression.right, environment)) : left;
        if (operator === 'or')
            return truthy(left) ? left : first(this.evaluate(expression.right, environment));
        const right = first(this.evaluate(expression.right, environment));
        const metamethodName = {
            '==': '__eq', '~=': '__eq', '<': '__lt', '<=': '__le',
            '..': '__concat', '+': '__add', '-': '__sub', '*': '__mul',
            '/': '__div', '//': '__idiv', '%': '__mod', '^': '__pow',
            '&': '__band', '|': '__bor', '~': '__bxor',
            '<<': '__shl', '>>': '__shr',
        }[operator];
        const metamethod = left instanceof LuaUserdata
            ? left.metamethod(metamethodName)
            : right instanceof LuaUserdata
                ? right.metamethod(metamethodName) : null;
        if (metamethod) {
            const result = metamethod(left, right);
            return operator === '~=' ? !truthy(result) : result;
        }

        switch (operator) {
        case '==': return left === right;
        case '~=': return left !== right;
        case '<': return left < right;
        case '>': return left > right;
        case '<=': return left <= right;
        case '>=': return left >= right;
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
        default: throw new Error(`Unsupported Lua binary operator ${operator}`);
        }
    }
}

export function luaTableToArray(table) {
    if (!(table instanceof LuaTable)) return [];
    const values = [];
    for (let index = 1; index <= table.length(); index++)
        values.push(table.get(index));
    return values;
}

export function luaValueToJs(value) {
    if (!(value instanceof LuaTable)) return value;
    const entries = [...value.entries()];
    const length = value.length();
    if (length === entries.length) {
        return Array.from({ length }, (_entry, index) =>
            luaValueToJs(value.get(index + 1)));
    }
    return Object.fromEntries(entries.map(([key, entry]) => [
        String(key), luaValueToJs(entry),
    ]));
}

export function luaTableToObject(table) {
    if (!(table instanceof LuaTable)) return {};
    return Object.fromEntries([...table.entries()].map(([key, value]) => [
        String(key), value instanceof LuaTable ? luaTableToObject(value) : value,
    ]));
}

export function objectToLuaTable(object) {
    const table = new LuaTable();
    for (const [key, value] of Object.entries(object || {})) {
        table.set(key, value && typeof value === 'object' && !Array.isArray(value)
            ? objectToLuaTable(value) : value);
    }
    return table;
}
