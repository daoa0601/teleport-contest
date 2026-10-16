import { rhack } from '../../js/cmd.js';
import { game, requireGameDisplay } from '../../js/gstate.js';
import { resetInputState } from '../../js/input.js';

export async function readDungeonOverview(): Promise<string> {
    const input = resetInputState();
    let text = '';
    input.display = { async readKey() {
        text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
        return 27;
    } };
    game._pending_message = '';
    game._retained_message = '';
    await rhack(15);
    return text;
}
