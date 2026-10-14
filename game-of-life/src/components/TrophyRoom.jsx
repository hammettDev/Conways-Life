import React, { useEffect } from 'react';
import { trophyRoom } from '../game/trophies.js';

const Cup = ({ lit = true, small = false }) => (
  <svg viewBox="0 0 64 72" width={small ? 40 : 64} height={small ? 45 : 72} aria-hidden="true" className={lit ? 'cup lit' : 'cup'}>
    <path d="M14 6h36v8c0 14-6 24-18 26-12-2-18-12-18-26z" fill="currentColor" />
    <path d="M14 10H4c0 12 4 18 12 20M50 10h10c0 12-4 18-12 20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    <rect x="28" y="38" width="8" height="12" fill="currentColor" />
    <path d="M18 50h28l4 8H14z" fill="currentColor" />
    <rect x="12" y="58" width="40" height="8" rx="2" fill="currentColor" opacity="0.8" />
  </svg>
);

// The trophy room: championships and badges in a cabinet, and the records for each game. Opened from the header.
export default function TrophyRoom({ save, onClose }) {
  const room = trophyRoom(save);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="trophyroom" role="dialog" aria-label="Trophy room" onClick={onClose}>
      <div className="trophybox" onClick={(e) => e.stopPropagation()}>
        <div className="trophyhead">
          <h2>Trophy room</h2>
          <span className="note">{room.earned} of {room.badges.length} badges</span>
          <button className="ghost small" onClick={onClose}>Close</button>
        </div>

        <section className="cabinet">
          <h3>Gridiron Cellular Warfare</h3>
          <div className="shelf">
            {room.cups.length === 0 && <div className="cupslot empty"><Cup lit={false} /><span>Win the playoffs to put a championship here</span></div>}
            {room.cups.map((c) => (
              <div key={c.n} className="cupslot"><Cup /><b>Season {c.n}</b><span>{c.wins}-{c.losses}{c.ties ? `-${c.ties}` : ''} · {c.pf}-{c.pa}</span></div>
            ))}
          </div>
          {room.seasons.length > room.cups.length && (
            <p className="note">Seasons without a title: {room.seasons.filter((s) => !s.champion).map((s) => `#${s.n} (${s.wins}-${s.losses}${s.finish ? `, ${s.finish.toLowerCase()}` : ''})`).join(', ')}</p>
          )}
        </section>

        <section className="cabinet">
          <h3>Conway&apos;s Takeover: bosses</h3>
          <div className="shelf">
            {room.bosses.map((b) => (
              <div key={b.id} className={b.beaten ? 'cupslot' : 'cupslot empty'}><Cup lit={b.beaten} small /><b>{b.beaten ? b.name : '???'}</b></div>
            ))}
          </div>
        </section>

        <section className="records">
          <div>
            <h3>Football records</h3>
            <dl>{room.football.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
          </div>
          <div>
            <h3>Takeover records</h3>
            <dl>{room.takeover.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
          </div>
        </section>

        <section>
          <h3>Badges</h3>
          <ul className="badges">
            {room.badges.map((b) => (
              <li key={b.id} className={b.earned ? 'badge on' : 'badge'} title={b.desc}>
                <b>{b.earned ? b.name : '???'}</b>
                <span>{b.earned ? b.desc : `${b.game}: ${b.desc}`}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
