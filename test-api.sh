#!/bin/bash
# 财务管家 API 测试脚本

API_URL="http://localhost:3000/api"
TOKEN=""

echo "========================================="
echo "  财务管家 API 测试"
echo "========================================="

# 1. 登录获取 Token
echo ""
echo "【1. 登录测试】"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}')
echo "$LOGIN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$LOGIN_RESPONSE"
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Token: ${TOKEN:0:20}..."

# 2. 商品档案
echo ""
echo "【2. 商品档案测试】"
curl -s -X GET "$API_URL/products?page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -20

# 3. 客户管理
echo ""
echo "【3. 客户管理测试】"
curl -s -X GET "$API_URL/customers?page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -20

# 4. 库存管理
echo ""
echo "【4. 库存管理测试】"
curl -s -X GET "$API_URL/inventory?page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -20

# 5. 库存预警
echo ""
echo "【5. 库存预警测试】"
curl -s -X GET "$API_URL/inventory/low-stock" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -20

# 6. 采购订单
echo ""
echo "【6. 采购订单测试】"
curl -s -X GET "$API_URL/purchase-orders?page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -20

# 7. 销售订单
echo ""
echo "【7. 销售订单测试】"
curl -s -X GET "$API_URL/orders?page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -20

# 8. 财务智能 - 利润计算
echo ""
echo "【8. 财务智能 - 利润计算】"
curl -s -X GET "$API_URL/finance/profit/calculate?startDate=2026-01-01&endDate=2026-12-31" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null

# 9. 财务智能 - 应收账龄
echo ""
echo "【9. 财务智能 - 应收账龄】"
curl -s -X GET "$API_URL/finance/receivables/aging" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null

# 10. OpenClaw 集成
echo ""
echo "【10. OpenClaw 集成测试】"
curl -s -X GET "$API_URL/openclaw/health" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null

# 11. 报价单（新路由）
echo ""
echo "【11. 报价单测试】"
curl -s -X GET "$API_URL/quotations?page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -20

# 12. 销售订单（新路由）
echo ""
echo "【12. 销售订单测试（新）】"
curl -s -X GET "$API_URL/sales-orders?page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -20

# 13. 采购申请（新路由）
echo ""
echo "【13. 采购申请测试】"
curl -s -X GET "$API_URL/purchase-requests?page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null | head -20

echo ""
echo "========================================="
echo "  测试完成！"
echo "========================================="