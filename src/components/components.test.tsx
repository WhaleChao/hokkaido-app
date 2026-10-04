import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithUi } from '../test/render';
import { resetAll, jsonResponse } from '../test/helpers';
import { AddAttractionForm } from './Tabs/AddAttractionForm';
import { ExpenseTracker } from './Tabs/ExpenseTracker';
import { ExchangeRate } from './Tabs/ExchangeRate';
import { PackingChecklist } from './Tabs/PackingChecklist';
import { Itinerary } from './Tabs/Itinerary';
import { PhotoAlbum } from './Tabs/PhotoAlbum';
import { createTripRecord, patchConfig, ensureDays, updateDay } from '../utils/tripData';
import { resetRatesForTests } from '../hooks/useExchangeRates';
import { todayISO, formatYMD } from '../utils/date';
import { expenseStore, albumStore } from '../db';
import { RATES_CACHE_KEY } from '../utils/rates';
import { type Attraction } from '../data/itinerary';

beforeEach(async () => {
    await resetAll();
    resetRatesForTests();
    vi.restoreAllMocks();
});

const ratesBody = { rates: { USD: 1, JPY: 150, TWD: 30, EUR: 0.9, KRW: 1300, THB: 35 } };

describe('景點表單', () => {
    const base: Attraction = { id: 'a1', name: '小樽運河', category: '景點', description: '原本說明', tags: [], mapQuery: '小樽運河', parkingInfo: '500円/小時', photoTip: '用低曝光' };

    it('按「取消」就是真的取消：不會呼叫儲存（舊版會偷偷存檔）', async () => {
        const onSave = vi.fn();
        const onCancel = vi.fn();
        renderWithUi(<AddAttractionForm editAttraction={base} onSave={onSave} onCancel={onCancel} />);
        const name = screen.getByLabelText('景點名稱');
        await userEvent.clear(name);
        await userEvent.type(name, '被取消的名字');
        await userEvent.click(screen.getByRole('button', { name: '取消' }));
        expect(onCancel).toHaveBeenCalled();
        expect(onSave).not.toHaveBeenCalled();
    });

    it('名稱空白不能儲存，並顯示白話提示', async () => {
        const onSave = vi.fn();
        renderWithUi(<AddAttractionForm onSave={onSave} onCancel={() => {}} />);
        await userEvent.click(screen.getByRole('button', { name: '儲存' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('請填寫景點名稱');
        expect(onSave).not.toHaveBeenCalled();
    });

    it('編輯時保留表單沒有的欄位（停車資訊、拍照提示），不會被洗掉', async () => {
        const onSave = vi.fn();
        renderWithUi(<AddAttractionForm editAttraction={base} onSave={onSave} onCancel={() => {}} />);
        await userEvent.click(screen.getByRole('button', { name: '儲存' }));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1', parkingInfo: '500円/小時', photoTip: '用低曝光', name: '小樽運河' }));
    });

    it('沒設定過停留時間的舊景點，編輯後仍是「不指定」', async () => {
        const onSave = vi.fn();
        renderWithUi(<AddAttractionForm editAttraction={base} onSave={onSave} onCancel={() => {}} />);
        await userEvent.click(screen.getByRole('button', { name: '儲存' }));
        expect(onSave.mock.calls[0][0].durationMinutes).toBeUndefined();
    });
});

describe('記帳', () => {
    async function openExpense(opts: { fetchOk?: boolean } = {}) {
        const { id } = await createTripRecord('T', '2026-02-10', '2026-02-12');
        await patchConfig(id, { tripCurrency: 'JPY', baseCurrency: 'TWD', travelers: 2 });
        vi.stubGlobal('fetch', vi.fn(async () => (opts.fetchOk === false ? jsonResponse({}, { ok: false, status: 500 }) : jsonResponse(ratesBody))));
        renderWithUi(<ExpenseTracker tripId={id} />);
        await screen.findByText('本趟總花費（日圓）');
        return id;
    }

    it('預設日期是裝置當地的今天', async () => {
        await openExpense();
        await userEvent.click(screen.getByRole('button', { name: /記一筆花費/ }));
        expect((screen.getByLabelText('日期') as HTMLInputElement).value).toBe(formatYMD(todayISO()));
    });

    it('無效金額（空白、文字、0、日圓帶小數）會顯示錯誤，不會存檔', async () => {
        const id = await openExpense();
        await userEvent.click(screen.getByRole('button', { name: /記一筆花費/ }));
        await userEvent.type(screen.getByLabelText('說明'), '午餐');
        for (const bad of ['', 'abc', '0', '100.5']) {
            const amt = screen.getByLabelText(/金額/);
            await userEvent.clear(amt);
            if (bad) await userEvent.type(amt, bad);
            await userEvent.click(screen.getByRole('button', { name: '儲存' }));
            expect(await screen.findByText(/請輸入大於 0 的整數金額/)).toBeInTheDocument();
        }
        expect((await expenseStore.keys()).filter((k) => k.startsWith(id))).toHaveLength(0);
    });

    it('新增一筆後：總額、結算幣別換算、兩人平分都正確', async () => {
        const id = await openExpense();
        await userEvent.click(screen.getByRole('button', { name: /記一筆花費/ }));
        await userEvent.type(screen.getByLabelText(/金額/), '1,500');
        await userEvent.type(screen.getByLabelText('說明'), '拉麵');
        await userEvent.click(screen.getByRole('button', { name: '儲存' }));
        await waitFor(() => expect(screen.getAllByText('¥1,500').length).toBeGreaterThan(0));
        expect(screen.getByText('約 NT$300')).toBeInTheDocument(); // 1500 JPY * 30/150
        expect(screen.getByText('¥750')).toBeInTheDocument(); // 兩人平分
        const keys = (await expenseStore.keys()).filter((k) => k.startsWith(id));
        const rec = await expenseStore.getItem<{ currency: string; amountJPY: number }>(keys[0]);
        expect(rec).toMatchObject({ amountJPY: 1500, currency: 'JPY' });
    });

    it('匯率服務失敗且沒有快取：不顯示假的換算數字，並說明原因', async () => {
        const { id } = await createTripRecord('T', '2026-02-10', '2026-02-12');
        await expenseStore.setItem(`${id}_x`, { id: 'x', description: '舊紀錄', amountJPY: 1000, category: '飲食', dateISO: '2026-02-10', paidBy: '自己' });
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { ok: false, status: 500 })));
        renderWithUi(<ExpenseTracker tripId={id} />);
        expect(await screen.findByText(/目前沒有匯率資料/)).toBeInTheDocument();
        expect(screen.queryByText(/約 NT\$/)).not.toBeInTheDocument();
        expect(screen.getAllByText('¥1,000').length).toBeGreaterThan(0); // 當地幣別金額照常顯示
    });
});

