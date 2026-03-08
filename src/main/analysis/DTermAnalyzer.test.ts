import { describe, it, expect } from 'vitest';
import { analyzeDTermEffectiveness } from './DTermAnalyzer';
import type { BlackboxFlightData } from '@shared/types/blackbox.types';
import type { TimeSeries } from '@shared/types/blackbox.types';
import { FFT_WINDOW_SIZE } from './constants';

/** Create a TimeSeries filled with a given value or generator function */
function makeTimeSeries(length: number, valueFn: (i: number) => number = () => 0): TimeSeries {
  const time = new Float64Array(length);
  const values = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    time[i] = i / 4000; // 4 kHz sample rate
    values[i] = valueFn(i);
  }
  return { time, values };
}

/** Create minimal BlackboxFlightData with configurable axis generators */
function makeFlightData(
  length: number,
  options: {
    gyroFn?: (axis: number, i: number) => number;
    setpointFn?: (axis: number, i: number) => number;
    pidDFn?: (axis: number, i: number) => number;
  } = {}
): BlackboxFlightData {
  const { gyroFn = () => 0, setpointFn = () => 0, pidDFn = () => 0 } = options;

  const makeAxisTuple = (fn: (axis: number, i: number) => number) =>
    [0, 1, 2].map((axis) => makeTimeSeries(length, (i) => fn(axis, i))) as [
      TimeSeries,
      TimeSeries,
      TimeSeries,
    ];

  return {
    gyro: makeAxisTuple(gyroFn),
    setpoint: [
      ...makeAxisTuple(setpointFn),
      makeTimeSeries(length), // throttle
    ] as [TimeSeries, TimeSeries, TimeSeries, TimeSeries],
    pidP: makeAxisTuple(() => 0),
    pidI: makeAxisTuple(() => 0),
    pidD: makeAxisTuple(pidDFn),
    pidF: makeAxisTuple(() => 0),
    motor: [
      makeTimeSeries(length),
      makeTimeSeries(length),
      makeTimeSeries(length),
      makeTimeSeries(length),
    ] as [TimeSeries, TimeSeries, TimeSeries, TimeSeries],
    debug: [],
    sampleRateHz: 4000,
    durationSeconds: length / 4000,
    frameCount: length,
  };
}

