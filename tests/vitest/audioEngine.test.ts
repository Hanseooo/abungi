import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../../src/services/audio/audioEngine';
import { DEFAULT_SETTINGS } from '../../src/game/core/save/saveFormat';

class FakeAudio {
  currentTime = 0;
  loop = false;
  playbackRate = 1;
  volume = 1;
  paused = false;
  listeners = new Map<string, () => void>();
  constructor(public readonly src: string, private readonly rejectPlay = false) {}
  play = vi.fn(async () => {
    if (this.rejectPlay) throw new Error('codec unavailable');
  });
  pause = vi.fn(() => { this.paused = true; });
  addEventListener(name: string, listener: () => void) { this.listeners.set(name, listener); }
  removeEventListener(name: string) { this.listeners.delete(name); }
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('AudioEngine', () => {
  it('keeps one exploration loop across non-battle screens and fades when combat starts', async () => {
    vi.useFakeTimers();
    const created: FakeAudio[] = [];
    const engine = new AudioEngine(src => {
      const audio = new FakeAudio(src);
      created.push(audio);
      return audio as unknown as HTMLAudioElement;
    });
    engine.configure({ ...DEFAULT_SETTINGS, musicVolume: 1 });
    engine.unlock();

    await engine.musicTrack('exploration-music');
    await engine.musicTrack('exploration-music');
    expect(created.map(audio => audio.src)).toEqual(['/audio/exploration-music.wav']);

    await engine.musicTrack('battle-music');
    expect(created.map(audio => audio.src)).toEqual(['/audio/exploration-music.wav', '/audio/battle-music.wav']);
    expect(created[0].pause).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(created[0].pause).toHaveBeenCalledOnce();
    expect(created[1].volume).toBeCloseTo(.52);
  });

  it('layers an impact with healing feedback and absorbs playback failures', async () => {
    const created: FakeAudio[] = [];
    const engine = new AudioEngine(src => {
      const audio = new FakeAudio(src, src.endsWith('/heal.wav'));
      created.push(audio);
      return audio as unknown as HTMLAudioElement;
    });
    engine.unlock();

    await expect(engine.combatSfx([
      { type: 'hit', targetId: 'ally-1' },
      { type: 'heal', targetId: 'ally-1', amount: 12 },
    ])).resolves.toBeUndefined();
    expect(created.map(audio => audio.src)).toEqual(['/audio/hit.wav', '/audio/heal.wav']);
  });
});