describe('匯率計算機', () => {
    it('拿不到匯率時顯示錯誤、結果是「—」，不編造數字', async () => {
        const { id } = await createTripRecord('T', '2026-02-10', '2026-02-12');
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, { ok: false, status: 503 })));
        renderWithUi(<ExchangeRate tripId={id} />);
        expect(await screen.findByText('目前拿不到匯率')).toBeInTheDocument();
        const out = document.querySelector('.exchange-box.out .big');
        expect(out?.textContent).toBe('—');
    });

    it('使用過期快取時明確警告，並仍能換算', async () => {
        const { id } = await createTripRecord('T', '2026-02-10', '2026-02-12');
        localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates: ratesBody.rates, timestamp: Date.now() - 48 * 3600 * 1000 }));
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
        renderWithUi(<ExchangeRate tripId={id} />);
        expect(await screen.findByText('目前使用舊匯率')).toBeInTheDocument();
        await waitFor(() => expect(document.querySelector('.exchange-box.out .big')?.textContent).toBe('200')); // 1000 JPY → TWD(30/150) = 200
    });
});

describe('海關提醒', () => {
    async function openChecklist(location: string) {
        const { id } = await createTripRecord('T', '2026-02-10', '2026-02-12');
        await patchConfig(id, { location });
        const rules = JSON.parse((await import('node:fs')).readFileSync('public/prohibited_rules.json', 'utf8'));
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(rules)));
        renderWithUi(<PackingChecklist tripId={id} />);
        await screen.findByText('行李準備進度');
    }

    it('日本行程顯示日本海關提醒與免責說明', async () => {
        await openChecklist('Sapporo, Japan');
        expect(await screen.findByText(/日本海關：/)).toBeInTheDocument();
        expect(screen.getByText(/不具法律效力/)).toBeInTheDocument();
    });

    it('Austria 不會被誤判成美國', async () => {
        await openChecklist('Salzburg, Austria');
        await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
        await new Promise((r) => setTimeout(r, 30));
        expect(screen.queryByText(/美國海關/)).not.toBeInTheDocument();
    });
});

