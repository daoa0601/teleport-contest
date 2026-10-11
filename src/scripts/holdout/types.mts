import { arrayValue, booleanValue, numberValue, objectValue, stringValue } from '../lib/session-types.mjs';
import type { Character } from './recipes.mjs';
import type { CalendarDate, DateCategory } from './calendar.mjs';
export type GeneratorKind = 'recipe' | 'fuzz' | 'explore' | 'deep';
export interface CandidateSpec {
    id: string;
    kind: GeneratorKind;
    character: Character;
    date: CalendarDate;
    seed: number;
    debug: boolean;
    recipe?: string;
    targetKeys?: number;
    targetDepth?: number;
    options?: string;
}
export interface RecordingMetrics {
    segments: number;
    steps: number;
    keys: number;
    rngCalls: number;
    gameplayScreens: number;
    maxDepth: number;
    maxTurn: number;
    maxExperienceLevel: number;
    promptKinds: Record<string, number>;
    endings: string[];
    levels: string[];
    animationFrames: number;
    recipeChecks?: string[];
}
export interface PendingRecording { spec: CandidateSpec; file: string; }
export interface AcceptedRecording extends PendingRecording { metrics: RecordingMetrics; }
export interface RejectedRecording {
    spec: CandidateSpec;
    reason: string;
    diagnostic?: string;
}
export interface HoldoutManifest {
    version: 1;
    tier: 'dev-private';
    sealed: false;
    created: string;
    updated?: string;
    accepted: AcceptedRecording[];
    rejected: RejectedRecording[];
    pending: PendingRecording[];
    attempts: number;
    configuration: { kinds: GeneratorKind[] };
}
export function decodeGeneratorKind(value: unknown): GeneratorKind {
    if (value === 'recipe' || value === 'fuzz' || value === 'explore' || value === 'deep') return value;
    throw new Error('generator kind must be recipe, fuzz, explore, or deep');
}
function decodeDateCategory(value: unknown): DateCategory {
    if (value === 'ordinary' || value === 'fullMoon' || value === 'newMoon' || value === 'friday13' || value === 'night') return value;
    throw new Error('invalid calendar category');
}
function decodeCandidate(value: unknown): CandidateSpec {
    const data = objectValue(value, 'candidate');
    const character = objectValue(data.character, 'character');
    const date = objectValue(data.date, 'date');
    const spec: CandidateSpec = { id: stringValue(data.id, 'id'), kind: decodeGeneratorKind(data.kind),
        character: { role: stringValue(character.role, 'role'), race: stringValue(character.race, 'race'), gender: stringValue(character.gender, 'gender'), align: stringValue(character.align, 'align') },
        date: { datetime: stringValue(date.datetime, 'datetime'), category: decodeDateCategory(date.category), moon: numberValue(date.moon, 'moon'),
            friday13: booleanValue(date.friday13, 'friday13'), night: booleanValue(date.night, 'night'), midnight: booleanValue(date.midnight, 'midnight') },
        seed: numberValue(data.seed, 'seed'), debug: booleanValue(data.debug, 'debug') };
    if (data.recipe !== undefined) spec.recipe = stringValue(data.recipe, 'recipe');
    if (data.targetKeys !== undefined) spec.targetKeys = numberValue(data.targetKeys, 'targetKeys');
    if (data.targetDepth !== undefined) spec.targetDepth = numberValue(data.targetDepth, 'targetDepth');
    if (data.options !== undefined) spec.options = stringValue(data.options, 'options');
    if (spec.kind === 'recipe' && !spec.recipe) throw new Error('recipe candidate needs a recipe name');
    if (spec.kind === 'deep' && spec.targetDepth === undefined) throw new Error('deep candidate needs a target depth');
    return spec;
}
function strings(value: unknown, label: string): string[] { return arrayValue(value, label).map(item => stringValue(item, label)); }
function decodeMetrics(value: unknown): RecordingMetrics {
    const data = objectValue(value, 'metrics');
    const promptKinds: Record<string, number> = {};
    for (const [kind, count] of Object.entries(objectValue(data.promptKinds, 'prompt kinds'))) promptKinds[kind] = numberValue(count, kind);
    return { segments: numberValue(data.segments, 'segments'), steps: numberValue(data.steps, 'steps'), keys: numberValue(data.keys, 'keys'), rngCalls: numberValue(data.rngCalls, 'rngCalls'),
        gameplayScreens: numberValue(data.gameplayScreens, 'gameplayScreens'), maxDepth: numberValue(data.maxDepth, 'maxDepth'), maxTurn: numberValue(data.maxTurn, 'maxTurn'),
        maxExperienceLevel: numberValue(data.maxExperienceLevel, 'maxExperienceLevel'), promptKinds, endings: strings(data.endings, 'endings'), levels: strings(data.levels, 'levels'),
        animationFrames: numberValue(data.animationFrames, 'animationFrames'), ...(data.recipeChecks === undefined ? {} : { recipeChecks: strings(data.recipeChecks, 'recipeChecks') }) };
}
function decodePending(value: unknown): PendingRecording {
    const data = objectValue(value, 'pending recording');
    return { spec: decodeCandidate(data.spec), file: stringValue(data.file, 'file') };
}
export function decodeManifest(value: unknown): HoldoutManifest {
    const data = objectValue(value, 'holdout manifest');
    if (data.version !== 1 || data.tier !== 'dev-private' || data.sealed !== false) throw new Error('expected a version-1 development holdout manifest');
    const configuration = objectValue(data.configuration, 'configuration');
    return { version: 1, tier: 'dev-private', sealed: false, created: stringValue(data.created, 'created'),
        ...(data.updated === undefined ? {} : { updated: stringValue(data.updated, 'updated') }),
        attempts: numberValue(data.attempts, 'attempts'), configuration: { kinds: arrayValue(configuration.kinds, 'kinds').map(decodeGeneratorKind) },
        pending: arrayValue(data.pending, 'pending').map(decodePending),
        accepted: arrayValue(data.accepted, 'accepted').map(value => { const row = objectValue(value, 'accepted recording'); return { ...decodePending(row), metrics: decodeMetrics(row.metrics) }; }),
        rejected: arrayValue(data.rejected, 'rejected').map(value => { const row = objectValue(value, 'rejected recording'); return { spec: decodeCandidate(row.spec), reason: stringValue(row.reason, 'reason'), ...(row.diagnostic === undefined ? {} : { diagnostic: stringValue(row.diagnostic, 'diagnostic') }) }; }) };
}
