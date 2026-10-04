// 檢查 public/prohibited_rules.json 格式：node scripts/validate-rules.mjs
// CI 與 npm test 都會跑，避免壞掉的規則檔被發布（App 端也會再驗證一次，壞資料不會顯示給使用者）。
import { readFileSync } from 'node:fs';

const path = new URL('../public/prohibited_rules.json', import.meta.url);
const errors = [];
let data;
try {
    data = JSON.parse(readFileSync(path, 'utf8'));
} catch (e) {
    console.error(`規則檔不是有效的 JSON：${e.message}`);
    process.exit(1);
}

if (!Array.isArray(data.rules) || data.rules.length === 0) errors.push('rules 必須是非空陣列');
for (const [i, r] of (data.rules ?? []).entries()) {
    if (!Array.isArray(r.keywords) || r.keywords.length === 0) errors.push(`第 ${i + 1} 筆：keywords 必須是非空陣列`);
    else if (!r.keywords.every((k) => typeof k === 'string' && k.trim() && k.length <= 40)) errors.push(`第 ${i + 1} 筆：keywords 必須是 40 字以內的非空字串`);
    if (typeof r.message !== 'string' || !r.message.trim() || r.message.length > 500) errors.push(`第 ${i + 1} 筆：message 必須是 500 字以內的非空字串`);
    if (typeof r.message === 'string' && /自動更新/.test(r.message)) errors.push(`第 ${i + 1} 筆：message 不得宣稱「自動更新」`);
}
if (typeof data.last_reviewed !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.last_reviewed)) errors.push('last_reviewed 必須是 YYYY-MM-DD');
for (const s of data.sources ?? []) {
    if (!/^https:\/\//.test(s.url ?? '')) errors.push(`來源網址必須是 https：${s.name}`);
}

if (errors.length > 0) {
    console.error('規則檔檢查失敗：\n- ' + errors.join('\n- '));
    process.exit(1);
}
console.log(`規則檔檢查通過：${data.rules.length} 筆規則，內容整理於 ${data.last_reviewed}`);
