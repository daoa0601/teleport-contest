import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { game, requireGameDisplay } from '../../js/gstate.js';
import type { InputGate, KeyInput } from '../../js/input.js';
import type { PromptAnswer } from './input-boundaries.js';

/** Feed finite, visible user choices only when the game requests fresh input. */
export function planInput(input: InputGate, test: TestContext, answers: readonly PromptAnswer[]): void {
    const previous = input.display;
    let next = 0;
    const reader = {
        async readKey(): Promise<number> {
            const answer = answers[next++];
            assert.ok(answer, `Unexpected input:\n${visibleText()}`);
            assert.match(visibleText(), answer.prompt);
            const keys: KeyInput[] = typeof answer.keys === 'string' ? [...answer.keys]
                : typeof answer.keys === 'number' ? [answer.keys] : [...answer.keys];
            const first = keys.shift();
            assert.ok(first !== undefined, 'A planned answer must contain a key');
            input.feed(keys);
            return typeof first === 'number' ? first : first.charCodeAt(0);
        },
    };
    input.display = reader;
    test.after(() => {
        if (input.display === reader) input.display = previous;
        assert.equal(next, answers.length, 'Every planned prompt must be reached');
    });
}

/** Variable damage loops may page known prose up to their native effect limit. */
export async function withMessagePages<T>(
    action: () => Promise<T>, input: InputGate, expected: RegExp, limit: number,
): Promise<T> {
    const previous = input.display;
    let pages = 0;
    input.display = {
        async readKey(): Promise<number> {
            assert.match(visibleText(), /--More--/, 'Expected a message pager');
            assert.match(game._pending_message, expected);
            assert.ok(++pages <= limit, `Effect exceeded its ${limit}-page bound`);
            return 32;
        },
    };
    try {
        return await action();
    } finally {
        input.display = previous;
    }
}

function visibleText(): string {
    return requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}
