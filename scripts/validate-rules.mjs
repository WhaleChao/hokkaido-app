// 檢查 public/prohibited_rules.json 與 public/rules-status.json 的結構：node scripts/validate-rules.mjs
// CI、npm test 與自動更新流程都會跑；驗證不過就不提交、不發布。
import { readFileSync } from 'node:fs';
import { validateRulesFile, validateStatusFile } from './rules/schema.mjs';

const load = (name) => {
    try {
        return JSON.parse(readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8'));
    } catch (e) {
        console.error(`${name} 不是有效的 JSON：${e.message}`);
        process.exit(1);
    }
};
const rules = load('prohibited_rules.json');
const status = load('rules-status.json');
const errors = [...validateRulesFile(rules).map((e) => `prohibited_rules.json：${e}`), ...validateStatusFile(status).map((e) => `rules-status.json：${e}`)];
for (const r of rules.rules ?? []) if (!status.sources?.[r.source_id]) errors.push(`規則 ${r.id} 在 rules-status.json 沒有對應的來源狀態`);
if (JSON.stringify(rules).includes('自動更新版')) errors.push('不得出現舊版的「自動更新版」字樣');
if (errors.length) {
    console.error('規則檔檢查失敗：\n- ' + errors.join('\n- '));
    process.exit(1);
}
console.log(`規則檔檢查通過：${rules.rules.length} 條規則、${rules.sources.length} 個官方來源，最後核對 ${status.checked_at}`);