describe('行程頁', () => {
    async function seedTrip() {
        const { id } = await createTripRecord('T', '2026-02-10', '2026-02-12');
        await patchConfig(id, { accommodations: [{ id: 'h1', name: '札幌飯店', address: '札幌市中央區', url: '', checkIn: '2026-02-10', checkOut: '2026-02-12' }] });
        await ensureDays(id);
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({})));
        return id;
    }

    it('設了入住／退房日期的住宿，「返回住宿」按鈕確實會出現（舊版因日期格式比對錯誤永遠不出現）', async () => {
        const id = await seedTrip();
        renderWithUi(<Itinerary tripId={id} />);
        expect(await screen.findByRole('button', { name: /返回 札幌飯店/ })).toBeInTheDocument();
    });

    it('亂貼的匯入內容：顯示錯誤，原有景點完全不變', async () => {
        const id = await seedTrip();
        await updateDay(id, 'day-1', (d) => ({ ...d, attractions: [{ id: 'k', name: '不能被洗掉的景點', category: '景點', description: '', tags: [], mapQuery: '' }] }));
        renderWithUi(<Itinerary tripId={id} />);
        await screen.findByText('不能被洗掉的景點');
        await userEvent.click(screen.getByRole('button', { name: /匯入表格/ }));
        const dialog = await screen.findByRole('dialog');
        await userEvent.type(within(dialog).getByLabelText('貼上表格內容'), '隨便亂貼的文字');
        await userEvent.click(within(dialog).getByRole('button', { name: '解析並匯入' }));
        expect(await within(dialog).findByRole('alert')).toHaveTextContent('沒有改動你的行程');
        await userEvent.click(within(dialog).getByRole('button', { name: '取消' }));
        expect(screen.getByText('不能被洗掉的景點')).toBeInTheDocument();
    });
});

describe('相簿連結', () => {
    it('拒絕 javascript: 等不安全的網址，接受一般相簿連結', async () => {
        const { id } = await createTripRecord('T', '2026-02-10', '2026-02-10');
        await ensureDays(id);
        renderWithUi(<PhotoAlbum tripId={id} />);
        await userEvent.click(await screen.findByRole('button', { name: /貼上相簿連結/ }));
        const input = screen.getByLabelText(/相簿分享連結/);
        await userEvent.type(input, 'javascript:alert(1)');
        await userEvent.click(screen.getByRole('button', { name: '儲存' }));
        expect(await screen.findByText(/不是有效的網址/)).toBeInTheDocument();
        expect(await albumStore.getItem(`${id}_albums`)).toBeNull();
        await userEvent.clear(input);
        await userEvent.type(input, 'photos.app.goo.gl/xyz');
        await userEvent.click(screen.getByRole('button', { name: '儲存' }));
        await waitFor(async () => expect(await albumStore.getItem(`${id}_albums`)).toEqual([{ dayId: 'day-1', url: 'https://photos.app.goo.gl/xyz' }]));
    });
});
