import React, { useMemo, useState } from 'react';

const SPORT_LABEL = { football: 'Football', soccer: 'Soccer', basketball: 'Basketball', baseball: 'Baseball', hockey: 'Hockey' };

// Formations and the shop. Selecting previews on the board; Lock In commits.
export default function Sidebar({
  builds, objects, selectedId, onSelect, objectId, onObject, locked, onLockIn,
}) {
  const [tab, setTab] = useState('formations');
  const [sport, setSport] = useState('all');
  const [query, setQuery] = useState('');

  const sports = useMemo(() => {
    const counts = {};
    for (const b of builds) counts[b.sport] = (counts[b.sport] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [builds]);

  const shown = builds.filter((b) =>
    (sport === 'all' || b.sport === sport) && b.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <aside className="sidebar">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'formations'} onClick={() => setTab('formations')}>Formations</button>
        <button role="tab" aria-selected={tab === 'shop'} onClick={() => setTab('shop')}>Shop</button>
      </div>

      {tab === 'formations' ? (
        <>
          <input
            className="search" type="search" placeholder="Search formations" value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label="Search formations"
          />
          <div className="chips">
            <button className={sport === 'all' ? 'chip on' : 'chip'} onClick={() => setSport('all')}>All {builds.length}</button>
            {sports.map(([s, n]) => (
              <button key={s} className={sport === s ? 'chip on' : 'chip'} onClick={() => setSport(s)}>
                {SPORT_LABEL[s] || s} {n}
              </button>
            ))}
          </div>
          <ul className="list">
            {shown.map((b) => (
              <li key={b.id}>
                <button
                  className={b.id === selectedId ? 'item on' : 'item'}
                  onClick={() => !locked && onSelect(b.id)} disabled={locked}
                >
                  <span className="name">{b.name}</span>
                  <span className="meta">{SPORT_LABEL[b.sport] || b.sport}</span>
                </button>
              </li>
            ))}
            {!shown.length && <li className="empty">No formations match.</li>}
          </ul>
        </>
      ) : (
        <>
          <p className="note">One object per match. Wallet is not wired up yet, so these are preview-only.</p>
          <ul className="list">
            {objects.map((o) => (
              <li key={o.id}>
                <button className={o.id === objectId ? 'item on' : 'item'} onClick={() => !locked && onObject(o.id === objectId ? null : o.id)} disabled={locked}>
                  <span className="name">{o.name}</span>
                  <span className="meta">${o.price.toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <button className="lock" onClick={onLockIn} disabled={!selectedId || locked}>
        {locked ? 'Locked in' : 'Lock In'}
      </button>
    </aside>
  );
}
