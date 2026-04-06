import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileWipeModal } from './ProfileWipeModal';
import type { DroneProfile } from '@shared/types/profile.types';

describe('ProfileWipeModal', () => {
  const mockProfile: DroneProfile = {
    id: 'profile-1',
    name: '5" Freestyle',
    fcSerialNumber: 'ABC123',
    size: '5"',
    battery: '6S',
    weight: 650,
    flightStyle: 'balanced',
    motorKV: 1950,
    propSize: '5.1"',
    snapshotIds: ['snapshot-1', 'snapshot-2'],
    connectionCount: 10,
    lastConnected: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fcInfo: {
      variant: 'BTFL',
      version: '4.4.0',
      target: 'STM32F405',
      boardName: 'MATEKF405',
      apiVersion: { protocol: 0, major: 1, minor: 46 },
    },
  };

  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnConfirm.mockResolvedValue(undefined);
  });

  it('renders modal with title', () => {
    render(
      <ProfileWipeModal profile={mockProfile} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );

    expect(screen.getByRole('heading', { name: 'Wipe Profile Data' })).toBeInTheDocument();
  });

  it('displays profile name in description', () => {
    render(
      <ProfileWipeModal profile={mockProfile} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );

    expect(screen.getByText('5" Freestyle')).toBeInTheDocument();
  });

  it('shows what will be deleted', () => {
    render(
      <ProfileWipeModal profile={mockProfile} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );

    expect(screen.getByText('All snapshots and backups')).toBeInTheDocument();
    expect(screen.getByText('All downloaded flight logs')).toBeInTheDocument();
    expect(screen.getByText('Active tuning session')).toBeInTheDocument();
    expect(screen.getByText('Tuning history')).toBeInTheDocument();
  });

  it('shows what will be kept', () => {
    render(
      <ProfileWipeModal profile={mockProfile} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );

    expect(
      screen.getByText('Profile configuration (name, drone size, battery, etc.)')
    ).toBeInTheDocument();
  });

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProfileWipeModal profile={mockProfile} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when wipe button clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProfileWipeModal profile={mockProfile} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );

    const wipeButton = screen.getByRole('button', { name: /wipe data/i });
    await user.click(wipeButton);

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state while wiping', async () => {
    const user = userEvent.setup();
    mockOnConfirm.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(
      <ProfileWipeModal profile={mockProfile} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );

    const wipeButton = screen.getByRole('button', { name: /wipe data/i });
    await user.click(wipeButton);

    expect(screen.getByText('Wiping...')).toBeInTheDocument();
    expect(wipeButton).toBeDisabled();
  });

  it('disables buttons while wiping', async () => {
    const user = userEvent.setup();
    mockOnConfirm.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(
      <ProfileWipeModal profile={mockProfile} onConfirm={mockOnConfirm} onCancel={mockOnCancel} />
    );

    const wipeButton = screen.getByRole('button', { name: /wipe data/i });
    await user.click(wipeButton);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeDisabled();
    expect(wipeButton).toBeDisabled();
  });
});
