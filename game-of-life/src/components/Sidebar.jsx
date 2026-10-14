import React, { useMemo, useRef, useState } from 'react';
import { MiniPreview, Thumb } from './MiniPreview.jsx';
import { DEMOS } from '../render/miniPreview.js';
import { CHIP_STYLES, swatch, isAnimated } from '../game/cosmetics.js';

const SPORT_LABEL = { football: 'Football', soccer: 'Soccer', basketball: 'Basketball', baseball: 'Baseball', hockey: 'Hockey', custom: 'Custom' };
const money = (n) => `$${n.toLocaleString()}`;

// Formations and the shop. Selecting previews on the board; Lock In commits.
// In the shop each piece shows a looping demo of what it does, and can be dragged
// from that card onto your half of the board (or placed with a click).
export default function Sidebar(props) {
  const {
  builds, objects, balance, wager, phase, free, bet, minBet, maxBet, betStep = 10, onBet, styles,
  selectedId, onSelect,
  objectId, onObject, placed, armed, onArm, onDragStart, onClearPlace,
  lockLabel, lockHint, canLock, onLockIn,
  audibleChoiceId, onAudibleConfirm, audibleLabel, canAudible,
  sheet, onSheet, onSnap, onSkip, onReplay, onAutoStart, onAutoStop, auto, cancelFee, custom, onNewMatch, onCallAudible, onCancel, onBackAudible, audibleDisabled, audibleFee,
} = props;
  const [innerTab, setInnerTab] = useState('formations');
  // the tab can be driven from outside (the phone's bottom bar opens the shop directly)
  const tab = props.tab ?? innerTab;
  const setTab = props.onTab ?? setInnerTab;
  const [shopMode, setShopMode] = useState('pieces');
  // Hold the Lock In button to auto-play: it keeps firing the same bet until you let go.
  const held = useRef(false);
  const holdTimer = useRef(null);
  const holdToRepeat = {
    onPointerDown: () => {
      if (!auto) return;
      holdTimer.current = setTimeout(() => {
        held.current = true;
        onAutoStart();
        // the button is replaced by Stop once auto-play starts, so listen on the window for the release
        window.addEventListener('pointerup', () => { held.current = false; onAutoStop(); }, { once: true });
      }, 500);
    },
    onPointerUp: () => clearTimeout(holdTimer.current),
    onPointerLeave: () => clearTimeout(holdTimer.current),
  };

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
      <div className="panelbody">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={activeTab === 'formations'} onClick={() => setTab('formations')}>Formations</button>
        <button role="tab" aria-selected={activeTab === 'shop'} onClick={() => setTab('shop')} disabled={picking}>
          Shop{chosen && placed ? ' ·1' : ''}
        </button>
      </div>

      {picking && <p className="banner">Audible! Pick the formation you want to switch to.</p>}

      {activeTab === 'formations' ? (
        <>
          {custom && (custom.unlocked ? (
            <button className="ghost" onClick={custom.onNew} disabled={!drafting || custom.list.length >= custom.max}>
              + Design a formation{custom.list.length >= custom.max ? ' (slots full)' : ''}
            </button>
          ) : (
            <button className="ghost blip" onClick={custom.onBuy} disabled={!custom.canBuy || !drafting}
              title={`Design your own formation under the same rules as the rest. One-time unlock; save up to ${custom.max}.`}>
              Formation Designer · {custom.canBuy ? `unlock ${money(custom.price)}` : `need ${money(custom.price - balance)} more`}
            </button>
          ))}
          <input
            className="search" type="search" placeholder="Search formations" value={query}
            onChange={(e) => setQuery(e.target.value)} aria-label="Search formations"
          />
          {sports.length > 1 && (
          <div className="chips">
            <button className={sport === 'all' ? 'chip on' : 'chip'} onClick={() => setSport('all')}>All {builds.length}</button>
            {sports.map(([s, n]) => (
              <button key={s} className={sport === s ? 'chip on' : 'chip'} onClick={() => setSport(s)}>
                {SPORT_LABEL[s] || s} {n}
              </button>
            ))}
          </div>
          )}
          <ul className="list">
            {shown.map((b) => (
              <li key={b.id} className={b.sport === 'custom' ? 'customrow' : undefined}>
                <button
                  className={b.id === currentId ? 'item on' : 'item'}
                  onClick={() => onSelect(b.id)} disabled={!(drafting || picking) || (picking && b.id === selectedId)}
                >
                  <span className="name">{b.name}</span>
                  <span className="meta">{picking && b.id === selectedId ? 'current' : b.sport === 'football' ? '' : SPORT_LABEL[b.sport] || b.sport}</span>
                </button>
                {b.sport === 'custom' && custom && (
                  <>
                    <button className="ghost small" onClick={() => custom.onEdit(custom.list.find((c) => c.id === b.id))} disabled={!drafting}>Edit</button>
                    <button className="ghost small" onClick={() => custom.onDelete(b.id)} disabled={!drafting} aria-label={`Delete ${b.name}`}>✕</button>
                  </>
                )}
              </li>
            ))}
            {!shown.length && <li className="empty">No formations match.</li>}
          </ul>
        </>
      ) : (
        <>
          {styles && (
            <div className="segment" role="tablist" aria-label="Shop section">
              <button role="tab" aria-selected={shopMode === 'pieces'} className={shopMode === 'pieces' ? 'chip on' : 'chip'} onClick={() => setShopMode('pieces')}>Pieces</button>
              <button role="tab" aria-selected={shopMode === 'colours'} className={shopMode === 'colours' ? 'chip on' : 'chip'} onClick={() => setShopMode('colours')}>Chip colours</button>
            </div>
          )}
          {styles && shopMode === 'colours' ? (
            <>
              <p className="note">Recolour your own cells and chips. Purely cosmetic: it changes nothing about a match. Colour-changing ones shift over time.</p>
              <ul className="list">
                {CHIP_STYLES.map((c) => {
                  const own = styles.owned.includes(c.id);
                  const on = styles.equipped === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        className={on ? 'item on styleitem' : 'item styleitem'}
                        disabled={on || (!own && balance < c.price)}
                        onClick={() => (own ? styles.onEquip(c.id) : styles.onBuy(c.id))}
                        aria-label={`${c.name}${isAnimated(c) ? ' (colour-changing)' : ''}`}
                      >
                        <span className="swatch" style={{ background: swatch(c) }} />
                        <span className="name">{c.name}{isAnimated(c) ? ' ✦' : ''}</span>
                        <span className="meta">{on ? 'Equipped' : own ? 'Equip' : money(c.price)}</span>
                      </button>
                    </li>
                  );
                })}
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
                    <span className="meta">{free ? 'free' : afford ? `${money(o.price)}${o.heat > 1 ? ` (+${Math.round((o.heat - 1) * 100)}% repeat)` : ''}` : `need ${money(o.price + wager - balance)} more`}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          </>
          )}
        </>
      )}

      </div>
      <div className="actions">
        {onSheet && (
          <div className="mobnav" role="toolbar" aria-label="Menus">
            <button className={sheet === 'formations' ? 'on' : ''} onClick={() => onSheet('formations')}>Formations</button>
            <button className={sheet === 'shop' ? 'on' : ''} onClick={() => onSheet('shop')}>Shop</button>
            <button className={sheet === 'tables' ? 'on' : ''} onClick={() => onSheet('tables')}>Tables</button>
          </div>
        )}
      {auto && auto.on ? (
        <>
          <button className="lock" onClick={onAutoStop}>Stop auto-play</button>
          <p className="hint">Auto-play: {auto.n} played · {auto.net >= 0 ? '+' : '−'}{money(Math.abs(auto.net))}</p>
        </>
      ) : picking ? (
        <>
          <button className="lock" onClick={onAudibleConfirm} disabled={!canAudible}>{audibleLabel}</button>
          <button className="ghost" onClick={onBackAudible}>Back</button>
        </>
      ) : phase === 'playing' ? (
        <button className="lock" onClick={onSkip}>Skip to result</button>
      ) : phase === 'done' ? (
        <>
          <button className="lock" onClick={onNewMatch}>New match</button>
          <button className="ghost" onClick={onReplay}>Watch replay</button>
        </>
      ) : phase === 'locked' ? (
        <>
          <button className="lock" onClick={onSnap}>Snap</button>
          <div className="betrow">
            <button className="ghost" onClick={onCallAudible} disabled={audibleDisabled} title="Switch your formation after seeing the bot's">Audible {audibleFee}</button>
            <button className="ghost" onClick={onCancel}>Cancel{cancelFee ? ` · −${cancelFee}` : ''}</button>
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
                type="range" className="betslider" min={minBet} max={maxBet} step={betStep} value={bet}
                onChange={(e) => onBet(Number(e.target.value))} disabled={!drafting || maxBet <= minBet} aria-label="Bet amount"
              />
            </div>
          )}
          <button
            className="lock" disabled={!canLock} {...holdToRepeat}
            onClick={() => { if (!held.current) onLockIn(); held.current = false; }}
          >{lockLabel}</button>
          {lockHint && <p className="hint">{lockHint}</p>}
          {!lockHint && auto && <p className="hint">Hold Lock In to keep playing the same bet.</p>}
          {auto && <button className="ghost small" onClick={onAutoStart} disabled={!canLock}>Auto-play</button>}
          {auto && (
            <label className="note autopiece">
              <input type="checkbox" checked={auto.piece} onChange={(e) => auto.onPiece(e.target.checked)} /> Buy the same piece again each match
            </label>
          )}
        </>
      )}
      </div>
    </aside>
  );
}
