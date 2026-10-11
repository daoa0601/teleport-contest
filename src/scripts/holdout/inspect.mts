import { itemAt } from '../lib/session-types.mjs';
import type { Session } from '../lib/session-types.mjs';
import type { AcceptedRecording, CandidateSpec, RecordingMetrics } from './types.mjs';
import { decodeScreen, classifyPrompt } from '../lib/holdout-policy.mjs';
import { validateRecipeRecording } from './recipes.mjs';


interface CorpusSummary {
    tier: 'dev-private';
    sealed: false;
    sessions: number;
    segments: number;
    steps: number;
    keys: number;
    rngCalls: number;
    animationFrames: number;
    byGenerator: Record<string, number>;
    byRecipe: Record<string, number>;
    byRole: Record<string, number>;
    byRace: Record<string, number>;
    byAlignment: Record<string, number>;
    byGender: Record<string, number>;
    byDate: Record<string, number>;
    byMode: Record<string, number>;
    lengths: Record<'under60' | '60to149' | '150to399' | '400plus', number>;
    depths: Record<'1to2' | '3to6' | '7plus', number>;
    promptKinds: Record<string, number>;
    maxDepth: number;
    maxTurn: number;
    characterCombinations: number;
}

export function inspectRecording(session: Session): RecordingMetrics {
    if (session.version !== 5 || !Array.isArray(session.segments) || !session.segments.length) {
        throw new Error('recording must contain version-5 segments');
    }
    const result: RecordingMetrics = { segments: session.segments.length, steps: 0, keys: 0, rngCalls: 0,
        gameplayScreens: 0, maxDepth: 0, maxTurn: 0, maxExperienceLevel: 0, promptKinds: {}, endings: [],
        levels: [], animationFrames: 0 };
    const levels = new Set<string>();
    for (const segment of session.segments) {
        const { steps, moves, recording } = segment;
        if (!Array.isArray(steps) || !steps.length || typeof moves !== 'string') {
            throw new Error('empty recording');
        }
        if (!recording || recording.suppliedKeys !== moves.length) {
            throw new Error('recording has unconsumed planned keys');
        }
        if (steps.length < moves.length || steps.length > moves.length + 1) {
            throw new Error('recording is missing input observations');
        }
        let segmentGameplay = 0;
        for (const [index, step] of steps.entries()) {
            if (step.key !== (index === 0 ? null : moves[index - 1])) {
                throw new Error(`input observation does not match key at step ${index}`);
            }
            if (!Array.isArray(step.rng) || typeof step.screen !== 'string'
                || !Array.isArray(step.cursor) || step.cursor.length !== 3) {
                throw new Error(`invalid observation at step ${index}`);
            }
            const raw = step.screen.split('\n');
            const lines = decodeScreen(raw);
            const text = lines.join('\n');
            if (/HP:\s*\d+\s*\(/.test(text)) segmentGameplay++;
            for (const match of text.matchAll(/(?:Dlvl|Home|End Game):\s*(\d+)/g)) {
                result.maxDepth = Math.max(result.maxDepth, Number(match[1]));
                levels.add(match[0]);
            }
            for (const match of text.matchAll(/\bT:(\d+)/g)) {
                result.maxTurn = Math.max(result.maxTurn, Number(match[1]));
            }
            for (const match of text.matchAll(/\b(?:Xp|Exp):(\d+)/g)) {
                result.maxExperienceLevel = Math.max(result.maxExperienceLevel, Number(match[1]));
            }
            const kind = classifyPrompt(raw, step.cursor).kind;
            result.promptKinds[kind] = (result.promptKinds[kind] ?? 0) + 1;
            result.rngCalls += step.rng.filter(call => /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(call)).length;
            result.animationFrames += step.animation_frames?.length ?? 0;
        }
        if (!segmentGameplay) throw new Error('segment never entered the game');
        result.gameplayScreens += segmentGameplay;
        const finalStep = itemAt(steps, steps.length - 1);
        const finalPrompt = classifyPrompt(finalStep.screen.split('\n'), finalStep.cursor).kind;
        if (recording.termination === 'input-boundary' && recording.driver?.dead) {
            throw new Error('policy stopped before the death sequence exited');
        }
        if (recording.termination === 'input-boundary' && finalPrompt !== 'command') {
            throw new Error(`recording ends in an unanswered ${finalPrompt} prompt`);
        }
        if (recording.termination === 'process-exit' && recording.exitCode !== 0) {
            throw new Error('game process did not exit cleanly');
        }
        result.endings.push(recording.termination);
        result.steps += steps.length;
        result.keys += moves.length;
    }
    result.levels = [...levels];
    return result;
}

export function inspectCandidate(spec: CandidateSpec, recorded: Session) {
    const metrics = inspectRecording(recorded);
    if (spec.kind === 'deep' && (spec.targetDepth === undefined || metrics.maxDepth < spec.targetDepth
        || metrics.maxExperienceLevel < 20)) {
        throw new Error(`native setup requested depth ${spec.targetDepth}/Xp20, reached depth ${metrics.maxDepth}/Xp${metrics.maxExperienceLevel}`);
    }
    if (spec.kind === 'recipe') {
        if (!spec.recipe) throw new Error('recipe candidate needs a recipe name');
        const evidence = validateRecipeRecording(spec.recipe, recorded);
        if (!evidence.ok) {
            throw new Error(`recipe requirements not reached: ${evidence.error
                ?? evidence.checks.filter(check => !check.ok).map(check => check.check).join('; ')}`);
        }
        metrics.recipeChecks = evidence.checks.map(check => check.check);
    }
    if (spec.kind !== 'recipe' && metrics.maxTurn < 5
        && !metrics.endings.includes('process-exit')) {
        throw new Error('policy did not advance at least four game turns');
    }
    return metrics;
}

export function summarizeCorpus(rows: readonly AcceptedRecording[]) {
    const summary: CorpusSummary = { tier: 'dev-private', sealed: false, sessions: rows.length,
        segments: 0, steps: 0, keys: 0, rngCalls: 0, animationFrames: 0,
        byGenerator: {}, byRecipe: {}, byRole: {}, byRace: {}, byAlignment: {},
        byGender: {}, byDate: {}, byMode: {}, lengths: { under60: 0, '60to149': 0,
            '150to399': 0, '400plus': 0 }, depths: { '1to2': 0, '3to6': 0, '7plus': 0 },
        promptKinds: {}, maxDepth: 0, maxTurn: 0, characterCombinations: 0 };
    const combinations = new Set();
    const count = (table: Record<string, number>, key: string) => { table[key] = (table[key] ?? 0) + 1; };
    for (const row of rows) {
        const { spec, metrics } = row;
        for (const field of ['segments', 'steps', 'keys', 'rngCalls', 'animationFrames'] as const) {
            summary[field] += metrics[field];
        }
        count(summary.byGenerator, spec.kind);
        if (spec.recipe) count(summary.byRecipe, spec.recipe);
        count(summary.byRole, spec.character.role);
        count(summary.byRace, spec.character.race);
        count(summary.byAlignment, spec.character.align);
        count(summary.byGender, spec.character.gender);
        count(summary.byDate, spec.date.category);
        count(summary.byMode, spec.debug ? 'debug' : 'normal');
        combinations.add(JSON.stringify(spec.character));
        count(summary.lengths, metrics.steps < 60 ? 'under60'
            : metrics.steps < 150 ? '60to149' : metrics.steps < 400 ? '150to399' : '400plus');
        count(summary.depths, metrics.maxDepth <= 2 ? '1to2' : metrics.maxDepth <= 6 ? '3to6' : '7plus');
        summary.maxDepth = Math.max(summary.maxDepth, metrics.maxDepth);
        summary.maxTurn = Math.max(summary.maxTurn, metrics.maxTurn);
        for (const [kind, count] of Object.entries(metrics.promptKinds)) {
            summary.promptKinds[kind] = (summary.promptKinds[kind] ?? 0) + count;
        }
    }
    summary.characterCombinations = combinations.size;
    return summary;
}
