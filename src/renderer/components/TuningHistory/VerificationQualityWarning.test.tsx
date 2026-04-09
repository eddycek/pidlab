import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VerificationQualityWarning } from './VerificationQualityWarning';
import type { DataQualityScore } from '@shared/types/analysis.types';

const fairQuality: DataQualityScore = {
  overall: 46,
  tier: 'fair',
  subScores: [
    { name: 'Step count', score: 20, weight: 0.3 },
    { name: 'Axis coverage', score: 0, weight: 0.3 },
    { name: 'Magnitude variety', score: 100, weight: 0.2 },
    { name: 'Hold quality', score: 100, weight: 0.2 },
  ],
};

const poorQuality: DataQualityScore = {
  overall: 15,
  tier: 'poor',
  subScores: [
    { name: 'Step count', score: 0, weight: 0.3 },
    { name: 'Axis coverage', score: 0, weight: 0.3 },
    { name: 'Magnitude variety', score: 50, weight: 0.2 },
    { name: 'Hold quality', score: 25, weight: 0.2 },
  ],
};

describe('VerificationQualityWarning', () => {
  it('renders fair quality warning with score', () => {
    render(
      <VerificationQualityWarning dataQuality={fairQuality} onAccept={vi.fn()} onReject={vi.fn()} />
    );
    expect(screen.getByText(/Fair \(46\/100\)/)).toBeInTheDocument();
    expect(screen.getByText('Low Verification Data Quality')).toBeInTheDocument();
  });

  it('renders poor quality warning', () => {
    render(
      <VerificationQualityWarning dataQuality={poorQuality} onAccept={vi.fn()} onReject={vi.fn()} />
    );
    expect(screen.getByText(/Poor \(15\/100\)/)).toBeInTheDocument();
  });

  it('shows failing sub-scores', () => {
    render(
      <VerificationQualityWarning dataQuality={fairQuality} onAccept={vi.fn()} onReject={vi.fn()} />
    );
    expect(screen.getByText('Step count: 20/100')).toBeInTheDocument();
    expect(screen.getByText('Axis coverage: 0/100')).toBeInTheDocument();
    // Good sub-scores should not be shown
    expect(screen.queryByText(/Magnitude variety/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hold quality/)).not.toBeInTheDocument();
  });

  it('calls onAccept when Accept Anyway clicked', async () => {
    const onAccept = vi.fn();
    const user = userEvent.setup();
    render(
      <VerificationQualityWarning
        dataQuality={fairQuality}
        onAccept={onAccept}
        onReject={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Accept Anyway' }));
    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('calls onReject when Fly Again clicked', async () => {
    const onReject = vi.fn();
    const user = userEvent.setup();
    render(
      <VerificationQualityWarning
        dataQuality={fairQuality}
        onAccept={vi.fn()}
        onReject={onReject}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Fly Again' }));
    expect(onReject).toHaveBeenCalledOnce();
  });

  it('has correct dialog role', () => {
    render(
      <VerificationQualityWarning dataQuality={fairQuality} onAccept={vi.fn()} onReject={vi.fn()} />
    );
    expect(
      screen.getByRole('dialog', { name: 'Verification quality warning' })
    ).toBeInTheDocument();
  });
});
