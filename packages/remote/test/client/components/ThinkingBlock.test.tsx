import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-icons/io5', () => ({ IoBulb: () => null }));

import { ThinkingBlock } from '../../../src/client/components/ThinkingBlock';

describe('ThinkingBlock', () => {
	it('returns null when content is empty string', () => {
		const { container } = render(<ThinkingBlock content="" />);
		expect(container.firstChild).toBeNull();
	});

	it('renders content when non-empty', () => {
		render(<ThinkingBlock content="I am thinking..." />);
		expect(screen.getByText('I am thinking...')).toBeDefined();
	});

	it('renders the translation key for the label', () => {
		render(<ThinkingBlock content="some thought" />);
		// t() is identity, so the i18n key itself is rendered
		expect(screen.getByText('thinking.label')).toBeDefined();
	});

	it('matches snapshot', () => {
		const { container } = render(<ThinkingBlock content="Deep thought" />);
		expect(container.firstChild).toMatchSnapshot();
	});
});
