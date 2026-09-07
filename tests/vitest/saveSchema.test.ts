import { describe, expect, it } from 'vitest';
import { SeededRng } from '../../src/game/core/rng/seededRng';
import { createRun, completeRouteNode } from '../../src/game/core/progression/run';
import { generateReward, claimReward } from '../../src/game/core/progression/rewards';
import { generateShopOffers } from '../../src/game/core/progression/shop';
import { createSaveEnvelope, migrateSaveEnvelope, DEFAULT_PROFILE, DEFAULT_SETTINGS } from '../../src/game/core/save/saveFormat';
import { parseSaveEnvelope } from '../../src/services/save/schema';

function makeV2Envelope(overrides: Record<string, unknown> = {}) {
  const run = createRun(['earl', 'hans', 'leandre'], 99);
  const nodeId = run.route.startNodeIds[0];
  const withNode = completeRouteNode(run, nodeId);
  const shopNodeId = withNode.route.nodes.find(n => n.type === 'shop')?.id ?? nodeId;
  const shopVisit = { nodeId: shopNodeId, offers: generateShopOffers(withNode, shopNodeId), purchasedOfferIds: [] };
  const envelope = migrateSaveEnvelope(
    createSaveEnvelope({ activeRun: { ...withNode, shopVisit }, profile: DEFAULT_PROFILE, settings: DEFAULT_SETTINGS }, 1)
  );
  return { ...envelope, payload: { ...envelope.payload, activeRun: { ...envelope.payload.activeRun, ...overrides } } };
}

describe('saveSchema Zod validation', () => {
  it('accepts a real v2 envelope through migrate then parse', () => {
    const run = createRun(['earl', 'hans', 'marcus'], 43);
    const completed = completeRouteNode(run, run.route.startNodeIds[0]);
    const reward = generateReward(completed, 'boss', new SeededRng(90));
    const claimed = claimReward(completed, reward, { relicId: reward.relicChoices[0], upgrade: reward.upgradeChoices[0] });
    const envelope = createSaveEnvelope({ activeRun: claimed, profile: DEFAULT_PROFILE, settings: DEFAULT_SETTINGS }, 1);
    const migrated = migrateSaveEnvelope(envelope);
    const parsed = parseSaveEnvelope(migrated);
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.payload.activeRun?.party.map(p => p.characterId)).toEqual(claimed.party.map(p => p.characterId));
    expect(parsed.payload.activeRun?.fieldUsesSpent).toBe(0);
    expect(parsed.payload.activeRun?.shopVisit).toBeNull();
  });

  it('rejects fieldUsesSpent: -1 (negative counter)', () => {
    const bad = makeV2Envelope({ fieldUsesSpent: -1 });
    expect(() => parseSaveEnvelope(bad)).toThrow();
  });

  it('rejects fieldUsesSpent: 0.5 (fractional counter)', () => {
    const bad = makeV2Envelope({ fieldUsesSpent: 0.5 });
    expect(() => parseSaveEnvelope(bad)).toThrow();
  });

  it('rejects shopVisit with purchasedOfferId absent from offers', () => {
    const run = createRun(['earl', 'hans', 'leandre'], 77);
    const nodeId = run.route.nodes.find(n => n.type === 'shop')?.id ?? run.route.startNodeIds[0];
    const offers = generateShopOffers(run, nodeId);
    const shopVisit = { nodeId, offers, purchasedOfferIds: ['nonexistent-offer-id'] };
    const envelope = migrateSaveEnvelope(
      createSaveEnvelope({ activeRun: { ...run, shopVisit, fieldUsesSpent: null }, profile: DEFAULT_PROFILE, settings: DEFAULT_SETTINGS }, 1)
    );
    expect(() => parseSaveEnvelope(envelope)).toThrow();
  });
});
