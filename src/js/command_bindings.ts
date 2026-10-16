// Ordered command bindings and movement layouts.
// C refs: cmd.c cmdbind_add(), reset_commands(), cmd_from_func().
import {
    DIRECTION_HANDLERS, INITIAL_COMMAND_BINDINGS,
    NATIVE_COMMAND_CONSTANTS, NATIVE_COMMAND_FLAGS, NATIVE_COMMANDS, NATIVE_SPECIAL_KEYS,
} from './command_data.js';
import type { NativeCommand } from './command_types.js';

export interface KeyBinding {
    key: number;
    command: NativeCommand | null;
    user: boolean;
    parameter: string | null;
}

export interface MovementBinding {
    direction: number;
    mode: number;
    dx: number;
    dy: number;
    dz: number;
}

interface SavedMovement {
    key: number;
    command: NativeCommand | null;
}

const MOVEMENT_DELTAS: readonly (readonly [number, number, number])[] = [
    [-1, 0, 0], [-1, -1, 0], [0, -1, 0], [1, -1, 0],
    [1, 0, 0], [1, 1, 0], [0, 1, 0], [-1, 1, 0],
    [0, 0, 1], [0, 0, -1],
];

const commandNamed = (name: string) => NATIVE_COMMANDS.find(command => command.name === name);
const commandForHandler = (handler: string) => NATIVE_COMMANDS.find(command => command.handler === handler);
const control = (key: number) => key & 0x1f;
const meta = (key: number) => key | 0x80;
const uppercase = (key: number) => key >= 97 && key <= 122 ? key - 32 : key;
const WAIT_COMMAND = commandNamed('wait');
if (!WAIT_COMMAND) throw new Error('The native command table must define wait.');
const SPACE_WAIT: NativeCommand = { ...WAIT_COMMAND, key: 32 };

const MENU_COMMAND_KEYS = new Map([
    ['menu_next_page', '>'], ['menu_previous_page', '<'],
    ['menu_first_page', '^'], ['menu_last_page', '|'],
    ['menu_select_all', '.'], ['menu_invert_all', '@'], ['menu_deselect_all', '-'],
    ['menu_select_page', ','], ['menu_invert_page', '~'], ['menu_deselect_page', '\\'],
    ['menu_search', ':'], ['menu_shift_right', '}'], ['menu_shift_left', '{'],
]);

export class CommandBindings {
    bindings: KeyBinding[];
    specialKeys: Map<string, number>;
    savedMovement: SavedMovement[];
    spaceFallback: NativeCommand | null;
    numberPad: boolean;
    swapYZ: boolean;
    pcHack: boolean;
    phoneLayout: boolean;
    restOnSpace: boolean;
    menuAliases: { key: number; command: string }[];

    constructor() {
        this.bindings = [];
        this.specialKeys = new Map<string, number>();
        for (const { name, key } of NATIVE_SPECIAL_KEYS) {
            if (name !== null) this.specialKeys.set(name, key);
        }
        this.savedMovement = [];
        this.spaceFallback = null;
        this.numberPad = false;
        this.swapYZ = false;
        this.pcHack = false;
        this.phoneLayout = false;
        this.restOnSpace = false;
        this.menuAliases = [];
        for (const command of NATIVE_COMMANDS) {
            if (command.name !== null && command.key) this.add(command.key, command);
        }
        for (const binding of INITIAL_COMMAND_BINDINGS)
            this.bindKey(binding.key, binding.name, false);
        this.installMovement();
    }

    lookup(key: number): KeyBinding | null {
        return this.bindings.find(binding => binding.key === key) ?? null;
    }

    bindSpecialKey(key: number, name: string): boolean {
        if (!name || !this.specialKeys.has(name)) return false;
        this.specialKeys.set(name, key);
        return true;
    }

    specialKey(name: string): number | undefined {
        return this.specialKeys.get(name);
    }

    // options.c:add_menu_cmd_alias() appends aliases; the first matching
    // key wins, and the original menu command remains available.
    bindMenuKey(key: number, name: string): boolean {
        const command = MENU_COMMAND_KEYS.get(name);
        if (!command) return false;
        const character = String.fromCharCode(key);
        if (!key || key === 10 || key === 13 || key === 27 || key === 32
            || /^[a-zA-Z0-9]$/.test(character) || '])[="(%!?+/$*`0_.'.includes(character)) return false;
        if (this.menuAliases.length < 32) this.menuAliases.push({ key, command });
        return true;
    }

    menuKey(command: string): number {
        return this.menuAliases.find(alias => alias.command === command)?.key ?? command.charCodeAt(0);
    }

    menuCommand(key: number): number {
        const alias = this.menuAliases.find(alias => alias.key === key);
        return alias ? alias.command.charCodeAt(0) : key;
    }

    bindKey(key: number, text: string, user = true): { accepted: boolean; error: string | null } {
        if (text.toLowerCase() === 'nothing') {
            this.remove(key);
            return { accepted: true, error: null };
        }
        const open = text.indexOf('(');
        const close = text.lastIndexOf(')');
        const hasParameter = open >= 0 && close > open;
        const name = (hasParameter ? text.slice(0, open) : text).toLowerCase();
        const parameter = hasParameter ? text.slice(open + 1, close) : null;
        const command = commandNamed(name);
        if (!command || (command.flags & NATIVE_COMMAND_FLAGS.INTERNALCMD))
            return { accepted: false, error: null };
        this.add(key, command, user);
        let error: string | null = null;
        if (command.flags & NATIVE_COMMAND_FLAGS.CMD_PARAM) {
            if (parameter === null) error = `'${name}' requires a parameter`;
            else if (!parameter.length) error = 'Required parameter cannot be empty';
            else if (key) {
                const binding = this.lookup(key);
                if (binding) binding.parameter = parameter.slice(0, 30);
            }
        } else if (parameter?.length) error = `'${name}' does not take a parameter`;
        return { accepted: true, error };
    }

