import { describe, it, expect } from 'vitest';
import {
  analyzeFeedforward,
  recommendFeedforward,
  extractRCLinkRate,
  LEADING_EDGE_RATIO_THRESHOLD,
  SMALL_STEP_RATIO_THRESHOLD,
  SMOOTH_FACTOR_MAX,
  JITTER_FACTOR_MAX,
} from './FeedforwardAnalyzer';
import type {
  FeedforwardContext,
  FeedforwardAnalysis,
  StepResponse,
  StepEvent,
} from '@shared/types/analysis.types';

// ---- Helpers ----

function makeStep(magnitude: number, axis: 0 | 1 | 2 = 0): StepEvent {
  return {
    axis,
    startIndex: 0,
    endIndex: 100,
    magnitude,
    direction: magnitude > 0 ? 'positive' : 'negative',
  };
}

function makeResponse(overrides: Partial<StepResponse> & { step: StepEvent }): StepResponse {
  return {
    riseTimeMs: 10,
    overshootPercent: 15,
    settlingTimeMs: 50,
    latencyMs: 3,
    ringingCount: 0,
    peakValue: 100,
    steadyStateValue: 80,
    trackingErrorRMS: 0.1,
    steadyStateErrorPercent: 2,
    leadingEdgeOvershootPercent: 12,
    ffDominated: true,
    ffEnergyRatio: 0.7,
    ...overrides,
  };
}

const activeFF: FeedforwardContext = {
  active: true,
  boost: 15,
  smoothFactor: 25,
  jitterFactor: 7,
};

