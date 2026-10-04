import { render } from '@testing-library/react';
import { type ReactElement } from 'react';
import { UiProvider } from '../components/ui/UiProvider';

export function renderWithUi(ui: ReactElement) {
    return render(<UiProvider>{ui}</UiProvider>);
}
