/**
 * 儲存檔案給使用者。手機（觸控為主）優先叫出系統分享選單，可以直接存到「檔案」或傳給別人；
 * 電腦一律直接下載，不要跳出分享視窗。回傳 'shared' | 'downloaded' | 'cancelled'。
 */
export async function saveFile(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: file.name });
            return 'shared';
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
            // 其他原因分享失敗：改用下載
        }
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return 'downloaded';
}
