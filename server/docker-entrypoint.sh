#!/bin/sh
set -e
echo "[kelo] waiting for database..."
i=0
while [ "$i" -lt 40 ]; do
  if node -e "const {Client}=require('pg'); const c=new Client({connectionString:process.env.DATABASE_URL}); c.connect().then(()=>c.end()).then(()=>process.exit(0)).catch(()=>process.exit(1));" 2>/dev/null; then
    echo "[kelo] database is ready"
    break
  fi
  i=$((i+1))
  sleep 1
done

echo "[kelo] running migrations..."
if node server/migrate.js; then
  echo "[kelo] migrations ok"
else
  echo "[kelo] WARNING: migrate failed — starting server anyway (check logs)"
fi

echo "[kelo] starting API on port ${PORT:-3000}"
exec node server/app.js
