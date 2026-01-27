import React, { useEffect, useState } from 'react';

export const KeyboardShortcuts: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle with ? key
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setVisible(prev => !prev);
      }
      // Close on ESC
      if (e.key === 'Escape' && visible) {
        setVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  const dismiss = () => setVisible(false);

  if (!visible) return null;

  return (
    <div className="keyboard-shortcuts-overlay" onClick={dismiss}>
      <div className="keyboard-shortcuts-box" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-header">
          <span className="shortcuts-title">⌨️ Keyboard Shortcuts</span>
          <button className="shortcuts-dismiss" onClick={dismiss}>✕</button>
        </div>

        <div className="shortcuts-list">
          <div className="shortcut-item">
            <span className="shortcut-key">Space</span>
            <span className="shortcut-desc">Play / Pause</span>
          </div>

          <div className="shortcut-item">
            <span className="shortcut-key">← / →</span>
            <span className="shortcut-desc">Move -10s / +10s</span>
          </div>

          <div className="shortcut-item">
            <span className="shortcut-key">↑ / ↓</span>
            <span className="shortcut-desc">Zoom in / out time window</span>
          </div>

          <div className="shortcut-item">
            <span className="shortcut-key">+ / -</span>
            <span className="shortcut-desc">Zoom in / out amplitude</span>
          </div>

          <div className="shortcut-item">
            <span className="shortcut-key">?</span>
            <span className="shortcut-desc">Show / hide this help</span>
          </div>

          <div className="shortcut-item">
            <span className="shortcut-key">ESC</span>
            <span className="shortcut-desc">Close modals</span>
          </div>
        </div>

        <div className="shortcuts-footer">
          Press <strong>?</strong> to toggle, <strong>ESC</strong> to close
        </div>
      </div>
    </div>
  );
};
