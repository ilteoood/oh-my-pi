import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-markdown', () => ({
	default: ({ children }: { children: string }) => <span data-testid="markdown">{children}</span>,
}));
vi.mock('rehype-highlight', () => ({ default: () => ({}) }));
vi.mock('remark-gfm', () => ({ default: () => ({}) }));

import { MarkdownContent } from '../../../src/client/components/MarkdownContent';

describe('MarkdownContent', () => {
	it('renders content', () => {
		render(<MarkdownContent content="**Hello**" />);
		expect(screen.getByTestId('markdown').textContent).toBe('**Hello**');
	});

	it('matches snapshot', () => {
		const { container } = render(<MarkdownContent content="# Title" />);
		expect(container.firstChild).toMatchSnapshot();
	});
});
