import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EegParamControls } from '../EegParamControls';

describe('EegParamControls', () => {
  const defaultProps = {
    amplitudeScale: 1,
    tcValue: null,
    hfValue: null,
    onAmplitudeChange: vi.fn(),
    onTcChange: vi.fn(),
    onHfChange: vi.fn(),
    disabled: false,
  };

  it('renders three parameter selectors', () => {
    render(<EegParamControls {...defaultProps} />);
    expect(screen.getByText('Sens')).toBeInTheDocument();
    expect(screen.getByText('TC')).toBeInTheDocument();
    expect(screen.getByText('HF')).toBeInTheDocument();
  });

  it('calls onAmplitudeChange when Sens select changes', () => {
    const onAmplitudeChange = vi.fn();
    render(<EegParamControls {...defaultProps} onAmplitudeChange={onAmplitudeChange} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '2' } });
    expect(onAmplitudeChange).toHaveBeenCalledWith(2);
  });

  it('calls onTcChange when TC select changes', () => {
    const onTcChange = vi.fn();
    render(<EegParamControls {...defaultProps} onTcChange={onTcChange} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: '0.3' } });
    expect(onTcChange).toHaveBeenCalledWith(0.3);
  });

  it('calls onTcChange with null when OFF selected', () => {
    const onTcChange = vi.fn();
    render(<EegParamControls {...defaultProps} onTcChange={onTcChange} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: '' } });
    expect(onTcChange).toHaveBeenCalledWith(null);
  });

  it('calls onHfChange when HF select changes', () => {
    const onHfChange = vi.fn();
    render(<EegParamControls {...defaultProps} onHfChange={onHfChange} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[2], { target: { value: '70' } });
    expect(onHfChange).toHaveBeenCalledWith(70);
  });

  it('calls onHfChange with null when OFF selected', () => {
    const onHfChange = vi.fn();
    render(<EegParamControls {...defaultProps} onHfChange={onHfChange} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[2], { target: { value: '' } });
    expect(onHfChange).toHaveBeenCalledWith(null);
  });

  it('disables all selects when disabled=true', () => {
    render(<EegParamControls {...defaultProps} disabled={true} />);

    const selects = screen.getAllByRole('combobox');
    selects.forEach((s) => expect(s).toBeDisabled());
  });
});
