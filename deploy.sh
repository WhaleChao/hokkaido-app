#!/usr/bin/env sh
# 發布：先跑檢查與建置，再把 dist/ 強制推到 gh-pages 分支（GitHub Pages 讀這個分支）。
# 注意：dist 內只會有建置成品；來源碼在 main 分支。
set -e
npm run predeploy
cd dist
touch .nojekyll
git init -q
git checkout -q -B main
git add -A
git commit -q -m "deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"
git push -f https://github.com/WhaleChao/hokkaido-app.git main:gh-pages
cd -
