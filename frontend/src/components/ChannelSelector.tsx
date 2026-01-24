import React from 'react';

interface ChannelSelectorProps {
  channels: string[];
  selectedChannels: number[];
  onChannelToggle: (channelIndex: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  channels,
  selectedChannels,
  onChannelToggle,
  onSelectAll,
  onDeselectAll,
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredChannels = channels.filter((channel) =>
    channel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="channel-selector">
      <div className="channel-selector-header">
        <h3>Channels</h3>
        <div className="channel-actions">
          <button onClick={onSelectAll} className="text-button">All</button>
          <button onClick={onDeselectAll} className="text-button">None</button>
        </div>
      </div>

      <input
        type="text"
        placeholder="Search channels..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="channel-search"
      />

      <div className="channel-list">
        {filteredChannels.map((channel) => {
          const actualIndex = channels.indexOf(channel);
          const isSelected = selectedChannels.includes(actualIndex);

          return (
            <label
              key={channel}
              className={`channel-item ${isSelected ? 'selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onChannelToggle(actualIndex)}
              />
              <span className="channel-name">{channel}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};
