#!/usr/bin/env bash
set -euo pipefail

cd ~/API-Gateway

git fetch --all
git reset --hard origin/main

docker compose up -d

npm install
npm run build

cd dashboard
npm install
npm run build
cd ..

pm2 restart api-gateway || pm2 start "npm start" --name api-gateway
pm2 restart dashboard || pm2 serve dashboard/dist 5173 --name dashboard --spa
pm2 save

pm2 status
