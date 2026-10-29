import { describe, it, expect } from 'vitest';
import { playbackReducer as reduce, initialPlayback } from './playback';
import { graphPositions } from './layout';
describe('playback transitions', () => {
  it('clamps navigation and pauses manual seeks', () => {
    expect(
      reduce({ ...initialPlayback, playing: true }, { type: 'seek', index: 99, count: 4 }),
    ).toMatchObject({ index: 3, playing: false });
    expect(reduce(initialPlayback, { type: 'seek', index: -4, count: 4 }).index).toBe(0);
  });
  it('pauses at the final frame and replays from the beginning', () => {
    const end = reduce({ ...initialPlayback, index: 2, playing: true }, { type: 'tick', count: 4 });
    expect(end).toMatchObject({ index: 3, playing: false });
    expect(reduce(end, { type: 'play', count: 4 })).toMatchObject({ index: 0, playing: true });
  });
  it('ignores stale timer ticks after pause and resets while preserving speed', () => {
    expect(reduce(initialPlayback, { type: 'tick', count: 4 })).toBe(initialPlayback);
    expect(reduce({ index: 3, playing: true, speed: 150 }, { type: 'reset' })).toEqual({
      index: 0,
      playing: false,
      speed: 150,
    });
  });
  it('bounds speed and handles singleton traces', () => {
    expect(reduce(initialPlayback, { type: 'speed', speed: 0 }).speed).toBe(100);
    expect(reduce(initialPlayback, { type: 'speed', speed: 9000 }).speed).toBe(2000);
    expect(reduce(initialPlayback, { type: 'play', count: 1 }).playing).toBe(false);
  });
});
describe('tree layout', () => {
  it('preserves left/right ordering and assigns distinct positions to skewed trees', () => {
    const view = {
      kind: 'tree',
      nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      edges: [
        { id: 'a:left', from: 'a', to: 'b' },
        { id: 'b:right', from: 'b', to: 'c' },
      ],
    };
    const p = graphPositions(view);
    expect(p.get('b').x).toBeLessThan(p.get('a').x);
    expect(p.get('c').x).toBeGreaterThan(p.get('b').x);
    expect(p.get('c').y).toBeGreaterThan(p.get('b').y);
    expect(new Set([...p.values()].map(({ x, y }) => `${x}:${y}`)).size).toBe(3);
  });
});