    setNumberPad(value: number): boolean {
        if (!Number.isInteger(value) || value < -1 || value > 4) return false;
        for (const { key, command } of this.savedMovement) this.add(key, command);
        const numberPad = value > 0;
        const mode = value === -1 ? 1 : numberPad ? value - 1 : 0;
        this.numberPad = numberPad;
        const swapYZ = !numberPad && !!(mode & 1);
        if (swapYZ !== this.swapYZ) {
            this.swapYZ = swapYZ;
            for (const key of [121, 89, control(121), meta(121), meta(89), meta(control(121))])
                this.swapKeys(key, key + 1);
        }
        const pcHack = numberPad && !!(mode & 1);
        if (pcHack !== this.pcHack) {
            this.pcHack = pcHack;
            if (pcHack) this.add(meta(48), commandForHandler('dotypeinv'));
            else this.remove(meta(48));
        }
        const phoneLayout = numberPad && !!(mode & 2);
        if (phoneLayout !== this.phoneLayout) {
            this.phoneLayout = phoneLayout;
            for (let key = 49; key <= 51; key++) {
                this.swapKeys(key, key + 6);
                this.swapKeys(meta(key), meta(key + 6));
            }
        }
        this.installMovement();
        return true;
    }

    setRestOnSpace(enabled: boolean, { initial = false } = {}): void {
        this.restOnSpace = enabled;
        if (!initial) this.updateRestOnSpace();
    }

    finishConfiguration() {
        this.updateRestOnSpace();
    }

    get directionKeys() {
        return this.numberPad
            ? this.phoneLayout ? '41236987><' : '47896321><'
            : this.swapYZ ? 'hzkulnjb><' : 'hykulnjb><';
    }

    movementForKey(key: number, mode: number | null = null): MovementBinding | null {
        const handler = this.lookup(key)?.command?.handler;
        if (!handler) return null;
        for (let direction = 0; direction < DIRECTION_HANDLERS.length; direction++) {
            const modes = DIRECTION_HANDLERS[direction];
            const delta = MOVEMENT_DELTAS[direction];
            if (!modes || !delta) continue;
            const foundMode = mode === null ? modes.indexOf(handler)
                : modes[mode] === handler ? mode : -1;
            if (foundMode >= 0) return {
                direction, mode: foundMode,
                dx: delta[0], dy: delta[1], dz: delta[2],
            };
        }
        return null;
    }

    keyForDirection(direction: number, mode = 0): number {
        const handler = DIRECTION_HANDLERS[direction]?.[mode];
        return handler ? this.keyForHandler(handler) : 0;
    }

    keyForCommand(name: string): number {
        const command = commandNamed(name);
        return command ? this.keyForHandler(command.handler) : 0;
    }

    keyForHandler(handler: string): number {
        let result = 0;
        for (const binding of this.bindings) {
            const key = binding.key;
            if (key === 32) continue;
            if (!this.numberPad && ((key >= 48 && key <= 57)
                || (key === 45 && handler === 'do_fight'))) continue;
            if (binding.command?.handler !== handler) continue;
            if (key >= 32 && key <= 126) return key;
            result = key;
        }
        return this.lookup(32)?.command?.handler === handler ? 32 : result;
    }

    add(key: number, command: NativeCommand | null | undefined, user = false): void {
        command ??= null;
        if (!key) return;
        const binding = this.lookup(key);
        if (!command && binding) {
            this.remove(key);
        } else if (binding) {
            binding.command = command;
            binding.user = user;
            binding.parameter = null;
        } else {
            this.bindings.unshift({ key, command, user, parameter: null });
        }
    }

    remove(key: number): void {
        const index = this.bindings.findIndex(binding => binding.key === key);
        if (index >= 0) this.bindings.splice(index, 1);
    }

    swapKeys(first: number, second: number): void {
        const firstBinding = this.lookup(first), secondBinding = this.lookup(second);
        if (!firstBinding || !secondBinding) return;
        firstBinding.key = second;
        secondBinding.key = first;
    }

    installMovement() {
        this.savedMovement = [];
        for (let direction = 0; direction < NATIVE_COMMAND_CONSTANTS.N_DIRS; direction++) {
            const key = this.directionKeys.charCodeAt(direction);
            for (let mode = 0; mode < 3; mode++) {
                const movementKey = mode === 0 ? key : this.numberPad
                    ? meta(key) : mode === 1 ? uppercase(key) : control(key);
                this.savedMovement.push({
                    key: movementKey, command: this.lookup(movementKey)?.command ?? null,
                });
                this.remove(movementKey);
            }
        }
        for (let direction = 0; direction < NATIVE_COMMAND_CONSTANTS.N_DIRS; direction++) {
            const key = this.directionKeys.charCodeAt(direction);
            const handlers = DIRECTION_HANDLERS[direction];
            if (!handlers) throw new RangeError(`Missing direction handlers for direction ${direction}`);
            this.add(key, commandForHandler(handlers[0]));
            this.add(this.numberPad ? meta(key) : uppercase(key), commandForHandler(handlers[1]));
            if (!this.numberPad) this.add(control(key), commandForHandler(handlers[2]));
        }
        this.updateRestOnSpace();
    }

    updateRestOnSpace() {
        const current = this.lookup(32);
        if (current && current.command !== SPACE_WAIT) this.spaceFallback = current.command;
        this.add(32, this.restOnSpace ? SPACE_WAIT : this.spaceFallback);
    }
}