describe('DTermAnalyzer', () => {
  describe('analyzeDTermEffectiveness', () => {
    it('should return undefined when pidD data is missing', () => {
      const data = makeFlightData(FFT_WINDOW_SIZE * 2);
      // Force pidD to be undefined-ish
      (data as Record<string, unknown>).pidD = undefined;

      const result = analyzeDTermEffectiveness(data);
      expect(result).toBeUndefined();
    });

    it('should return undefined when pidD has fewer than 3 axes', () => {
      const data = makeFlightData(FFT_WINDOW_SIZE * 2);
      // Force pidD to have only 2 elements
      (data as Record<string, unknown>).pidD = [data.pidD[0], data.pidD[1]];

      const result = analyzeDTermEffectiveness(data);
      expect(result).toBeUndefined();
    });

    it('should handle very short flight data (< FFT_WINDOW_SIZE samples)', () => {
      const shortLength = FFT_WINDOW_SIZE - 1;
      const data = makeFlightData(shortLength);

      const result = analyzeDTermEffectiveness(data);

      // Should return with all axes = 0 (data too short for FFT)
      expect(result).toBeDefined();
      expect(result!.roll).toBe(0);
      expect(result!.pitch).toBe(0);
      expect(result!.yaw).toBe(0);
      expect(result!.overall).toBe(0);
    });

    it('should return effectiveness values in 0-1 range for valid data', () => {
      const length = FFT_WINDOW_SIZE * 4;
      const data = makeFlightData(length, {
        // Gyro has some noise in the analysis band (50 Hz oscillation)
        gyroFn: (_axis, i) => Math.sin((2 * Math.PI * 50 * i) / 4000) * 10,
        // Setpoint is steady (so error = -gyro)
        setpointFn: () => 0,
        // D-term has some response to the oscillation
        pidDFn: (_axis, i) => Math.cos((2 * Math.PI * 50 * i) / 4000) * 3,
      });

      const result = analyzeDTermEffectiveness(data);

      expect(result).toBeDefined();
      expect(result!.roll).toBeGreaterThanOrEqual(0);
      expect(result!.roll).toBeLessThanOrEqual(1);
      expect(result!.pitch).toBeGreaterThanOrEqual(0);
      expect(result!.pitch).toBeLessThanOrEqual(1);
      expect(result!.yaw).toBeGreaterThanOrEqual(0);
      expect(result!.yaw).toBeLessThanOrEqual(1);
      expect(result!.overall).toBeGreaterThanOrEqual(0);
      expect(result!.overall).toBeLessThanOrEqual(1);
    });

    it('should return higher effectiveness when D-term signal is strong relative to error', () => {
      const length = FFT_WINDOW_SIZE * 4;

      // Strong D relative to error
      const strongD = makeFlightData(length, {
        gyroFn: (_axis, i) => Math.sin((2 * Math.PI * 80 * i) / 4000) * 5,
        setpointFn: () => 0,
        pidDFn: (_axis, i) => Math.cos((2 * Math.PI * 80 * i) / 4000) * 20,
      });

      // Weak D relative to error
      const weakD = makeFlightData(length, {
        gyroFn: (_axis, i) => Math.sin((2 * Math.PI * 80 * i) / 4000) * 20,
        setpointFn: () => 0,
        pidDFn: (_axis, i) => Math.cos((2 * Math.PI * 80 * i) / 4000) * 1,
      });

      const strongResult = analyzeDTermEffectiveness(strongD);
      const weakResult = analyzeDTermEffectiveness(weakD);

      expect(strongResult).toBeDefined();
      expect(weakResult).toBeDefined();
      expect(strongResult!.overall).toBeGreaterThan(weakResult!.overall);
    });

    it('should return lower effectiveness when D-term signal is weak', () => {
      const length = FFT_WINDOW_SIZE * 4;
      const data = makeFlightData(length, {
        // Large error signal
        gyroFn: (_axis, i) => Math.sin((2 * Math.PI * 60 * i) / 4000) * 50,
        setpointFn: () => 0,
        // Tiny D-term response
        pidDFn: (_axis, i) => Math.cos((2 * Math.PI * 60 * i) / 4000) * 0.1,
      });

      const result = analyzeDTermEffectiveness(data);

      expect(result).toBeDefined();
      expect(result!.overall).toBeLessThan(0.3);
    });

    it('should set dCritical=true when overall > 0.7', () => {
      const length = FFT_WINDOW_SIZE * 4;
      // D-term energy much larger than error energy → clamped to 1.0
      const data = makeFlightData(length, {
        gyroFn: (_axis, i) => Math.sin((2 * Math.PI * 80 * i) / 4000) * 1,
        setpointFn: () => 0,
        pidDFn: (_axis, i) => Math.cos((2 * Math.PI * 80 * i) / 4000) * 100,
      });

      const result = analyzeDTermEffectiveness(data);

      expect(result).toBeDefined();
      expect(result!.overall).toBeGreaterThan(0.7);
      expect(result!.dCritical).toBe(true);
    });

    it('should set dCritical=false when overall <= 0.7', () => {
      const length = FFT_WINDOW_SIZE * 4;
      const data = makeFlightData(length, {
        gyroFn: (_axis, i) => Math.sin((2 * Math.PI * 60 * i) / 4000) * 30,
        setpointFn: () => 0,
        pidDFn: (_axis, i) => Math.cos((2 * Math.PI * 60 * i) / 4000) * 0.5,
      });

      const result = analyzeDTermEffectiveness(data);

      expect(result).toBeDefined();
      expect(result!.overall).toBeLessThanOrEqual(0.7);
      expect(result!.dCritical).toBe(false);
    });

    it('should compute overall as weighted average of roll and pitch only', () => {
      const length = FFT_WINDOW_SIZE * 4;
      // Different D-term strength per axis: roll=strong, pitch=medium, yaw=very strong
      const data = makeFlightData(length, {
        gyroFn: (_axis, i) => Math.sin((2 * Math.PI * 80 * i) / 4000) * 10,
        setpointFn: () => 0,
        pidDFn: (axis, i) => {
          const amp = axis === 0 ? 50 : axis === 1 ? 5 : 200;
          return Math.cos((2 * Math.PI * 80 * i) / 4000) * amp;
        },
      });

      const result = analyzeDTermEffectiveness(data);

      expect(result).toBeDefined();
      // Overall should be (roll + pitch) / 2, NOT include yaw
      const expectedOverall = (result!.roll + result!.pitch) / 2;
      expect(result!.overall).toBeCloseTo(expectedOverall, 10);
    });
  });
});
