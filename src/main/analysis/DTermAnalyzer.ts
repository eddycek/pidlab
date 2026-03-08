/**
 * D-term effectiveness analyzer.
 *
 * Measures how effectively the D-term dampens oscillations by comparing
 * pidD contribution energy against PID error energy in the prop wash band.
 * A high ratio means D is actively working to suppress oscillations;
 * a low ratio means D gain could potentially be reduced.
 */
import type { BlackboxFlightData } from '@shared/types/blackbox.types';
import type { DTermEffectiveness } from '@shared/types/analysis.types';
import { computePowerSpectrum, trimSpectrum } from './FFTCompute';
import { FFT_WINDOW_SIZE } from './constants';

export type { DTermEffectiveness } from '@shared/types/analysis.types';

/** Lower bound of the D-term effectiveness analysis band (Hz) */
const DTERM_ANALYSIS_MIN_HZ = 20;

/** Upper bound of the D-term effectiveness analysis band (Hz) */
const DTERM_ANALYSIS_MAX_HZ = 150;

/**
 * Analyze D-term effectiveness from blackbox flight data.
 *
 * Computes per-axis ratio of D-term energy to error energy in the 20-150 Hz band.
 * Returns undefined if pidD data is missing or too short for FFT.
 *
 * @param flightData - Parsed blackbox flight data
 * @returns D-term effectiveness per axis, or undefined if data is insufficient
 */
export function analyzeDTermEffectiveness(
  flightData: BlackboxFlightData
): DTermEffectiveness | undefined {
  // Defensive check — pidD is typed as a 3-tuple but guard against malformed data
  if (!flightData.pidD || flightData.pidD.length < 3) return undefined;

  const axes: number[] = [];

  for (let axis = 0; axis < 3; axis++) {
    const pidDValues = flightData.pidD[axis].values;
    const gyroValues = flightData.gyro[axis].values;
    const setpointValues = flightData.setpoint[axis]?.values;

    if (pidDValues.length < FFT_WINDOW_SIZE || gyroValues.length < FFT_WINDOW_SIZE) {
      axes.push(0);
      continue;
    }

    // Compute error signal: setpoint - gyro
    const errorSignal = new Float64Array(gyroValues.length);
    for (let i = 0; i < gyroValues.length; i++) {
      errorSignal[i] = (setpointValues?.[i] ?? 0) - gyroValues[i];
    }

    // Compute power spectra using Welch's method
    const errorSpectrum = computePowerSpectrum(
      errorSignal,
      flightData.sampleRateHz,
      FFT_WINDOW_SIZE
    );
    const dTermSpectrum = computePowerSpectrum(
      pidDValues,
      flightData.sampleRateHz,
      FFT_WINDOW_SIZE
    );

    // Trim to the analysis band
    const errorTrimmed = trimSpectrum(errorSpectrum, DTERM_ANALYSIS_MIN_HZ, DTERM_ANALYSIS_MAX_HZ);
    const dTermTrimmed = trimSpectrum(dTermSpectrum, DTERM_ANALYSIS_MIN_HZ, DTERM_ANALYSIS_MAX_HZ);

    // Sum energy in band (magnitudes are in dB, convert to linear for energy sum)
    const errorEnergy = sumLinearEnergy(errorTrimmed.magnitudes);
    const dTermEnergy = sumLinearEnergy(dTermTrimmed.magnitudes);

    // Effectiveness ratio (clamped 0-1)
    const ratio = errorEnergy > 0 ? Math.min(1, dTermEnergy / errorEnergy) : 0;
    axes.push(ratio);
  }

  const [roll, pitch, yaw] = axes;
  // Weighted average: roll and pitch matter most (yaw D is often 0)
  const overall = (roll + pitch) / 2;

  return {
    roll,
    pitch,
    yaw,
    overall,
    dCritical: overall > 0.7,
  };
}

/**
 * Sum linear power from dB magnitudes.
 * Converts each dB value to linear power (10^(dB/10)) and sums.
 */
function sumLinearEnergy(magnitudesDb: Float64Array): number {
  let sum = 0;
  for (let i = 0; i < magnitudesDb.length; i++) {
    // Convert dB to linear power: 10^(dB/10)
    sum += Math.pow(10, magnitudesDb[i] / 10);
  }
  return sum;
}
