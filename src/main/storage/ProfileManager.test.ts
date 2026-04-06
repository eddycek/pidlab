import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfileManager } from './ProfileManager';

// Mock dependencies
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-profile-uuid'),
}));

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockStorage = vi.hoisted(() => ({
  ensureDirectory: vi.fn(),
  saveProfile: vi.fn(),
  loadProfile: vi.fn(),
  deleteProfile: vi.fn(),
  loadProfiles: vi.fn().mockResolvedValue({}),
  findProfileBySerial: vi.fn(),
  exportProfile: vi.fn(),
}));

vi.mock('./ProfileStorage', () => {
  return {
    ProfileStorage: class MockProfileStorage {
      ensureDirectory = mockStorage.ensureDirectory;
      saveProfile = mockStorage.saveProfile;
      loadProfile = mockStorage.loadProfile;
      deleteProfile = mockStorage.deleteProfile;
      loadProfiles = mockStorage.loadProfiles;
      findProfileBySerial = mockStorage.findProfileBySerial;
      exportProfile = mockStorage.exportProfile;
    },
  };
});

describe('ProfileManager', () => {
  let manager: ProfileManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ProfileManager('/tmp/test-profiles');
  });

  describe('clearSnapshotRefs', () => {
    it('clears snapshotIds and baselineSnapshotId', async () => {
      const profile = {
        id: 'profile-1',
        name: 'Test Drone',
        snapshotIds: ['snap-1', 'snap-2', 'snap-baseline'],
        baselineSnapshotId: 'snap-baseline',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      mockStorage.loadProfile.mockResolvedValue(profile);

      await manager.clearSnapshotRefs('profile-1');

      expect(mockStorage.saveProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'profile-1',
          snapshotIds: [],
          baselineSnapshotId: undefined,
        })
      );
    });

    it('updates the updatedAt timestamp', async () => {
      const profile = {
        id: 'profile-1',
        name: 'Test Drone',
        snapshotIds: ['snap-1'],
        baselineSnapshotId: 'snap-1',
        updatedAt: '2020-01-01T00:00:00.000Z',
      };

      mockStorage.loadProfile.mockResolvedValue(profile);

      await manager.clearSnapshotRefs('profile-1');

      const savedProfile = mockStorage.saveProfile.mock.calls[0][0];
      expect(new Date(savedProfile.updatedAt).getTime()).toBeGreaterThan(
        new Date('2020-01-01').getTime()
      );
    });

    it('throws if profile not found', async () => {
      mockStorage.loadProfile.mockResolvedValue(null);

      await expect(manager.clearSnapshotRefs('nonexistent')).rejects.toThrow(
        'Profile nonexistent not found'
      );
    });

    it('works when profile has no snapshots', async () => {
      const profile = {
        id: 'profile-1',
        name: 'Test Drone',
        snapshotIds: [],
        baselineSnapshotId: undefined,
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      mockStorage.loadProfile.mockResolvedValue(profile);

      await manager.clearSnapshotRefs('profile-1');

      expect(mockStorage.saveProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshotIds: [],
          baselineSnapshotId: undefined,
        })
      );
    });
  });
});
