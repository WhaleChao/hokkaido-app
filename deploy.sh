#!/usr/bin/env sh
# 發布：先跑檢查與建置，再把 dist/ 強制推到 gh-pages 分支（GitHub Pages 讀這個分支）。
# 注意：dist 內只會有建置成品；來源碼在 main 分支。
set -e
npm run predeploy
# 這個 repo 的預設分支是 gh-pages（GitHub 的排程與手動觸發只讀預設分支的 workflow 檔），
# 所以把自動核對規則的 workflow 一併放進發布分支；原始檔仍以 main 的 .github/workflows 為準。
mkdir -p dist/.github/workflows
cp .github/workflows/update-rules.yml dist/.github/workflows/update-rules.yml
cd dist
touch .nojekyll
git init -q
git checkout -q -B main
git add -A
git commit -q -m "deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -f https://github.com/WhaleChao/hokkaido-app.git main:gh-pages
cd -
