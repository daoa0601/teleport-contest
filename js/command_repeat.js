// C cmd.c:CQ_REPEAT. Commands retain their selected handler; object choices
// retain inventory letters so repeating acts on the current inventory.
import { game } from './gstate.js';
export function clearRepeatCommand() {
    game._repeatCommands = [];
}
export function rememberCommand(binding, append) {
    if (game._inDoAgain)
        return;
    if (!append)
        clearRepeatCommand();
    game._repeatCommands ??= [];
    game._repeatCommands.push({ kind: 'command', binding });
}
export function rememberCommandKey(key) {
    if (game._inDoAgain)
        return;
    game._repeatCommands ??= [];
    game._repeatCommands.push({ kind: 'key', key });
}
export function rememberObjectChoice(key, count) {
    if (game._inDoAgain)
        return;
    game._repeatCommands ??= [];
    if (count !== null && count > 0)
        game._repeatCommands.push({ kind: 'count', count });
    rememberCommandKey(key);
}
export function takeRepeatCommand() {
    return game._inDoAgain ? game._repeatCommands?.shift() : undefined;
}
//# sourceMappingURL=command_repeat.js.map