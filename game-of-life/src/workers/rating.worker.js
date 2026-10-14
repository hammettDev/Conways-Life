import { ratePlayers } from '../engine/rating.js';

// Rating takes several seconds of simulation, so it runs off the main thread.
self.onmessage = (e) => {
  const rating = ratePlayers(e.data.players, (done, total) => self.postMessage({ type: 'progress', done, total }));
  self.postMessage({ type: 'done', rating });
};
