// cmd.c handler_rebind_keys()/handler_rebind_keys_add(): the interactive
// key-binding menus behind the full options menu's "bind keys" row.
import { game } from './gstate.js';
import { flush_screen, pline } from './display.js';
import { pgetchar } from './input.js';
import { getLine } from './query.js';
import { showMultiSelectWindow, showTextWindow } from './windows.js';
import { NATIVE_COMMANDS, NATIVE_COMMAND_FLAGS } from './command_data.js';
import { COMMAND_DESCRIPTIONS } from './command_descriptions.js';
import { keyText } from './command_help.js';
// cmd.c count_bind_keys(): user rebinds plus default keys that no longer
// have their command bound.
export function countBindKeys() {
    const bound = new Set(game.commandBindings.bindings.map(binding => binding.key));
    let count = 0;
    for (const binding of game.commandBindings.bindings)
        if (binding.user && binding.command && binding.command.key !== binding.key)
            count++;
    for (const command of NATIVE_COMMANDS)
        if (command.key && !bound.has(command.key))
            count++;
    return count;
}
// cmd.c get_changed_key_binds(): the "BIND=key:command" config rows.
export function changedKeyBindsLines() {
    const bound = new Set(game.commandBindings.bindings.map(binding => binding.key));
    const lines = [];
    for (const binding of game.commandBindings.bindings) {
        if (!binding.user || !binding.command || binding.command.key === binding.key)
            continue;
        const parameter = binding.command.flags & NATIVE_COMMAND_FLAGS.CMD_PARAM
            && binding.parameter !== null ? `(${binding.parameter})` : '';
        lines.push(`BIND=${keyText(binding.key)}:${binding.command.name}${parameter}`);
    }
    for (const command of NATIVE_COMMANDS)
        if (command.key && !bound.has(command.key))
            lines.push(`BIND=${keyText(command.key)}:nothing`);
    return lines;
}
// cmd.c handler_rebind_keys_add(): keyfirst asks for the key before showing
// the command list, otherwise the key is asked after a command is chosen.
async function handlerRebindKeysAdd(keyfirst) {
    let key = 0;
    if (keyfirst) {
        await pline('Bind which key? ');
        await flush_screen(1);
        key = (await pgetchar()) & 255;
        if (!key || key === 27)
            return;
    }
    const rows = [];
    if (key) {
        const binding = game.commandBindings.lookup(key);
        rows.push(binding?.command
            ? { selectable: false, text: `Key '${keyText(key)}' is currently bound to "${binding.command.name}".` }
            : { selectable: false, text: `Key '${keyText(key)}' is not bound to anything.` });
        rows.push({ selectable: false, text: '' });
    }
    // The unbind row carries identifier -1; command rows keep their
    // extcmdlist index + 1, as C's add_menu identifiers do.
    rows.push({ value: -1, text: 'nothing: unbind the key' });
    rows.push({ selectable: false, text: '' });
    for (const [index, command] of NATIVE_COMMANDS.entries()) {
        if (command.flags & (NATIVE_COMMAND_FLAGS.MOVEMENTCMD
            | NATIVE_COMMAND_FLAGS.INTERNALCMD | NATIVE_COMMAND_FLAGS.CMD_NOT_AVAILABLE))
            continue;
        rows.push({ value: index + 1,
            text: `${command.name}: ${COMMAND_DESCRIPTIONS.get(command.name ?? '') ?? ''}` });
    }
    const picks = await showMultiSelectWindow({
        title: key ? `Bind '${keyText(key)}' to what command?` : 'Bind what command?',
        omitHeadings: true, pickOne: true, signalEscape: true, pageLocalKeys: true,
        sections: [{ items: rows }],
    });
    if (!picks || !picks.length)
        return;
    const pick = picks[0];
    if (pick === undefined)
        return;
    let commandText;
    let command = null;
    if (pick === -1) {
        commandText = 'nothing';
    }
    else {
        command = NATIVE_COMMANDS[pick - 1] ?? null;
        if (!command)
            return;
        if (command.flags & NATIVE_COMMAND_FLAGS.CMD_PARAM) {
            const answer = await getLine(`Command ${command.name} requires a parameter:`, (_character, keyCode) => keyCode >= 32 && keyCode < 127);
            // mungspaces() condenses the answer; an ESC stays in the buffer
            // and ends up inside the binding parameter, as in C.
            const parameter = (answer ?? '\x1b').replace(/\s+/g, ' ').trim();
            commandText = `${command.name}(${parameter})`;
        }
        else {
            commandText = command.name ?? '';
        }
    }
    if (!key) {
        await pline('Bind which key? ');
        await flush_screen(1);
        key = (await pgetchar()) & 255;
        if (!key || key === 27)
            return;
    }
    const previous = game.commandBindings.lookup(key);
    const result = game.commandBindings.bindKey(key, commandText, true);
    if (result.error) {
        // cfgfiles.c:config_erradd() prints interactive errors immediately;
        // tty_wait_synch() then displays the map without waiting for a key.
        await pline(`${result.error}${/[.!?]$/.test(result.error) ? '' : '.'}`);
        await flush_screen(1);
    }
    if (result.accepted) {
        // cmdbind_add() updates an existing binding in place. Its caller
        // therefore sees the new command through prevcmd too.
        if (previous?.command && previous.command !== command)
            await pline(`Changed key '${keyText(key)}' from "${previous.command.name}" to "${commandText}".`);
        else if (!previous?.command)
            await pline(`Bound key '${keyText(key)}' to "${commandText}".`);
    }
    else {
        await pline('Key binding failed?!');
    }
}
// cmd.c handler_rebind_keys(): the "Do what?" pick list, redone after every
// action until it is cancelled.
export async function handlerRebindKeys() {
    for (;;) {
        const rows = [
            { value: 1, text: 'bind key to a command' },
            { value: 2, text: 'bind command to a key' },
        ];
        if (countBindKeys())
            rows.push({ value: 3, text: 'view changed key binds' });
        const picks = await showMultiSelectWindow({
            title: 'Do what?', omitHeadings: true, pickOne: true, signalEscape: true,
            pageLocalKeys: true,
            sections: [{ items: rows }],
        });
        if (!picks || !picks.length)
            return;
        if (picks[0] === 1)
            await handlerRebindKeysAdd(true);
        else if (picks[0] === 2)
            await handlerRebindKeysAdd(false);
        else if (picks[0] === 3)
            await showTextWindow(changedKeyBindsLines());
    }
}
//# sourceMappingURL=rebind_keys.js.map