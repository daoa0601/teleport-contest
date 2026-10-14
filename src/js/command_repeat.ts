// C cmd.c:CQ_REPEAT. Commands retain their selected handler; object choices
// retain inventory letters so repeating acts on the current inventory.
import { game } from './gstate.js';
import { NATIVE_COMMANDS } from './command_data.js';
import { commandExecutionKey } from './command_keys.js';
import type { CommandBinding, RepeatCommandEntry } from './command_types.js';

export function clearRepeatCommand(): void {
    game._repeatCommands = [];
}

export function rememberCommand(binding: CommandBinding, append: boolean): void {
    if (game._inDoAgain) return;
    if (!append) clearRepeatCommand();
    game._repeatCommands ??= [];
    // cmdq_add_ec() looks up the first table entry for the function. Aliases
    // such as #name therefore repeat as #call, including Lua admission.
    const command = NATIVE_COMMANDS.find(candidate => candidate.handler === binding.command?.handler)
        ?? binding.command;
    game._repeatCommands.push({ kind: 'command', binding: {
        command, parameter: null,
        key: commandExecutionKey(command?.name)?.charCodeAt(0) ?? null,
    } });
}

export function rememberCommandKey(key: number): void {
    if (game._inDoAgain) return;
    game._repeatCommands ??= [];
    game._repeatCommands.push({ kind: 'key', key });
}

export function rememberObjectChoice(key: number, count: number | null): void {
    if (game._inDoAgain) return;
    game._repeatCommands ??= [];
    if (count !== null && count > 0)
        game._repeatCommands.push({ kind: 'count', count });
    rememberCommandKey(key);
}

export function takeRepeatCommand(): RepeatCommandEntry | undefined {
    return game._inDoAgain ? game._repeatCommands?.shift() : undefined;
}
