import { describe, expect, test } from 'bun:test';
import {
  DEPOSIT_CHANNEL_MANIFEST,
  DEPOSIT_CHANNELS,
  PAYOUT_CHANNEL_MANIFEST,
  PAYOUT_CHANNELS,
  SUBSCRIPTION_CHANNEL_MANIFEST,
  SUBSCRIPTION_CHANNELS,
} from './env';

const expectManifestParity = <Channel extends string>(
  manifest: readonly { channel: Channel; presetFile: string; auditTarget: string }[],
  channels: readonly Channel[],
  feature: string,
) => {
  expect(channels).toEqual(manifest.map(({ channel }) => channel));
  expect(new Set(channels).size).toBe(channels.length);

  for (const entry of manifest) {
    expect(entry.presetFile).toBe(`${entry.channel}.json`);
    expect(entry.auditTarget).toBe(`preset_channels:${feature}:${entry.channel}`);
  }
};

describe('backend channel manifests', () => {
  test('derive channel ids, preset filenames, and audit targets from one manifest', () => {
    expectManifestParity(DEPOSIT_CHANNEL_MANIFEST, DEPOSIT_CHANNELS, 'deposit');
    expectManifestParity(PAYOUT_CHANNEL_MANIFEST, PAYOUT_CHANNELS, 'payout');
    expectManifestParity(SUBSCRIPTION_CHANNEL_MANIFEST, SUBSCRIPTION_CHANNELS, 'subscription');
  });

  test('keep one default channel and explicitly mark deferred sources', () => {
    expect(DEPOSIT_CHANNEL_MANIFEST.filter((entry) => entry.default)).toHaveLength(1);
    expect(PAYOUT_CHANNEL_MANIFEST.filter((entry) => entry.default)).toHaveLength(1);
    expect(SUBSCRIPTION_CHANNEL_MANIFEST.filter((entry) => entry.default)).toHaveLength(1);
    expect(DEPOSIT_CHANNEL_MANIFEST.filter((entry) => entry.deferred).map(({ channel }) => channel)).toEqual([
      'JCB-USD',
      'JCB-JPY',
    ]);
  });
});
