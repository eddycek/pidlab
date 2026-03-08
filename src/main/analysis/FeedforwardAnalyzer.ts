/**
 * Extended feedforward analysis module.
 *
 * Analyzes step response data to produce recommendations for:
 * - `feedforward_smooth_factor`: When leading-edge overshoot (0-20ms) dominates settling overshoot
 * - `feedforward_jitter_factor`: When small-magnitude steps show more FF overshoot than large steps
 * - RC link rate awareness: High-speed links (250Hz+) benefit from stronger smoothing
 *
 * Designed to work alongside the existing FF-dominated detection in PIDAnalyzer/PIDRecommender.
 */
import type {
  FeedforwardContext,
  FeedforwardAnalysis,
  StepResponse,
  PIDRecommendation,
} from '@shared/types/analysis.types';

// ---- Constants ----

/** Step magnitude threshold: steps below this fraction of max rate are "small" */
export const SMALL_STEP_THRESHOLD = 0.3;

/** Leading edge window: 0-20ms after step onset */
export const LEADING_EDGE_MS = 20;

/** Leading-edge ratio above which smooth factor increase is recommended */
export const LEADING_EDGE_RATIO_THRESHOLD = 1.5;

/** Small-step overshoot ratio above which jitter factor increase is recommended */
export const SMALL_STEP_RATIO_THRESHOLD = 1.4;

/** Minimum steps per category to make a recommendation */
export const MIN_STEPS_FOR_ANALYSIS = 3;

/** RC link rate threshold above which stronger smoothing is recommended (Hz) */
export const HIGH_RC_RATE_HZ = 250;

/** Default smooth factor step increase */
export const SMOOTH_FACTOR_STEP = 10;

/** Default jitter factor step increase */
export const JITTER_FACTOR_STEP = 3;

/** Max smooth factor (BF range 0-75) */
export const SMOOTH_FACTOR_MAX = 75;

/** Max jitter factor (BF range 0-20) */
export const JITTER_FACTOR_MAX = 20;

// ---- Implementation ----

/**
 * Analyze feedforward characteristics from step response data.
 *
 * Compares leading-edge overshoot vs settling overshoot, and small-step vs large-step
 * FF overshoot to determine if ff_smooth_factor or feedforward_jitter_factor need adjustment.
 *
 * @param responses - All step responses across axes (with leadingEdgeOvershootPercent populated)
 * @param ffContext - Current feedforward configuration from BBL headers
 * @param maxStickRate - Maximum stick rate in deg/s (default 670 for BF defaults)
 * @returns FeedforwardAnalysis or undefined if not enough data
 */
export function analyzeFeedforward(
  responses: StepResponse[],
  ffContext: FeedforwardContext | undefined,
  maxStickRate: number = 670
): FeedforwardAnalysis | undefined {
  // Only analyze when FF is active
  if (!ffContext?.active) return undefined;

  // Filter to FF-relevant responses (those with ffDominated info and overshoot)
  const ffResponses = responses.filter(
    (r) => r.ffDominated !== undefined && r.overshootPercent > 0
  );

  if (ffResponses.length < MIN_STEPS_FOR_ANALYSIS) return undefined;

  // ── Leading-edge analysis ──
  // Compare early overshoot (0-20ms) vs total overshoot
  const withLeadingEdge = ffResponses.filter((r) => r.leadingEdgeOvershootPercent !== undefined);
  let leadingEdgeRatio = 1.0;
  if (withLeadingEdge.length >= MIN_STEPS_FOR_ANALYSIS) {
    const meanLeading =
      withLeadingEdge.reduce((s, r) => s + r.leadingEdgeOvershootPercent!, 0) /
      withLeadingEdge.length;
    const meanTotal =
      withLeadingEdge.reduce((s, r) => s + r.overshootPercent, 0) / withLeadingEdge.length;
    leadingEdgeRatio = meanTotal > 0 ? meanLeading / meanTotal : 1.0;
  }

  // ── Small vs large step analysis ──
  const smallThreshold = maxStickRate * SMALL_STEP_THRESHOLD;
  const smallSteps = ffResponses.filter((r) => Math.abs(r.step.magnitude) < smallThreshold);
  const largeSteps = ffResponses.filter((r) => Math.abs(r.step.magnitude) >= smallThreshold);

  let smallStepOvershootRatio = 1.0;
  if (smallSteps.length >= MIN_STEPS_FOR_ANALYSIS && largeSteps.length >= MIN_STEPS_FOR_ANALYSIS) {
    const meanSmallOS = smallSteps.reduce((s, r) => s + r.overshootPercent, 0) / smallSteps.length;
    const meanLargeOS = largeSteps.reduce((s, r) => s + r.overshootPercent, 0) / largeSteps.length;
    smallStepOvershootRatio = meanLargeOS > 0 ? meanSmallOS / meanLargeOS : 1.0;
  }

  const rcLinkRateHz = ffContext.rcLinkRateHz;
  const hasRecommendations =
    leadingEdgeRatio >= LEADING_EDGE_RATIO_THRESHOLD ||
    smallStepOvershootRatio >= SMALL_STEP_RATIO_THRESHOLD;

  const summaryParts: string[] = [];
  if (leadingEdgeRatio >= LEADING_EDGE_RATIO_THRESHOLD) {
    summaryParts.push(
      `Leading-edge overshoot is ${leadingEdgeRatio.toFixed(1)}x the settling overshoot — consider increasing ff_smooth_factor`
    );
  }
  if (smallStepOvershootRatio >= SMALL_STEP_RATIO_THRESHOLD) {
    summaryParts.push(
      `Small stick inputs overshoot ${smallStepOvershootRatio.toFixed(1)}x more than large inputs — consider increasing feedforward_jitter_factor`
    );
  }
  if (rcLinkRateHz !== undefined && rcLinkRateHz >= HIGH_RC_RATE_HZ) {
    summaryParts.push(
      `RC link rate detected: ${rcLinkRateHz} Hz (high-speed — benefits from FF smoothing)`
    );
  }
  if (summaryParts.length === 0) {
    summaryParts.push('Feedforward response looks well-tuned.');
  }

  return {
    hasRecommendations,
    leadingEdgeRatio: Math.round(leadingEdgeRatio * 100) / 100,
    smallStepOvershootRatio: Math.round(smallStepOvershootRatio * 100) / 100,
    smallStepCount: smallSteps.length,
    largeStepCount: largeSteps.length,
    rcLinkRateHz,
    summary: summaryParts.join('. ') + '.',
  };
}

