---
name: api-test
description: 快速测试 API 接口，支持自动认证和批量测试。Use when the user asks to "测试API", "api test", "接口测试", "curl测试", "测试接口".
---

# API 快速测试

## 单接口测试

### GET 请求
```bash
curl -s -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  "${API_BASE}/endpoint" | jq .
```

### POST 请求
```bash
curl -s -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -d '{"key":"value"}' \
  "${API_BASE}/endpoint" | jq .
```

## 自动获取 Token

### 登录获取 JWT
```bash
JWT_TOKEN=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  "${API_BASE}/auth/login" | jq -r '.access_token')

echo "Token: $JWT_TOKEN"
```

## 批量测试

### 从文件读取测试用例
```bash
# test-cases.json
[
  {"method":"GET","path":"/users","expected":200},
  {"method":"POST","path":"/users","body":{"name":"test"},"expected":201}
]
```

### 执行批量测试
```bash
jq -c '.[]' test-cases.json | while read test; do
  method=$(echo $test | jq -r '.method')
  path=$(echo $test | jq -r '.path')
  expected=$(echo $test | jq -r '.expected')
  
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X $method \
    -H "Authorization: Bearer ${JWT_TOKEN}" \
    "${API_BASE}${path}")
  
  if [ "$status" == "$expected" ]; then
    echo "✓ $method $path"
  else
    echo "✗ $method $path (got $status, expected $expected)"
  fi
done
```

## 常用模板

### 健康检查
```bash
curl -s "${API_BASE}/health" | jq .
```

### 带查询参数
```bash
curl -s -G \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  --data-urlencode "page=1" \
  --data-urlencode "limit=10" \
  "${API_BASE}/users" | jq .
```
