import { afterEach, expect, it, vi } from 'vitest';
import { useAppStore } from '../../src/app/appStore';
import { createRun } from '../../src/game/core/progression/run';
import { DEFAULT_SETTINGS } from '../../src/game/core/save/saveFormat';
import { IndexedDbSaveRepository } from '../../src/services/save/IndexedDbSaveRepository';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it.each([
  ['fast party', ['yatords', 'yeeho', 'earl']],
  ['slow party', ['marcus', 'hans', 'leandre']],
])('holds the encounter entrance before turns for a %s', async (_label, party) => {
  vi.useFakeTimers();
  vi.spyOn(IndexedDbSaveRepository.prototype, 'save').mockResolvedValue(undefined);
  const run = createRun(party, 20260907);
  useAppStore.setState({ run, screen: 'route', settings: { ...DEFAULT_SETTINGS, animationSpeed: 2 }, isResolving: false, sceneQueue: [], battleEvents: [] });
  const opening = useAppStore.getState().selectNode(run.route.startNodeIds[0]);
  await vi.advanceTimersByTimeAsync(0);
  expect(useAppStore.getState().isResolving).toBe(true);
  expect(useAppStore.getState()).toHaveProperty('battleEntrance.duration', 1200);
  expect(useAppStore.getState().battleEvents).toEqual([]);
  const before = JSON.stringify(useAppStore.getState().run);
  const battle = useAppStore.getState().run!.activeBattle!;
  await useAppStore.getState().battleGuard(battle.turnOrder[battle.turnIndex]);
  expect(JSON.stringify(useAppStore.getState().run)).toBe(before);
  await vi.advanceTimersByTimeAsync(1199);
  expect(useAppStore.getState()).toHaveProperty('battleEntrance.duration', 1200);
  expect(useAppStore.getState().battleEvents).toEqual([]);
  await vi.advanceTimersByTimeAsync(1);
  expect(useAppStore.getState()).toHaveProperty('battleEntrance', null);
  await vi.runAllTimersAsync();
  await opening;
  expect(useAppStore.getState().isResolving).toBe(false);
});
