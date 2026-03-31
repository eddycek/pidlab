import { describe, it, expect } from 'vitest';
import { parseDiffSetting, parseProfileNamesFromDiff } from './types';

describe('parseDiffSetting', () => {
  it('should parse a setting from CLI diff', () => {
    const diff = 'set gyro_lpf1_static_hz = 250\nset dterm_lpf1_static_hz = 150';
    expect(parseDiffSetting(diff, 'gyro_lpf1_static_hz')).toBe('250');
    expect(parseDiffSetting(diff, 'dterm_lpf1_static_hz')).toBe('150');
  });

  it('should return undefined for missing setting', () => {
    expect(parseDiffSetting('set a = 1', 'b')).toBeUndefined();
  });
});

describe('parseProfileNamesFromDiff', () => {
  it('should parse profile names from multi-profile diff', () => {
    const diff = [
      '# master',
      'set debug_mode = GYRO_SCALED',
      '',
      'profile 0',
      'set profile_name = pidlab_1',
      'set p_roll = 45',
      '',
      'profile 1',
      'set profile_name = Tuned',
      'set p_roll = 50',
      '',
      'rateprofile 0',
      'set rates_type = ACTUAL',
    ].join('\n');

    const names = parseProfileNamesFromDiff(diff);
    expect(names).toEqual({ 0: 'pidlab_1', 1: 'Tuned' });
  });

  it('should handle # prefix in profile headers', () => {
    const diff = ['# profile 0', 'set profile_name = Stock', '# profile 1', 'set p_roll = 50'].join(
      '\n'
    );

    const names = parseProfileNamesFromDiff(diff);
    expect(names).toEqual({ 0: 'Stock' });
  });

  it('should return empty object when no profile names set', () => {
    const diff = ['profile 0', 'set p_roll = 45', 'profile 1', 'set p_roll = 50'].join('\n');

    expect(parseProfileNamesFromDiff(diff)).toEqual({});
  });

  it('should skip empty profile names', () => {
    const diff = [
      'profile 0',
      'set profile_name = ',
      'profile 1',
      'set profile_name = MyTune',
    ].join('\n');

    const names = parseProfileNamesFromDiff(diff);
    expect(names).toEqual({ 1: 'MyTune' });
  });

  it('should stop parsing profile_name after rateprofile section', () => {
    const diff = [
      'profile 0',
      'set profile_name = Good',
      'rateprofile 0',
      'set rateprofile_name = Fast',
    ].join('\n');

    const names = parseProfileNamesFromDiff(diff);
    expect(names).toEqual({ 0: 'Good' });
  });

  it('should return empty for empty diff', () => {
    expect(parseProfileNamesFromDiff('')).toEqual({});
  });

  it('should handle diff with only master section (no profiles)', () => {
    const diff = '# master\nset gyro_lpf1_static_hz = 250';
    expect(parseProfileNamesFromDiff(diff)).toEqual({});
  });
});
