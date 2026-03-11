import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartTuningModal } from './StartTuningModal';
import { TUNING_TYPE } from '@shared/constants';

describe('StartTuningModal', () => {
  it('renders all three tuning mode options', () => {
    render(<StartTuningModal onStart={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('Filter Tune')).toBeInTheDocument();
    expect(screen.getByText('PID Tune')).toBeInTheDocument();
    expect(screen.getByText('Flash Tune')).toBeInTheDocument();
    expect(screen.getAllByText('1-2 flights')).toHaveLength(2);
    expect(screen.getByText('1 flight')).toBeInTheDocument();
  });

  it('shows "Start here" badge on Filter Tune', () => {
    render(<StartTuningModal onStart={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('Start here')).toBeInTheDocument();
  });

  it('calls onStart with filter when Filter Tune clicked', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={onStart} onCancel={vi.fn()} />);

    await user.click(screen.getByText('Filter Tune'));
    expect(onStart).toHaveBeenCalledWith(TUNING_TYPE.FILTER);
  });

  it('calls onStart with pid when PID Tune clicked', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={onStart} onCancel={vi.fn()} />);

    await user.click(screen.getByText('PID Tune'));
    expect(onStart).toHaveBeenCalledWith(TUNING_TYPE.PID);
  });

  it('calls onStart with quick when Flash Tune clicked', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={onStart} onCancel={vi.fn()} />);

    await user.click(screen.getByText('Flash Tune'));
    expect(onStart).toHaveBeenCalledWith(TUNING_TYPE.FLASH);
  });

  it('calls onCancel when Cancel clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when overlay clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByText('Choose Tuning Mode').closest('.start-tuning-overlay')!);
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not call onCancel when modal content clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByText('Choose Tuning Mode'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
