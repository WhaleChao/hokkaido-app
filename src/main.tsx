import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { UiProvider } from './components/ui/UiProvider.tsx';
import { applyTheme, readTheme } from './utils/theme.ts';
import { initPwa } from './pwa.ts';

applyTheme(readTheme());
initPwa();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <UiProvider>
            <App />
        </UiProvider>
    </StrictMode>,
);
