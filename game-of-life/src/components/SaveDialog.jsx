import React, { useState } from 'react';

// Export your progress as a code, or import one. localStorage can be cleared by
// the browser, so this is the backup.
export default function SaveDialog({ code, onImport, onClose }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setMsg('Copied.'); } catch { setMsg('Select the code and copy it.'); }
  };
  const doImport = () => { const problem = onImport(text); setMsg(problem || 'Imported. Welcome back.'); };
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Save and load">
      <div className="dialog">
        <h2>Save and load</h2>
        <p className="note">Your progress lives in this browser. Copy this code to move to another device. A code only loads if it is newer than the progress already on the device, so it cannot be used to undo a loss.</p>
        <textarea readOnly value={code} rows={3} onFocus={(e) => e.target.select()} aria-label="Your save code" />
        <div className="row"><button className="ghost" onClick={copy}>Copy code</button></div>
        <p className="note">Have a code? Paste it here.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="GCW1...." aria-label="Paste a save code" />
        <div className="row">
          <button className="ghost" onClick={doImport} disabled={!text.trim()}>Load code</button>
          <button className="go small" onClick={onClose}>Done</button>
        </div>
        {msg && <p className="note" role="status">{msg}</p>}
      </div>
    </div>
  );
}