/**
 * Generate feedforward-specific PID recommendations based on analysis.
 *
 * @param analysis - Result from analyzeFeedforward
 * @param ffContext - Current feedforward configuration
 * @returns Array of PID recommendations for FF parameters
 */
export function recommendFeedforward(
  analysis: FeedforwardAnalysis | undefined,
  ffContext: FeedforwardContext | undefined
): PIDRecommendation[] {
  if (!analysis || !ffContext?.active) return [];

  const recommendations: PIDRecommendation[] = [];

  // ff_smooth_factor recommendation
  if (analysis.leadingEdgeRatio >= LEADING_EDGE_RATIO_THRESHOLD) {
    const current = ffContext.smoothFactor ?? 0;
    // High-speed RC links benefit from more smoothing
    const step =
      ffContext.rcLinkRateHz !== undefined && ffContext.rcLinkRateHz >= HIGH_RC_RATE_HZ
        ? SMOOTH_FACTOR_STEP + 10
        : SMOOTH_FACTOR_STEP;
    const recommended = Math.min(current + step, SMOOTH_FACTOR_MAX);

    if (recommended > current) {
      recommendations.push({
        setting: 'feedforward_smooth_factor',
        currentValue: current,
        recommendedValue: recommended,
        reason:
          `Overshoot is concentrated in the first 20ms of step response (leading-edge ratio ${analysis.leadingEdgeRatio.toFixed(1)}x). ` +
          'This spike pattern is caused by unsmoothed feedforward, not P/D imbalance. ' +
          `Increasing smooth factor from ${current} to ${recommended} softens the initial FF spike without reducing overall response.` +
          (ffContext.rcLinkRateHz !== undefined && ffContext.rcLinkRateHz >= HIGH_RC_RATE_HZ
            ? ` High-speed RC link (${ffContext.rcLinkRateHz} Hz) benefits from additional smoothing.`
            : ''),
        impact: 'stability',
        confidence: 'medium',
      });
    }
  }

  // feedforward_jitter_factor recommendation
  if (analysis.smallStepOvershootRatio >= SMALL_STEP_RATIO_THRESHOLD) {
    const current = ffContext.jitterFactor ?? 0;
    const recommended = Math.min(current + JITTER_FACTOR_STEP, JITTER_FACTOR_MAX);

    if (recommended > current) {
      recommendations.push({
        setting: 'feedforward_jitter_factor',
        currentValue: current,
        recommendedValue: recommended,
        reason:
          `Small stick movements (<30% stick) overshoot ${analysis.smallStepOvershootRatio.toFixed(1)}x more than large movements. ` +
          'This indicates feedforward over-responds to small inputs. ' +
          `Increasing jitter factor from ${current} to ${recommended} selectively attenuates FF during slow/small stick movements, ` +
          'reducing jitter without affecting sharp command response.',
        impact: 'stability',
        confidence: 'medium',
      });
    }
  }

  return recommendations;
}

/**
 * Extract RC link rate from BBL raw headers.
 *
 * BF logs `rc_smoothing_auto_factor` and frame timing info. The actual RC rate
 * can be derived from `rcIntervalMs` or `rc_smoothing_input_hz` headers.
 *
 * @param rawHeaders - BBL raw header map
 * @returns RC link rate in Hz, or undefined if not available
 */
export function extractRCLinkRate(rawHeaders: Map<string, string>): number | undefined {
  // Direct RC rate header (BF 4.3+)
  const rcSmoothingInputHz = parseIntOr(rawHeaders.get('rc_smoothing_input_hz'));
  if (rcSmoothingInputHz !== undefined && rcSmoothingInputHz > 0) {
    return rcSmoothingInputHz;
  }

  // Alternative: rcIntervalMs header
  const rcIntervalMs = parseIntOr(rawHeaders.get('rcIntervalMs'));
  if (rcIntervalMs !== undefined && rcIntervalMs > 0) {
    return Math.round(1000 / rcIntervalMs);
  }

  return undefined;
}

function parseIntOr(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}
