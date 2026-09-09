import { afterEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../src/app/appStore';
import { createRun } from '../../src/game/core/progression/run';
import { createSaveEnvelope, DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../../src/game/core/save/saveFormat';
import { parseSaveEnvelope } from '../../src/services/save/schema';
import { IndexedDbSaveRepository } from '../../src/services/save/IndexedDbSaveRepository';

afterEach(() => vi.restoreAllMocks());

it('commits an event once and ignores a replay against its completed node', async () => {
  const save = vi.spyOn(IndexedDbSaveRepository.prototype, 'save').mockResolvedValue(undefined as never);
  const run = createRun(['earl', 'hans', 'marcus'], 20260908);
  const node = run.route.nodes.find(candidate => candidate.type === 'event')!;
  node.eventId = 'swap-meet';
  run.currentNodeId = node.id;
  useAppStore.setState({ run, profile: structuredClone(DEFAULT_PROFILE), settings: structuredClone(DEFAULT_SETTINGS), screen: 'event', isResolving: false, sceneQueue: [], eventResult: null, error: null });
  await useAppStore.getState().chooseEvent('leave');
  const committed = structuredClone(useAppStore.getState().run!);
  expect(committed.completedNodeIds).toContain(node.id);
  expect(save).toHaveBeenCalledTimes(1);
  await useAppStore.getState().chooseEvent('leave');
  expect(useAppStore.getState().run).toEqual(committed);
  expect(save).toHaveBeenCalledTimes(1);
});

it('commits recruitment into the outgoing slot and persists the exact inherited state', async () => {
  let persisted: ReturnType<typeof createSaveEnvelope> | undefined;
  vi.spyOn(IndexedDbSaveRepository.prototype, 'save').mockImplementation(async payload => {
    persisted = createSaveEnvelope(payload, 1);
    return persisted;
  });
  let run = createRun(['hans', 'jiro', 'marcus'], 1);
  let node = run.route.nodes.find(candidate => candidate.type === 'event');
  const { deriveEventOffers } = await import('../../src/game/core/progression/events');
  for (let seed = 1; !node || !deriveEventOffers(run, node.id).recruitIds.includes('earl'); seed += 1) {
    run = createRun(['hans', 'jiro', 'marcus'], seed);
    node = run.route.nodes.find(candidate => candidate.type === 'event');
    if (node) { node.eventId = 'fourth-chair'; run.currentNodeId = node.id; }
  }
  run.party[0].hp = 46;
  run.party[0].abilityPP = { sidearm: 7, 'sentry-unit': 0, 'repair-drone': 0, overclock: 0 };
  const before = structuredClone(run);
  useAppStore.setState({ run, profile: structuredClone(DEFAULT_PROFILE), settings: structuredClone(DEFAULT_SETTINGS), screen: 'event', isResolving: false, sceneQueue: [], eventResult: null, error: null });
  await useAppStore.getState().chooseEvent('recruit', { kind: 'recruit', candidateId: 'earl', outgoingCharacterId: 'hans', upgradeIds: [] });
  const committed = useAppStore.getState().run!;
  expect(committed.party[0]).toMatchObject({ characterId: 'earl', hp: 55, abilityPP: { 'knuckle-up': 4, yosi: 2, 'patch-up': 1, adrenaline: 1 }, upgradedAbilities: [] });
  expect(committed.party.slice(1)).toEqual(before.party.slice(1));
  expect(committed.inventory).toEqual(before.inventory);
  expect(committed.coins).toBe(before.coins);
  expect(committed.completedNodeIds).toContain(committed.currentNodeId!);
  expect(parseSaveEnvelope(persisted).payload.activeRun?.party[0]).toEqual(committed.party[0]);
});


it('commits a press once and replays the parsed save without a second outcome', async () => {
  let persisted: ReturnType<typeof createSaveEnvelope> | undefined;
  const save = vi.spyOn(IndexedDbSaveRepository.prototype, 'save').mockImplementation(async payload => {
    persisted = createSaveEnvelope(payload, 1);
    return persisted;
  });
  const run = createRun(['earl', 'hans', 'marcus'], 20260908);
  const node = run.route.nodes.find(candidate => candidate.type === 'event')!;
  node.eventId = 'the-press';
  run.currentNodeId = node.id;
  run.relicIds = ['cardboard-plate'];
  const input = structuredClone(run);
  useAppStore.setState({ run, profile: structuredClone(DEFAULT_PROFILE), settings: structuredClone(DEFAULT_SETTINGS), screen: 'event', isResolving: false, sceneQueue: [], eventResult: null, error: null });

  await useAppStore.getState().chooseEvent('safe', { kind: 'pressRelic', relicId: 'cardboard-plate' });
  expect(persisted).toBeDefined();
  const parsed = parseSaveEnvelope(persisted);
  const committed = structuredClone(parsed.payload.activeRun!);
  const committedProfile = structuredClone(parsed.payload.profile);
  expect(committed.relicIds).toHaveLength(1);
  expect(committed.relicIds).not.toContain('cardboard-plate');
  expect(committed.completedNodeIds).toContain(node.id);
  expect(committed.score).toBe(input.score + 10);
  expect(committedProfile.discoveredRelics).toContain(committed.relicIds[0]);
  expect(save).toHaveBeenCalledTimes(1);

  useAppStore.setState({ run: committed, profile: committedProfile, settings: parsed.payload.settings, screen: 'event', isResolving: false, sceneQueue: [], eventResult: 'already shown', error: null });
  await useAppStore.getState().chooseEvent('safe', { kind: 'pressRelic', relicId: 'cardboard-plate' });
  expect(useAppStore.getState().run).toEqual(committed);
  expect(useAppStore.getState().profile).toEqual(committedProfile);
  expect(useAppStore.getState().run!.rngState).toBe(committed.rngState);
  expect(save).toHaveBeenCalledTimes(1);
});
