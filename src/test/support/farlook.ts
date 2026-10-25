import assert from 'node:assert/strict';
import { rhack } from '../../js/cmd.js';
import { flushPendingTopline } from '../../js/display.js';
import { requireGameDisplay } from '../../js/gstate.js';
import { resetInputState } from '../../js/input.js';

export async function farlookText(positionKeys: string): Promise<string> {
    const display = requireGameDisplay();
    const messageRows = () => display.grid.slice(0, 3)
        .map(row => row.map(cell => cell.ch).join('')).join(' ');
    const pages: string[] = [];
    const input = resetInputState();
    input.feed(positionKeys);
    input.display = { async readKey() {
        assert.ok(pages.length < 6, `Farlook did not finish: ${messageRows()}`);
        pages.push(messageRows());
        return ' '.charCodeAt(0);
    } };

    await rhack(';'.charCodeAt(0));
    await flushPendingTopline();
    pages.push(messageRows());
    return pages.join(' ').replace(/--More--/g, '').replace(/\s+/g, ' ').trim();
}
