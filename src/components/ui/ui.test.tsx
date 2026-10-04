import { describe, it, expect, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DateField } from './DateField';

function Harness({ min }: { min?: string }) {
    const [v, setV] = useState('');
    return (
        <>
            <DateField label="結束日" value={v} onChange={setV} min={min} />
            <output data-testid="iso">{v}</output>
        </>
    );
}

describe('日期欄位', () => {
    it('可以直接鍵盤輸入多種寫法，失焦後統一顯示為 2026/02/10', async () => {
        render(<Harness />);
        const input = screen.getByLabelText('結束日');
        await userEvent.type(input, '2026年2月10日');
        await userEvent.tab();
        expect((input as HTMLInputElement).value).toBe('2026/02/10');
        expect(screen.getByTestId('iso').textContent).toBe('2026-02-10');
    });

    it('不存在的日期顯示白話錯誤並保留使用者打的字', async () => {
        render(<Harness />);
        const input = screen.getByLabelText('結束日');
        await userEvent.type(input, '2026/02/30');
        await userEvent.tab();
        expect(await screen.findByRole('alert')).toHaveTextContent('日期格式不正確');
        expect((input as HTMLInputElement).value).toBe('2026/02/30');
        expect(screen.getByTestId('iso').textContent).toBe('');
    });

    it('早於最小日期會被擋下', async () => {
        render(<Harness min="2026-02-10" />);
        const input = screen.getByLabelText('結束日');
        await userEvent.type(input, '2026/02/01');
        await userEvent.tab();
        expect(await screen.findByRole('alert')).toHaveTextContent('不能早於 2026/02/10');
    });

    it('佔位字是繁中「年/月/日」，不是瀏覽器語系的 yyyy/mm/dd', () => {
        render(<Harness />);
        expect(screen.getByPlaceholderText('年/月/日')).toBeInTheDocument();
    });
});

describe('更新提示', () => {
    it('有新版本時顯示提示，按「立即更新」才套用，「稍後」可關閉', async () => {
        vi.resetModules();
        const applyUpdate = vi.fn();
        const dismissNeedRefresh = vi.fn();
        vi.doMock('../../pwa', () => ({ usePwa: () => ({ needRefresh: true, offlineReady: false }), applyUpdate, dismissNeedRefresh, dismissOfflineReady: vi.fn() }));
        const { UpdatePrompt } = await import('../UpdatePrompt');
        const { renderWithUi } = await import('../../test/render');
        renderWithUi(<UpdatePrompt />);
        expect(screen.getByRole('alert')).toHaveTextContent('有新版本可以使用');
        expect(applyUpdate).not.toHaveBeenCalled(); // 沒按之前不會自己換版
        await userEvent.click(screen.getByRole('button', { name: '稍後' }));
        expect(dismissNeedRefresh).toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', { name: '立即更新' }));
        expect(applyUpdate).toHaveBeenCalled();
        vi.doUnmock('../../pwa');
    });

    it('沒有新版本時不顯示任何東西', async () => {
        vi.resetModules();
        vi.doMock('../../pwa', () => ({ usePwa: () => ({ needRefresh: false, offlineReady: false }), applyUpdate: vi.fn(), dismissNeedRefresh: vi.fn(), dismissOfflineReady: vi.fn() }));
        const { UpdatePrompt } = await import('../UpdatePrompt');
        const { renderWithUi } = await import('../../test/render');
        const { container } = renderWithUi(<UpdatePrompt />);
        expect(container.querySelector('.update-banner')).toBeNull();
        vi.doUnmock('../../pwa');
    });
});
