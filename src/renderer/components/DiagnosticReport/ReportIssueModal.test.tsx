import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportIssueModal } from './ReportIssueModal';

describe('ReportIssueModal', () => {
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  it('renders modal with form fields', () => {
    render(<ReportIssueModal onSubmit={onSubmit} onClose={onClose} submitting={false} />);

    expect(screen.getByText('Report Tuning Issue')).toBeInTheDocument();
    expect(screen.getByLabelText('Email (optional)')).toBeInTheDocument();
    expect(screen.getByLabelText('What went wrong? (optional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send Report' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('submits with email and note', async () => {
    const user = userEvent.setup();
    render(<ReportIssueModal onSubmit={onSubmit} onClose={onClose} submitting={false} />);

    await user.type(screen.getByLabelText('Email (optional)'), 'pilot@test.com');
    await user.type(screen.getByLabelText('What went wrong? (optional)'), 'Bad LPF1');
    await user.click(screen.getByRole('button', { name: 'Send Report' }));

    expect(onSubmit).toHaveBeenCalledWith('pilot@test.com', 'Bad LPF1', undefined);
  });

  it('submits with undefined when fields empty', async () => {
    const user = userEvent.setup();
    render(<ReportIssueModal onSubmit={onSubmit} onClose={onClose} submitting={false} />);

    await user.click(screen.getByRole('button', { name: 'Send Report' }));

    expect(onSubmit).toHaveBeenCalledWith(undefined, undefined, undefined);
  });

  it('shows Sending... when submitting', () => {
    render(<ReportIssueModal onSubmit={onSubmit} onClose={onClose} submitting={true} />);

    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();
  });

  it('closes on Cancel click', async () => {
    const user = userEvent.setup();
    render(<ReportIssueModal onSubmit={onSubmit} onClose={onClose} submitting={false} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('shows privacy note without BBL when no flight data', () => {
    render(<ReportIssueModal onSubmit={onSubmit} onClose={onClose} submitting={false} />);

    expect(
      screen.getByText('No personal data, file paths, or raw flight recordings.')
    ).toBeInTheDocument();
  });

  it('does not show flight data checkbox when hasFlightData is false', () => {
    render(
      <ReportIssueModal
        onSubmit={onSubmit}
        onClose={onClose}
        submitting={false}
        hasFlightData={false}
      />
    );

    expect(screen.queryByText('Include flight data (BBL log)')).not.toBeInTheDocument();
  });

  it('shows flight data checkbox when hasFlightData is true', () => {
    render(
      <ReportIssueModal
        onSubmit={onSubmit}
        onClose={onClose}
        submitting={false}
        hasFlightData={true}
      />
    );

    expect(screen.getByText('Include flight data (BBL log)')).toBeInTheDocument();
  });

  it('checkbox is checked by default when hasFlightData', () => {
    render(
      <ReportIssueModal
        onSubmit={onSubmit}
        onClose={onClose}
        submitting={false}
        hasFlightData={true}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('submits with includeFlightData=true when checkbox checked', async () => {
    const user = userEvent.setup();
    render(
      <ReportIssueModal
        onSubmit={onSubmit}
        onClose={onClose}
        submitting={false}
        hasFlightData={true}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Send Report' }));

    expect(onSubmit).toHaveBeenCalledWith(undefined, undefined, true);
  });

  it('submits with includeFlightData=false when checkbox unchecked', async () => {
    const user = userEvent.setup();
    render(
      <ReportIssueModal
        onSubmit={onSubmit}
        onClose={onClose}
        submitting={false}
        hasFlightData={true}
      />
    );

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Send Report' }));

    expect(onSubmit).toHaveBeenCalledWith(undefined, undefined, false);
  });

  it('shows BBL in privacy note when checkbox checked', () => {
    render(
      <ReportIssueModal
        onSubmit={onSubmit}
        onClose={onClose}
        submitting={false}
        hasFlightData={true}
      />
    );

    expect(screen.getByText('Raw flight recording (BBL file)')).toBeInTheDocument();
    expect(screen.getByText('No personal data or file paths.')).toBeInTheDocument();
  });

  it('hides BBL from privacy note when checkbox unchecked', async () => {
    const user = userEvent.setup();
    render(
      <ReportIssueModal
        onSubmit={onSubmit}
        onClose={onClose}
        submitting={false}
        hasFlightData={true}
      />
    );

    await user.click(screen.getByRole('checkbox'));

    expect(screen.queryByText('Raw flight recording (BBL file)')).not.toBeInTheDocument();
    expect(
      screen.getByText('No personal data, file paths, or raw flight recordings.')
    ).toBeInTheDocument();
  });
});
