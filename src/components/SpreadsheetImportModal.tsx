import { useState } from 'react';
import { FileUp, X } from 'lucide-react';

interface Props {
    onImport: (tsv: string) => void;
    onClose: () => void;
}

export function SpreadsheetImportModal({ onImport, onClose }: Props) {
    const [tsvData, setTsvData] = useState('');

    const handleImport = () => {
        if (!tsvData.trim()) {
            alert('請貼上行程表格內容');
            return;
        }
        if (!window.confirm('準備匯入此表格，是否繼續？')) return;

        onImport(tsvData);
        onClose();
    };

    return (
        <div className="add-form-overlay fade-in">
            <div className="add-form-container" style={{ maxWidth: '500px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontWeight: 700 }}><FileUp size={20} className="inline-icon" /> 智慧匯入行程表</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className="form-group">
                    <label style={{ fontSize: '1rem', color: 'var(--text-main)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>
                        免上傳檔案！直接從表格「複製貼上」即可 ⚡️
                    </label>

                    {(() => {
                        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                        return (
                            <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: isMobile ? 'rgba(255,165,0,0.1)' : 'rgba(52,88,153,0.1)', borderRadius: '8px', border: isMobile ? '1px solid orange' : '1px solid var(--fuji-blue)' }}>
                                <div style={{ fontWeight: 'bold', color: isMobile ? 'orange' : 'var(--fuji-blue)', marginBottom: '8px' }}>
                                    📱 系統偵測您目前使用：{isMobile ? '手機版網頁' : '電腦版網頁'}
                                </div>
                                {isMobile ? (
                                    <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
                                        建議：在手機上圈選 Excel 表格比較困難，強烈建議您**改用電腦版打開此網頁**進行匯入喔！
                                    </p>
                                ) : (
                                    <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
                                        操作提示：請直接在您的 Excel 中將行程圈選後按下 `Ctrl+C`，再到下方大黑框按下 `Ctrl+V`。
                                    </p>
                                )}
                            </div>
                        );
                    })()}

                    <div style={{ marginBottom: '12px' }}>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: 'bold', marginBottom: '8px' }}>必須包含的表格欄位（順序隨意，但建議如下）：</p>
                        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', border: '1px solid #ddd', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f5f5f5' }}>
                                    <th style={{ padding: '8px', border: '1px solid #ddd' }}>天數</th>
                                    <th style={{ padding: '8px', border: '1px solid #ddd' }}>景點名稱</th>
                                    <th style={{ padding: '8px', border: '1px solid #ddd' }}>分類</th>
                                    <th style={{ padding: '8px', border: '1px solid #ddd' }}>備註 (選填)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>1</td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>東京迪士尼</td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>景點</td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>抽快速通關</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>第 2 天</td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>一蘭拉麵</td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}>食物</td>
                                    <td style={{ padding: '8px', border: '1px solid #ddd' }}></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <textarea
                        value={tsvData}
                        onChange={(e) => setTsvData(e.target.value)}
                        placeholder={'在此貼上您的 Excel 內容...\n(1\t東京迪士尼\t景點\t...)'}
                        style={{
                            width: '100%',
                            height: '150px',
                            padding: '12px',
                            borderRadius: '8px',
                            border: '1px solid #ccc',
                            fontFamily: 'monospace',
                            whiteSpace: 'pre',
                            overflowWrap: 'normal',
                            overflowX: 'auto',
                            backgroundColor: '#f9f9f9'
                        }}
                    />
                </div>

                <div className="form-actions">
                    <button className="btn-save" onClick={handleImport} style={{ width: '100%' }}>
                        解析並匯入
                    </button>
                </div>
            </div>
        </div>
    );
}