describe('analyzeFeedforward', () => {
  it('should return undefined when FF is not active', () => {
    const responses = [makeResponse({ step: makeStep(300) })];
    const result = analyzeFeedforward(responses, { active: false });

    expect(result).toBeUndefined();
  });

  it('should return undefined when FF context is undefined', () => {
    const responses = [makeResponse({ step: makeStep(300) })];
    const result = analyzeFeedforward(responses, undefined);

    expect(result).toBeUndefined();
  });

  it('should return undefined with fewer than 3 steps', () => {
    const responses = [
      makeResponse({ step: makeStep(300) }),
      makeResponse({ step: makeStep(300) }),
    ];
    const result = analyzeFeedforward(responses, activeFF);

    expect(result).toBeUndefined();
  });

  it('should detect leading-edge dominated overshoot', () => {
    // Leading edge overshoot = 30%, total overshoot = 15% → ratio = 2.0
    const responses = Array.from({ length: 5 }, () =>
      makeResponse({
        step: makeStep(300),
        overshootPercent: 15,
        leadingEdgeOvershootPercent: 30,
      })
    );
    const result = analyzeFeedforward(responses, activeFF);

    expect(result).toBeDefined();
    expect(result!.leadingEdgeRatio).toBe(2.0);
    expect(result!.hasRecommendations).toBe(true);
    expect(result!.summary).toContain('ff_smooth_factor');
  });

  it('should not flag when leading-edge ratio is below threshold', () => {
    // Leading edge = 10%, total = 15% → ratio = 0.67 (below threshold)
    const responses = Array.from({ length: 5 }, () =>
      makeResponse({
        step: makeStep(300),
        overshootPercent: 15,
        leadingEdgeOvershootPercent: 10,
      })
    );
    const result = analyzeFeedforward(responses, activeFF);

    expect(result).toBeDefined();
    expect(result!.leadingEdgeRatio).toBeLessThan(LEADING_EDGE_RATIO_THRESHOLD);
    expect(result!.summary).not.toContain('ff_smooth_factor');
  });

  it('should detect small-step overshoot dominance', () => {
    // maxStickRate = 670, threshold = 201
    // Small steps (<201 deg/s) overshoot 40%, large steps (>=201) overshoot 15%
    const smallSteps = Array.from({ length: 4 }, () =>
      makeResponse({
        step: makeStep(100),
        overshootPercent: 40,
        leadingEdgeOvershootPercent: 10,
      })
    );
    const largeSteps = Array.from({ length: 4 }, () =>
      makeResponse({
        step: makeStep(400),
        overshootPercent: 15,
        leadingEdgeOvershootPercent: 10,
      })
    );

    const result = analyzeFeedforward([...smallSteps, ...largeSteps], activeFF);

    expect(result).toBeDefined();
    expect(result!.smallStepOvershootRatio).toBeGreaterThan(SMALL_STEP_RATIO_THRESHOLD);
    expect(result!.smallStepCount).toBe(4);
    expect(result!.largeStepCount).toBe(4);
    expect(result!.hasRecommendations).toBe(true);
    expect(result!.summary).toContain('feedforward_jitter_factor');
  });

  it('should not flag when small-step ratio is below threshold', () => {
    const smallSteps = Array.from({ length: 4 }, () =>
      makeResponse({
        step: makeStep(100),
        overshootPercent: 15,
        leadingEdgeOvershootPercent: 10,
      })
    );
    const largeSteps = Array.from({ length: 4 }, () =>
      makeResponse({
        step: makeStep(400),
        overshootPercent: 14,
        leadingEdgeOvershootPercent: 10,
      })
    );

    const result = analyzeFeedforward([...smallSteps, ...largeSteps], activeFF);

    expect(result).toBeDefined();
    expect(result!.smallStepOvershootRatio).toBeLessThan(SMALL_STEP_RATIO_THRESHOLD);
    expect(result!.summary).not.toContain('feedforward_jitter_factor');
  });

  it('should report RC link rate in summary when high-speed', () => {
    const responses = Array.from({ length: 5 }, () =>
      makeResponse({
        step: makeStep(300),
        overshootPercent: 15,
        leadingEdgeOvershootPercent: 10,
      })
    );
    const ffWithRC: FeedforwardContext = { ...activeFF, rcLinkRateHz: 500 };
    const result = analyzeFeedforward(responses, ffWithRC);

    expect(result).toBeDefined();
    expect(result!.rcLinkRateHz).toBe(500);
    expect(result!.summary).toContain('500 Hz');
  });

  it('should handle responses without ffDominated field', () => {
    const responses = Array.from({ length: 5 }, () =>
      makeResponse({
        step: makeStep(300),
        ffDominated: undefined,
        overshootPercent: 20,
      })
    );
    // Without ffDominated, responses are filtered out → not enough data
    const result = analyzeFeedforward(responses, activeFF);

    expect(result).toBeUndefined();
  });

  it('should report well-tuned when no issues found', () => {
    const responses = Array.from({ length: 5 }, () =>
      makeResponse({
        step: makeStep(300),
        overshootPercent: 10,
        leadingEdgeOvershootPercent: 5,
      })
    );
    const result = analyzeFeedforward(responses, activeFF);

    expect(result).toBeDefined();
    expect(result!.hasRecommendations).toBe(false);
    expect(result!.summary).toContain('well-tuned');
  });
});

