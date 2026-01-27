import React, { useEffect, useState } from 'react';

export const InteractionHint: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hasSeenHints = localStorage.getItem('edf-hints-seen');
    if (!hasSeenHints) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        localStorage.setItem('edf-hints-seen', 'true');
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem('edf-hints-seen', 'true');
  };

  return (
    <div className="interaction-hint-overlay" onClick={dismiss}>
      <div className="interaction-hint-box" onClick={(e) => e.stopPropagation()}>
        <div className="hint-header">
          <span className="hint-title">💡 Interactive Features</span>
          <button className="hint-dismiss" onClick={dismiss}>✕</button>
        </div>

        <div className="hint-list">
          <div className="hint-item">
            <span className="hint-icon">🖱️</span>
            <span className="hint-text"><strong>Scroll wheel</strong> to zoom (left: amplitude, right: time)</span>
          </div>
          <div className="hint-item">
            <span className="hint-icon">✋</span>
            <span className="hint-text"><strong>Drag</strong> to pan through the timeline</span>
          </div>
          <div className="hint-item">
            <span className="hint-icon">👆</span>
            <span className="hint-text"><strong>Click</strong> anywhere to position cursor</span>
          </div>
          <div className="hint-item">
            <span className="hint-icon">⌨️</span>
            <span className="hint-text">Press <strong>?</strong> for keyboard shortcuts</span>
          </div>
        </div>

        <div className="hint-footer">
          Click anywhere or press ESC to dismiss
        </div>
      </div>
    </div>
  );
};
