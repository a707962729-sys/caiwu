#!/bin/bash
cd /Users/mac/caiwu

# Get token
LOGIN_RESP=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['token'])")
echo "Token: ${TOKEN:0:30}..."

AUTH_HEADER="Authorization: Bearer $TOKEN"

echo ""
echo "=== RECEIVABLES ==="
curl -s http://localhost:3000/api/receivables -H "$AUTH_HEADER" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    lst=d['data'].get('list',[])
    print(f'OK - total in list: {len(lst)}, total field: {d[\"data\"].get(\"total\",0)}')
    for c in lst[:3]:
        print(f'  [{c[\"id\"]}] {c.get(\"partner_name\",\"\")} amount={c.get(\"amount\",\"\")} status={c.get(\"status\",\"\")}')
else:
    print('FAIL:', d.get('error','unknown'))
"

echo ""
echo "=== INVOICES ==="
curl -s http://localhost:3000/api/invoices -H "$AUTH_HEADER" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    lst=d['data'].get('list',[])
    print(f'OK - total: {len(lst)}')
    for c in lst[:3]:
        print(f'  [{c[\"id\"]}] {c.get(\"invoice_no\",\"\")} amount={c.get(\"total_amount\",\"\")} status={c.get(\"status\",\"\")}')
else:
    print('FAIL:', d.get('error','unknown'))
"

echo ""
echo "=== EMPLOYEES ==="
curl -s http://localhost:3000/api/employees -H "$AUTH_HEADER" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    lst=d['data'].get('list',[])
    print(f'OK - total: {len(lst)}')
    for c in lst[:3]:
        print(f'  [{c[\"id\"]}] {c.get(\"name\",\"\")} dept={c.get(\"department\",\"\")}')
else:
    print('FAIL:', d.get('error','unknown'))
"

echo ""
echo "=== SALARIES ==="
curl -s http://localhost:3000/api/salaries -H "$AUTH_HEADER" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    lst=d['data'].get('list',[])
    print(f'OK - total: {len(lst)}')
else:
    print('FAIL:', d.get('error','unknown'))
"

echo ""
echo "=== ATTENDANCE ==="
curl -s http://localhost:3000/api/attendance -H "$AUTH_HEADER" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    lst=d['data'].get('list',[])
    print(f'OK - total: {len(lst)}')
else:
    print('FAIL:', d.get('error','unknown'))
"

echo ""
echo "=== CONTRACTS ==="
curl -s http://localhost:3000/api/contracts -H "$AUTH_HEADER" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    lst=d['data'].get('list',[])
    print(f'OK - total: {len(lst)}')
    for c in lst[:5]:
        print(f'  [{c[\"id\"]}] {c.get(\"contract_no\",\"\")} status={c.get(\"status\",\"\")} review={c.get(\"review_status\",\"\")}')
else:
    print('FAIL:', d.get('error','unknown'))
"

echo ""
echo "=== DASHBOARD OVERVIEW ==="
curl -s http://localhost:3000/api/dashboard/overview -H "$AUTH_HEADER" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    data=d['data']
    print('OK')
    print('  Income:', data.get('incomeExpense',{}).get('income'))
    print('  Expense:', data.get('incomeExpense',{}).get('expense'))
    print('  Receivable:', data.get('receivablesPayables',{}).get('receivable'))
    print('  Payable:', data.get('receivablesPayables',{}).get('payable'))
else:
    print('FAIL:', d.get('error','unknown'))
"

echo ""
echo "=== QQBOT STATUS ==="
curl -s http://localhost:3000/api/qqbot -H "$AUTH_HEADER" | head -c 200

echo ""
echo "=== SETTINGS ==="
curl -s http://localhost:3000/api/settings -H "$AUTH_HEADER" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if d.get('success'):
    print('OK - keys:', list(d['data'].keys()))
else:
    print('FAIL:', d.get('error','unknown'))
"

echo ""
echo "=== POST /api/contracts/18/review ==="
curl -s -X POST http://localhost:3000/api/contracts/18/review -H "$AUTH_HEADER" -H "Content-Type: application/json" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('OK' if d.get('success') else 'FAIL', d.get('message','')[:100])
"