describe('recommendFeedforward', () => {
  const baseAnalysis: FeedforwardAnalysis = {
    hasRecommendations: true,
    leadingEdgeRatio: 2.0,
    smallStepOvershootRatio: 1.0,
    smallStepCount: 5,
    largeStepCount: 5,
    summary: 'test',
  };

  it('should return empty when analysis is undefined', () => {
    expect(recommendFeedforward(undefined, activeFF)).toEqual([]);
  });

  it('should return empty when FF is not active', () => {
    expect(recommendFeedforward(baseAnalysis, { active: false })).toEqual([]);
  });

  it('should recommend smooth factor increase for leading-edge overshoot', () => {
    const recs = recommendFeedforward(baseAnalysis, activeFF);

    const smoothRec = recs.find((r) => r.setting === 'feedforward_smooth_factor');
    expect(smoothRec).toBeDefined();
    expect(smoothRec!.currentValue).toBe(25);
    expect(smoothRec!.recommendedValue).toBe(35); // 25 + 10
    expect(smoothRec!.reason).toContain('leading-edge');
  });

  it('should recommend larger smooth factor step for high-speed RC', () => {
    const ffWithRC: FeedforwardContext = { ...activeFF, rcLinkRateHz: 500 };
    const recs = recommendFeedforward(baseAnalysis, ffWithRC);

    const smoothRec = recs.find((r) => r.setting === 'feedforward_smooth_factor');
    expect(smoothRec).toBeDefined();
    expect(smoothRec!.recommendedValue).toBe(45); // 25 + 10 + 10 (high-speed bonus)
    expect(smoothRec!.reason).toContain('High-speed RC link');
  });

  it('should clamp smooth factor to maximum', () => {
    const ffHighSmooth: FeedforwardContext = { ...activeFF, smoothFactor: 70, rcLinkRateHz: 500 };
    const recs = recommendFeedforward(baseAnalysis, ffHighSmooth);

    const smoothRec = recs.find((r) => r.setting === 'feedforward_smooth_factor');
    expect(smoothRec).toBeDefined();
    expect(smoothRec!.recommendedValue).toBe(SMOOTH_FACTOR_MAX);
  });

  it('should recommend jitter factor increase for small-step overshoot', () => {
    const analysis: FeedforwardAnalysis = {
      ...baseAnalysis,
      leadingEdgeRatio: 1.0, // no leading-edge issue
      smallStepOvershootRatio: 2.0, // small steps overshoot 2x more
    };
    const recs = recommendFeedforward(analysis, activeFF);

    const jitterRec = recs.find((r) => r.setting === 'feedforward_jitter_factor');
    expect(jitterRec).toBeDefined();
    expect(jitterRec!.currentValue).toBe(7);
    expect(jitterRec!.recommendedValue).toBe(10); // 7 + 3
    expect(jitterRec!.reason).toContain('Small stick movements');
  });

  it('should clamp jitter factor to maximum', () => {
    const ffHighJitter: FeedforwardContext = { ...activeFF, jitterFactor: 19 };
    const analysis: FeedforwardAnalysis = {
      ...baseAnalysis,
      leadingEdgeRatio: 1.0,
      smallStepOvershootRatio: 2.0,
    };
    const recs = recommendFeedforward(analysis, ffHighJitter);

    const jitterRec = recs.find((r) => r.setting === 'feedforward_jitter_factor');
    expect(jitterRec).toBeDefined();
    expect(jitterRec!.recommendedValue).toBe(JITTER_FACTOR_MAX);
  });

  it('should produce both recommendations when both issues present', () => {
    const analysis: FeedforwardAnalysis = {
      ...baseAnalysis,
      leadingEdgeRatio: 2.0,
      smallStepOvershootRatio: 2.0,
    };
    const recs = recommendFeedforward(analysis, activeFF);

    expect(recs).toHaveLength(2);
    expect(recs.map((r) => r.setting)).toContain('feedforward_smooth_factor');
    expect(recs.map((r) => r.setting)).toContain('feedforward_jitter_factor');
  });

  it('should not recommend when smooth factor is already at max', () => {
    const ffMaxSmooth: FeedforwardContext = { ...activeFF, smoothFactor: SMOOTH_FACTOR_MAX };
    const recs = recommendFeedforward(baseAnalysis, ffMaxSmooth);

    const smoothRec = recs.find((r) => r.setting === 'feedforward_smooth_factor');
    expect(smoothRec).toBeUndefined();
  });
});

describe('extractRCLinkRate', () => {
  it('should extract from rc_smoothing_input_hz', () => {
    const headers = new Map([['rc_smoothing_input_hz', '250']]);
    expect(extractRCLinkRate(headers)).toBe(250);
  });

  it('should extract from rcIntervalMs', () => {
    const headers = new Map([['rcIntervalMs', '4']]);
    expect(extractRCLinkRate(headers)).toBe(250);
  });

  it('should prefer rc_smoothing_input_hz over rcIntervalMs', () => {
    const headers = new Map([
      ['rc_smoothing_input_hz', '500'],
      ['rcIntervalMs', '4'],
    ]);
    expect(extractRCLinkRate(headers)).toBe(500);
  });

  it('should return undefined when no headers present', () => {
    expect(extractRCLinkRate(new Map())).toBeUndefined();
  });

  it('should return undefined for zero values', () => {
    const headers = new Map([['rc_smoothing_input_hz', '0']]);
    expect(extractRCLinkRate(headers)).toBeUndefined();
  });
});
