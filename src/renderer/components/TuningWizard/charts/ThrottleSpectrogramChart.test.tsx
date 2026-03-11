import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThrottleSpectrogramChart } from './ThrottleSpectrogramChart';
import type {
  ThrottleSpectrogramResult,
  PowerSpectrum,
  ThrottleBand,
} from '@shared/types/analysis.types';

function makeSpectrum(length: number, fillDb: number): PowerSpectrum {
  const frequencies = new Float64Array(length);
  const magnitudes = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    frequencies[i] = i * 5;
    magnitudes[i] = fillDb + Math.sin(i * 0.1) * 5;
  }
  return { frequencies, magnitudes };
}

function makeResult(bandsWithData: number): ThrottleSpectrogramResult {
  const bands: ThrottleBand[] = [];
  for (let i = 0; i < 10; i++) {
    if (i < bandsWithData) {
      bands.push({
        throttleMin: i * 10,
        throttleMax: (i + 1) * 10,
        sampleCount: 1000,
        spectra: [makeSpectrum(100, -40), makeSpectrum(100, -35), makeSpectrum(100, -45)],
        noiseFloorDb: [-40, -35, -45],
      });
    } else {
      bands.push({
        throttleMin: i * 10,
        throttleMax: (i + 1) * 10,
        sampleCount: 0,
      });
    }
  }
  return {
    bands,
    numBands: 10,
    minSamplesPerBand: 512,
    bandsWithData,
  };
}

describe('ThrottleSpectrogramChart', () => {
  it('renders nothing when no bands have data', () => {
    const { container } = render(<ThrottleSpectrogramChart data={makeResult(0)} />);
    expect(container.querySelector('.spectrogram-chart')).toBeNull();
  });

  it('renders SVG heatmap when data is available', () => {
    const { container } = render(<ThrottleSpectrogramChart data={makeResult(5)} />);
    expect(container.querySelector('.spectrogram-svg')).toBeInTheDocument();
    // Should have rect elements for heatmap cells
    const rects = container.querySelectorAll('.spectrogram-svg rect');
    expect(rects.length).toBeGreaterThan(0);
  });

  it('shows axis tabs without All option', () => {
    render(<ThrottleSpectrogramChart data={makeResult(5)} />);
    expect(screen.getByRole('tab', { name: 'Roll' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pitch' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Yaw' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'All' })).not.toBeInTheDocument();
  });

  it('switches axis when tab clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(<ThrottleSpectrogramChart data={makeResult(5)} />);

    const pitchTab = screen.getByRole('tab', { name: 'Pitch' });
    await user.click(pitchTab);

    // Chart should still render
    expect(container.querySelector('.spectrogram-svg')).toBeInTheDocument();
  });

  it('renders frequency axis labels', () => {
    const { container } = render(<ThrottleSpectrogramChart data={makeResult(5)} />);
    const texts = container.querySelectorAll('text');
    const textContents = Array.from(texts).map((t) => t.textContent);
    expect(textContents).toContain('Frequency (Hz)');
    expect(textContents).toContain('Throttle');
  });

  it('renders colorbar with dB labels', () => {
    const { container } = render(<ThrottleSpectrogramChart data={makeResult(5)} />);
    const texts = Array.from(container.querySelectorAll('text')).map((t) => t.textContent || '');
    const dbLabels = texts.filter((t) => t.includes('dB'));
    expect(dbLabels.length).toBeGreaterThanOrEqual(2);
  });
});
