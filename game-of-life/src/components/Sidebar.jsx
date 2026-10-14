import React, { useMemo, useState } from 'react';
import { MiniPreview, Thumb } from './MiniPreview.jsx';
import { DEMOS } from '../render/miniPreview.js';

const SPORT_LABEL = { football: 'Football', soccer: 'Soccer', basketball: 'Basketball', baseball: 'Baseball', hockey: 'Hockey' };
const money = (n) => `$${n.toLocaleString()}`;

// Formations and the shop. Selecting previews on the board; Lock In commits.
// In the shop each piece shows a looping demo of what it does, and can be dragged
// from that card onto your half of the board (or placed with a click).
export default function Sidebar({
  builds, objects, balance, wager, phase, free, bet, minBet, maxBet, onBet,
  selectedId, onSelect,
  objectId, onObject, placed, armed, onArm, onDragStart, onClearPlace,
  lockLabel, lockHint, canLock, onLockIn,
  audibleChoiceId, onAudibleConfirm, audibleLabel, canAudible,
  onSnap, onSkip, onNewMatch, bosses, onBoss, onCallAudible, onCancel, onBackAudible, audibleDisabled, audibleFee,
}) {
  const [tab, setTab] = useState('formations');
  const [sport, setSport] = useState('all');
  const [query, setQuery] = useState('');

  const drafting = phase === 'draft';
  const picking = phase === 'audible';
  const shopOpen = drafting;
  const activeTab = picking ? 'formations' : tab;

  const sports = useMemo(() => {
    const counts = {};
    for (const b of builds) counts[b.sport] = (counts[b.sport] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [builds]);

  const shown = builds.filter((b) =>
    (sport === 'all' || b.sport === sport) && b.name.toLowerCase().includes(query.trim().toLowerCase()));

  const chosen = objects.find((o) => o.id === objectId) || null;
  const currentId = picking ? audibleChoiceId : selectedId;

  return (
    <aside className="sidebar">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={activeTab === 'formations'} onClick={() => setTab('formations')}>Formations</button>
        {bosses && <button role="tab" aria-selected={activeTab === 'boss'} onClick={() => setTab('boss')} disabled={picking}>Boss{bosses.ready ? ' !' : ''}</button>}
        <button role="tab" aria-selected={activeTab === 'shop'} onClick={() => setTab('shop')} disabled={picking}>
          Shop{chosen && placed ? ' ·1' : ''}
        </button>
      </div>

      {picking && <p className="banner">Audible! Pick the formation you want to switch to.</p>}

      {activeTab === 'boss' && bosses ? (
        <>
          <p className="note">
            {bosses.ready
              ? 'A boss fight is open. Beat one and your winnings are multiplied by a hidden number from x2 to x20, revealed after the win. A loss costs your bet as usual.'
              : `Win ${bosses.toGo} more regular match${bosses.toGo === 1 ? '' : 'es'} to open a boss fight.`}
          </p>
          <ul className="list">
            {bosses.all.map((b) => {
              const open = bosses.list.some((x) => x.id === b.id);
              const beaten = bosses.beaten.includes(b.id);
              return (
                <li key={b.id}>
                  <button
                    className={bosses.selected === b.id ? 'item on bossitem' : 'item bossitem'}
                    disabled={!drafting || !bosses.ready || !open}
                    onClick={() => onBoss(bosses.selected === b.id ? null : b.id)}
                  >
                    <span className="name">{b.name}{beaten ? ' ✓' : ''}</span>
                    <span className="meta">{open ? (b.blurb) : 'Beat the boss before to unlock'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {bosses.selected && <p className="hint">Boss fight selected. Pick a formation and Challenge.</p>}
        </>
      ) : activeTab === 'formations' ? (
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
                  className={b.id === currentId ? 'item on' : 'item'}
                  onClick={() => onSelect(b.id)} disabled={!(drafting || picking) || (picking && b.id === selectedId)}
                >
                  <span className="name">{b.name}</span>
                  <span className="meta">{picking && b.id === selectedId ? 'current' : SPORT_LABEL[b.sport] || b.sport}</span>
                </button>
              </li>
            ))}
            {!shown.length && <li className="empty">No formations match.</li>}
          </ul>
        </>
      ) : (
        <>
          <p className="note">
            One piece per match. It replaces your back-row reserves. {shopOpen ? 'Pick one, then drag its card onto your half of the board.' : 'Locked until the next match.'}
          </p>

          {chosen && (
            <div className={`shopcard ${placed ? 'placed' : armed ? 'armed' : ''}`}>
              <div className="dragzone" onPointerDown={shopOpen ? onDragStart : undefined} style={{ touchAction: 'none' }} title="Drag onto your half of the board">
                <MiniPreview objectId={chosen.id} />
                <span className="draghint">{placed ? 'Placed on your half' : armed ? 'Click a spot on your half' : 'Drag me onto the board'}</span>
              </div>
              <div className="cardrow"><b>{chosen.name}</b><span className="price">{free ? 'free' : money(chosen.price)}</span></div>
              <p className="note">{DEMOS[chosen.id]?.note || chosen.blurb} <span>{chosen.cells} cells.</span></p>
              <div className="row">
                <button className="ghost" onClick={onArm} disabled={!shopOpen}>{placed ? 'Move' : 'Place'}</button>
                <button className="ghost" onClick={onClearPlace} disabled={!shopOpen}>Remove</button>
              </div>
            </div>
          )}

          <ul className="list">
            {objects.map((o) => {
              const afford = free || balance >= o.price + wager;
              return (
                <li key={o.id}>
                  <button
                    className={o.id === objectId ? 'item on withthumb' : 'item withthumb'}
                    onClick={() => onObject(o.id === objectId ? null : o.id)} disabled={!shopOpen || (!afford && o.id !== objectId)}
                  >
                    <Thumb shape={o.shape} />
                    <span className="name">{o.name}</span>
                    <span className="meta">{free ? 'free' : afford ? money(o.price) : `need ${money(o.price + wager - balance)} more`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {picking ? (
        <>
          <button className="lock" onClick={onAudibleConfirm} disabled={!canAudible}>{audibleLabel}</button>
          <button className="ghost" onClick={onBackAudible}>Back</button>
        </>
      ) : phase === 'playing' ? (
        <button className="lock" onClick={onSkip}>Skip to result</button>
      ) : phase === 'done' ? (
        <button className="lock" onClick={onNewMatch}>New match</button>
      ) : phase === 'locked' ? (
        <>
          <button className="lock" onClick={onSnap}>Snap</button>
          <div className="betrow">
            <button className="ghost" onClick={onCallAudible} disabled={audibleDisabled} title="Switch your formation after seeing the bot's">Audible {audibleFee}</button>
            <button className="ghost" onClick={onCancel}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          {bet != null && (
            <div className="betbox">
              <div className="betrow">
                <span>Bet <b>{money(bet)}</b></span>
                <button className="ghost small" onClick={() => onBet(maxBet)} disabled={!drafting || bet >= maxBet}>Max</button>
              </div>
              <input
                type="range" className="betslider" min={minBet} max={maxBet} step={10} value={bet}
                onChange={(e) => onBet(Number(e.target.value))} disabled={!drafting || maxBet <= minBet} aria-label="Bet amount"
              />
            </div>
          )}
          <button className="lock" onClick={onLockIn} disabled={!canLock}>{lockLabel}</button>
          {lockHint && <p className="hint">{lockHint}</p>}
        </>
      )}
    </aside>
  );
}
