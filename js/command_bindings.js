// Ordered command bindings and movement layouts: the key-binding state of
// C cmd.c's cmdbind_*()/bind_*()/commands_init()/reset_commands() family
// (one method per C function; see each citation below) plus the
// ext_func_tab_from_func() lookup. This is cmd.c code, but it cannot live
// in cmd.ts: gstate.ts runs createGameState() — which instantiates
// CommandBindings — at module initialization, and cmd.ts imports
// gstate.ts, so folding the class in creates a game_state -> cmd ->
// gstate -> game_state cycle that dies at import time with
// "Cannot access 'CommandBindings' before initialization" (verified).
import { DIRECTION_HANDLERS, INITIAL_COMMAND_BINDINGS, NATIVE_COMMAND_CONSTANTS, NATIVE_COMMAND_FLAGS, NATIVE_COMMANDS, NATIVE_SPECIAL_KEYS, } from './command_data.js';
const MOVEMENT_DELTAS = [
    [-1, 0, 0], [-1, -1, 0], [0, -1, 0], [1, -1, 0],
    [1, 0, 0], [1, 1, 0], [0, 1, 0], [-1, 1, 0],
    [0, 0, 1], [0, 0, -1],
];
// Port only: lookup in the port's native command table.
const commandNamed = (name) => NATIVE_COMMANDS.find(command => command.name === name);
// C cmd.c:ext_func_tab_from_func(): the first command table entry whose
// handler is this C function. Aliases such as #name resolve to #call.
export function extFuncTabFromFunc(handler) {
    const command = NATIVE_COMMANDS.find(candidate => candidate.handler === handler);
    if (!command)
        throw new Error(`No command table entry for handler ${handler}`);
    return command;
}
// C global.h:C()
const control = (key) => key & 0x1f;
// C global.h:M()
const meta = (key) => key | 0x80;
// C hacklib.c:highc()
const uppercase = (key) => key >= 97 && key <= 122 ? key - 32 : key;
const WAIT_COMMAND = commandNamed('wait');
if (!WAIT_COMMAND)
    throw new Error('The native command table must define wait.');
