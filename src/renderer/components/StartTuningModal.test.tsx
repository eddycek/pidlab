import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartTuningModal } from './StartTuningModal';
import { TUNING_TYPE } from '@shared/constants';
import type { FCInfo } from '@shared/types/common.types';
import type { CompletedTuningRecord } from '@shared/types/tuning-history.types';

const DEMO_FC_INFO: FCInfo = {
  variant: 'BTFL',
  version: '4.5.1',
  target: 'STM32F405',
  boardName: 'OMNIBUSF4SD',
  apiVersion: { protocol: 0, major: 1, minor: 46 },
  pidProfileIndex: 0,
  pidProfileCount: 4,
};

describe('StartTuningModal', () => {
  beforeEach(() => {
    // Default: getConnectionStatus returns disconnected (no FC info)
    // so tests without fcInfo prop resolve loading state quickly
    vi.mocked(window.betaflight.getConnectionStatus).mockResolvedValue({
      connected: false,
    });
  });

  it('renders all three tuning mode options', async () => {
    render(<StartTuningModal onStart={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByText('Filter Tune');

    expect(screen.getByText('Filter Tune')).toBeInTheDocument();
    expect(screen.getByText('PID Tune')).toBeInTheDocument();
    expect(screen.getByText('Flash Tune')).toBeInTheDocument();
    expect(screen.getAllByText('2 flights')).toHaveLength(3);
  });

  it('shows "Start here" badge on Filter Tune', async () => {
    render(<StartTuningModal onStart={vi.fn()} onCancel={vi.fn()} />);
    await screen.findByText('Start here');
  });

  it('calls onStart with filter when Filter Tune clicked', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={onStart} onCancel={vi.fn()} />);
    await screen.findByText('Filter Tune');

    await user.click(screen.getByText('Filter Tune'));
    expect(onStart).toHaveBeenCalledWith(TUNING_TYPE.FILTER, undefined);
  });

  it('calls onStart with pid when PID Tune clicked', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={onStart} onCancel={vi.fn()} />);
    await screen.findByText('PID Tune');

    await user.click(screen.getByText('PID Tune'));
    expect(onStart).toHaveBeenCalledWith(TUNING_TYPE.PID, undefined);
  });

  it('calls onStart with quick when Flash Tune clicked', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={onStart} onCancel={vi.fn()} />);
    await screen.findByText('Flash Tune');

    await user.click(screen.getByText('Flash Tune'));
    expect(onStart).toHaveBeenCalledWith(TUNING_TYPE.FLASH, undefined);
  });

  it('calls onCancel when Cancel clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={vi.fn()} onCancel={onCancel} />);
    await screen.findByText('Cancel');

    await user.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when overlay clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={vi.fn()} onCancel={onCancel} />);
    await screen.findByText('Cancel');

    await user.click(screen.getByText('Choose Tuning Mode').closest('.start-tuning-overlay')!);
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not call onCancel when modal content clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={vi.fn()} onCancel={onCancel} />);
    await screen.findByText('Cancel');

    await user.click(screen.getByText('Choose Tuning Mode'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  // PID profile selector tests
  it('shows profile selector when fcInfo has multiple profiles', () => {
    render(<StartTuningModal onStart={vi.fn()} onCancel={vi.fn()} fcInfo={DEMO_FC_INFO} />);

    expect(screen.getByText('BF PID Profile')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('does not show profile selector when fcInfo has single profile', () => {
    const singleProfileFC: FCInfo = { ...DEMO_FC_INFO, pidProfileCount: 1 };
    render(<StartTuningModal onStart={vi.fn()} onCancel={vi.fn()} fcInfo={singleProfileFC} />);

    expect(screen.queryByText('BF PID Profile')).not.toBeInTheDocument();
  });

  it('passes selected profile index when starting tuning', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={onStart} onCancel={vi.fn()} fcInfo={DEMO_FC_INFO} />);

    // Click profile 2 (index 1)
    await user.click(screen.getByText('2'));
    await user.click(screen.getByText('Filter Tune'));

    expect(onStart).toHaveBeenCalledWith(TUNING_TYPE.FILTER, 1);
  });

  it('shows "current" label on active FC profile', () => {
    render(<StartTuningModal onStart={vi.fn()} onCancel={vi.fn()} fcInfo={DEMO_FC_INFO} />);

    expect(screen.getByText('current')).toBeInTheDocument();
  });

  it('shows user-defined profile labels', () => {
    render(
      <StartTuningModal
        onStart={vi.fn()}
        onCancel={vi.fn()}
        fcInfo={DEMO_FC_INFO}
        pidProfileLabels={{ 0: 'Stock', 1: 'Tuned' }}
      />
    );

    expect(screen.getByText('Stock')).toBeInTheDocument();
    expect(screen.getByText('Tuned')).toBeInTheDocument();
  });

  it('defaults to profile from defaultPidProfileIndex prop', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(
      <StartTuningModal
        onStart={onStart}
        onCancel={vi.fn()}
        fcInfo={DEMO_FC_INFO}
        defaultPidProfileIndex={2}
      />
    );

    // Without clicking any profile button, start Filter Tune
    await user.click(screen.getByText('Filter Tune'));
    expect(onStart).toHaveBeenCalledWith(TUNING_TYPE.FILTER, 2);
  });

  // Tuning history context tests
  it('shows session count and recency for profiles with history', () => {
    const history: CompletedTuningRecord[] = [
      {
        id: '1',
        profileId: 'p1',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        tuningType: TUNING_TYPE.FILTER,
        bfPidProfileIndex: 1,
        baselineSnapshotId: null,
        postFilterSnapshotId: null,
        postTuningSnapshotId: null,
        filterLogId: null,
        pidLogId: null,
        quickLogId: null,
        verificationLogId: null,
        appliedFilterChanges: [],
        appliedPIDChanges: [],
        appliedFeedforwardChanges: [],
        filterMetrics: null,
        pidMetrics: null,
        verificationMetrics: null,
        verificationPidMetrics: null,
        transferFunctionMetrics: null,
      },
      {
        id: '2',
        profileId: 'p1',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        tuningType: TUNING_TYPE.PID,
        bfPidProfileIndex: 1,
        baselineSnapshotId: null,
        postFilterSnapshotId: null,
        postTuningSnapshotId: null,
        filterLogId: null,
        pidLogId: null,
        quickLogId: null,
        verificationLogId: null,
        appliedFilterChanges: [],
        appliedPIDChanges: [],
        appliedFeedforwardChanges: [],
        filterMetrics: null,
        pidMetrics: null,
        verificationMetrics: null,
        verificationPidMetrics: null,
        transferFunctionMetrics: null,
      },
    ];

    render(
      <StartTuningModal
        onStart={vi.fn()}
        onCancel={vi.fn()}
        fcInfo={DEMO_FC_INFO}
        tuningHistory={history}
      />
    );

    // Profile 2 (index 1) should show "2 tunes · today"
    expect(screen.getByText(/2 tunes/)).toBeInTheDocument();
    expect(screen.getByText(/today/)).toBeInTheDocument();
  });

  it('shows "unused" for profiles with no tuning history', () => {
    render(
      <StartTuningModal
        onStart={vi.fn()}
        onCancel={vi.fn()}
        fcInfo={DEMO_FC_INFO}
        tuningHistory={[]}
      />
    );

    // Profiles 2, 3, 4 (not current) should show "unused"
    expect(screen.getAllByText('unused')).toHaveLength(3);
  });

  it('shows no profile names when no labels provided', () => {
    render(<StartTuningModal onStart={vi.fn()} onCancel={vi.fn()} fcInfo={DEMO_FC_INFO} />);

    // Profile numbers shown, but no name spans rendered
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('pidlab_1')).not.toBeInTheDocument();
  });

  // Self-hydration: fcInfo missing → fetched from getConnectionStatus
  it('fetches FC info and shows profile selector when fcInfo prop is missing', async () => {
    vi.mocked(window.betaflight.getConnectionStatus).mockResolvedValue({
      connected: true,
      fcInfo: DEMO_FC_INFO,
    });

    render(<StartTuningModal onStart={vi.fn()} onCancel={vi.fn()} />);

    // Initially no profile selector
    expect(screen.queryByText('BF PID Profile')).not.toBeInTheDocument();

    // After async hydration, profile selector appears
    await screen.findByText('BF PID Profile');
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('passes fetched profile index when starting after hydration', async () => {
    vi.mocked(window.betaflight.getConnectionStatus).mockResolvedValue({
      connected: true,
      fcInfo: { ...DEMO_FC_INFO, pidProfileIndex: 2 },
    });

    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<StartTuningModal onStart={onStart} onCancel={vi.fn()} />);

    // Wait for hydration
    await screen.findByText('BF PID Profile');

    // Click profile 1 (index 0) then start
    await user.click(screen.getByText('1'));
    await user.click(screen.getByText('PID Tune'));

    expect(onStart).toHaveBeenCalledWith(TUNING_TYPE.PID, 0);
  });
});
