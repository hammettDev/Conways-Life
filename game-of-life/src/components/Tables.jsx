import React from 'react';
import { TABLES, tableOpen } from '../game/tables.js';

const money = (n) => (n >= 1000000 ? `$${n / 1000000}M` : n >= 1000 ? `$${n / 1000}k` : `$${n}`);

// The stakes tables, on the left. Higher tables take bigger bets, charge a fee and field sharper bots.
// The other game modes will live here too.
export default function Tables({ save, tableId, onPick, drafting, tutorial }) {
  return (
    <aside className="lobby" aria-label="Tables">
      <h2>Tables</h2>
      <ul className="list">
        {TABLES.map((t) => {
          const open = tableOpen(save, t);
          return (
            <li key={t.id}>
              <button
                className={t.id === tableId ? 'item on tableitem' : 'item tableitem'}
                disabled={!drafting || !open || tutorial}
                onClick={() => onPick(t.id)}
                aria-pressed={t.id === tableId}
              >
                <span className="name">{t.name}</span>
                <span className="meta">
                  {open
                    ? `Bets ${money(t.min)} to ${money(t.max)}${t.fee ? ` · ${Math.round(t.fee * 100)}% fee` : ''} · pieces ×${t.itemMult}`
                    : `Locked: reach ${money(t.unlock)}`}
                </span>
                {open && <span className="meta">{t.blurb}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <h2>More modes</h2>
      <ul className="list soon">
        <li><span className="item tableitem" aria-disabled="true"><span className="name">Football gauntlet</span><span className="meta">Coming soon</span></span></li>
        <li><span className="item tableitem" aria-disabled="true"><span className="name">4-player arena</span><span className="meta">Coming soon</span></span></li>
        <li><span className="item tableitem" aria-disabled="true"><span className="name">Pinball</span><span className="meta">Coming soon</span></span></li>
      </ul>
    </aside>
  );
}
