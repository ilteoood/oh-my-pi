import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@heroui/react', async () => await import('../../mocks/heroui'));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => opts ? `${key}:${JSON.stringify(opts)}` : key }) }));
vi.mock('react-icons/io5', () => ({ IoClose: () => null }));

import { useSessionStore } from '../../../src/client/stores/sessionStore';
import { StatusOverlay } from '../../../src/client/components/StatusOverlay';

const initialState = {
	connected: false,
	sessionState: null,
	messages: [],
	streamingContent: [],
	streamingRole: null,
	toolExecutions: {},
	isStreaming: false,
	isCompacting: false,
	isRetrying: false,
	retryInfo: null,
	error: null,
	availableModels: [],
	sessionStats: null,
	fileSearch: null,
};

beforeEach(() => {
	useSessionStore.setState(initialState);
});

describe('StatusOverlay', () => {
	it('returns null when idle (no compacting, retrying, or error)', () => {
		const { container } = render(<StatusOverlay />);
		expect(container.firstChild).toBeNull();
	});

	it('shows compacting spinner when isCompacting is true', () => {
		useSessionStore.setState({ isCompacting: true });
		render(<StatusOverlay />);
		// Spinner from heroui mock renders as role="status"
		expect(screen.getByRole('status')).toBeDefined();
		expect(screen.getByText('status.compacting')).toBeDefined();
	});

	it('shows retrying info when isRetrying and retryInfo are set', () => {
		useSessionStore.setState({
			isRetrying: true,
			retryInfo: { attempt: 2, maxAttempts: 5, delayMs: 500, errorMessage: 'timeout' },
		});
		render(<StatusOverlay />);
		expect(screen.getByRole('status')).toBeDefined();
		// The t() mock interpolates opts as JSON, so the text contains the key
		const el = screen.getByText((text) => text.includes('status.retrying'));
		expect(el).toBeDefined();
	});

	it('shows error message when error is set', () => {
		useSessionStore.setState({ error: 'Something went wrong' });
		render(<StatusOverlay />);
		expect(screen.getByText('Something went wrong')).toBeDefined();
	});

	it('calls setError(null) when error button is clicked', () => {
		useSessionStore.setState({ error: 'boom' });
		render(<StatusOverlay />);
		const btn = screen.getByRole('button');
		fireEvent.click(btn);
		expect(useSessionStore.getState().error).toBeNull();
	});

	it('shows both compacting and error simultaneously when both are set', () => {
		useSessionStore.setState({ isCompacting: true, error: 'parallel error' });
		render(<StatusOverlay />);
		expect(screen.getByRole('status')).toBeDefined();
		expect(screen.getByText('parallel error')).toBeDefined();
	});
});
