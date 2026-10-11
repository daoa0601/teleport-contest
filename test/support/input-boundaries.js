import assert from 'node:assert/strict';
import { game } from '../../js/gstate.js';
// Each answer belongs to an observed prompt. Extra prompts fail instead of
// silently consuming a response intended for a later question.
export async function answerPrompts(operation, input, answers) {
    const completed = operation.then(value => ({ kind: 'completed', value }));
    for (const { prompt, keys } of answers) {
        const boundary = await Promise.race([
            completed,
            input.waitUntilBlocked().then(() => ({ kind: 'input' })),
        ]);
        assert.equal(boundary.kind, 'input', `Expected input for ${prompt}`);
        assert.match(visibleText(), prompt);
        input.feed(keys);
    }
    const finalBoundary = await Promise.race([
        completed,
        input.waitUntilBlocked().then(() => ({ kind: 'input' })),
    ]);
    if (finalBoundary.kind === 'input') {
        assert.fail(`Unexpected input after the planned answers:\n${visibleText()}`);
    }
    return finalBoundary.value;
}
function visibleText() {
    assert.ok(game.nhDisplay, 'Prompt assertions need the live display');
    return game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
//# sourceMappingURL=input-boundaries.js.map