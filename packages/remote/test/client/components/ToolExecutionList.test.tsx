import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/client/components/ToolCallCard', () => ({
	ToolCallCard: ({ id, name }: { id: string; name: string }) => (
		<div data-testid={`tool-card-${id}`} data-name={name} />
	),
}));

import { useSessionStore } from '../../../src/client/stores/sessionStore';
import { ToolExecutionList } from '../../../src/client/components/ToolExecutionList';

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

describe('ToolExecutionList', () => {
	it('returns null when toolExecutions is empty', () => {
		const { container } = render(<ToolExecutionList />);
		expect(container.firstChild).toBeNull();
	});

	it('renders a ToolCallCard for each execution', () => {
		useSessionStore.setState({
			toolExecutions: {
				'id-1': { id: 'id-1', name: 'bash', args: { command: 'ls' }, status: 'running' },
				'id-2': { id: 'id-2', name: 'read', args: { path: '/tmp/file' }, status: 'complete' },
			},
		});
		render(<ToolExecutionList />);
		expect(screen.getByTestId('tool-card-id-1')).toBeDefined();
		expect(screen.getByTestId('tool-card-id-2')).toBeDefined();
	});

	it('renders exactly one card per execution', () => {
		useSessionStore.setState({
			toolExecutions: {
				'x-1': { id: 'x-1', name: 'grep', args: { pattern: 'foo' }, status: 'running' },
			},
		});
		render(<ToolExecutionList />);
		const cards = screen.getAllByTestId(/^tool-card-/);
		expect(cards).toHaveLength(1);
	});
});