const SPACE_WAIT = { ...WAIT_COMMAND, key: 32 };
const MENU_COMMAND_KEYS = new Map([
    ['menu_next_page', '>'], ['menu_previous_page', '<'],
    ['menu_first_page', '^'], ['menu_last_page', '|'],
    ['menu_select_all', '.'], ['menu_invert_all', '@'], ['menu_deselect_all', '-'],
    ['menu_select_page', ','], ['menu_invert_page', '~'], ['menu_deselect_page', '\\'],
    ['menu_search', ':'], ['menu_shift_right', '}'], ['menu_shift_left', '{'],
]);
export class CommandBindings {
    bindings;
    specialKeys;
    savedMovement;
    spaceFallback;
    numberPad;
    swapYZ;
    pcHack;
    phoneLayout;
    restOnSpace;
    menuAliases;
    mouseButtons = new Map();
    savedMouseButtons = [null, null];
    // Also C cmd.c:commands_init(): inlined here (mouse buttons, the
    // command table's default keys, and INITIAL_COMMAND_BINDINGS).
    constructor() {
        this.bindings = [];
        this.specialKeys = new Map();
        for (const { name, key } of NATIVE_SPECIAL_KEYS) {
            if (name !== null)
                this.specialKeys.set(name, key);
        }
        this.savedMovement = [];
        this.spaceFallback = null;
        this.numberPad = false;
        this.swapYZ = false;
        this.pcHack = false;
        this.phoneLayout = false;
        this.restOnSpace = false;
        this.menuAliases = [];
        this.bindMouseButton(1, 'therecmdmenu');
        this.bindMouseButton(2, 'clicklook');
        for (const command of NATIVE_COMMANDS) {
            if (command.name !== null && command.key)
                this.add(command.key, command);
        }
        for (const binding of INITIAL_COMMAND_BINDINGS)
            this.bindKey(binding.key, binding.name, false);
        this.installMovement();
    }
    // C cmd.c:cmdbind_get().
    lookup(key) {
        return this.bindings.find(binding => binding.key === key) ?? null;
    }
    mouseCommand(button) {
        return this.mouseButtons.get(button) ?? null;
    }
    // C lock_mouse_buttons(): getpos saves both bindings and clears them
    // until selection ends, including while its help and menus are open.
    lockMouseButtons(saveButtons) {
        if (saveButtons) {
            this.savedMouseButtons = [this.mouseCommand(1), this.mouseCommand(2)];
            this.mouseButtons.set(1, null);
            this.mouseButtons.set(2, null);
        }
        else {
            this.mouseButtons.set(1, this.savedMouseButtons[0]);
            this.mouseButtons.set(2, this.savedMouseButtons[1]);
        }
    }
    // C cmd.c:bind_mousebtn().
    bindMouseButton(button, name) {
        if (name.toLowerCase() === 'nothing') {
            this.mouseButtons.set(button, null);
            return true;
        }
        const command = NATIVE_COMMANDS.find(entry => entry.name?.toLowerCase() === name.toLowerCase()
            && entry.flags & NATIVE_COMMAND_FLAGS.MOUSECMD);
        if (!command)
            return false;
        this.mouseButtons.set(button, command);
        return true;
    }
    // C cmd.c:bind_specialkey().
    bindSpecialKey(key, name) {
        if (!name || !this.specialKeys.has(name))
            return false;
        this.specialKeys.set(name, key);
        return true;
    }
    specialKey(name) {
        return this.specialKeys.get(name);
    }
    // options.c:add_menu_cmd_alias() appends aliases; the first matching
    // key wins, and the original menu command remains available.
    bindMenuKey(key, name) {
        const command = MENU_COMMAND_KEYS.get(name);
        if (!command)
            return false;
        const character = String.fromCharCode(key);
        if (!key || key === 10 || key === 13 || key === 27 || key === 32
            || /^[a-zA-Z0-9]$/.test(character) || '])[="(%!?+/$*`0_.'.includes(character))
            return false;
        if (this.menuAliases.length >= 32)
            return false;
        this.menuAliases.push({ key, command });
        return true;
    }
    menuKey(command) {
        return this.menuAliases.find(alias => alias.command === command)?.key ?? command.charCodeAt(0);
    }
    menuCommand(key) {
        const alias = this.menuAliases.find(alias => alias.key === key);
        return alias ? alias.command.charCodeAt(0) : key;
    }
    bindKey(key, text, user = true) {
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
        let error = null;
        if (command.flags & NATIVE_COMMAND_FLAGS.CMD_PARAM) {
            if (parameter === null)
                error = `'${name}' requires a parameter`;
            else if (!parameter.length)
                error = 'Required parameter cannot be empty';
            else if (key) {
                const binding = this.lookup(key);
                if (binding)
                    binding.parameter = parameter.slice(0, 30);
            }
        }
        else if (parameter?.length)
            error = `'${name}' does not take a parameter`;
        return { accepted: true, error };
    }
    // Also C cmd.c:reset_commands(): the number_pad rebind half — swap_yz,
    // pcHack, phone_layout key swaps over the saved movement bindings.
    setNumberPad(value) {
        if (!Number.isInteger(value) || value < -1 || value > 4)
            return false;
        for (const { key, command } of this.savedMovement)
            this.add(key, command);
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
            if (pcHack)
                this.add(meta(48), extFuncTabFromFunc('dotypeinv'));
            else
                this.remove(meta(48));
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
    setRestOnSpace(enabled, { initial = false } = {}) {
        this.restOnSpace = enabled;
        if (!initial)
            this.updateRestOnSpace();
    }
    finishConfiguration() {
        this.updateRestOnSpace();
    }
    get directionKeys() {
        return this.numberPad
            ? this.phoneLayout ? '41236987><' : '47896321><'
            : this.swapYZ ? 'hzkulnjb><' : 'hykulnjb><';
    }
    // C cmd.c:movecmd(): resolve a key to its bound direction function and
    // vector (mode null scans walk, rush, then run like MV_ANY).
    movementForKey(key, mode = null) {
        const handler = this.lookup(key)?.command?.handler;
        if (!handler)
            return null;
        for (let direction = 0; direction < DIRECTION_HANDLERS.length; direction++) {
            const modes = DIRECTION_HANDLERS[direction];
            const delta = MOVEMENT_DELTAS[direction];
            if (!modes || !delta)
                continue;
            const foundMode = mode === null ? modes.indexOf(handler)
                : modes[mode] === handler ? mode : -1;
            if (foundMode >= 0)
                return {
                    direction, mode: foundMode,
                    dx: delta[0], dy: delta[1], dz: delta[2],
                };
        }
        return null;
    }
    // C cmd.c:cmd_from_dir().
    keyForDirection(direction, mode = 0) {
        const handler = DIRECTION_HANDLERS[direction]?.[mode];
        return handler ? this.keyForHandler(handler) : 0;
    }
    keyForCommand(name) {
        const command = commandNamed(name);
        return command ? this.keyForHandler(command.handler) : 0;
    }
    // C cmd.c:cmd_from_func().
    keyForHandler(handler) {
        let result = 0;
        for (const binding of this.bindings) {
            const key = binding.key;
            if (key === 32)
                continue;
            if (!this.numberPad && ((key >= 48 && key <= 57)
                || (key === 45 && handler === 'do_fight')))
                continue;
            if (binding.command?.handler !== handler)
                continue;
            if (key >= 32 && key <= 126)
                return key;
            result = key;
        }
        return this.lookup(32)?.command?.handler === handler ? 32 : result;
    }
    // C cmd.c:cmdbind_add().
    add(key, command, user = false) {
        command ??= null;
        if (!key)
            return;
        const binding = this.lookup(key);
        if (!command && binding) {
            this.remove(key);
        }
        else if (binding) {
            binding.command = command;
            binding.user = user;
            binding.parameter = null;
        }
        else {
            this.bindings.unshift({ key, command, user, parameter: null });
        }
    }
    // C cmd.c:cmdbind_remove().
    remove(key) {
        const index = this.bindings.findIndex(binding => binding.key === key);
        if (index >= 0)
            this.bindings.splice(index, 1);
    }
    // C cmd.c:cmdbind_swapkeys().
    swapKeys(first, second) {
        const firstBinding = this.lookup(first), secondBinding = this.lookup(second);
        if (!firstBinding || !secondBinding)
            return;
        firstBinding.key = second;
        secondBinding.key = first;
    }
    // C cmd.c:reset_commands(). The rebind tail: back up the commands the
    // movement keys replace, bind DIRECTION_HANDLERS to the layout's keys,
    // then update_rest_on_space(). The number_pad rebind half of the same C
    // function is setNumberPad(); the initial-commands half is the constructor.
    // Also C cmd.c:bind_key_fn(): inlined here (extFuncTabFromFunc() finds the
    // command whose handler is this direction function, then add()).
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
            if (!handlers)
                throw new RangeError(`Missing direction handlers for direction ${direction}`);
            this.add(key, extFuncTabFromFunc(handlers[0]));
            this.add(this.numberPad ? meta(key) : uppercase(key), extFuncTabFromFunc(handlers[1]));
            if (!this.numberPad)
                this.add(control(key), extFuncTabFromFunc(handlers[2]));
        }
        this.updateRestOnSpace();
    }
    updateRestOnSpace() {
        const current = this.lookup(32);
        if (current && current.command !== SPACE_WAIT)
            this.spaceFallback = current.command;
        this.add(32, this.restOnSpace ? SPACE_WAIT : this.spaceFallback);
    }
}
//# sourceMappingURL=command_bindings.js.map