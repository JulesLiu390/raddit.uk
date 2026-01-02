import React from 'react';
import './MentionList.css';

const MentionList = ({ results, onSelect, style }) => {
  if (!results || results.length === 0) return null;

  return (
    <div className="mention-list" style={style}>
      {results.map(user => (
        <div key={user.id || user.googleId} className="mention-item" onClick={() => onSelect(user)}>
          <img src={user.picture || 'https://picsum.photos/40/40?random=1'} alt={user.name} />
          <div className="mention-info">
            <span className="mention-name">{user.name}</span>
            <span className="mention-id">@{user.id || user.googleId}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MentionList;
