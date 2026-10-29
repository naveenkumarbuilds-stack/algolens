export const initialPlayback = { index: 0, playing: false, speed: 650 };
export function playbackReducer(state, action) {
  const last = Math.max(0, (action.count ?? 1) - 1);
  switch (action.type) {
    case 'play':
      return { ...state, index: state.index >= last ? 0 : state.index, playing: last > 0 };
    case 'pause':
      return { ...state, playing: false };
    case 'tick':
      return !state.playing
        ? state
        : { ...state, index: Math.min(last, state.index + 1), playing: state.index + 1 < last };
    case 'seek':
      return { ...state, index: Math.max(0, Math.min(last, action.index)), playing: false };
    case 'reset':
      return { ...state, index: 0, playing: false };
    case 'speed':
      return { ...state, speed: Math.max(100, Math.min(2000, action.speed)) };
    default:
      return state;
  }
}
