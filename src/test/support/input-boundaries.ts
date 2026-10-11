import assert from 'node:assert/strict';
import { game } from '../../js/gstate.js';
import type { InputGate, KeyInput } from '../../js/input.js';

export interface PromptAnswer {
    prompt: RegExp;
    keys: KeyInput | readonly KeyInput[];
}

// Each answer belongs to an observed prompt. Extra prompts fail instead of
// silently consuming a response intended for a later question.
export async function answerPrompts<T>(
    operation: Promise<T>,
    input: InputGate,
    answers: readonly PromptAnswer[],
): Promise<T> {
    const completed = operation.then(value => ({ kind: 'completed' as const, value }));
    for (const { prompt, keys } of answers) {
        const boundary = await Promise.race([
            completed,
            input.waitUntilBlocked().then(() => ({ kind: 'input' as const })),
        ]);
        assert.equal(boundary.kind, 'input', `Expected input for ${prompt}`);
        assert.match(visibleText(), prompt);
        input.feed(keys);
    }
    const finalBoundary = await Promise.race([
        completed,
        input.waitUntilBlocked().then(() => ({ kind: 'input' as const })),
    ]);
    if (finalBoundary.kind === 'input') {
        assert.fail(`Unexpected input after the planned answers:\n${visibleText()}`);
    }
    return finalBoundary.value;
}

function visibleText(): string {
    assert.ok(game.nhDisplay, 'Prompt assertions need the live display');
    return game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
