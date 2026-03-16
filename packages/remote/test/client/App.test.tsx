import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../src/client/pages/ChatPage', () => ({
	ChatPage: () => <div data-testid="chat-page" />,
}));

import { App } from '../../src/client/App';

describe('App', () => {
	it('renders without crashing', () => {
		const { container } = render(<App />);
		expect(container.firstChild).toMatchSnapshot();
	});
});
