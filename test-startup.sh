#!/bin/bash
cd apps/backend-passport-strategies
npm run start:dev &
PID=$!
sleep 10
kill $PID 2>/dev/null
wait $PID 2>/dev/null
