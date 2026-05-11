---
name: web-scraper
description: 终极网络数据采集与爬虫工具，Level 12 终极能力：覆盖20大技术模块（HTTP直接请求/浏览器自动化/抓包逆向/移动端APP逆向/JS逆向/协议级采集/AI驱动采集/公开数据源/搜索引擎采集/社交媒体采集/深网暗网采集/网络空间搜索/文档邮件采集/IoT传感器数据/云端浏览器BaaS/验证码完全破解/指纹对抗全方案/代理完整体系/行为模拟/中国平台针对性破解）。支持美团mtgsig/waimai_sign、京东DFPID/XID/sign、淘宝x-sign、拼多多anti-content、抖音_signature/X-Bogus、小红书x-s等全平台破解。WAF绕过：Cloudflare/DataDome/Kasada/Shape/Akamai/PerimeterX。AI驱动：Crawl4AI/ScrapeGraphAI/AgentQL/Browser-Use/Skyvern。指纹对抗：JA4/JA4+/TLS/HTTP2/Canvas/WebGL/AudioContext/WebRTC。代理体系：站大爷/ISP/住宅/移动/Tor。Use when the user asks to "爬取数据", "抓取网页", "web scrape", "crawl", "采集数据", "爬虫", "抓取API", "美团", "京东", "淘宝", "拼多多", "抖音", "小红书", "mtgsig", "waimai_sign", "DFPID", "XID", "x-sign", "anti-content", "X-Bogus", "_signature", "x-s"
---

# Web Scraper Ultimate - Level 12 终极版本

> **核心原则**: 结果导向，想尽一切办法获取目标数据，不做任何技术妥协或保留。

---

## 目录

1. [模块1: HTTP直接请求（参数签名逆向）](#模块1-http直接请求参数签名逆向)
2. [模块2: 浏览器自动化（反检测）](#模块2-浏览器自动化反检测)
3. [模块3: 抓包逆向](#模块3-抓包逆向)
4. [模块4: 移动端APP逆向](#模块4-移动端app逆向)
5. [模块5: JS逆向](#模块5-js逆向)
6. [模块6: 协议级采集](#模块6-协议级采集)
7. [模块7: AI驱动采集](#模块7-ai驱动采集)
8. [模块8: 公开数据源](#模块8-公开数据源)
9. [模块9: 搜索引擎采集](#模块9-搜索引擎采集)
10. [模块10: 社交媒体采集](#模块10-社交媒体采集)
11. [模块11: 深网/暗网采集](#模块11-深网暗网采集)
12. [模块12: 网络空间搜索](#模块12-网络空间搜索)
13. [模块13: 文档/邮件采集](#模块13-文档邮件采集)
14. [模块14: IoT/传感器数据](#模块14-iot传感器数据)
15. [模块15: 云端浏览器BaaS](#模块15-云端浏览器baas)
16. [模块16: 验证码完全破解](#模块16-验证码完全破解)
17. [模块17: 指纹对抗全方案](#模块17-指纹对抗全方案)
18. [模块18: 代理完整体系](#模块18-代理完整体系)
19. [模块19: 行为模拟](#模块19-行为模拟)
20. [模块20: 中国平台针对性破解](#模块20-中国平台针对性破解)
21. [WAF/Bot检测绕过专项](#wafbot检测绕过专项)
22. [分布式架构](#分布式架构)
23. [自进化引擎](#自进化引擎)

---

## 模块1: HTTP直接请求（参数签名逆向）

### 概述
HTTP直接请求是最基础也是最高效的采集方式。通过完美伪装浏览器指纹（JA3/JA4/TLS/HTTP2），可直接绕过大部分反爬检测。配合参数签名逆向，可直接调用目标API获取结构化数据。

### 推荐工具

| 工具 | 用途 | 优势 |
|------|------|------|
| curl_cffi | TLS/JA3/JA4伪装 | 纯C扩展，完美模拟浏览器TLS握手 |
| httpx | 异步HTTP/2 | 原生HTTP/2支持，性能优异 |
| aiohttp | 高并发异步 | 成熟稳定，生态丰富 |
| requests | 简单同步请求 | 易用，适合快速原型 |

### 代码示例

#### 1.1 curl_cffi 完整伪装方案

```python
from curl_cffi import requests as curl_requests
from curl_cffi.requests import Session
import json
import time

class UltimateHTTPClient:
    """终极HTTP客户端 - 完全指纹伪装"""
    
    def __init__(self, impersonate="chrome120"):
        # 支持的impersonate: chrome99, chrome100, chrome101, chrome104, chrome107,
        # chrome110, chrome116, chrome119, chrome120, chrome123,
        # edge99, edge101, safari15_3, safari15_5, safari17_0, safari17_2
        self.session = Session(impersonate=impersonate)
        self.session.timeout = 30
        
    def request_with_full_disguise(self, url, method="GET", **kwargs):
        """
        发送完全伪装的HTTP请求
        """
        # 默认headers模拟真实浏览器
        default_headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "max-age=0",
            "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1"
        }
        
        # 合并用户自定义headers
        headers = kwargs.pop("headers", {})
        default_headers.update(headers)
        
        response = self.session.request(
            method=method,
            url=url,
            headers=default_headers,
            **kwargs
        )
        return response

# 使用示例
client = UltimateHTTPClient(impersonate="chrome120")
resp = client.request_with_full_disguise("https://example.com/api/data")
print(resp.text)
```

#### 1.2 参数签名逆向方法论

```python
import hashlib
import hmac
import base64
import urllib.parse
import json
import time
import re
from typing import Dict, Any

class SignatureCracker:
    """
    参数签名逆向通用框架
    流程: 抓包→定位→还原→验证
    """
    
    @staticmethod
    def analyze_request_pattern(requests_log: list) -> Dict[str, Any]:
        """
        分析请求模式，识别签名参数
        常见签名参数名: sign, signature, _sign, token, auth, _sig
        """
        signature_params = []
        
        for req in requests_log:
            params = req.get("params", {})
            for key, value in params.items():
                # 签名参数特征: 32位hex(MD5) 或 43位base64(HMAC)
                if re.match(r'^[a-f0-9]{32}$', str(value)):
                    signature_params.append({
                        "param": key,
                        "type": "MD5",
                        "value": value,
                        "other_params": {k: v for k, v in params.items() if k != key}
                    })
                elif re.match(r'^[A-Za-z0-9+/]{43}=?$', str(value)):
                    signature_params.append({
                        "param": key,
                        "type": "HMAC/Base64",
                        "value": value,
                        "other_params": {k: v for k, v in params.items() if k != key}
                    })
        
        return signature_params
    
    @staticmethod
    def crack_md5_sign(params: Dict[str, Any], secret_key: str = "", 
                       sort_keys: bool = True, 
                       exclude_keys: list = None) -> str:
        """
        破解MD5签名
        常见模式: MD5(排序后的参数串 + 密钥)
        """
        if exclude_keys is None:
            exclude_keys = ["sign", "signature"]
        
        # 过滤排除的参数
        filtered_params = {k: v for k, v in params.items() if k not in exclude_keys}
        
        # 排序
        if sort_keys:
            items = sorted(filtered_params.items())
        else:
            items = filtered_params.items()
        
        # 构建签名字符串
        sign_str = "&".join([f"{k}={v}" for k, v in items])
        
        if secret_key:
            sign_str += secret_key
        
        return hashlib.md5(sign_str.encode()).hexdigest()
    
    @staticmethod
    def crack_hmac_sign(params: Dict[str, Any], secret_key: str,
                        algorithm: str = "sha256") -> str:
        """
        破解HMAC签名
        """
        message = json.dumps(params, separators=(',', ':'), sort_keys=True)
        
        if algorithm == "sha256":
            digest = hmac.new(secret_key.encode(), message.encode(), hashlib.sha256).digest()
        elif algorithm == "sha1":
            digest = hmac.new(secret_key.encode(), message.encode(), hashlib.sha1).digest()
        elif algorithm == "md5":
            digest = hmac.new(secret_key.encode(), message.encode(), hashlib.md5).digest()
        
        return base64.b64encode(digest).decode()

# 使用示例
params = {
    "app_id": "12345",
    "timestamp": str(int(time.time())),
    "data": "example"
}
# 假设密钥是 "secret_key"
sign = SignatureCracker.crack_md5_sign(params, secret_key="secret_key")
print(f"Generated sign: {sign}")
```

#### 1.3 httpx 异步高并发方案

```python
import httpx
import asyncio
from typing import List, Dict

class AsyncHTTPClient:
    """异步HTTP客户端 - 高并发采集"""
    
    def __init__(self, concurrency: int = 100, http2: bool = True):
        limits = httpx.Limits(max_keepalive_connections=50, max_connections=concurrency)
        self.client = httpx.AsyncClient(
            http2=http2,
            limits=limits,
            timeout=httpx.Timeout(30.0, connect=5.0)
        )
    
    async def fetch_single(self, url: str, headers: Dict = None) -> Dict:
        """获取单个URL"""
        try:
            response = await self.client.get(url, headers=headers)
            return {
                "url": url,
                "status": response.status_code,
                "content": response.text,
                "success": response.status_code == 200
            }
        except Exception as e:
            return {
                "url": url,
                "status": 0,
                "content": str(e),
                "success": False
            }
    
    async def fetch_batch(self, urls: List[str], headers: Dict = None) -> List[Dict]:
        """批量获取URL"""
        tasks = [self.fetch_single(url, headers) for url in urls]
        return await asyncio.gather(*tasks, return_exceptions=True)
    
    async def close(self):
        await self.client.aclose()

# 使用示例
async def main():
    client = AsyncHTTPClient(concurrency=50)
    urls = [f"https://example.com/page/{i}" for i in range(1, 101)]
    results = await client.fetch_batch(urls)
    await client.close()
    print(f"成功: {sum(1 for r in results if r.get('success'))}")

# asyncio.run(main())
```

### 实战技巧

1. **TLS指纹识别**: 使用 https://tls.browserleaks.com/json 检测当前TLS指纹
2. **JA3指纹**: 使用 https://www.ja3er.com/ 查询JA3指纹是否被标记
3. **抓包定位签名**: 使用Chrome DevTools的"Initiator"功能追踪签名生成位置
4. **参数变化分析**: 对比多次请求，找出变化的签名参数
5. **密钥提取**: 在JS代码中搜索关键词: `sign`, `signature`, `md5`, `hmac`, `secret`, `key`

---

## 模块2: 浏览器自动化（反检测）

### 概述
浏览器自动化是处理JS渲染页面和强反爬站点的核心手段。现代反检测方案从CDP协议层、C++层注入指纹，实现接近真实浏览器的体验。

### 推荐工具

| 工具 | 核心能力 | 适用场景 |
|------|---------|---------|
| **Camoufox** | C++层指纹注入，Firefox内核 | 最强反检测方案 |
| **Patchright** | Playwright反检测Fork | CDP协议层对抗 |
| **Nodriver** | undetected-chromedriver替代 | 简单反检测 |
| **Botright** | 反检测+验证码一体化 | 验证码频繁站点 |
| **rebrowser-patches** | Puppeteer/Playwright补丁 | 轻量级方案 |

### 代码示例

#### 2.1 Camoufox 终极反检测方案

```python
# Camoufox - 当前最强反检测浏览器
# 安装: pip install camoufox

from camoufox.sync_api import Camoufox
from camoufox.utils import generate_fingerprint

def camoufox_ultimate_scraper(url: str):
    """
    Camoufox终极采集方案
    特点: C++层指纹注入、内存占用低(200MB)、Firefox内核天然反检测
    """
    # 生成一致性的浏览器指纹
    fingerprint = generate_fingerprint(
        os="windows",
        browser="firefox",
        version="120"
    )
    
    with Camoufox(
        headless=True,
        fingerprint=fingerprint,
        geoip=True,  # 自动匹配IP地理位置
        locale="zh-CN",
        timezone="Asia/Shanghai"
    ) as browser:
        page = browser.new_page()
        
        # 设置额外的反检测脚本
        page.add_init_script("""
            // 覆盖webdriver检测
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            
            // 覆盖plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [
                    {name: "Chrome PDF Plugin"},
                    {name: "Native Client"}
                ]
            });
        """)
        
        page.goto(url, wait_until="networkidle")
        
        # 模拟人类行为
        page.mouse.move(100, 200)
        page.wait_for_timeout(500)
        page.mouse.move(300, 400)
        
        content = page.content()
        browser.close()
        return content

# 使用示例
# html = camoufox_ultimate_scraper("https://example.com")
```

#### 2.2 Patchright CDP协议层对抗

```python
# Patchright - Playwright的反检测Fork
# 安装: pip install patchright

from patchright.sync_api import sync_playwright

def patchright_stealth_scraper(url: str):
    """
    Patchright反检测方案
    特点: 从CDP协议层堵住检测泄露，使用isolated世界隐藏自动化特征
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
            ]
        )
        
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
            locale='zh-CN',
            timezone_id='Asia/Shanghai',
            permissions=['geolocation'],
            geolocation={'latitude': 39.9, 'longitude': 116.4}
        )
        
        page = context.new_page()
        
        # 注入反检测脚本
        page.add_init_script("""
            // 删除webdriver
            delete Object.getPrototypeOf(navigator).webdriver;
            
            // 模拟chrome.runtime
            window.chrome = {
                runtime: {
                    OnInstalledReason: {CHROME_UPDATE: "chrome_update"},
                    OnRestartRequiredReason: {APP_UPDATE: "app_update"},
                    PlatformArch: {X86_64: "x86-64"},
                    PlatformNaclArch: {X86_64: "x86-64"},
                    PlatformOs: {WIN: "win"},
                    RequestUpdateCheckStatus: {NO_UPDATE: "no_update"}
                }
            };
            
            // 覆盖permissions API
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({state: Notification.permission}) :
                    originalQuery(parameters)
            );
        """)
        
        page.goto(url, wait_until="networkidle")
        content = page.content()
        browser.close()
        return content
```

#### 2.3 Nodriver 快速方案

```python
# Nodriver - undetected-chromedriver的继任者
# 安装: pip install nodriver

import nodriver as uc
import asyncio

async def nodriver_scraper(url: str):
    """
    Nodriver快速反检测方案
    特点: 开箱即用，Cloudflare通过率85%+
    """
    browser = await uc.start()
    page = await browser.get(url)
    
    # 自动等待页面加载
    await page.sleep(3)
    
    content = await page.get_content()
    browser.stop()
    return content

# 使用示例
# content = asyncio.run(nodriver_scraper("https://nowsecure.nl"))
```

#### 2.4 Botright 验证码一体化方案

```python
# Botright - 反检测+验证码破解一体化
# 安装: pip install botright

import botright

async def botright_captcha_scraper(url: str):
    """
    Botright验证码一体化方案
    特点: 自动检测并解决多种验证码
    """
    bot = await botright.Botright()
    browser = await botright.launch(
        proxy={
            "server": "http://proxy.example.com:8080",
            "username": "user",
            "password": "pass"
        },
        captcha_solver="capsolver",  # 集成CapSolver
        captcha_api_key="YOUR_CAPSOLVER_KEY"
    )
    
    page = await browser.new_page()
    await page.goto(url)
    
    # 自动检测并解决验证码
    await page.solve_captcha_if_present()
    
    # 人性化交互
    await page.mouse.move_randomly(duration=2.0)
    await page.keyboard.type_like_human("search query")
    
    content = await page.content()
    await browser.close()
    return content
```

#### 2.5 多浏览器轮换策略

```python
import random
from enum import Enum

class BrowserEngine(Enum):
    CAMOUFOX = "camoufox"
    PATCHRIGHT = "patchright"
    NODRIVER = "nodriver"
    PLAYWRIGHT = "playwright"

class BrowserRotator:
    """多浏览器轮换管理器"""
    
    def __init__(self):
        self.engines = list(BrowserEngine)
        self.current_index = 0
        self.failure_counts = {engine: 0 for engine in self.engines}
    
    def get_next_browser(self) -> BrowserEngine:
        """获取下一个浏览器引擎"""
        # 优先选择失败次数少的
        sorted_engines = sorted(self.engines, key=lambda e: self.failure_counts[e])
        
        # 80%概率选择最佳，20%随机
        if random.random() < 0.8:
            return sorted_engines[0]
        else:
            return random.choice(self.engines)
    
    def record_success(self, engine: BrowserEngine):
        """记录成功"""
        self.failure_counts[engine] = max(0, self.failure_counts[engine] - 1)
    
    def record_failure(self, engine: BrowserEngine):
        """记录失败"""
        self.failure_counts[engine] += 1

# 使用示例
rotator = BrowserRotator()
engine = rotator.get_next_browser()
print(f"Using browser: {engine.value}")
```

### 实战技巧

1. **检测点排查**: 使用 https://bot.sannysoft.com/ 测试反检测效果
2. **WebDriver检测**: 确保 `navigator.webdriver` 为 `undefined`
3. **Chrome Runtime**: 模拟 `window.chrome.runtime` 对象
4. **Permissions API**: 覆盖 `navigator.permissions.query`
5. **Plugins**: 确保 `navigator.plugins` 非空
6. **Languages**: 设置与IP地理位置匹配的语言

---

## 模块3: 抓包逆向

### 概述
抓包逆向是分析APP和Web应用网络请求的核心技术。通过拦截HTTPS流量，可以分析API参数、签名算法、加密逻辑。

### 推荐工具

| 工具 | 平台 | 特点 |
|------|------|------|
| **mitmproxy** | 全平台 | 开源，支持自定义脚本 |
| **Charles** | Win/Mac | 商用，UI友好 |
| **HTTP Toolkit** | 全平台 | 支持USB直连iPhone |
| **Fiddler** | Win | 免费，功能全面 |
| **Burp Suite** | 全平台 | 安全测试标准 |

### 代码示例

#### 3.1 mitmproxy 自定义脚本

```python
# mitmproxy_addon.py
# 运行: mitmproxy -s mitmproxy_addon.py

from mitmproxy import http
import json
import base64

class APICapture:
    """API流量捕获与分析"""
    
    def __init__(self):
        self.captured_apis = []
    
    def request(self, flow: http.HTTPFlow):
        """拦截请求"""
        # 只捕获API请求
        if "/api/" in flow.request.pretty_url or "/v1/" in flow.request.pretty_url:
            capture = {
                "type": "request",
                "url": flow.request.pretty_url,
                "method": flow.request.method,
                "headers": dict(flow.request.headers),
                "params": dict(flow.request.query),
            }
            
            # 捕获请求体
            if flow.request.content:
                try:
                    capture["body"] = json.loads(flow.request.content)
                except:
                    capture["body"] = base64.b64encode(flow.request.content).decode()
            
            self.captured_apis.append(capture)
            print(f"[API Request] {flow.request.method} {flow.request.pretty_url}")
    
    def response(self, flow: http.HTTPFlow):
        """拦截响应"""
        if "/api/" in flow.request.pretty_url:
            capture = {
                "type": "response",
                "url": flow.request.pretty_url,
                "status": flow.response.status_code,
                "headers": dict(flow.response.headers),
            }
            
            # 捕获响应体
            if flow.response.content:
                try:
                    capture["body"] = json.loads(flow.response.content)
                except:
                    capture["body"] = base64.b64encode(flow.response.content).decode()[:1000]
            
            self.captured_apis.append(capture)
            print(f"[API Response] {flow.response.status_code} {flow.request.pretty_url}")
    
    def done(self):
        """保存捕获的数据"""
        with open("captured_apis.json", "w") as f:
            json.dump(self.captured_apis, f, indent=2)

addons = [APICapture()]
```

#### 3.2 SSL Pinning 绕过脚本

```python
# ssl_bypass.js - Frida SSL Pinning绕过
# 运行: frida -U -f com.example.app -l ssl_bypass.js --no-pause

Java.perform(function() {
    console.log("[*] SSL Pinning Bypass Started");
    
    // 1. OkHttp3 SSL Pinning绕过
    try {
        var TrustManagerImpl = Java.use('com.android.org.conscrypt.TrustManagerImpl');
        TrustManagerImpl.checkTrustedRecursive.implementation = function() {
            console.log("[*] OkHttp3 checkTrustedRecursive bypassed");
            return [];
        };
    } catch(e) {
        console.log("[-] OkHttp3 not found");
    }
    
    // 2. X509TrustManager绕过
    try {
        var X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
        var SSLContext = Java.use('javax.net.ssl.SSLContext');
        
        var TrustManager = Java.registerClass({
            name: 'com.example.TrustManager',
            implements: [X509TrustManager],
            methods: {
                checkClientTrusted: function() {},
                checkServerTrusted: function() {},
                getAcceptedIssuers: function() { return []; }
            }
        });
        
        var TrustManagers = [TrustManager.$new()];
        var SSLContext_init = SSLContext.init.overload(
            '[Ljavax.net.ssl.KeyManager;', 
            '[Ljavax.net.ssl.TrustManager;', 
            'java.security.SecureRandom'
        );
        
        SSLContext_init.implementation = function(km, tm, random) {
            console.log("[*] SSLContext.init() hooked");
            SSLContext_init.call(this, km, TrustManagers, random);
        };
    } catch(e) {
        console.log("[-] X509TrustManager hook failed: " + e);
    }
    
    // 3. WebView SSL绕过
    try {
        var WebView = Java.use('android.webkit.WebView');
        var SslErrorHandler = Java.use('android.webkit.SslErrorHandler');
        var WebViewClient = Java.use('android.webkit.WebViewClient');
        
        WebViewClient.onReceivedSslError.implementation = function(view, handler, error) {
            console.log("[*] WebView SSL error bypassed");
            handler.proceed();
        };
    } catch(e) {
        console.log("[-] WebView SSL bypass failed");
    }
    
    console.log("[*] SSL Pinning Bypass Complete");
});
```

#### 3.3 流量分析→参数签名复现

```python
import json
from urllib.parse import parse_qs, urlparse

class TrafficAnalyzer:
    """流量分析器 - 从抓包数据中提取签名逻辑"""
    
    def __init__(self, capture_file: str):
        with open(capture_file, 'r') as f:
            self.captures = json.load(f)
    
    def extract_signature_params(self) -> list:
        """提取包含签名的请求"""
        signature_requests = []
        
        for capture in self.captures:
            if capture.get("type") == "request":
                params = capture.get("params", {})
                body = capture.get("body", {})
                
                # 检查URL参数
                for key, value in params.items():
                    if self._is_signature_param(key, value):
                        signature_requests.append({
                            "url": capture["url"],
                            "param_name": key,
                            "param_value": value,
                            "other_params": {k: v for k, v in params.items() if k != key},
                            "source": "url"
                        })
                
                # 检查Body
                if isinstance(body, dict):
                    for key, value in body.items():
                        if self._is_signature_param(key, value):
                            signature_requests.append({
                                "url": capture["url"],
                                "param_name": key,
                                "param_value": value,
                                "other_params": {k: v for k, v in body.items() if k != key},
                                "source": "body"
                            })
        
        return signature_requests
    
    def _is_signature_param(self, key: str, value) -> bool:
        """判断是否为签名参数"""
        signature_keywords = ['sign', 'signature', '_sign', 'token', 'auth', '_sig', 'hmac']
        
        # 检查参数名
        if any(keyword in key.lower() for keyword in signature_keywords):
            return True
        
        # 检查参数值特征
        if isinstance(value, str):
            # MD5: 32位hex
            if len(value) == 32 and all(c in '0123456789abcdef' for c in value.lower()):
                return True
            # SHA1: 40位hex
            if len(value) == 40 and all(c in '0123456789abcdef' for c in value.lower()):
                return True
            # Base64特征
            if len(value) > 40 and value.endswith('=') or all(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=' for c in value):
                return True
        
        return False
    
    def analyze_signature_pattern(self, signature_requests: list):
        """分析签名模式"""
        if not signature_requests:
            print("[-] 未找到签名参数")
            return
        
        print(f"[+] 找到 {len(signature_requests)} 个签名请求")
        
        for i, req in enumerate(signature_requests[:5]):  # 只分析前5个
            print(f"\n--- 签名请求 {i+1} ---")
            print(f"URL: {req['url']}")
            print(f"参数名: {req['param_name']}")
            print(f"参数值: {req['param_value']}")
            print(f"其他参数: {json.dumps(req['other_params'], indent=2)}")

# 使用示例
# analyzer = TrafficAnalyzer("captured_apis.json")
# sig_requests = analyzer.extract_signature_params()
# analyzer.analyze_signature_pattern(sig_requests)
```

### 实战技巧

1. **证书安装**: 确保手机/模拟器信任mitmproxy/Charles的根证书
2. **Android 7+**: 需要Magisk+Move Certificates模块或修改APK
3. **iOS**: 需要越狱或使用HTTP Toolkit的USB直连功能
4. **SSL Pinning**: 使用Frida或Objection绕过
5. **Protobuf**: 使用blackboxprotobuf解码二进制数据

---

## 模块4: 移动端APP逆向

### 概述
移动端APP逆向是获取APP内部API和加密算法的关键技术。通过Frida Hook、APK反编译、so层逆向，可以提取参数签名、设备指纹生成逻辑。

### 推荐工具

| 工具 | 用途 |
|------|------|
| **Frida** | 动态Hook，运行时修改APP行为 |
| **jadx** | APK反编译，查看Java源码 |
| **apktool** | APK解包/打包，修改资源 |
| **IDA Pro** | so层逆向，分析Native代码 |
| **Ghidra** | 免费逆向工具，替代IDA |
| **Objection** | Frida的易用封装 |
| **Magisk** | Root方案，支持LSPosed |

### 代码示例

#### 4.1 Frida Hook 完整方案

```python
import frida
import sys

# Hook脚本 - hook_sign.js
hook_script = """
Java.perform(function() {
    console.log("[*] Frida Hook Started");
    
    // Hook加密函数示例 - 假设目标使用自定义加密
    var CryptoUtils = Java.use("com.example.app.CryptoUtils");
    
    // Hook sign生成函数
    CryptoUtils.generateSign.implementation = function(params) {
        console.log("[*] generateSign called");
        console.log("    params: " + params);
        
        var result = this.generateSign(params);
        console.log("    result: " + result);
        
        return result;
    };
    
    // Hook MD5函数
    CryptoUtils.md5.implementation = function(input) {
        console.log("[*] MD5 input: " + input);
        var result = this.md5(input);
        console.log("[*] MD5 output: " + result);
        return result;
    };
    
    // Hook设备指纹获取
    var DeviceInfo = Java.use("com.example.app.DeviceInfo");
    DeviceInfo.getFingerprint.implementation = function() {
        var result = this.getFingerprint();
        console.log("[*] Device Fingerprint: " + result);
        return result;
    };
    
    // Hook网络请求
    var OkHttpClient = Java.use("okhttp3.OkHttpClient");
    var Request = Java.use("okhttp3.Request");
    
    OkHttpClient.newCall.implementation = function(request) {
        console.log("[*] HTTP Request:");
        console.log("    URL: " + request.url().toString());
        console.log("    Method: " + request.method());
        
        var headers = request.headers();
        var headersStr = "";
        for (var i = 0; i < headers.size(); i++) {
            headersStr += headers.name(i) + ": " + headers.value(i) + "\\n";
        }
        console.log("    Headers: \\n" + headersStr);
        
        return this.newCall(request);
    };
});
"""

def on_message(message, data):
    if message['type'] == 'send':
        print(f"[*] {message['payload']}")
    else:
        print(f"[-] {message}")

def run_hook(app_package: str):
    """运行Frida Hook"""
    device = frida.get_usb_device()
    
    # 启动APP并附加
    pid = device.spawn([app_package])
    session = device.attach(pid)
    
    script = session.create_script(hook_script)
    script.on('message', on_message)
    script.load()
    
    device.resume(pid)
    
    print(f"[*] Hooking {app_package}, PID: {pid}")
    sys.stdin.read()

# 使用示例
# run_hook("com.example.app")
```

#### 4.2 APK反编译分析

```python
import subprocess
import os

class APKAnalyzer:
    """APK分析工具"""
    
    def __init__(self, apk_path: str, output_dir: str = "./decompiled"):
        self.apk_path = apk_path
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
    
    def decompile_with_jadx(self):
        """使用jadx反编译APK"""
        output_path = os.path.join(self.output_dir, "java_source")
        cmd = f"jadx -d {output_path} {self.apk_path}"
        subprocess.run(cmd, shell=True)
        print(f"[+] 反编译完成: {output_path}")
        return output_path
    
    def decode_with_apktool(self):
        """使用apktool解包APK"""
        output_path = os.path.join(self.output_dir, "smali_resources")
        cmd = f"apktool d -f {self.apk_path} -o {output_path}"
        subprocess.run(cmd, shell=True)
        print(f"[+] 解包完成: {output_path}")
        return output_path
    
    def extract_native_libs(self):
        """提取so库文件"""
        import zipfile
        
        libs_dir = os.path.join(self.output_dir, "native_libs")
        os.makedirs(libs_dir, exist_ok=True)
        
        with zipfile.ZipFile(self.apk_path, 'r') as zip_ref:
            for file in zip_ref.namelist():
                if file.endswith('.so'):
                    zip_ref.extract(file, libs_dir)
                    print(f"[+] 提取: {file}")
        
        return libs_dir
    
    def search_sign_keywords(self, source_dir: str):
        """搜索签名相关关键词"""
        keywords = ['sign', 'signature', 'md5', 'sha1', 'hmac', 'encrypt', 'aes', 'rsa']
        results = []
        
        for root, dirs, files in os.walk(source_dir):
            for file in files:
                if file.endswith('.java'):
                    file_path = os.path.join(root, file)
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        for keyword in keywords:
                            if keyword in content.lower():
                                results.append({
                                    "file": file_path,
                                    "keyword": keyword
                                })
        
        return results

# 使用示例
# analyzer = APKAnalyzer("app.apk")
# analyzer.decompile_with_jadx()
# analyzer.decode_with_apktool()
```

#### 4.3 so层逆向分析

```python
# so层逆向需要IDA Pro或Ghidra
# 这里提供Python辅助分析脚本

import subprocess
import re

class SOAnalyzer:
    """SO库分析工具"""
    
    def __init__(self, so_path: str):
        self.so_path = so_path
    
    def extract_strings(self) -> list:
        """提取字符串"""
        result = subprocess.run(
            ['strings', self.so_path],
            capture_output=True,
            text=True
        )
        
        strings = result.stdout.split('\n')
        
        # 过滤出可能有用的字符串
        interesting_patterns = [
            r'[a-f0-9]{32}',  # MD5
            r'[a-f0-9]{40}',  # SHA1
            r'[a-f0-9]{64}',  # SHA256
            r'-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----',
            r'-----BEGIN (RSA |EC |DSA )?PUBLIC KEY-----',
            r'AES|DES|RSA|HMAC|SHA',
            r'api\.|http|https',
        ]
        
        interesting_strings = []
        for s in strings:
            for pattern in interesting_patterns:
                if re.search(pattern, s, re.IGNORECASE):
                    interesting_strings.append(s)
                    break
        
        return interesting_strings
    
    def list_symbols(self) -> list:
        """列出符号表"""
        result = subprocess.run(
            ['nm', '-D', self.so_path],
            capture_output=True,
            text=True
        )
        
        symbols = []
        for line in result.stdout.split('\n'):
            if ' T ' in line or ' D ' in line:  # 函数或数据
                parts = line.split()
                if len(parts) >= 3:
                    symbols.append({
                        "address": parts[0],
                        "type": parts[1],
                        "name": parts[2]
                    })
        
        return symbols
    
    def find_crypto_functions(self) -> list:
        """查找加密相关函数"""
        symbols = self.list_symbols()
        crypto_keywords = ['encrypt', 'decrypt', 'sign', 'verify', 'hash', 
                          'md5', 'sha', 'aes', 'des', 'rsa', 'hmac']
        
        crypto_funcs = []
        for sym in symbols:
            name = sym['name'].lower()
            if any(kw in name for kw in crypto_keywords):
                crypto_funcs.append(sym)
        
        return crypto_funcs

# 使用示例
# analyzer = SOAnalyzer("libnative.so")
# strings = analyzer.extract_strings()
# crypto_funcs = analyzer.find_crypto_functions()
```

### 实战技巧

1. **Frida Server**: 确保手机端运行frida-server，版本与PC端一致
2. **SELinux**: Android 5.0+需要关闭SELinux或配置权限
3. **反调试绕过**: 使用`frida --no-pause`绕过启动时检测
4. **so加密**: 使用IDA Pro分析ollvm混淆的so文件
5. **VMP保护**: 使用unicorn模拟执行或寻找逻辑漏洞

---

## 模块5: JS逆向

### 概述
JS逆向是破解Web端参数签名和加密算法的核心技术。通过AST反混淆、JSVMP破解、webpack分析，可以还原加密逻辑并在Python中复现。

### 推荐工具

| 工具 | 用途 |
|------|------|
| **@babel/core** | AST解析与转换 |
| **@babel/traverse** | AST遍历 |
| **@babel/types** | AST节点操作 |
| **js-beautify** | JS代码美化 |
| **AST Explorer** | 在线AST分析 |
| **Node.js** | 运行浏览器JS |

### 代码示例

#### 5.1 AST反混淆

```javascript
// deobfuscator.js - AST反混淆脚本
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");
const generate = require("@babel/generator").default;
const fs = require("fs");

function deobfuscate(code) {
    const ast = parser.parse(code, {
        sourceType: "script",
    });

    // 1. 还原十六进制字符串
    traverse(ast, {
        StringLiteral(path) {
            if (path.node.extra?.raw) {
                delete path.node.extra.raw;
            }
        }
    });

    // 2. 还原Unicode字符串
    traverse(ast, {
        StringLiteral(path) {
            if (/\\u[0-9a-fA-F]{4}/.test(path.node.value)) {
                path.node.value = eval('"' + path.node.value + '"');
            }
        }
    });

    // 3. 还原数组混淆
    traverse(ast, {
        MemberExpression(path) {
            if (t.isArrayExpression(path.node.object) &&
                t.isNumericLiteral(path.node.property)) {
                const array = path.node.object.elements;
                const index = path.node.property.value;
                if (index < array.length) {
                    path.replaceWith(array[index]);
                }
            }
        }
    });

    // 4. 还原简单算术表达式
    traverse(ast, {
        BinaryExpression(path) {
            if (t.isNumericLiteral(path.node.left) &&
                t.isNumericLiteral(path.node.right)) {
                const result = eval(generate(path.node).code);
                path.replaceWith(t.numericLiteral(result));
            }
        }
    });

    // 5. 删除死代码
    traverse(ast, {
        IfStatement(path) {
            if (t.isBooleanLiteral(path.node.test)) {
                if (path.node.test.value) {
                    path.replaceWithMultiple(path.node.consequent.body);
                } else if (path.node.alternate) {
                    path.replaceWithMultiple(path.node.alternate.body);
                } else {
                    path.remove();
                }
            }
        }
    });

    const output = generate(ast, {
        compact: false,
        quotes: "double",
        indent: { style: "  " }
    }).code;

    return output;
}

// 使用示例
// const code = fs.readFileSync("obfuscated.js", "utf8");
// const cleanCode = deobfuscate(code);
// fs.writeFileSync("clean.js", cleanCode);
```

#### 5.2 Webpack Chunk分析

```python
import re
import json

class WebpackAnalyzer:
    """Webpack打包文件分析器"""
    
    def __init__(self, js_file: str):
        with open(js_file, 'r', encoding='utf-8') as f:
            self.code = f.read()
    
    def extract_modules(self) -> dict:
        """提取所有模块"""
        # Webpack模块特征: (function(module, exports, __webpack_require__)
        module_pattern = r'\{(\d+):\s*\[function\([^)]+\)\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\},\s*\{[^}]*\}\]\}'
        
        modules = {}
        for match in re.finditer(module_pattern, self.code):
            module_id = match.group(1)
            module_code = match.group(2)
            modules[module_id] = module_code
        
        return modules
    
    def find_crypto_module(self) -> str:
        """查找加密相关模块"""
        modules = self.extract_modules()
        
        crypto_keywords = ['encrypt', 'decrypt', 'sign', 'md5', 'sha', 'aes', 'rsa', 'hmac']
        
        for module_id, code in modules.items():
            code_lower = code.lower()
            if any(kw in code_lower for kw in crypto_keywords):
                print(f"[+] 发现加密模块: {module_id}")
                return code
        
        return None
    
    def extract_entry_point(self) -> str:
        """提取入口点"""
        # Webpack入口特征: ([function(require, module, exports)
        entry_pattern = r'\(([function\(require,\s*module,\s*exports\)[\s\S]+?)\)\s*\(\s*\{'
        
        match = re.search(entry_pattern, self.code)
        if match:
            return match.group(1)
        
        return None

# 使用示例
# analyzer = WebpackAnalyzer("bundle.js")
# crypto_code = analyzer.find_crypto_module()
```

#### 5.3 JSVMP虚拟机破解

```python
# JSVMP破解方法论
# 1. 追踪虚拟机指令流
# 2. Hook加密函数直接调用
# 3. 寻找逻辑漏洞（如密钥硬编码）

import execjs
import json

class JSVMPBreaker:
    """JSVMP破解器"""
    
    def __init__(self, vmp_code: str):
        """
        vmp_code: VMP保护的JS代码
        """
        self.vmp_code = vmp_code
        self.ctx = execjs.compile(vmp_code)
    
    def hook_encrypt_function(self, func_name: str, test_input: str):
        """
        Hook加密函数，提取算法
        
        原理: 通过多次调用，观察输入输出关系
        """
        # 准备Hook代码
        hook_code = f"""
        var originalFunc = {func_name};
        var calls = [];
        
        {func_name} = function(input) {{
            var result = originalFunc(input);
            calls.push({{input: input, output: result}});
            return result;
        }};
        """
        
        self.ctx.exec(hook_code)
        
        # 多次调用收集数据
        test_inputs = [
            test_input,
            "a",
            "abc",
            "test123",
            "hello world"
        ]
        
        for inp in test_inputs:
            try:
                result = self.ctx.call(func_name, inp)
                print(f"Input: {inp}")
                print(f"Output: {result}")
                print(f"Length: {len(result)}")
                print("---")
            except Exception as e:
                print(f"Error with input '{inp}': {e}")
    
    def analyze_output_pattern(self, outputs: list):
        """分析输出模式，推断算法"""
        for output in outputs:
            # MD5: 32位hex
            if len(output) == 32 and all(c in '0123456789abcdef' for c in output.lower()):
                return "MD5"
            
            # SHA1: 40位hex
            if len(output) == 40 and all(c in '0123456789abcdef' for c in output.lower()):
                return "SHA1"
            
            # SHA256: 64位hex
            if len(output) == 64 and all(c in '0123456789abcdef' for c in output.lower()):
                return "SHA256"
            
            # Base64特征
            if len(output) % 4 == 0 and all(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=' for c in output):
                return "Base64"
        
        return "Unknown"

# 使用示例
# breaker = JSVMPBreaker(vmp_js_code)
# breaker.hook_encrypt_function("encrypt", "test")
```

#### 5.4 环境补全（Node.js运行浏览器JS）

```python
import execjs
import json

class BrowserEnvironment:
    """浏览器环境补全"""
    
    def __init__(self):
        self.env_code = """
        // 模拟window对象
        var window = {
            location: {
                href: "https://example.com",
                hostname: "example.com",
                protocol: "https:",
                pathname: "/"
            },
            navigator: {
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
                language: "zh-CN",
                languages: ["zh-CN", "zh", "en"],
                platform: "Win32",
                vendor: "Google Inc.",
                webdriver: undefined
            },
            screen: {
                width: 1920,
                height: 1080,
                colorDepth: 24
            },
            document: {
                cookie: "",
                referrer: ""
            },
            localStorage: {
                data: {},
                getItem: function(key) { return this.data[key] || null; },
                setItem: function(key, value) { this.data[key] = value; },
                removeItem: function(key) { delete this.data[key]; }
            },
            sessionStorage: {
                data: {},
                getItem: function(key) { return this.data[key] || null; },
                setItem: function(key, value) { this.data[key] = value; },
                removeItem: function(key) { delete this.data[key]; }
            },
            addEventListener: function() {},
            removeEventListener: function() {}
        };
        
        // 模拟document对象
        var document = window.document;
        
        // 模拟navigator对象
        var navigator = window.navigator;
        
        // 模拟location对象
        var location = window.location;
        
        // 模拟localStorage
        var localStorage = window.localStorage;
        
        // 模拟sessionStorage
        var sessionStorage = window.sessionStorage;
        
        // 模拟console
        var console = {
            log: function() {},
            warn: function() {},
            error: function() {},
            info: function() {}
        };
        
        // 模拟XMLHttpRequest
        var XMLHttpRequest = function() {};
        
        // 模拟fetch
        var fetch = function() { return Promise.resolve(); };
        
        // 模拟setTimeout/setInterval
        var setTimeout = function(fn, delay) { return 0; };
        var clearTimeout = function(id) {};
        var setInterval = function(fn, delay) { return 0; };
        var clearInterval = function(id) {};
        """
    
    def execute_browser_js(self, js_code: str, func_name: str = None, *args):
        """
        在补全的浏览器环境中执行JS代码
        """
        full_code = self.env_code + "\n" + js_code
        
        ctx = execjs.compile(full_code)
        
        if func_name:
            return ctx.call(func_name, *args)
        else:
            return ctx.eval("this")

# 使用示例
# env = BrowserEnvironment()
# result = env.execute_browser_js(js_code, "generateSign", param1, param2)
```

### 实战技巧

1. **断点调试**: 使用Chrome DevTools的Sources面板设置断点
2. **Call Stack**: 通过调用栈追踪签名生成路径
3. **Pretty Print**: 使用`{}`按钮美化压缩代码
4. **Overrides**: 使用Local Overrides修改并持久化JS代码
5. **XHR/Fetch断点**: 在Sources面板设置XHR断点

---

## 模块6: 协议级采集

### 概述
协议级采集是直接对接WebSocket、gRPC、GraphQL、SSE等协议的高级采集技术。相比HTTP，这些协议通常防护较弱，数据更结构化。

### 推荐工具

| 协议 | 工具 |
|------|------|
| WebSocket | websockets |
| gRPC | grpcio, grpcurl |
| GraphQL | gql, clairvoyance |
| SSE | aiohttp |

### 代码示例

#### 6.1 WebSocket 实时数据流采集

```python
import websockets
import asyncio
import json

class WebSocketScraper:
    """WebSocket实时数据流采集器"""
    
    def __init__(self, uri: str, headers: dict = None):
        self.uri = uri
        self.headers = headers or {}
        self.messages = []
    
    async def connect_and_listen(self, subscribe_msg: dict = None, duration: int = 60):
        """
        连接并监听WebSocket消息
        
        Args:
            subscribe_msg: 订阅消息
            duration: 监听时长(秒)
        """
        async with websockets.connect(
            self.uri,
            extra_headers=self.headers,
            ping_interval=30,
            ping_timeout=10
        ) as websocket:
            print(f"[+] Connected to {self.uri}")
            
            # 发送订阅消息
            if subscribe_msg:
                await websocket.send(json.dumps(subscribe_msg))
                print(f"[+] Sent: {subscribe_msg}")
            
            # 监听消息
            start_time = asyncio.get_event_loop().time()
            
            try:
                while asyncio.get_event_loop().time() - start_time < duration:
                    message = await asyncio.wait_for(
                        websocket.recv(),
                        timeout=5.0
                    )
                    
                    data = json.loads(message)
                    self.messages.append(data)
                    print(f"[+] Received: {data}")
                    
                    # 处理消息...
                    await self.handle_message(data)
                    
            except asyncio.TimeoutError:
                print("[-] Receive timeout")
            except websockets.exceptions.ConnectionClosed:
                print("[-] Connection closed")
    
    async def handle_message(self, data: dict):
        """处理接收到的消息 - 子类可重写"""
        pass
    
    def save_messages(self, filename: str):
        """保存消息到文件"""
        with open(filename, 'w') as f:
            json.dump(self.messages, f, indent=2)
        print(f"[+] Saved {len(self.messages)} messages to {filename}")

# 使用示例 - 加密货币交易数据
async def crypto_scraper():
    scraper = WebSocketScraper(
        uri="wss://stream.crypto.com/v2/market",
        headers={"Origin": "https://crypto.com"}
    )
    
    subscribe_msg = {
        "method": "subscribe",
        "params": {"channels": ["trade.BTC_USDT"]},
        "id": 1
    }
    
    await scraper.connect_and_listen(subscribe_msg, duration=60)
    scraper.save_messages("crypto_trades.json")

# asyncio.run(crypto_scraper())
```

#### 6.2 gRPC Protobuf 逆向与采集

```python
import grpc
import json
from google.protobuf import json_format

class GRPCScraper:
    """gRPC采集器"""
    
    def __init__(self, target: str, use_tls: bool = True):
        """
        Args:
            target: gRPC服务器地址，如 "api.example.com:50051"
            use_tls: 是否使用TLS
        """
        self.target = target
        
        if use_tls:
            self.channel = grpc.secure_channel(target, grpc.ssl_channel_credentials())
        else:
            self.channel = grpc.insecure_channel(target)
    
    def list_services(self):
        """列出所有服务 - 需要反射支持"""
        try:
            from grpc_reflection.v1alpha import reflection_pb2, reflection_pb2_grpc
            
            stub = reflection_pb2_grpc.ServerReflectionStub(self.channel)
            request = reflection_pb2.ServerReflectionRequest(list_services="")
            
            response = stub.ServerReflectionInfo(iter([request]))
            for resp in response:
                if resp.list_services_response:
                    services = resp.list_services_response.service
                    return [s.name for s in services]
        except Exception as e:
            print(f"[-] Reflection not available: {e}")
            return []
    
    def describe_service(self, service_name: str):
        """描述服务"""
        # 使用grpcurl获取服务描述
        import subprocess
        
        result = subprocess.run(
            ['grpcurl', '-plaintext', self.target, 'describe', service_name],
            capture_output=True,
            text=True
        )
        
        return result.stdout

# 使用grpcurl进行逆向
# grpcurl -plaintext api.example.com:50051 list
# grpcurl -plaintext api.example.com:50051 describe .UserService
# grpcurl -plaintext -d '{"id": 123}' api.example.com:50051 UserService/GetUser
```

#### 6.3 GraphQL Introspection + Clairvoyance

```python
import requests
import json

class GraphQLScraper:
    """GraphQL采集器"""
    
    def __init__(self, endpoint: str, headers: dict = None):
        self.endpoint = endpoint
        self.headers = headers or {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    def introspect(self) -> dict:
        """
        执行Introspection查询获取Schema
        注意: 部分站点会禁用introspection
        """
        introspection_query = """
        query IntrospectionQuery {
          __schema {
            queryType { name }
            mutationType { name }
            subscriptionType { name }
            types {
              ...FullType
            }
            directives {
              name
              description
              locations
              args {
                ...InputValue
              }
            }
          }
        }
        fragment FullType on __Type {
          kind
          name
          description
          fields(includeDeprecated: true) {
            name
            description
            args {
              ...InputValue
            }
            type {
              ...TypeRef
            }
            isDeprecated
            deprecationReason
          }
          inputFields {
            ...InputValue
          }
          interfaces {
            ...TypeRef
          }
          enumValues(includeDeprecated: true) {
            name
            description
            isDeprecated
            deprecationReason
          }
          possibleTypes {
            ...TypeRef
          }
        }
        fragment InputValue on __InputValue {
          name
          description
          type { ...TypeRef }
          defaultValue
        }
        fragment TypeRef on __Type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
        """
        
        response = requests.post(
            self.endpoint,
            headers=self.headers,
            json={"query": introspection_query}
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            print(f"[-] Introspection failed: {response.status_code}")
            return None
    
    def execute_query(self, query: str, variables: dict = None) -> dict:
        """执行GraphQL查询"""
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
        
        response = requests.post(
            self.endpoint,
            headers=self.headers,
            json=payload
        )
        
        return response.json()
    
    def clairvoyance_recon(self):
        """
        使用Clairvoyance进行Schema发现
        当introspection被禁用时使用
        """
        # pip install clairvoyance
        # python -m clairvoyance "https://api.example.com/graphql" -o schema.json
        import subprocess
        
        result = subprocess.run(
            ['python', '-m', 'clairvoyance', self.endpoint, '-o', 'schema.json'],
            capture_output=True,
            text=True
        )
        
        print(result.stdout)
        print(result.stderr)

# 使用示例
# scraper = GraphQLScraper("https://api.example.com/graphql")
# schema = scraper.introspect()
# result = scraper.execute_query("{ users { id name email } }")
```

#### 6.4 SSE（Server-Sent Events）流式采集

```python
import aiohttp
import asyncio
import json

class SSEScraper:
    """SSE流式数据采集器"""
    
    def __init__(self, url: str, headers: dict = None):
        self.url = url
        self.headers = headers or {
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache"
        }
        self.events = []
    
    async def listen(self, duration: int = 60):
        """
        监听SSE事件流
        
        Args:
            duration: 监听时长(秒)
        """
        async with aiohttp.ClientSession() as session:
            async with session.get(self.url, headers=self.headers) as response:
                print(f"[+] Connected to SSE stream: {response.status}")
                
                start_time = asyncio.get_event_loop().time()
                current_event = {}
                
                async for line in response.content:
                    if asyncio.get_event_loop().time() - start_time > duration:
                        break
                    
                    line = line.decode('utf-8').strip()
                    
                    if line.startswith('event:'):
                        current_event['event'] = line[6:].strip()
                    elif line.startswith('data:'):
                        data = line[5:].strip()
                        if 'data' in current_event:
                            current_event['data'] += '\n' + data
                        else:
                            current_event['data'] = data
                    elif line.startswith('id:'):
                        current_event['id'] = line[3:].strip()
                    elif line.startswith('retry:'):
                        current_event['retry'] = int(line[6:].strip())
                    elif line == '':
                        # 空行表示事件结束
                        if current_event:
                            self.events.append(current_event)
                            print(f"[+] Event: {current_event.get('event', 'message')}")
                            
                            # 尝试解析JSON数据
                            try:
                                data = json.loads(current_event.get('data', '{}'))
                                await self.handle_event(data)
                            except json.JSONDecodeError:
                                pass
                            
                            current_event = {}
    
    async def handle_event(self, data: dict):
        """处理事件数据 - 子类可重写"""
        print(f"    Data: {data}")
    
    def save_events(self, filename: str):
        """保存事件到文件"""
        with open(filename, 'w') as f:
            json.dump(self.events, f, indent=2)
        print(f"[+] Saved {len(self.events)} events to {filename}")

# 使用示例
async def sse_example():
    scraper = SSEScraper("https://stream.example.com/events")
    await scraper.listen(duration=60)
    scraper.save_events("sse_events.json")

# asyncio.run(sse_example())
```

### 实战技巧

1. **WebSocket鉴权**: 注意在URL或headers中传递token
2. **gRPC反射**: 使用`grpcurl list`查看可用服务
3. **GraphQL深度限制**: 避免过深嵌套查询触发限流
4. **SSE重连**: 实现指数退避重连机制
5. **协议升级**: 关注HTTP/3对WebSocket的影响

---

## 模块7: AI驱动采集

### 概述
AI驱动采集是2025-2026年最前沿的技术方向。通过LLM直接理解页面内容，无需编写XPath/CSS选择器，自适应页面变化。

### 推荐工具

| 工具 | Stars | 核心能力 |
|------|-------|---------|
| **Crawl4AI** | 63.5k | LLM原生提取，结构化数据 |
| **ScrapeGraphAI** | 15k+ | GPT-4V视觉理解 |
| **AgentQL** | 5k+ | 自然语言查询 |
| **Browser-Use** | 25k+ | AI控制浏览器 |
| **Skyvern** | 20.8k | 视觉AI页面理解 |

### 代码示例

#### 7.1 Crawl4AI 完整方案

```python
# Crawl4AI - 63.5k stars，开源最强AI爬虫
# 安装: pip install crawl4ai

from crawl4ai import AsyncWebCrawler
from crawl4ai.extraction_strategy import LLMExtractionStrategy
from crawl4ai.crawler_strategy import LocalSeleniumCrawlerStrategy
import asyncio
import json

class Crawl4AIExtractor:
    """Crawl4AI数据提取器"""
    
    def __init__(self, llm_config: dict = None):
        """
        Args:
            llm_config: LLM配置，如 {"provider": "openai", "api_key": "xxx"}
        """
        self.llm_config = llm_config or {
            "provider": "openai",
            "api_key": "YOUR_API_KEY",
            "model": "gpt-4-vision-preview"
        }
    
    async def extract_with_llm(self, url: str, schema: dict, instruction: str = None):
        """
        使用LLM提取结构化数据
        
        Args:
            url: 目标URL
            schema: 数据结构定义
            instruction: 额外提取指令
        """
        async with AsyncWebCrawler(
            verbose=True,
            bypass_cloudflare=True
        ) as crawler:
            
            extraction_strategy = LLMExtractionStrategy(
                provider=self.llm_config["provider"],
                api_token=self.llm_config["api_key"],
                schema=schema,
                instruction=instruction or "Extract the data according to the schema",
                extraction_type="schema"
            )
            
            result = await crawler.arun(
                url=url,
                extraction_strategy=extraction_strategy,
                bypass_cloudflare=True,
                magic=True,  # 自动处理动态内容
                wait_for_images=True
            )
            
            return {
                "success": result.success,
                "content": result.extracted_content,
                "markdown": result.markdown,
                "links": result.links
            }
    
    async def extract_products(self, url: str):
        """提取产品信息示例"""
        schema = {
            "products": [{
                "name": "str",
                "price": "float",
                "currency": "str",
                "description": "str",
                "image_url": "str",
                "in_stock": "boolean"
            }]
        }
        
        instruction = """
        Extract all product information from the page.
        For price, extract only the numeric value.
        For in_stock, return true if the product is available.
        """
        
        return await self.extract_with_llm(url, schema, instruction)
    
    async def extract_articles(self, url: str):
        """提取文章信息示例"""
        schema = {
            "articles": [{
                "title": "str",
                "author": "str",
                "publish_date": "str",
                "content": "str",
                "tags": ["str"]
            }]
        }
        
        return await self.extract_with_llm(url, schema)

# 使用示例
async def crawl4ai_demo():
    extractor = Crawl4AIExtractor({
        "provider": "openai",
        "api_key": "YOUR_API_KEY"
    })
    
    result = await extractor.extract_products("https://example.com/products")
    print(json.dumps(result, indent=2, ensure_ascii=False))

# asyncio.run(crawl4ai_demo())
```

#### 7.2 ScrapeGraphAI 视觉理解

```python
# ScrapeGraphAI - GPT-4V视觉驱动
# 安装: pip install scrapegraphai

from scrapegraphai.graphs import SmartScraperGraph, SearchGraph
import os

class ScrapeGraphAIExtractor:
    """ScrapeGraphAI数据提取器"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.graph_config = {
            "llm": {
                "api_key": self.api_key,
                "model": "openai/gpt-4-vision-preview",
            },
            "verbose": True,
            "headless": True,
        }
    
    def extract(self, prompt: str, url: str):
        """
        使用自然语言提示提取数据
        
        Args:
            prompt: 自然语言描述要提取的数据
            url: 目标URL
        """
        smart_scraper = SmartScraperGraph(
            prompt=prompt,
            source=url,
            config=self.graph_config
        )
        
        result = smart_scraper.run()
        return result
    
    def search_and_extract(self, prompt: str, search_query: str):
        """
        搜索并提取数据
        
        Args:
            prompt: 提取指令
            search_query: 搜索查询
        """
        search_graph = SearchGraph(
            prompt=prompt,
            config=self.graph_config
        )
        
        result = search_graph.run(search_query)
        return result

# 使用示例
# extractor = ScrapeGraphAIExtractor()
# result = extractor.extract(
#     prompt="提取所有产品名称、价格和描述",
#     url="https://example.com/products"
# )
```

#### 7.3 AgentQL 自然语言查询

```python
# AgentQL - 自然语言查询网页
# 安装: pip install agentql

import agentql

class AgentQLExtractor:
    """AgentQL自然语言查询提取器"""
    
    def __init__(self):
        pass
    
    def query_page(self, url: str, query: str):
        """
        使用自然语言查询页面
        
        Args:
            url: 目标URL
            query: AgentQL查询语句
        """
        # 启动浏览器
        with agentql.wrap() as page:
            page.goto(url)
            
            # 执行查询
            response = page.query(query)
            
            return response
    
    def extract_products(self, url: str):
        """提取产品信息"""
        query = """
        {
            products[] {
                name
                price (as float)
                description
                in_stock (as boolean)
                image_url
            }
        }
        """
        return self.query_page(url, query)
    
    def extract_search_results(self, url: str):
        """提取搜索结果"""
        query = """
        {
            results[] {
                title
                url
                snippet
            }
        }
        """
        return self.query_page(url, query)

# 使用示例
# extractor = AgentQLExtractor()
# products = extractor.extract_products("https://example.com/products")
```

#### 7.4 Browser-Use AI浏览器控制

```python
# Browser-Use - AI控制浏览器
# 安装: pip install browser-use

from browser_use import Agent
from langchain_openai import ChatOpenAI
import asyncio

class BrowserUseAgent:
    """Browser-Use AI浏览器代理"""
    
    def __init__(self, api_key: str = None):
        self.llm = ChatOpenAI(
            model="gpt-4o",
            api_key=api_key
        )
    
    async def execute_task(self, task: str, url: str = None):
        """
        执行自然语言描述的任务
        
        Args:
            task: 任务描述
            url: 起始URL（可选）
        """
        agent = Agent(
            task=task,
            llm=self.llm,
            use_vision=True  # 启用视觉理解
        )
        
        result = await agent.run()
        return result
    
    async def login_and_extract(self, login_url: str, username: str, password: str, target_data: str):
        """登录并提取数据"""
        task = f"""
        1. 访问 {login_url}
        2. 在用户名输入框输入: {username}
        3. 在密码输入框输入: {password}
        4. 点击登录按钮
        5. 等待页面加载完成
        6. 提取以下数据: {target_data}
        """
        
        return await self.execute_task(task)
    
    async def search_and_scrape(self, search_url: str, query: str, num_results: int = 10):
        """搜索并采集结果"""
        task = f"""
        1. 访问 {search_url}
        2. 在搜索框输入: {query}
        3. 点击搜索按钮
        4. 提取前{num_results}个搜索结果
        5. 返回每个结果的标题、链接和描述
        """
        
        return await self.execute_task(task)

# 使用示例
async def browser_use_demo():
    agent = BrowserUseAgent(api_key="YOUR_API_KEY")
    
    result = await agent.search_and_scrape(
        search_url="https://google.com",
        query="python web scraping",
        num_results=5
    )
    print(result)

# asyncio.run(browser_use_demo())
```

#### 7.5 Skyvern 视觉AI页面理解

```python
# Skyvern - 视觉AI页面理解
# 安装: pip install skyvern

from skyvern.agent import SkyvernAgent
import asyncio

class SkyvernExtractor:
    """Skyvern视觉AI提取器"""
    
    def __init__(self, api_key: str = None):
        self.agent = SkyvernAgent(api_key=api_key)
    
    async def navigate_and_extract(self, url: str, goal: str):
        """
        导航并提取数据
        
        Args:
            url: 目标URL
            goal: 目标描述
        """
        result = await self.agent.run_task(
            url=url,
            goal=goal
        )
        
        return result
    
    async def fill_form(self, url: str, form_data: dict):
        """自动填写表单"""
        goal = f"填写表单: {json.dumps(form_data)}"
        return await self.navigate_and_extract(url, goal)
    
    async def extract_table(self, url: str, table_description: str):
        """提取表格数据"""
        goal = f"找到并提取以下表格: {table_description}"
        return await self.navigate_and_extract(url, goal)

# 使用示例
async def skyvern_demo():
    extractor = SkyvernExtractor(api_key="YOUR_API_KEY")
    
    result = await extractor.navigate_and_extract(
        url="https://example.com/data",
        goal="提取页面上的所有产品信息表格"
    )
    print(result)

# asyncio.run(skyvern_demo())
```

#### 7.6 LLM直接解析HTML

```python
from openai import AsyncOpenAI
import asyncio

class LLMDirectExtractor:
    """LLM直接解析HTML"""
    
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key)
    
    async def extract_structured_data(self, html: str, schema: dict, instruction: str = None):
        """
        使用LLM从HTML中提取结构化数据
        
        Args:
            html: HTML内容
            schema: 期望的数据结构
            instruction: 额外指令
        """
        # 截断HTML避免超出token限制
        truncated_html = html[:8000] if len(html) > 8000 else html
        
        system_prompt = """You are a web scraping expert. Extract structured data from the provided HTML according to the given schema. Return only valid JSON."""
        
        user_prompt = f"""
Instruction: {instruction or 'Extract data according to the schema'}

Schema: {json.dumps(schema, indent=2)}

HTML:
{truncated_html}

Extract the data and return as JSON:
"""
        
        response = await self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            response_format={"type": "json_object"}
        )
        
        result = response.choices[0].message.content
        return json.loads(result)

# 使用示例
async def llm_extract_demo():
    extractor = LLMDirectExtractor(api_key="YOUR_API_KEY")
    
    html = "<html>...</html>"  # 页面HTML
    schema = {
        "products": [{
            "name": "string",
            "price": "number"
        }]
    }
    
    result = await extractor.extract_structured_data(html, schema)
    print(result)

# asyncio.run(llm_extract_demo())
```

### 实战技巧

1. **Token优化**: 截断HTML到8k-16k tokens，保留关键内容
2. **Schema设计**: 使用明确的字段名和类型，提高提取准确率
3. **多轮提取**: 复杂页面分多次提取不同区域
4. **结果验证**: 使用Pydantic验证提取结果
5. **成本优化**: 先用传统方法，失败时再用AI方法

---

## 模块8: 公开数据源

### 概述
公开数据源是最合规、最稳定的采集方式。优先使用RSS、Open API、政府开放数据等官方渠道。

### 推荐工具

| 类型 | 工具/平台 |
|------|----------|
| RSS/Atom | feedparser |
| Open API | requests + 官方SDK |
| 政府数据 | data.gov.cn, data.gov |
| 学术数据 | CrossRef, arXiv API |

### 代码示例

#### 8.1 RSS/Atom Feed 采集

```python
import feedparser
import requests
from datetime import datetime

class RSSScraper:
    """RSS Feed采集器"""
    
    def __init__(self):
        self.feeds = []
    
    def parse_feed(self, url: str):
        """解析RSS Feed"""
        feed = feedparser.parse(url)
        
        result = {
            "title": feed.feed.get("title", ""),
            "link": feed.feed.get("link", ""),
            "description": feed.feed.get("description", ""),
            "updated": feed.feed.get("updated", ""),
            "entries": []
        }
        
        for entry in feed.entries:
            result["entries"].append({
                "title": entry.get("title", ""),
                "link": entry.get("link", ""),
                "published": entry.get("published", ""),
                "summary": entry.get("summary", ""),
                "content": entry.get("content", [{}])[0].get("value", "") if entry.get("content") else ""
            })
        
        return result
    
    def monitor_feeds(self, urls: list, callback):
        """监控多个Feed"""
        for url in urls:
            try:
                feed = self.parse_feed(url)
                callback(feed)
            except Exception as e:
                print(f"[-] Error parsing {url}: {e}")

# 使用示例
# scraper = RSSScraper()
# feed = scraper.parse_feed("https://example.com/feed.xml")
```

#### 8.2 Open API 对接

```python
import requests
from typing import Dict, Any

class OpenAPIClient:
    """Open API客户端"""
    
    def __init__(self, base_url: str, api_key: str = None):
        self.base_url = base_url
        self.api_key = api_key
        self.session = requests.Session()
        
        if api_key:
            self.session.headers["Authorization"] = f"Bearer {api_key}"
    
    def get(self, endpoint: str, params: Dict = None) -> Dict:
        """GET请求"""
        url = f"{self.base_url}{endpoint}"
        response = self.session.get(url, params=params)
        response.raise_for_status()
        return response.json()
    
    def post(self, endpoint: str, data: Dict = None) -> Dict:
        """POST请求"""
        url = f"{self.base_url}{endpoint}"
        response = self.session.post(url, json=data)
        response.raise_for_status()
        return response.json()

# 使用示例 - GitHub API
# client = OpenAPIClient("https://api.github.com", api_key="YOUR_TOKEN")
# repos = client.get("/users/octocat/repos")
```

#### 8.3 政府开放数据平台

```python
import requests

class GovernmentDataClient:
    """政府开放数据客户端"""
    
    def __init__(self):
        self.endpoints = {
            "china": "https://data.gov.cn/api",
            "usa": "https://api.data.gov",
            "eu": "https://data.europa.eu/api"
        }
    
    def query_china_data(self, dataset_id: str, params: dict = None):
        """查询中国政府开放数据"""
        # 具体API需参考data.gov.cn文档
        url = f"{self.endpoints['china']}/datasets/{dataset_id}"
        response = requests.get(url, params=params)
        return response.json()
    
    def query_usa_data(self, api_key: str, dataset: str, params: dict = None):
        """查询美国政府数据"""
        url = f"{self.endpoints['usa']}/{dataset}"
        params = params or {}
        params["api_key"] = api_key
        response = requests.get(url, params=params)
        return response.json()

# 使用示例
# client = GovernmentDataClient()
# data = client.query_china_data("dataset_id")
```

### 实战技巧

1. **API限流**: 遵守Rate Limit，使用指数退避
2. **数据更新**: 使用ETag或Last-Modified检测更新
3. **增量采集**: 只采集新增数据，避免重复
4. **数据验证**: 验证数据格式和完整性
5. **合规使用**: 遵守数据使用协议和许可

---

## 模块9: 搜索引擎采集

### 概述
搜索引擎采集是发现目标网站和数据入口的重要手段。通过Google Dorking、搜索引擎API，可以快速定位特定类型的内容。

### 推荐工具

| 工具 | 用途 |
|------|------|
| **Google Dorking** | 高级搜索技巧 |
| **SerpAPI** | Google搜索结果API |
| **ScraperAPI** | 通用搜索引擎API |
| **Bing API** | 官方API |

### 代码示例

#### 9.1 Google Dorking 高级搜索

```python
class GoogleDorking:
    """Google Dorking高级搜索"""
    
    DORKS = {
        "site": "site:{domain}",  # 限定站点
        "inurl": "inurl:{keyword}",  # URL包含
        "intitle": "intitle:{keyword}",  # 标题包含
        "intext": "intext:{keyword}",  # 正文包含
        "filetype": "filetype:{ext}",  # 文件类型
        "ext": "ext:{ext}",  # 扩展名
        "cache": "cache:{url}",  # 缓存页面
        "related": "related:{domain}",  # 相关站点
        "link": "link:{url}",  # 外链
        "define": "define:{word}",  # 定义
        "stocks": "stocks:{symbol}",  # 股票
        "book": "book:{title}",  # 图书
        "maps": "maps:{location}",  # 地图
        "movie": "movie:{title}",  # 电影
        "weather": "weather:{location}",  # 天气
    }
    
    @staticmethod
    def build_dork(**kwargs) -> str:
        """构建Dork查询"""
        parts = []
        
        for key, value in kwargs.items():
            if key in GoogleDorking.DORKS:
                parts.append(GoogleDorking.DORKS[key].format(**{key: value}))
        
        return " ".join(parts)
    
    @staticmethod
    def find_exposed_files(domain: str, extensions: list = None):
        """查找暴露的敏感文件"""
        if extensions is None:
            extensions = ["pdf", "doc", "docx", "xls", "xlsx", "sql", "env", "config"]
        
        dorks = []
        for ext in extensions:
            dorks.append(f"site:{domain} filetype:{ext}")
        
        return dorks
    
    @staticmethod
    def find_login_pages(domain: str):
        """查找登录页面"""
        keywords = ["login", "admin", "signin", "wp-login", "administrator"]
        dorks = []
        
        for kw in keywords:
            dorks.append(f"site:{domain} inurl:{kw}")
        
        return dorks
    
    @staticmethod
    def find_api_endpoints(domain: str):
        """查找API端点"""
        patterns = ["/api/", "/v1/", "/v2/", "/graphql", "/rest/"]
        dorks = []
        
        for pattern in patterns:
            dorks.append(f"site:{domain} inurl:{pattern}")
        
        return dorks

# 使用示例
# dork = GoogleDorking.build_dork(site="example.com", filetype="pdf")
# print(dork)  # site:example.com filetype:pdf
```

#### 9.2 SerpAPI Google搜索

```python
from serpapi import GoogleSearch

class SerpAPIScraper:
    """SerpAPI Google搜索采集"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
    
    def search(self, query: str, num_results: int = 10, **kwargs):
        """
        执行Google搜索
        
        Args:
            query: 搜索查询
            num_results: 结果数量
            **kwargs: 额外参数
        """
        params = {
            "q": query,
            "num": num_results,
            "api_key": self.api_key,
            "engine": "google",
            **kwargs
        }
        
        search = GoogleSearch(params)
        results = search.get_dict()
        
        return results
    
    def get_organic_results(self, query: str, num_results: int = 10):
        """获取自然搜索结果"""
        results = self.search(query, num_results)
        
        organic = []
        for result in results.get("organic_results", []):
            organic.append({
                "title": result.get("title"),
                "link": result.get("link"),
                "snippet": result.get("snippet"),
                "position": result.get("position")
            })
        
        return organic
    
    def get_news_results(self, query: str, num_results: int = 10):
        """获取新闻结果"""
        results = self.search(query, num_results, tbm="nws")
        
        news = []
        for result in results.get("news_results", []):
            news.append({
                "title": result.get("title"),
                "link": result.get("link"),
                "source": result.get("source"),
                "date": result.get("date"),
                "snippet": result.get("snippet")
            })
        
        return news

# 使用示例
# scraper = SerpAPIScraper(api_key="YOUR_API_KEY")
# results = scraper.get_organic_results("python web scraping")
```

#### 9.3 Bing API 官方接口

```python
import requests

class BingAPIScraper:
    """Bing API搜索采集"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.endpoint = "https://api.bing.microsoft.com/v7.0/search"
        self.headers = {"Ocp-Apim-Subscription-Key": api_key}
    
    def search(self, query: str, count: int = 10, offset: int = 0):
        """
        执行Bing搜索
        
        Args:
            query: 搜索查询
            count: 结果数量(最大50)
            offset: 偏移量
        """
        params = {
            "q": query,
            "count": min(count, 50),
            "offset": offset,
            "textDecorations": False,
            "textFormat": "HTML"
        }
        
        response = requests.get(
            self.endpoint,
            headers=self.headers,
            params=params
        )
        response.raise_for_status()
        
        return response.json()
    
    def get_web_pages(self, query: str, count: int = 50):
        """获取网页结果"""
        results = self.search(query, count)
        
        pages = []
        for web_page in results.get("webPages", {}).get("value", []):
            pages.append({
                "name": web_page.get("name"),
                "url": web_page.get("url"),
                "snippet": web_page.get("snippet"),
                "dateLastCrawled": web_page.get("dateLastCrawled")
            })
        
        return pages

# 使用示例
# scraper = BingAPIScraper(api_key="YOUR_API_KEY")
# results = scraper.get_web_pages("python tutorial")
```

### 实战技巧

1. **Dork组合**: 多个dork条件组合使用，精确定位
2. **结果去重**: 搜索引擎结果可能有重复，需要去重
3. **分页采集**: 使用offset或start参数获取更多结果
4. **限流控制**: 搜索引擎API有严格限流，注意控制频率
5. **缓存结果**: 避免重复搜索相同查询

---

## 模块10: 社交媒体采集

### 概述
社交媒体采集是获取用户生成内容的重要渠道。各平台有不同的防护机制，需要针对性方案。

### 推荐工具

| 平台 | 工具/方案 |
|------|----------|
| 微博 | Cookie登录+API |
| 小红书 | x-s签名逆向 |
| 抖音 | _signature+X-Bogus |
| Twitter/X | API v2 |
| Facebook | Graph API |
| Instagram | GraphQL API |

### 代码示例

#### 10.1 微博采集

```python
import requests
import json
import re

class WeiboScraper:
    """微博采集器"""
    
    def __init__(self, cookies: str = None):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
            "Referer": "https://weibo.com/"
        })
        
        if cookies:
            self.session.headers["Cookie"] = cookies
    
    def get_user_weibo(self, uid: str, page: int = 1):
        """获取用户微博"""
        url = "https://weibo.com/ajax/statuses/mymblog"
        params = {
            "uid": uid,
            "page": page,
            "feature": 0
        }
        
        response = self.session.get(url, params=params)
        data = response.json()
        
        weibos = []
        for item in data.get("data", {}).get("list", []):
            weibos.append({
                "id": item.get("id"),
                "text": item.get("text_raw", ""),
                "created_at": item.get("created_at"),
                "reposts_count": item.get("reposts_count"),
                "comments_count": item.get("comments_count"),
                "attitudes_count": item.get("attitudes_count")
            })
        
        return weibos
    
    def search_weibo(self, keyword: str, page: int = 1):
        """搜索微博"""
        url = "https://weibo.com/ajax/side/search"
        params = {
            "q": keyword,
            "page": page
        }
        
        response = self.session.get(url, params=params)
        return response.json()

# 使用示例
# scraper = WeiboScraper(cookies="YOUR_COOKIES")
# weibos = scraper.get_user_weibo("1234567890")
```

#### 10.2 小红书 x-s签名破解

```python
import requests
import hashlib
import time
import json

class XiaohongshuScraper:
    """小红书采集器 - x-s签名破解"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "X-Sign": "",  # 需要计算
            "X-Timestamp": "",
            "X-S": ""
        })
    
    def generate_xs_sign(self, api: str, params: dict = None) -> dict:
        """
        生成x-s签名
        注意: 这是简化示例，实际算法需要逆向JS获取
        """
        timestamp = str(int(time.time() * 1000))
        
        # 构建签名字符串（实际算法需逆向）
        sign_str = f"{api}{timestamp}"
        if params:
            sign_str += json.dumps(params, separators=(',', ':'), sort_keys=True)
        
        # 实际算法可能更复杂，这里只是示例
        x_s = hashlib.md5(sign_str.encode()).hexdigest()
        
        return {
            "X-Timestamp": timestamp,
            "X-S": x_s,
            "X-Sign": x_s  # 某些版本使用X-Sign
        }
    
    def get_user_notes(self, user_id: str, page: int = 1):
        """获取用户笔记"""
        api = "/api/sns/web/v1/user_posted"
        params = {
            "user_id": user_id,
            "page": page,
            "page_size": 20
        }
        
        # 生成签名
        headers = self.generate_xs_sign(api, params)
        self.session.headers.update(headers)
        
        url = f"https://www.xiaohongshu.com{api}"
        response = self.session.get(url, params=params)
        
        return response.json()

# 使用示例
# scraper = XiaohongshuScraper()
# notes = scraper.get_user_notes("user_id")
```

#### 10.3 抖音 _signature+X-Bogus

```python
import requests
import hashlib
import time

class DouyinScraper:
    """抖音采集器 - _signature+X-Bogus破解"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.douyin.com/"
        })
    
    def generate_xbogus(self, url_params: str, user_agent: str) -> str:
        """
        生成X-Bogus参数
        注意: 这是简化示例，实际算法需要逆向JS获取
        """
        # 实际算法涉及复杂的位运算和字符编码
        # 这里只是占位示例
        timestamp = int(time.time())
        md5_input = f"{url_params}{user_agent}{timestamp}"
        
        # 实际算法更复杂
        xbogus = hashlib.md5(md5_input.encode()).hexdigest()[:21]
        
        return xbogus
    
    def get_user_videos(self, sec_user_id: str, cursor: int = 0):
        """获取用户视频列表"""
        base_url = "https://www.douyin.com/aweme/v1/web/aweme/post/"
        params = {
            "sec_user_id": sec_user_id,
            "count": 10,
            "cursor": cursor
        }
        
        # 生成X-Bogus
        params_str = "&".join([f"{k}={v}" for k, v in params.items()])
        xbogus = self.generate_xbogus(params_str, self.session.headers["User-Agent"])
        params["X-Bogus"] = xbogus
        
        response = self.session.get(base_url, params=params)
        return response.json()

# 使用示例
# scraper = DouyinScraper()
# videos = scraper.get_user_videos("sec_user_id")
```

#### 10.4 Twitter/X API v2

```python
import tweepy

class TwitterScraper:
    """Twitter API v2采集器"""
    
    def __init__(self, bearer_token: str):
        self.client = tweepy.Client(bearer_token=bearer_token)
    
    def get_user_tweets(self, username: str, max_results: int = 10):
        """获取用户推文"""
        user = self.client.get_user(username=username)
        user_id = user.data.id
        
        tweets = self.client.get_users_tweets(
            id=user_id,
            max_results=max_results,
            tweet_fields=["created_at", "public_metrics", "context_annotations"]
        )
        
        result = []
        for tweet in tweets.data or []:
            result.append({
                "id": tweet.id,
                "text": tweet.text,
                "created_at": tweet.created_at,
                "metrics": tweet.public_metrics
            })
        
        return result
    
    def search_tweets(self, query: str, max_results: int = 10):
        """搜索推文"""
        tweets = self.client.search_recent_tweets(
            query=query,
            max_results=max_results,
            tweet_fields=["created_at", "public_metrics"]
        )
        
        return tweets.data

# 使用示例
# scraper = TwitterScraper(bearer_token="YOUR_TOKEN")
# tweets = scraper.get_user_tweets("twitter")
```

### 实战技巧

1. **Cookie维护**: 定期更新Cookie，避免过期
2. **设备指纹**: 社交媒体对设备指纹检测严格，需轮换
3. **行为模拟**: 模拟真实用户浏览行为，避免被识别为机器人
4. **代理选择**: 使用住宅代理或ISP代理
5. **频率控制**: 严格控制请求频率，避免触发风控

---

## 模块11: 深网/暗网采集

### 概述
深网/暗网采集用于获取Tor网络、.onion站点的数据。需要特殊网络配置和匿名措施。

### 推荐工具

| 工具 | 用途 |
|------|------|
| **Tor Browser** | 访问.onion站点 |
| **Socks5代理** | 通过Tor网络转发 |
| **I2P** | I2P网络访问 |

### 代码示例

#### 11.1 Tor网络配置

```python
import requests
import socks
import socket

class TorScraper:
    """Tor网络采集器"""
    
    def __init__(self, proxy_port: int = 9050):
        """
        Args:
            proxy_port: Tor SOCKS5代理端口，默认9050
        """
        self.proxy_port = proxy_port
        self.session = requests.Session()
        
        # 设置SOCKS5代理
        socks.set_default_proxy(socks.SOCKS5, "127.0.0.1", proxy_port)
        socket.socket = socks.socksocket
        
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
        })
    
    def get(self, url: str, **kwargs):
        """通过Tor网络发送GET请求"""
        return self.session.get(url, **kwargs)
    
    def check_tor_connection(self):
        """检查Tor连接状态"""
        try:
            response = self.session.get("https://check.torproject.org")
            return "Congratulations" in response.text
        except Exception as e:
            print(f"[-] Tor connection failed: {e}")
            return False
    
    def renew_tor_identity(self, control_port: int = 9051, password: str = None):
        """更换Tor出口节点"""
        from stem import Signal
        from stem.control import Controller
        
        try:
            with Controller.from_port(port=control_port) as controller:
                if password:
                    controller.authenticate(password=password)
                else:
                    controller.authenticate()
                
                controller.signal(Signal.NEWNYM)
                print("[+] Tor identity renewed")
                return True
        except Exception as e:
            print(f"[-] Failed to renew identity: {e}")
            return False

# 使用示例
# scraper = TorScraper()
# if scraper.check_tor_connection():
#     response = scraper.get("https://check.torproject.org")
```

#### 11.2 .onion站点访问

```python
class OnionScraper(TorScraper):
    """.onion站点采集器"""
    
    def __init__(self, proxy_port: int = 9050):
        super().__init__(proxy_port)
        # 增加超时时间，Tor网络较慢
        self.session.timeout = 60
    
    def scrape_onion_site(self, onion_url: str):
        """
        采集.onion站点
        
        Args:
            onion_url: .onion地址，如 "http://3g2upl4pq6kufc4m.onion"
        """
        try:
            response = self.session.get(onion_url)
            return {
                "success": True,
                "status_code": response.status_code,
                "content": response.text,
                "headers": dict(response.headers)
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def discover_links(self, content: str) -> list:
        """从页面内容中发现.onion链接"""
        import re
        
        onion_pattern = r'[a-z2-7]{16,56}\.onion'
        links = re.findall(onion_pattern, content)
        
        return list(set(links))

# 使用示例
# scraper = OnionScraper()
# result = scraper.scrape_onion_site("http://3g2upl4pq6kufc4m.onion")
```

### 实战技巧

1. **Tor配置**: 确保Tor服务运行，SOCKS5代理可用
2. **超时设置**: Tor网络较慢，需要设置较长的超时时间
3. **身份轮换**: 定期更换Tor出口节点，避免被追踪
4. **安全注意**: 遵守当地法律，仅用于合法研究目的
5. **I2P替代**: I2P网络提供另一种匿名访问方式

---

## 模块12: 网络空间搜索

### 概述
网络空间搜索引擎（Shodan、ZoomEye、FOFA、Censys）可以发现互联网上的暴露服务和设备。

### 推荐工具

| 平台 | 特点 |
|------|------|
| **Shodan** | 最全面的网络空间搜索引擎 |
| **ZoomEye** | 知道创宇出品，国内友好 |
| **FOFA** | 白帽汇出品，中文支持好 |
| **Censys** | 学术背景，数据质量高 |
| **Hunter** | 奇安信出品，企业资产发现 |

### 代码示例

#### 12.1 Shodan API

```python
import shodan

class ShodanSearcher:
    """Shodan网络空间搜索"""
    
    def __init__(self, api_key: str):
        self.api = shodan.Shodan(api_key)
    
    def search(self, query: str, limit: int = 100):
        """
        执行Shodan搜索
        
        Args:
            query: Shodan查询语法
            limit: 结果数量限制
        """
        results = []
        
        try:
            for banner in self.api.search_cursor(query):
                results.append({
                    "ip": banner.get("ip_str"),
                    "port": banner.get("port"),
                    "org": banner.get("org"),
                    "isp": banner.get("isp"),
                    "location": banner.get("location", {}),
                    "os": banner.get("os"),
                    "product": banner.get("product"),
                    "version": banner.get("version"),
                    "data": banner.get("data")
                })
                
                if len(results) >= limit:
                    break
        except shodan.APIError as e:
            print(f"[-] Shodan API Error: {e}")
        
        return results
    
    def search_webcams(self, limit: int = 10):
        """搜索网络摄像头"""
        return self.search("webcam", limit)
    
    def search_databases(self, limit: int = 10):
        """搜索暴露的数据库"""
        return self.search("mongodb OR redis OR elasticsearch OR mysql port:27017,6379,9200,3306", limit)
    
    def search_ics(self, limit: int = 10):
        """搜索工业控制系统"""
        return self.search("ics OR scada OR modbus", limit)

# 使用示例
# searcher = ShodanSearcher(api_key="YOUR_API_KEY")
# results = searcher.search_webcams(10)
```

#### 12.2 ZoomEye API

```python
import requests

class ZoomEyeSearcher:
    """ZoomEye网络空间搜索"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.zoomeye.org"
        self.headers = {"Authorization": f"JWT {api_key}"}
    
    def search_host(self, query: str, page: int = 1):
        """搜索主机"""
        url = f"{self.base_url}/host/search"
        params = {
            "query": query,
            "page": page
        }
        
        response = requests.get(url, headers=self.headers, params=params)
        return response.json()
    
    def search_web(self, query: str, page: int = 1):
        """搜索Web组件"""
        url = f"{self.base_url}/web/search"
        params = {
            "query": query,
            "page": page
        }
        
        response = requests.get(url, headers=self.headers, params=params)
        return response.json()

# 使用示例
# searcher = ZoomEyeSearcher(api_key="YOUR_API_KEY")
# results = searcher.search_host("apache")
```

#### 12.3 FOFA API

```python
import requests
import base64

class FofaSearcher:
    """FOFA网络空间搜索"""
    
    def __init__(self, email: str, api_key: str):
        self.email = email
        self.api_key = api_key
        self.base_url = "https://fofa.info/api/v1"
    
    def search(self, query: str, size: int = 100, fields: str = "ip,port,title,domain"):
        """
        执行FOFA搜索
        
        Args:
            query: FOFA查询语法
            size: 结果数量
            fields: 返回字段
        """
        # FOFA使用base64编码查询
        query_b64 = base64.b64encode(query.encode()).decode()
        
        url = f"{self.base_url}/search/all"
        params = {
            "email": self.email,
            "key": self.api_key,
            "qbase64": query_b64,
            "size": size,
            "fields": fields
        }
        
        response = requests.get(url, params=params)
        return response.json()
    
    def search_web_servers(self, server: str, size: int = 100):
        """搜索特定Web服务器"""
        query = f'server="{server}"'
        return self.search(query, size)
    
    def search_by_icon(self, icon_hash: str, size: int = 100):
        """通过图标hash搜索"""
        query = f'icon_hash="{icon_hash}"'
        return self.search(query, size)

# 使用示例
# searcher = FofaSearcher(email="your@email.com", api_key="YOUR_KEY")
# results = searcher.search_web_servers("nginx", 50)
```

### 实战技巧

1. **查询语法**: 学习各平台的查询语法，提高搜索精度
2. **结果去重**: 多个平台结果可能有重叠，需要合并去重
3. **数据验证**: 验证发现的暴露服务是否真实存在
4. **合规使用**: 仅用于合法的安全研究和资产管理
5. **API限流**: 注意各平台的API调用频率限制

---

## 模块13: 文档/邮件采集

### 概述
文档/邮件采集涉及PDF、Office文档解析和邮件列表采集。需要专门的解析库处理不同格式。

### 推荐工具

| 类型 | 工具 |
|------|------|
| PDF | PyMuPDF, pdfplumber |
| Word | python-docx |
| Excel | openpyxl, pandas |
| OCR | Tesseract, PaddleOCR |
| 邮件 | imaplib, poplib |

### 代码示例

#### 13.1 PDF解析

```python
import fitz  # PyMuPDF
import pdfplumber

class PDFExtractor:
    """PDF文档提取器"""
    
    def __init__(self):
        pass
    
    def extract_text_pymupdf(self, pdf_path: str) -> str:
        """使用PyMuPDF提取文本"""
        doc = fitz.open(pdf_path)
        text = ""
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text += f"\n--- Page {page_num + 1} ---\n"
            text += page.get_text()
        
        doc.close()
        return text
    
    def extract_text_pdfplumber(self, pdf_path: str) -> str:
        """使用pdfplumber提取文本"""
        text = ""
        
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                text += f"\n--- Page {i + 1} ---\n"
                text += page.extract_text() or ""
        
        return text
    
    def extract_tables(self, pdf_path: str) -> list:
        """提取PDF中的表格"""
        tables = []
        
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_tables = page.extract_tables()
                tables.extend(page_tables)
        
        return tables
    
    def extract_images(self, pdf_path: str, output_dir: str):
        """提取PDF中的图片"""
        import os
        os.makedirs(output_dir, exist_ok=True)
        
        doc = fitz.open(pdf_path)
        image_count = 0
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            images = page.get_images()
            
            for img_index, img in enumerate(images):
                xref = img[0]
                base_image = doc.extract_image(xref)
                image_bytes = base_image["image"]
                image_ext = base_image["ext"]
                
                image_path = f"{output_dir}/image_{page_num}_{img_index}.{image_ext}"
                with open(image_path, "wb") as f:
                    f.write(image_bytes)
                
                image_count += 1
        
        doc.close()
        print(f"[+] Extracted {image_count} images")

# 使用示例
# extractor = PDFExtractor()
# text = extractor.extract_text_pymupdf("document.pdf")
```

#### 13.2 Office文档提取

```python
from docx import Document
import openpyxl
import pandas as pd

class OfficeExtractor:
    """Office文档提取器"""
    
    def extract_word(self, docx_path: str) -> dict:
        """提取Word文档内容"""
        doc = Document(docx_path)
        
        result = {
            "paragraphs": [],
            "tables": []
        }
        
        # 提取段落
        for para in doc.paragraphs:
            if para.text.strip():
                result["paragraphs"].append(para.text)
        
        # 提取表格
        for table in doc.tables:
            table_data = []
            for row in table.rows:
                row_data = [cell.text for cell in row.cells]
                table_data.append(row_data)
            result["tables"].append(table_data)
        
        return result
    
    def extract_excel(self, excel_path: str, sheet_name: str = None) -> list:
        """提取Excel数据"""
        wb = openpyxl.load_workbook(excel_path)
        
        results = []
        
        if sheet_name:
            sheets = [wb[sheet_name]]
        else:
            sheets = wb
        
        for sheet in sheets:
            sheet_data = []
            for row in sheet.iter_rows(values_only=True):
                sheet_data.append(row)
            
            results.append({
                "sheet_name": sheet.title,
                "data": sheet_data
            })
        
        wb.close()
        return results
    
    def extract_excel_pandas(self, excel_path: str) -> dict:
        """使用pandas提取Excel"""
        excel_file = pd.ExcelFile(excel_path)
        
        result = {}
        for sheet_name in excel_file.sheet_names:
            df = pd.read_excel(excel_file, sheet_name=sheet_name)
            result[sheet_name] = df.to_dict(orient='records')
        
        return result

# 使用示例
# extractor = OfficeExtractor()
# word_data = extractor.extract_word("document.docx")
# excel_data = extractor.extract_excel("data.xlsx")
```

#### 13.3 OCR文字识别

```python
import pytesseract
from PIL import Image
import cv2
import numpy as np

class OCRExtractor:
    """OCR文字识别提取器"""
    
    def __init__(self, lang: str = "chi_sim+eng"):
        """
        Args:
            lang: 识别语言，chi_sim=简体中文，eng=英文
        """
        self.lang = lang
    
    def extract_from_image(self, image_path: str) -> str:
        """从图片提取文字"""
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image, lang=self.lang)
        return text
    
    def extract_from_image_cv2(self, image_path: str) -> str:
        """使用OpenCV预处理后再识别"""
        # 读取图片
        image = cv2.imread(image_path)
        
        # 灰度化
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # 二值化
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        # 去噪
        denoised = cv2.fastNlMeansDenoising(binary)
        
        # OCR识别
        text = pytesseract.image_to_string(denoised, lang=self.lang)
        return text
    
    def extract_from_pdf_ocr(self, pdf_path: str) -> str:
        """对扫描版PDF进行OCR"""
        import fitz
        
        doc = fitz.open(pdf_path)
        full_text = ""
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            
            # 将页面转换为图片
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x缩放提高清晰度
            img_data = pix.tobytes("png")
            
            # 保存临时图片
            temp_img_path = f"/tmp/page_{page_num}.png"
            with open(temp_img_path, "wb") as f:
                f.write(img_data)
            
            # OCR识别
            text = self.extract_from_image(temp_img_path)
            full_text += f"\n--- Page {page_num + 1} ---\n{text}"
            
            # 清理临时文件
            import os
            os.remove(temp_img_path)
        
        doc.close()
        return full_text

# 使用示例
# extractor = OCRExtractor(lang="chi_sim")
# text = extractor.extract_from_image("image.png")
```

### 实战技巧

1. **PDF类型判断**: 先判断是文本PDF还是扫描PDF，选择对应方法
2. **表格识别**: pdfplumber对表格识别效果较好
3. **OCR预处理**: 灰度化、二值化、去噪可提高识别率
4. **多语言支持**: Tesseract支持100+语言，需下载对应语言包
5. **批量处理**: 大量文档使用多线程/多进程加速

---

## 模块14: IoT/传感器数据

### 概述
IoT/传感器数据采集涉及MQTT协议、工控协议（Modbus/OPC UA）等。用于工业数据采集、智能家居监控等场景。

### 推荐工具

| 协议 | 工具 |
|------|------|
| MQTT | paho-mqtt |
| Modbus | pymodbus |
| OPC UA | opcua-client |

### 代码示例

#### 14.1 MQTT协议采集

```python
import paho.mqtt.client as mqtt
import json
import time

class MQTTCollector:
    """MQTT数据采集器"""
    
    def __init__(self, broker: str, port: int = 1883, 
                 username: str = None, password: str = None):
        self.broker = broker
        self.port = port
        self.messages = []
        
        self.client = mqtt.Client()
        
        if username and password:
            self.client.username_pw_set(username, password)
        
        # 设置回调
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
    
    def _on_connect(self, client, userdata, flags, rc):
        """连接回调"""
        if rc == 0:
            print(f"[+] Connected to MQTT broker: {self.broker}")
        else:
            print(f"[-] Connection failed with code: {rc}")
    
    def _on_message(self, client, userdata, msg):
        """消息回调"""
        try:
            payload = json.loads(msg.payload.decode())
        except:
            payload = msg.payload.decode()
        
        message = {
            "topic": msg.topic,
            "payload": payload,
            "timestamp": time.time()
        }
        
        self.messages.append(message)
        print(f"[+] Received on {msg.topic}: {payload}")
    
    def subscribe(self, topic: str, qos: int = 0):
        """订阅主题"""
        self.client.subscribe(topic, qos)
        print(f"[+] Subscribed to: {topic}")
    
    def start_listening(self, duration: int = 60):
        """开始监听"""
        self.client.connect(self.broker, self.port)
        self.client.loop_start()
        
        time.sleep(duration)
        
        self.client.loop_stop()
        self.client.disconnect()
    
    def publish(self, topic: str, payload: dict, qos: int = 0):
        """发布消息"""
        self.client.connect(self.broker, self.port)
        
        message = json.dumps(payload)
        self.client.publish(topic, message, qos)
        
        self.client.disconnect()

# 使用示例
# collector = MQTTCollector("broker.hivemq.com")
# collector.subscribe("sensor/temperature")
# collector.start_listening(60)
```

#### 14.2 Modbus协议采集

```python
from pymodbus.client import ModbusTcpClient
from pymodbus.exceptions import ModbusException

class ModbusCollector:
    """Modbus数据采集器"""
    
    def __init__(self, host: str, port: int = 502):
        self.host = host
        self.port = port
        self.client = ModbusTcpClient(host, port)
    
    def connect(self):
        """连接设备"""
        if self.client.connect():
            print(f"[+] Connected to Modbus device: {self.host}:{self.port}")
            return True
        else:
            print(f"[-] Failed to connect to {self.host}:{self.port}")
            return False
    
    def read_coils(self, address: int, count: int = 1, slave: int = 1):
        """读取线圈状态"""
        try:
            result = self.client.read_coils(address, count, slave=slave)
            if result.isError():
                print(f"[-] Modbus error: {result}")
                return None
            return result.bits[:count]
        except ModbusException as e:
            print(f"[-] Exception: {e}")
            return None
    
    def read_holding_registers(self, address: int, count: int = 1, slave: int = 1):
        """读取保持寄存器"""
        try:
            result = self.client.read_holding_registers(address, count, slave=slave)
            if result.isError():
                print(f"[-] Modbus error: {result}")
                return None
            return result.registers
        except ModbusException as e:
            print(f"[-] Exception: {e}")
            return None
    
    def read_input_registers(self, address: int, count: int = 1, slave: int = 1):
        """读取输入寄存器"""
        try:
            result = self.client.read_input_registers(address, count, slave=slave)
            if result.isError():
                print(f"[-] Modbus error: {result}")
                return None
            return result.registers
        except ModbusException as e:
            print(f"[-] Exception: {e}")
            return None
    
    def close(self):
        """关闭连接"""
        self.client.close()

# 使用示例
# collector = ModbusCollector("192.168.1.100")
# if collector.connect():
#     data = collector.read_holding_registers(0, 10)
#     collector.close()
```

### 实战技巧

1. **MQTT QoS**: 根据数据重要性选择合适的QoS级别
2. **Modbus地址**: 注意区分0-based和1-based地址
3. **数据解析**: 寄存器数据可能需要字节序转换
4. **异常处理**: 工业环境网络不稳定，需要完善的异常处理
5. **数据缓存**: 网络中断时缓存数据，恢复后补发

---

## 模块15: 云端浏览器BaaS

### 概述
云端浏览器BaaS（Browser as a Service）提供托管的浏览器实例，无需管理基础设施。适合大规模、高并发的采集任务。

### 推荐服务

| 服务 | 特点 | 价格 |
|------|------|------|
| **Steel Browser** | a16z投资，1秒启动，24小时连接 | $ |
| **Hyperbrowser** | AI-native，MCP集成，自愈 | $$ |
| **Browserless v2/v3** | 开源，BrowserQL DSL | $ |
| **Bright Data Scraping Browser** | 企业级，Web Unlocker集成 | $$$ |
| **ScrapingBee** | 简单易用，代理+浏览器 | $$ |

### 代码示例

#### 15.1 Steel Browser

```python
from steel import Steel
from playwright.sync_api import sync_playwright

class SteelBrowser:
    """Steel Browser云端浏览器"""
    
    def __init__(self, api_key: str):
        self.client = Steel(api_key=api_key)
    
    def create_session(self, timeout: int = 86400, proxy: dict = None):
        """
        创建浏览器会话
        
        Args:
            timeout: 会话超时时间(秒)，默认24小时
            proxy: 代理配置
        """
        session = self.client.sessions.create(
            timeout=timeout,
            proxy=proxy
        )
        
        return session
    
    def scrape_with_playwright(self, url: str, session_id: str = None):
        """使用Playwright连接Steel浏览器"""
        if not session_id:
            session = self.create_session()
            session_id = session.id
        
        ws_endpoint = f"wss://connect.steel.dev?sessionId={session_id}"
        
        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(ws_endpoint)
            context = browser.new_context()
            page = context.new_page()
            
            page.goto(url, wait_until="networkidle")
            content = page.content()
            
            context.close()
            browser.close()
            
            return content

# 使用示例
# steel = SteelBrowser(api_key="YOUR_API_KEY")
# content = steel.scrape_with_playwright("https://example.com")
```

#### 15.2 Hyperbrowser

```python
from hyperbrowser import Hyperbrowser

class HyperbrowserScraper:
    """Hyperbrowser云端浏览器"""
    
    def __init__(self, api_key: str):
        self.hb = Hyperbrowser(api_key=api_key)
    
    def create_session(self, use_proxy: bool = True, proxy_type: str = "residential",
                       solve_captcha: bool = True, auto_heal: bool = True):
        """
        创建Hyperbrowser会话
        
        Args:
            use_proxy: 是否使用代理
            proxy_type: 代理类型 (residential/isp/datacenter)
            solve_captcha: 自动解决验证码
            auto_heal: 自动修复选择器
        """
        session = self.hb.sessions.create(
            use_proxy=use_proxy,
            proxy_type=proxy_type,
            solve_captcha=solve_captcha,
            auto_heal=auto_heal
        )
        
        return session
    
    def scrape(self, url: str, instructions: str = None):
        """
        采集页面
        
        Args:
            url: 目标URL
            instructions: AI指令
        """
        result = self.hb.scrape(
            url=url,
            instructions=instructions
        )
        
        return result

# 使用示例
# scraper = HyperbrowserScraper(api_key="YOUR_API_KEY")
# result = scraper.scrape("https://example.com", "提取所有产品信息")
```

#### 15.3 Browserless v2/v3

```python
import requests

class BrowserlessScraper:
    """Browserless云端浏览器"""
    
    def __init__(self, token: str, host: str = "wss://chrome.browserless.io"):
        self.token = token
        self.host = host
    
    def scrape_with_browserql(self, url: str, query: str):
        """
        使用BrowserQL DSL采集
        
        Args:
            url: 目标URL
            query: BrowserQL查询
        """
        graphql_query = """
        mutation Scrape($url: String!, $query: String!) {
            scrape(url: $url, query: $query) {
                title
                content
                links
            }
        }
        """
        
        variables = {
            "url": url,
            "query": query
        }
        
        response = requests.post(
            f"{self.host}/graphql",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "query": graphql_query,
                "variables": variables
            }
        )
        
        return response.json()
    
    def scrape_simple(self, url: str, wait_for: str = None):
        """简单采集"""
        api_url = f"{self.host}/content"
        
        params = {
            "token": self.token,
            "url": url
        }
        
        if wait_for:
            params["waitFor"] = wait_for
        
        response = requests.get(api_url, params=params)
        return response.text

# 使用示例
# scraper = BrowserlessScraper(token="YOUR_TOKEN")
# content = scraper.scrape_simple("https://example.com")
```

### 选型建议

| 场景 | 推荐服务 | 理由 |
|------|---------|------|
| 快速启动 | Steel | 1秒启动，24小时连接 |
| AI驱动 | Hyperbrowser | MCP集成，自愈机制 |
| 开源可控 | Browserless | 可自托管，BrowserQL |
| 企业级 | Bright Data | 完整生态，Web Unlocker |
| 预算有限 | ScrapingBee | 性价比高 |

---

## 模块16: 验证码完全破解

### 概述
验证码破解是突破高防护站点的关键技术。从商业API到AI视觉识别，多种方案应对不同类型的验证码。

### 推荐工具

| 工具 | 支持类型 | 成功率 |
|------|---------|--------|
| **CapSolver** | reCAPTCHA v2/v3, hCaptcha, Turnstile, GeeTest, DataDome | 95%+ |
| **FlareSolverr** | Cloudflare Turnstile专项 | 90%+ |
| **2Captcha** | 多种类型 | 85%+ |
| **GPT-4o** | 文本验证码 | 90%+ |
| **自定义** | 滑块、点选验证码 | 80%+ |

### 代码示例

#### 16.1 CapSolver 全类型破解

```python
import requests
import time

class CapSolver:
    """CapSolver验证码破解"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.endpoint = "https://api.capsolver.com"
    
    def solve_recaptcha_v2(self, website_url: str, website_key: str,
                           is_invisible: bool = False, proxy: str = None) -> str:
        """
        解决reCAPTCHA v2
        
        Args:
            website_url: 目标网站URL
            website_key: reCAPTCHA site key
            is_invisible: 是否隐形验证码
            proxy: 代理地址
        """
        task = {
            "type": "ReCaptchaV2TaskProxyLess" if not proxy else "ReCaptchaV2Task",
            "websiteURL": website_url,
            "websiteKey": website_key,
            "isInvisible": is_invisible
        }
        
        if proxy:
            task["proxy"] = proxy
        
        return self._solve(task)
    
    def solve_recaptcha_v3(self, website_url: str, website_key: str,
                           page_action: str = "verify", min_score: float = 0.3) -> str:
        """解决reCAPTCHA v3"""
        task = {
            "type": "ReCaptchaV3TaskProxyLess",
            "websiteURL": website_url,
            "websiteKey": website_key,
            "pageAction": page_action,
            "minScore": min_score
        }
        
        return self._solve(task)
    
    def solve_hcaptcha(self, website_url: str, website_key: str, proxy: str = None) -> str:
        """解决hCaptcha"""
        task = {
            "type": "HCaptchaTaskProxyLess" if not proxy else "HCaptchaTask",
            "websiteURL": website_url,
            "websiteKey": website_key
        }
        
        if proxy:
            task["proxy"] = proxy
        
        return self._solve(task)
    
    def solve_turnstile(self, website_url: str, website_key: str) -> str:
        """解决Cloudflare Turnstile"""
        task = {
            "type": "AntiTurnstileTaskProxyLess",
            "websiteURL": website_url,
            "websiteKey": website_key
        }
        
        return self._solve(task)
    
    def solve_geetest(self, website_url: str, gt: str, challenge: str) -> dict:
        """解决GeeTest"""
        task = {
            "type": "GeeTestTaskProxyLess",
            "websiteURL": website_url,
            "gt": gt,
            "challenge": challenge
        }
        
        return self._solve(task)
    
    def solve_image_to_text(self, image_base64: str) -> str:
        """图像验证码识别"""
        task = {
            "type": "ImageToTextTask",
            "body": image_base64
        }
        
        return self._solve(task)
    
    def _solve(self, task: dict):
        """通用求解方法"""
        # 创建任务
        create_payload = {
            "clientKey": self.api_key,
            "task": task
        }
        
        response = requests.post(
            f"{self.endpoint}/createTask",
            json=create_payload
        )
        
        result = response.json()
        
        if result.get("errorId") != 0:
            raise Exception(f"CapSolver error: {result.get('errorDescription')}")
        
        task_id = result.get("taskId")
        
        # 轮询结果
        while True:
            time.sleep(2)
            
            get_result_payload = {
                "clientKey": self.api_key,
                "taskId": task_id
            }
            
            response = requests.post(
                f"{self.endpoint}/getTaskResult",
                json=get_result_payload
            )
            
            result = response.json()
            
            if result.get("status") == "ready":
                return result.get("solution", {}).get("gRecaptchaResponse") or result.get("solution")
            
            if result.get("status") == "failed":
                raise Exception(f"Task failed: {result}")

# 使用示例
# solver = CapSolver(api_key="YOUR_API_KEY")
# token = solver.solve_recaptcha_v2("https://example.com", "SITE_KEY")
```

#### 16.2 FlareSolverr Cloudflare专项

```python
import requests

class FlareSolverr:
    """FlareSolverr - Cloudflare Turnstile专项"""
    
    def __init__(self, host: str = "http://localhost:8191"):
        self.host = host
    
    def solve(self, url: str, method: str = "GET", 
              headers: dict = None, post_data: dict = None) -> dict:
        """
        使用FlareSolverr解决Cloudflare
        
        Args:
            url: 目标URL
            method: 请求方法
            headers: 自定义headers
            post_data: POST数据
        """
        payload = {
            "cmd": "request.get" if method == "GET" else "request.post",
            "url": url,
            "maxTimeout": 60000
        }
        
        if headers:
            payload["headers"] = headers
        
        if post_data:
            payload["postData"] = post_data
        
        response = requests.post(f"{self.host}/v1", json=payload)
        return response.json()
    
    def get_cookies(self, url: str) -> list:
        """获取Cloudflare通过的cookies"""
        result = self.solve(url)
        
        if result.get("status") == "ok":
            return result.get("solution", {}).get("cookies", [])
        
        return []
    
    def get_user_agent(self, url: str) -> str:
        """获取使用的User-Agent"""
        result = self.solve(url)
        
        if result.get("status") == "ok":
            return result.get("solution", {}).get("userAgent", "")
        
        return ""

# 使用示例
# solver = FlareSolverr()
# result = solver.solve("https://cloudflare-protected-site.com")
```

#### 16.3 AI视觉识别验证码

```python
from openai import OpenAI
import base64

class AICaptchaSolver:
    """AI视觉验证码识别"""
    
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
    
    def solve_image_captcha(self, image_path: str) -> str:
        """
        使用GPT-4o识别图像验证码
        
        Args:
            image_path: 验证码图片路径
        """
        with open(image_path, "rb") as f:
            image_base64 = base64.b64encode(f.read()).decode()
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "识别图片中的验证码文字，只返回验证码内容，不要任何解释。"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=50
        )
        
        return response.choices[0].message.content.strip()
    
    def solve_slider_captcha(self, bg_image: str, slider_image: str) -> int:
        """
        识别滑块验证码缺口位置
        
        Args:
            bg_image: 背景图路径
            slider_image: 滑块图路径
        
        Returns:
            缺口X坐标
        """
        with open(bg_image, "rb") as f:
            bg_base64 = base64.b64encode(f.read()).decode()
        
        with open(slider_image, "rb") as f:
            slider_base64 = base64.b64encode(f.read()).decode()
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "第一张图是滑块验证码背景，第二张是滑块。找出缺口位置的X坐标，只返回数字。"},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{bg_base64}"}
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{slider_base64}"}
                        }
                    ]
                }
            ],
            max_tokens=10
        )
        
        try:
            return int(response.choices[0].message.content.strip())
        except:
            return 0

# 使用示例
# solver = AICaptchaSolver(api_key="YOUR_API_KEY")
# captcha_text = solver.solve_image_captcha("captcha.png")
```

#### 16.4 滑块验证码破解

```python
import cv2
import numpy as np
from scipy.interpolate import CubicSpline

class SliderCaptchaSolver:
    """滑块验证码破解"""
    
    @staticmethod
    def find_gap_position(bg_path: str, slider_path: str) -> int:
        """
        图像对比找缺口位置
        
        Args:
            bg_path: 背景图路径
            slider_path: 滑块图路径
        
        Returns:
            缺口X坐标
        """
        # 读取图片
        bg = cv2.imread(bg_path, 0)
        slider = cv2.imread(slider_path, 0)
        
        # 模板匹配
        result = cv2.matchTemplate(bg, slider, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
        
        return max_loc[0]
    
    @staticmethod
    def generate_bezier_track(distance: int, duration: float = 1.0) -> list:
        """
        生成贝塞尔曲线轨迹
        
        Args:
            distance: 滑动距离
            duration: 滑动持续时间(秒)
        
        Returns:
            轨迹点列表 [(x, y, time), ...]
        """
        # 控制点
        points = [
            (0, 0),
            (distance * 0.3, np.random.uniform(-5, 5)),
            (distance * 0.7, np.random.uniform(-5, 5)),
            (distance, 0)
        ]
        
        # 生成曲线
        t = np.linspace(0, 1, int(duration * 100))
        xs = CubicSpline(range(len(points)), [p[0] for p in points])(t * (len(points)-1))
        ys = CubicSpline(range(len(points)), [p[1] for p in points])(t * (len(points)-1))
        
        # 添加时间戳
        timestamps = np.linspace(0, duration * 1000, len(xs))
        
        track = []
        for i in range(len(xs)):
            track.append({
                "x": int(xs[i]),
                "y": int(ys[i]),
                "time": int(timestamps[i])
            })
        
        return track
    
    @staticmethod
    def generate_humanized_track(distance: int) -> list:
        """
        生成人性化轨迹（带加速度和停顿）
        
        Args:
            distance: 滑动距离
        """
        track = []
        current = 0
        mid = distance * 0.7
        t = 0.2
        v = 0
        
        while current < distance:
            if current < mid:
                a = 2  # 加速
            else:
                a = -3  # 减速
            
            v0 = v
            v = v0 + a * t
            
            # 添加随机波动
            move = v0 * t + 0.5 * a * t * t
            move = move + np.random.uniform(-2, 2)
            
            current += move
            
            # 偶尔停顿
            if np.random.random() < 0.05:
                track.append({
                    "x": int(min(current, distance)),
                    "y": int(np.random.uniform(-2, 2)),
                    "time": int(np.random.uniform(100, 300))
                })
            
            track.append({
                "x": int(min(current, distance)),
                "y": int(np.random.uniform(-2, 2)),
                "time": int(t * 100)
            })
        
        return track

# 使用示例
# gap_x = SliderCaptchaSolver.find_gap_position("bg.png", "slider.png")
# track = SliderCaptchaSolver.generate_bezier_track(gap_x)
```

#### 16.5 点选验证码破解

```python
import cv2
import numpy as np

class ClickCaptchaSolver:
    """点选验证码破解"""
    
    def __init__(self, ai_solver=None):
        self.ai_solver = ai_solver
    
    def detect_targets(self, image_path: str, target_texts: list) -> list:
        """
        检测点选目标位置
        
        Args:
            image_path: 验证码图片路径
            target_texts: 需要点击的文字列表
        
        Returns:
            点击坐标列表 [(x, y), ...]
        """
        if self.ai_solver:
            return self._detect_with_ai(image_path, target_texts)
        else:
            return self._detect_with_cv(image_path, target_texts)
    
    def _detect_with_ai(self, image_path: str, target_texts: list) -> list:
        """使用AI检测目标位置"""
        import base64
        
        with open(image_path, "rb") as f:
            image_base64 = base64.b64encode(f.read()).decode()
        
        prompt = f"""在图片中找到以下文字的位置，返回每个文字的坐标（相对于图片左上角的x,y）：
{', '.join(target_texts)}

返回格式：
文字1: x,y
文字2: x,y
"""
        
        # 这里调用AI API获取坐标
        # 返回解析后的坐标列表
        return []
    
    def _detect_with_cv(self, image_path: str, target_texts: list) -> list:
        """使用OpenCV检测（需要配合OCR）"""
        # 读取图片
        image = cv2.imread(image_path)
        
        # 使用OCR识别所有文字及其位置
        # 这里需要集成paddleocr或easyocr
        
        # 返回匹配文字的坐标
        return []
    
    @staticmethod
    def generate_click_sequence(coords: list, image_size: tuple) -> list:
        """
        生成点击序列（带随机偏移）
        
        Args:
            coords: 目标坐标列表
            image_size: 图片尺寸 (width, height)
        """
        clicks = []
        
        for coord in coords:
            # 添加随机偏移（模拟人类点击不精确）
            offset_x = np.random.uniform(-5, 5)
            offset_y = np.random.uniform(-5, 5)
            
            x = max(0, min(image_size[0], coord[0] + offset_x))
            y = max(0, min(image_size[1], coord[1] + offset_y))
            
            clicks.append({
                "x": int(x),
                "y": int(y),
                "delay": np.random.uniform(0.5, 1.5)  # 点击间隔
            })
        
        return clicks

# 使用示例
# solver = ClickCaptchaSolver(ai_solver=AICaptchaSolver(api_key="xxx"))
# coords = solver.detect_targets("captcha.png", ["文字1", "文字2"])
```

### 实战技巧

1. **验证码类型识别**: 先识别验证码类型，选择对应解决方案
2. **多源融合**: CapSolver失败时尝试2Captcha或Anti-Captcha
3. **代理配合**: 验证码破解通常需要配合代理使用
4. **成本控制**: 图像验证码用AI识别，复杂验证码用商业API
5. **失败重试**: 验证码破解有失败率，需要重试机制

---

## 模块17: 指纹对抗全方案

### 概述
指纹对抗是绕过Bot检测的核心技术。从TLS指纹到浏览器指纹，四维身份一致性（IP-TLS-浏览器-行为）是关键。

### 推荐工具

| 指纹类型 | 工具 |
|---------|------|
| TLS指纹 | curl_cffi, tls-client, uTLS |
| HTTP/2指纹 | httpx, curl_cffi |
| 浏览器指纹 | Camoufox, Patchright |
| WebRTC | 禁用或欺骗 |

### 代码示例

#### 17.1 JA3/JA4 TLS指纹伪装

```python
from curl_cffi import requests
from curl_cffi.requests import Session

class TLSFingerprinter:
    """TLS指纹伪装器"""
    
    # 常见浏览器JA3指纹
    JA3_FINGERPRINTS = {
        "chrome_120": "771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513,29-23-24,0",
        "firefox_120": "771,4865-4867-4866-49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-51-57-47-53-10,0-23-65281-10-11-35-16-5-51-43-13-45-28-65037,29-23-24-25-256-257,0",
        "safari_17": "771,49195-49199-52393-52392-49196-49200-49162-49161-49171-49172-51-57-47-53-10,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513,29-23-24,0"
    }
    
    def __init__(self, impersonate: str = "chrome120"):
        self.session = Session(impersonate=impersonate)
    
    def request_with_ja3(self, url: str, ja3: str = None, **kwargs):
        """
        使用指定JA3指纹发送请求
        
        Args:
            url: 目标URL
            ja3: 自定义JA3指纹
        """
        if ja3:
            # curl_cffi 通过impersonate参数设置JA3
            # 完整JA3支持需要修改底层curl配置
            pass
        
        return self.session.get(url, **kwargs)
    
    def check_ja3_fingerprint(self) -> dict:
        """检查当前JA3指纹"""
        response = self.session.get("https://tls.browserleaks.com/json")
        return response.json()

# 使用示例
# fingerprinter = TLSFingerprinter(impersonate="chrome120")
# ja3_info = fingerprinter.check_ja3_fingerprint()
```

#### 17.2 HTTP/2指纹伪装

```python
import httpx

class HTTP2Fingerprinter:
    """HTTP/2指纹伪装器"""
    
    def __init__(self):
        # 模拟Chrome的HTTP/2 Settings
        self.http2_settings = {
            "SETTINGS_HEADER_TABLE_SIZE": 65536,
            "SETTINGS_ENABLE_PUSH": 1,
            "SETTINGS_MAX_CONCURRENT_STREAMS": 1000,
            "SETTINGS_INITIAL_WINDOW_SIZE": 6291456,
            "SETTINGS_MAX_FRAME_SIZE": 16384,
            "SETTINGS_MAX_HEADER_LIST_SIZE": 262144
        }
        
        # 模拟Chrome的伪头顺序
        self.pseudo_header_order = [
            ":method",
            ":authority",
            ":scheme",
            ":path"
        ]
    
    def create_http2_client(self):
        """创建HTTP/2客户端"""
        limits = httpx.Limits(
            max_keepalive_connections=1000,
            max_connections=1000
        )
        
        client = httpx.Client(
            http2=True,
            limits=limits,
            timeout=httpx.Timeout(30.0)
        )
        
        return client
    
    def request_with_http2(self, url: str, headers: dict = None):
        """使用HTTP/2发送请求"""
        client = self.create_http2_client()
        
        default_headers = {
            ":authority": url.split("/")[2],
            ":method": "GET",
            ":path": "/",
            ":scheme": "https",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0"
        }
        
        if headers:
            default_headers.update(headers)
        
        response = client.get(url, headers=default_headers)
        return response

# 使用示例
# fingerprinter = HTTP2Fingerprinter()
# response = fingerprinter.request_with_http2("https://example.com")
```

#### 17.3 浏览器指纹注入

```python
class BrowserFingerprinter:
    """浏览器指纹注入器"""
    
    def __init__(self):
        self.fingerprints = {
            "canvas": self._generate_canvas_fingerprint(),
            "webgl": self._generate_webgl_fingerprint(),
            "audio": self._generate_audio_fingerprint(),
            "fonts": self._generate_fonts_list()
        }
    
    def _generate_canvas_fingerprint(self) -> str:
        """生成Canvas指纹"""
        # 实际指纹基于Canvas渲染差异
        # 这里返回一个模拟值
        return "canvas_fingerprint_hash"
    
    def _generate_webgl_fingerprint(self) -> dict:
        """生成WebGL指纹"""
        return {
            "vendor": "Google Inc. (NVIDIA)",
            "renderer": "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)",
            "unmasked_vendor": "NVIDIA",
            "unmasked_renderer": "NVIDIA GeForce GTX 1060 6GB",
            "aliased_line_width_range": [1, 1],
            "aliased_point_size_range": [1, 1024],
            "alpha_bits": 8,
            "blue_bits": 8,
            "depth_bits": 24,
            "green_bits": 8,
            "red_bits": 8,
            "max_combined_texture_image_units": 32,
            "max_cube_map_texture_size": 16384,
            "max_fragment_uniform_vectors": 1024,
            "max_renderbuffer_size": 16384,
            "max_texture_image_units": 16,
            "max_texture_size": 16384,
            "max_varying_vectors": 30,
            "max_vertex_attribs": 16,
            "max_vertex_texture_image_units": 16,
            "max_vertex_uniform_vectors": 4096,
            "precision_formats": {},
            "extensions": [
                "WEBGL_debug_renderer_info",
                "EXT_texture_filter_anisotropic",
                "EXT_disjoint_timer_query",
                "OES_texture_float_linear"
            ]
        }
    
    def _generate_audio_fingerprint(self) -> dict:
        """生成AudioContext指纹"""
        return {
            "sample_rate": 48000,
            "channel_count": 2,
            "channel_count_mode": "explicit",
            "channel_interpretation": "speakers",
            "max_channel_count": 2,
            "number_of_inputs": 1,
            "number_of_outputs": 0
        }
    
    def _generate_fonts_list(self) -> list:
        """生成字体列表"""
        return [
            "Arial", "Arial Black", "Arial Narrow", "Calibri", "Cambria",
            "Comic Sans MS", "Courier New", "Georgia", "Impact", "Times New Roman",
            "Trebuchet MS", "Verdana", "Webdings", "Wingdings", "Segoe UI",
            "Microsoft YaHei", "SimSun", "SimHei"
        ]
    
    def generate_stealth_script(self) -> str:
        """生成反检测注入脚本"""
        script = """
        // Canvas指纹注入
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type) {
            if (this.width === 220 && this.height === 30) {
                // 指纹识别Canvas，返回固定值
                return "data:image/png;base64,FAKE_CANVAS_FINGERPRINT";
            }
            return originalToDataURL.call(this, type);
        };
        
        // WebGL指纹注入
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            const params = {
                37445: "Google Inc. (NVIDIA)",  // UNMASKED_VENDOR_WEBGL
                37446: "ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11 vs_5_0 ps_5_0, D3D11)"  // UNMASKED_RENDERER_WEBGL
            };
            return params[parameter] || getParameter.call(this, parameter);
        };
        
        // AudioContext指纹注入
        const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
        AudioContext.prototype.createAnalyser = function() {
            const analyser = originalCreateAnalyser.call(this);
            // 修改analyser属性...
            return analyser;
        };
        
        // 禁用WebRTC
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        
        // 覆盖plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [
                {name: "Chrome PDF Plugin", filename: "internal-pdf-viewer"},
                {name: "Native Client", filename: "native-client.nmf"}
            ]
        });
        
        // 覆盖languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ["zh-CN", "zh", "en"]
        });
        """
        
        return script

# 使用示例
# fingerprinter = BrowserFingerprinter()
# stealth_script = fingerprinter.generate_stealth_script()
```

#### 17.4 WebRTC IP欺骗

```python
class WebRTCSpoofer:
    """WebRTC IP欺骗"""
    
    @staticmethod
    def generate_webrtc_block_script() -> str:
        """生成禁用WebRTC的脚本"""
        return """
        // 禁用WebRTC
        const originalRTCPeerConnection = window.RTCPeerConnection || 
                                          window.mozRTCPeerConnection || 
                                          window.webkitRTCPeerConnection;
        
        if (originalRTCPeerConnection) {
            window.RTCPeerConnection = function(...args) {
                const pc = new originalRTCPeerConnection(...args);
                
                // 覆盖createDataChannel
                const originalCreateDataChannel = pc.createDataChannel.bind(pc);
                pc.createDataChannel = function(...args) {
                    return originalCreateDataChannel(...args);
                };
                
                // 覆盖addIceCandidate
                const originalAddIceCandidate = pc.addIceCandidate.bind(pc);
                pc.addIceCandidate = function(candidate) {
                    if (candidate && candidate.candidate) {
                        // 可以在这里过滤或修改candidate
                        if (candidate.candidate.includes("typ host")) {
                            return Promise.resolve();
                        }
                    }
                    return originalAddIceCandidate(candidate);
                };
                
                return pc;
            };
            
            // 复制静态属性
            Object.setPrototypeOf(window.RTCPeerConnection, originalRTCPeerConnection);
            window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
        }
        
        // 禁用getUserMedia
        if (navigator.mediaDevices) {
            navigator.mediaDevices.getUserMedia = function() {
                return Promise.reject(new Error("getUserMedia is not supported"));
            };
        }
        """
    
    @staticmethod
    def generate_webrtc_spoof_script(fake_ips: list) -> str:
        """
        生成WebRTC IP欺骗脚本
        
        Args:
            fake_ips: 伪造的IP地址列表
        """
        ips_json = str(fake_ips).replace("'", '"')
        
        return f"""
        // WebRTC IP欺骗
        const fakeIPs = {ips_json};
        
        const originalCreateOffer = RTCPeerConnection.prototype.createOffer;
        RTCPeerConnection.prototype.createOffer = function() {{
            return originalCreateOffer.apply(this, arguments).then(offer => {{
                // 修改SDP中的IP地址
                fakeIPs.forEach(ip => {{
                    offer.sdp = offer.sdp.replace(/\\d+\\.\\d+\\.\\d+\\.\\d+/g, ip);
                }});
                return offer;
            }});
        }};
        """

# 使用示例
# block_script = WebRTCSpoofer.generate_webrtc_block_script()
# spoof_script = WebRTCSpoofer.generate_webrtc_spoof_script(["192.168.1.100"])
```

#### 17.5 四维身份一致性

```python
class IdentityConsistency:
    """
    四维身份一致性管理
    IP - TLS指纹 - 浏览器指纹 - 行为模式 必须一致
    """
    
    def __init__(self, ip_info: dict = None):
        self.identity = {
            "ip": ip_info or {},
            "tls": {},
            "browser": {},
            "behavior": {}
        }
        
        self._generate_consistent_identity()
    
    def _generate_consistent_identity(self):
        """生成一致的身份配置"""
        # 根据IP地理位置生成匹配的时区和语言
        if self.identity["ip"].get("country") == "CN":
            self.identity["browser"]["timezone"] = "Asia/Shanghai"
            self.identity["browser"]["locale"] = "zh-CN"
            self.identity["browser"]["languages"] = ["zh-CN", "zh", "en"]
        else:
            self.identity["browser"]["timezone"] = "America/New_York"
            self.identity["browser"]["locale"] = "en-US"
            self.identity["browser"]["languages"] = ["en-US", "en"]
        
        # 生成匹配的User-Agent
        self.identity["browser"]["user_agent"] = (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
        
        # 生成匹配的TLS指纹
        self.identity["tls"]["ja3"] = "chrome_120"
        self.identity["tls"]["http2_settings"] = {
            "SETTINGS_HEADER_TABLE_SIZE": 65536,
            "SETTINGS_ENABLE_PUSH": 1,
            "SETTINGS_MAX_CONCURRENT_STREAMS": 1000
        }
        
        # 生成匹配的行为模式
        self.identity["behavior"]["typing_speed"] = {
            "min_delay": 50,
            "max_delay": 200,
            "error_rate": 0.02
        }
        self.identity["behavior"]["mouse_speed"] = {
            "min_speed": 200,
            "max_speed": 800
        }
    
    def apply_to_playwright_context(self, context):
        """应用到Playwright上下文"""
        context.set_extra_http_headers({
            "Accept-Language": ",".join(self.identity["browser"]["languages"])
        })
        
        context.add_init_script(f"""
            Object.defineProperty(navigator, 'language', {{
                get: () => '{self.identity["browser"]["locale"]}'
            }});
            Object.defineProperty(navigator, 'languages', {{
                get: () => {self.identity["browser"]["languages"]}
            }});
        """)
    
    def apply_to_curl_cffi(self, session):
        """应用到curl_cffi会话"""
        session.headers["Accept-Language"] = ",".join(
            self.identity["browser"]["languages"]
        )

# 使用示例
# identity = IdentityConsistency({"country": "CN", "city": "Beijing"})
# identity.apply_to_playwright_context(context)
```

### 实战技巧

1. **指纹检测**: 使用 https://browserleaks.com/ 检测指纹泄露
2. **一致性检查**: 确保IP地理位置、时区、语言一致
3. **Canvas噪声**: 添加轻微噪声避免相同Canvas指纹
4. **WebRTC禁用**: 除非必要，否则禁用WebRTC防止IP泄露
5. **定期轮换**: 定期更换指纹配置，避免长期固定

---

## 模块18: 代理完整体系

### 概述
代理体系是爬虫的基础设施。从住宅代理到ISP代理，不同场景选择不同类型的代理。

### 代理类型对比

| 类型 | 隐蔽性 | 速度 | 价格 | 适用场景 |
|------|--------|------|------|---------|
| **住宅代理** | ★★★★★ | ★★★☆☆ | $$$ | 社交媒体、电商 |
| **ISP代理** | ★★★★★ | ★★★★☆ | $$ | 高防护网站 |
| **数据中心** | ★★☆☆☆ | ★★★★★ | $ | 低防护网站 |
| **移动代理** | ★★★★★ | ★★★☆☆ | $$$$ | APP采集 |
| **Tor代理** | ★★★★★ | ★☆☆☆☆ | 免费 | 匿名采集 |

### 代码示例

#### 18.1 站大爷代理配置（用户已购）

```python
class ZhanDaYeProxy:
    """站大爷代理管理"""
    
    # 用户已购站大爷配置
    CONFIG = {
        "account": "202604010132402473",
        "password": "tx7zey05",
        "main_host": "a216.zdtps.com",
        "backup_host": "a963.zdtps.com",
        "http_port": 21166,
        "socks5_port": 31166
    }
    
    @classmethod
    def get_http_proxy(cls, use_backup: bool = False) -> str:
        """获取HTTP代理地址"""
        host = cls.CONFIG["backup_host"] if use_backup else cls.CONFIG["main_host"]
        return f"http://{cls.CONFIG['account']}:{cls.CONFIG['password']}@{host}:{cls.CONFIG['http_port']}"
    
    @classmethod
    def get_socks5_proxy(cls, use_backup: bool = False) -> str:
        """获取SOCKS5代理地址"""
        host = cls.CONFIG["backup_host"] if use_backup else cls.CONFIG["main_host"]
        return f"socks5://{cls.CONFIG['account']}:{cls.CONFIG['password']}@{host}:{cls.CONFIG['socks5_port']}"
    
    @classmethod
    def get_proxy_dict(cls, use_backup: bool = False) -> dict:
        """获取代理字典（requests格式）"""
        proxy = cls.get_http_proxy(use_backup)
        return {
            "http": proxy,
            "https": proxy
        }

# 使用示例
# proxy = ZhanDaYeProxy.get_http_proxy()
# proxies = ZhanDaYeProxy.get_proxy_dict()
```

#### 18.2 智能代理选择器

```python
import random
from enum import Enum

class ProxyType(Enum):
    DATACENTER = "datacenter"
    RESIDENTIAL = "residential"
    ISP = "isp"
    MOBILE = "mobile"
    TOR = "tor"
    ZHANDAYE = "zhandaye"

class SmartProxySelector:
    """智能代理选择器"""
    
    def __init__(self):
        self.proxies = {
            ProxyType.ZHANDAYE: [
                ZhanDaYeProxy.get_http_proxy(),
                ZhanDaYeProxy.get_http_proxy(use_backup=True)
            ],
            ProxyType.ISP: [],  # 用户可添加ISP代理
            ProxyType.RESIDENTIAL: [],  # 用户可添加住宅代理
            ProxyType.DATACENTER: [],  # 用户可添加数据中心代理
        }
        
        self.failure_counts = {proxy_type: 0 for proxy_type in ProxyType}
        self.usage_counts = {proxy_type: 0 for proxy_type in ProxyType}
    
    def select_proxy(self, target_url: str, strategy: str = "auto") -> tuple:
        """
        选择代理
        
        Args:
            target_url: 目标URL
            strategy: 选择策略 (auto/stealth/speed/cost)
        
        Returns:
            (proxy_url, proxy_type)
        """
        if strategy == "auto":
            strategy = self._analyze_target(target_url)
        
        if strategy == "stealth":
            # 高隐蔽性需求
            proxy_type = ProxyType.ZHANDAYE
        elif strategy == "speed":
            # 速度优先
            proxy_type = ProxyType.DATACENTER
        elif strategy == "cost":
            # 成本优先 - 使用已购站大爷
            proxy_type = ProxyType.ZHANDAYE
        else:
            # 默认轮换
            proxy_type = self._get_best_proxy_type()
        
        proxy = self._get_proxy_from_pool(proxy_type)
        self.usage_counts[proxy_type] += 1
        
        return proxy, proxy_type
    
    def _analyze_target(self, url: str) -> str:
        """分析目标网站选择策略"""
        high_protection_domains = [
            "meituan.com", "jd.com", "taobao.com", "tmall.com",
            "douyin.com", "xiaohongshu.com"
        ]
        
        for domain in high_protection_domains:
            if domain in url:
                return "stealth"
        
        return "auto"
    
    def _get_best_proxy_type(self) -> ProxyType:
        """获取最佳代理类型"""
        # 优先使用失败次数少的
        sorted_types = sorted(
            [pt for pt in ProxyType if self.proxies.get(pt)],
            key=lambda pt: self.failure_counts[pt]
        )
        
        return sorted_types[0] if sorted_types else ProxyType.ZHANDAYE
    
    def _get_proxy_from_pool(self, proxy_type: ProxyType) -> str:
        """从代理池获取代理"""
        pool = self.proxies.get(proxy_type, [])
        if pool:
            return random.choice(pool)
        
        # 回退到站大爷
        return random.choice(self.proxies[ProxyType.ZHANDAYE])
    
    def record_failure(self, proxy_type: ProxyType):
        """记录代理失败"""
        self.failure_counts[proxy_type] += 1
    
    def record_success(self, proxy_type: ProxyType):
        """记录代理成功"""
        self.failure_counts[proxy_type] = max(0, self.failure_counts[proxy_type] - 1)

# 使用示例
# selector = SmartProxySelector()
# proxy, proxy_type = selector.select_proxy("https://meituan.com")
```

#### 18.3 代理健康检查与轮换

```python
import asyncio
import aiohttp
import time
from typing import List, Dict

class ProxyHealthChecker:
    """代理健康检查器"""
    
    def __init__(self, check_url: str = "http://httpbin.org/ip"):
        self.check_url = check_url
        self.proxy_status: Dict[str, dict] = {}
    
    async def check_proxy(self, proxy: str, timeout: int = 10) -> dict:
        """检查单个代理"""
        start_time = time.time()
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    self.check_url,
                    proxy=proxy,
                    timeout=aiohttp.ClientTimeout(total=timeout)
                ) as response:
                    
                    latency = time.time() - start_time
                    
                    if response.status == 200:
                        data = await response.json()
                        return {
                            "proxy": proxy,
                            "status": "healthy",
                            "latency": latency,
                            "ip": data.get("origin", "unknown"),
                            "response_code": response.status
                        }
                    else:
                        return {
                            "proxy": proxy,
                            "status": "unhealthy",
                            "latency": latency,
                            "response_code": response.status
                        }
        except Exception as e:
            return {
                "proxy": proxy,
                "status": "failed",
                "error": str(e)
            }
    
    async def check_proxies_batch(self, proxies: List[str]) -> List[dict]:
        """批量检查代理"""
        tasks = [self.check_proxy(proxy) for proxy in proxies]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        valid_results = []
        for result in results:
            if isinstance(result, dict):
                valid_results.append(result)
                self.proxy_status[result["proxy"]] = result
        
        return valid_results
    
    def get_healthy_proxies(self) -> List[str]:
        """获取健康代理列表"""
        healthy = []
        for proxy, status in self.proxy_status.items():
            if status.get("status") == "healthy":
                healthy.append(proxy)
        return healthy
    
    def get_proxy_stats(self) -> dict:
        """获取代理统计"""
        total = len(self.proxy_status)
        healthy = sum(1 for s in self.proxy_status.values() if s.get("status") == "healthy")
        unhealthy = sum(1 for s in self.proxy_status.values() if s.get("status") == "unhealthy")
        failed = sum(1 for s in self.proxy_status.values() if s.get("status") == "failed")
        
        return {
            "total": total,
            "healthy": healthy,
            "unhealthy": unhealthy,
            "failed": failed,
            "healthy_rate": healthy / total if total > 0 else 0
        }

# 使用示例
# checker = ProxyHealthChecker()
# results = asyncio.run(checker.check_proxies_batch(["http://proxy1:8080", "http://proxy2:8080"]))
```

### 实战技巧

1. **分层使用**: 低防用数据中心，中防用站大爷，高防用ISP
2. **健康检查**: 定期检查代理可用性，自动剔除失效代理
3. **失败切换**: 单个代理失败自动切换到备用
4. **地理位置**: 选择与目标网站用户群匹配的地理位置
5. **会话保持**: 同一任务使用相同代理，避免会话中断

---

## 模块19: 行为模拟

### 概述
行为模拟是绕过行为分析检测的关键。通过模拟人类鼠标轨迹、键盘输入、浏览模式，可以欺骗ML检测模型。

### 代码示例

#### 19.1 贝塞尔曲线鼠标轨迹

```python
import numpy as np
from scipy.interpolate import CubicSpline
import random

class MouseTrajectoryGenerator:
    """鼠标轨迹生成器"""
    
    @staticmethod
    def generate_bezier_curve(start: tuple, end: tuple, 
                               control_points: int = 3,
                               num_points: int = 100) -> list:
        """
        生成贝塞尔曲线轨迹
        
        Args:
            start: 起点 (x, y)
            end: 终点 (x, y)
            control_points: 控制点数量
            num_points: 轨迹点数量
        """
        # 生成随机控制点
        points = [start]
        
        for i in range(control_points):
            # 控制点在起点和终点之间随机分布
            t = (i + 1) / (control_points + 1)
            x = start[0] + (end[0] - start[0]) * t + random.uniform(-50, 50)
            y = start[1] + (end[1] - start[1]) * t + random.uniform(-50, 50)
            points.append((x, y))
        
        points.append(end)
        
        # 生成曲线
        t = np.linspace(0, 1, num_points)
        xs = CubicSpline(range(len(points)), [p[0] for p in points])(t * (len(points)-1))
        ys = CubicSpline(range(len(points)), [p[1] for p in points])(t * (len(points)-1))
        
        # 添加时间戳
        trajectory = []
        for i in range(num_points):
            trajectory.append({
                "x": int(xs[i]),
                "y": int(ys[i]),
                "timestamp": i * random.uniform(8, 12)  # 每点8-12ms
            })
        
        return trajectory
    
    @staticmethod
    def generate_humanized_trajectory(start: tuple, end: tuple) -> list:
        """
        生成人性化轨迹（带加速度和停顿）
        """
        distance = np.sqrt((end[0] - start[0])**2 + (end[1] - start[1])**2)
        
        # 根据距离计算点数
        num_points = int(distance / 5)  # 每5像素一个点
        num_points = max(20, min(num_points, 200))
        
        trajectory = MouseTrajectoryGenerator.generate_bezier_curve(
            start, end, num_points=num_points
        )
        
        # 添加随机停顿
        pause_indices = random.sample(range(1, len(trajectory)-1), 
                                      min(3, len(trajectory)//10))
        
        for idx in sorted(pause_indices, reverse=True):
            pause_duration = random.uniform(50, 200)  # 50-200ms停顿
            for i in range(idx, len(trajectory)):
                trajectory[i]["timestamp"] += pause_duration
        
        # 添加微动（overshoot后回正）
        if random.random() < 0.3:  # 30%概率微动
            overshoot_x = end[0] + random.uniform(-10, 10)
            overshoot_y = end[1] + random.uniform(-10, 10)
            
            trajectory.append({"x": int(overshoot_x), "y": int(overshoot_y), 
                             "timestamp": trajectory[-1]["timestamp"] + random.uniform(20, 50)})
            trajectory.append({"x": end[0], "y": end[1], 
                             "timestamp": trajectory[-1]["timestamp"] + random.uniform(20, 50)})
        
        return trajectory

# 使用示例
# trajectory = MouseTrajectoryGenerator.generate_humanized_trajectory((100, 200), (500, 400))
```

#### 19.2 LSTM行为序列生成

```python
import numpy as np

class LSTMBehaviorGenerator:
    """
    LSTM行为序列生成器
    模拟人类浏览行为的时间序列
    """
    
    def __init__(self):
        # 人类行为参数分布
        self.scroll_delays = {
            "mean": 2.5,
            "std": 1.2
        }
        self.reading_times = {
            "mean": 15.0,
            "std": 8.0
        }
        self.click_delays = {
            "mean": 0.8,
            "std": 0.4
        }
    
    def generate_scroll_sequence(self, num_scrolls: int = 10) -> list:
        """生成滚动序列"""
        sequence = []
        
        for i in range(num_scrolls):
            # 滚动距离（模拟人类不均匀滚动）
            scroll_distance = int(np.random.exponential(300) + 100)
            
            # 滚动前停顿
            delay_before = max(0.5, np.random.normal(
                self.scroll_delays["mean"], 
                self.scroll_delays["std"]
            ))
            
            # 滚动后阅读时间
            reading_time = max(3, np.random.normal(
                self.reading_times["mean"],
                self.reading_times["std"]
            ))
            
            sequence.append({
                "action": "scroll",
                "distance": scroll_distance,
                "delay_before": delay_before,
                "reading_time": reading_time
            })
        
        return sequence
    
    def generate_browsing_session(self, duration: float = 60.0) -> list:
        """生成浏览会话"""
        session = []
        elapsed = 0.0
        
        while elapsed < duration:
            # 随机选择行为
            action_type = np.random.choice(
                ["scroll", "click", "hover", "pause"],
                p=[0.5, 0.2, 0.2, 0.1]
            )
            
            if action_type == "scroll":
                action = {
                    "action": "scroll",
                    "distance": int(np.random.exponential(400) + 200),
                    "duration": max(0.3, np.random.normal(0.5, 0.2))
                }
                elapsed += action["duration"] + np.random.exponential(2)
            
            elif action_type == "click":
                action = {
                    "action": "click",
                    "delay_before": max(0.2, np.random.normal(0.8, 0.4)),
                    "hold_duration": max(0.05, np.random.normal(0.1, 0.05))
                }
                elapsed += action["delay_before"] + action["hold_duration"]
            
            elif action_type == "hover":
                action = {
                    "action": "hover",
                    "duration": max(0.5, np.random.exponential(2))
                }
                elapsed += action["duration"]
            
            else:  # pause
                action = {
                    "action": "pause",
                    "duration": max(1, np.random.exponential(5))
                }
                elapsed += action["duration"]
            
            session.append(action)
        
        return session

# 使用示例
# generator = LSTMBehaviorGenerator()
# session = generator.generate_browsing_session(120)
```

#### 19.3 人性化键盘输入

```python
import random
import asyncio

class HumanizedTyping:
    """人性化键盘输入"""
    
    # 按键间隔分布（毫秒）
    KEY_DELAYS = {
        "normal": (30, 150),
        "fast": (20, 80),
        "slow": (100, 300)
    }
    
    # 打字错误率
    ERROR_RATE = 0.02
    
    # 常见打字错误映射
    TYPO_MAP = {
        'a': 's', 's': 'a', 'd': 's', 'f': 'd', 'g': 'f',
        'q': 'w', 'w': 'q', 'e': 'r', 'r': 'e', 't': 'r',
        'z': 'x', 'x': 'z', 'c': 'x', 'v': 'c', 'b': 'v'
    }
    
    @staticmethod
    async def type_like_human(page, selector: str, text: str, 
                              speed: str = "normal"):
        """
        模拟人类输入
        
        Args:
            page: Playwright页面对象
            selector: 输入框选择器
            text: 要输入的文本
            speed: 输入速度 (normal/fast/slow)
        """
        delay_range = HumanizedTyping.KEY_DELAYS[speed]
        
        for i, char in enumerate(text):
            # 偶尔停顿（思考时间）
            if random.random() < 0.05:
                await asyncio.sleep(random.uniform(0.5, 2.0))
            
            # 偶尔打错字并删除
            if random.random() < HumanizedTyping.ERROR_RATE and char in HumanizedTyping.TYPO_MAP:
                # 输入错误字符
                typo = HumanizedTyping.TYPO_MAP[char]
                await page.type(selector, typo, delay=random.uniform(*delay_range))
                await asyncio.sleep(random.uniform(0.1, 0.3))
                
                # 删除错误字符
                await page.press(selector, "Backspace")
                await asyncio.sleep(random.uniform(0.1, 0.3))
            
            # 输入正确字符
            await page.type(selector, char, delay=random.uniform(*delay_range))
            
            # 长词后短暂停顿
            if char in [' ', '.', ',', '?', '!']:
                await asyncio.sleep(random.uniform(0.1, 0.5))
    
    @staticmethod
    def generate_typing_pattern(text: str) -> list:
        """生成打字模式（用于分析）"""
        pattern = []
        
        for char in text:
            delay = random.uniform(30, 150)
            
            # 偶尔打错
            if random.random() < HumanizedTyping.ERROR_RATE:
                pattern.append({
                    "char": HumanizedTyping.TYPO_MAP.get(char, char),
                    "delay": delay,
                    "is_error": True
                })
                pattern.append({
                    "action": "backspace",
                    "delay": random.uniform(100, 300)
                })
            
            pattern.append({
                "char": char,
                "delay": delay,
                "is_error": False
            })
        
        return pattern

# 使用示例
# await HumanizedTyping.type_like_human(page, "#input", "Hello World")
```

#### 19.4 GAN对抗ML检测

```python
import numpy as np

class GANBehaviorSimulator:
    """
    GAN行为模拟器
    生成通过ML检测的行为序列
    """
    
    def __init__(self):
        self.latent_dim = 100
        self.seq_length = 50
    
    def generate_behavior_sequence(self) -> np.ndarray:
        """
        生成行为序列
        
        Returns:
            行为序列数组 [seq_length, 3] (x, y, timestamp)
        """
        # 生成随机噪声
        noise = np.random.normal(0, 1, (self.latent_dim,))
        
        # 模拟生成器网络（简化版）
        # 实际应使用训练好的GAN模型
        
        # 生成基础轨迹
        t = np.linspace(0, 1, self.seq_length)
        
        # X坐标：带噪声的线性增长
        x = t * 800 + np.random.normal(0, 20, self.seq_length)
        
        # Y坐标：带噪声的正弦波
        y = 400 + 100 * np.sin(t * 4 * np.pi) + np.random.normal(0, 15, self.seq_length)
        
        # 时间戳：非均匀分布（人类行为不均匀）
        timestamps = np.cumsum(np.random.exponential(10, self.seq_length))
        
        sequence = np.column_stack([x, y, timestamps])
        
        return sequence
    
    def add_adversarial_noise(self, sequence: np.ndarray, epsilon: float = 0.1) -> np.ndarray:
        """
        添加对抗噪声
        
        Args:
            sequence: 原始行为序列
            epsilon: 噪声强度
        """
        noise = np.random.normal(0, epsilon, sequence.shape)
        adversarial_sequence = sequence + noise
        
        return adversarial_sequence
    
    def evaluate_human_likeness(self, sequence: np.ndarray) -> float:
        """
        评估行为的人类相似度
        
        Returns:
            相似度分数 0-1
        """
        # 计算速度变化
        velocities = np.diff(sequence[:, :2], axis=0)
        speed_changes = np.diff(np.linalg.norm(velocities, axis=1))
        
        # 人类行为特征：速度变化不剧烈
        speed_variance = np.var(speed_changes)
        
        # 计算停顿次数
        time_diffs = np.diff(sequence[:, 2])
        pauses = np.sum(time_diffs > 100)  # 超过100ms视为停顿
        
        # 综合评分
        score = 1.0 - min(1.0, speed_variance / 1000)  # 速度变化越小越好
        score *= min(1.0, pauses / 5)  # 有一定停顿更好
        
        return score

# 使用示例
# simulator = GANBehaviorSimulator()
# sequence = simulator.generate_behavior_sequence()
# score = simulator.evaluate_human_likeness(sequence)
```

### 实战技巧

1. **轨迹多样性**: 避免使用固定模式，每次生成不同轨迹
2. **速度变化**: 人类移动速度不均匀，有加速和减速
3. **停顿模拟**: 随机停顿模拟人类思考和阅读
4. **错误模拟**: 偶尔打错字、点错位置更符合人类行为
5. **时间分布**: 行为时间符合人类作息规律

---

## 模块20: 中国平台针对性破解

### 概述
中国平台（美团、京东、淘宝、拼多多、抖音、小红书）有独特的反爬体系，需要针对性破解方案。

### 各平台反爬体系

| 平台 | 核心防护 | 破解难度 |
|------|---------|---------|
| **美团** | mtgsig + waimai_sign + 设备指纹 | ★★★★★ |
| **京东** | DFPID + XID + sign + 滑块 | ★★★★☆ |
| **淘宝** | x-sign + x-mini-wua + x-umt | ★★★★★ |
| **拼多多** | anti-content + X-Bogus | ★★★☆☆ |
| **抖音** | _signature + X-Bogus + msToken | ★★★★☆ |
| **小红书** | x-s签名 + 原型链补环境 | ★★★☆☆ |

### 代码示例

#### 20.1 美团 mtgsig + waimai_sign

```python
import hashlib
import json
import time
import requests
import base64
from urllib.parse import quote

class MeituanScraper:
    """美团采集器"""
    
    def __init__(self, cookies: str = None):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://i.waimai.meituan.com/"
        })
        
        if cookies:
            self.session.headers["Cookie"] = cookies
    
    def generate_waimai_sign(self, path: str, params: dict, secret_key: str = None) -> str:
        """
        生成waimai_sign
        
        注意: 这是简化示例，实际算法需要逆向JS获取
        waimai_sign通常是RSA签名或HMAC签名
        """
        # 构建签名字符串
        timestamp = str(int(time.time() * 1000))
        
        sign_str = f"{path}|{timestamp}|{json.dumps(params, separators=(',', ':'))}"
        
        if secret_key:
            # HMAC签名
            import hmac
            sign = hmac.new(
                secret_key.encode(),
                sign_str.encode(),
                hashlib.sha256
            ).hexdigest()
        else:
            # MD5签名（简化）
            sign = hashlib.md5(sign_str.encode()).hexdigest()
        
        return sign, timestamp
    
    def generate_mtgsig(self, url: str, params: dict) -> str:
        """
        生成mtgsig
        
        注意: mtgsig是美团的顶级防护，需要完整逆向JSVMP
        这里提供调用已逆向算法的接口
        """
        # 实际实现需要:
        # 1. 逆向mtgsig 3.1.0的JSVMP代码
        # 2. 补全浏览器环境
        # 3. 提取签名算法
        
        # 简化示例
        sign_str = f"{url}{json.dumps(params, sort_keys=True)}"
        return hashlib.md5(sign_str.encode()).hexdigest()
    
    def search_shops(self, keyword: str, lat: float, lng: float):
        """搜索商家"""
        url = "https://i.waimai.meituan.com/openh5/homepage/poilist"
        
        params = {
            "geoType": "2",
            "cityId": "1",
            "lat": lat,
            "lng": lng,
            "keyword": keyword,
            "page": 1,
            "pageSize": 20
        }
        
        # 生成签名
        sign, timestamp = self.generate_waimai_sign("/openh5/homepage/poilist", params)
        
        headers = {
            "waimai_sign": sign,
            "waimai_timestamp": timestamp
        }
        
        response = self.session.get(url, params=params, headers=headers)
        return response.json()

# 使用示例
# scraper = MeituanScraper(cookies="YOUR_COOKIES")
# shops = scraper.search_shops("火锅", 39.9, 116.4)
```

#### 20.2 京东 DFPID + XID + sign

```python
import hashlib
import json
import time
import requests
import random

class JDScraper:
    """京东采集器"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://item.m.jd.com/"
        })
        
        # 设备指纹池
        self.device_pool = self._generate_device_pool()
    
    def _generate_device_pool(self, size: int = 10) -> list:
        """生成设备指纹池"""
        pool = []
        
        for _ in range(size):
            device = {
                "dfpid": self._generate_dfpid(),
                "xid": self._generate_xid(),
                "bncode": self._generate_bncode(),
                "uuid": self._generate_uuid()
            }
            pool.append(device)
        
        return pool
    
    def _generate_dfpid(self) -> str:
        """生成DFPID"""
        return hashlib.md5(str(time.time()).encode()).hexdigest()[:16]
    
    def _generate_xid(self) -> str:
        """生成XID"""
        return hashlib.sha256(str(random.random()).encode()).hexdigest()[:32]
    
    def _generate_bncode(self) -> str:
        """生成bncode"""
        return base64.b64encode(str(random.random()).encode()).decode()[:20]
    
    def _generate_uuid(self) -> str:
        """生成UUID"""
        return "1" + str(int(time.time() * 1000))[-14:] + str(random.randint(1000, 9999))
    
    def generate_sign(self, function_id: str, body: dict, uuid: str) -> tuple:
        """
        生成京东sign
        
        算法: MD5(functionId=xxx&body=xxx&uuid=xxx&client=m&clientVersion=xxx&t=xxx&appid=xxx)
        """
        body_str = json.dumps(body, separators=(',', ':'))
        body_encoded = quote(body_str, safe='')
        
        timestamp = str(int(time.time() * 1000))
        
        sign_str = f"functionId={function_id}&body={body_encoded}&uuid={uuid}&client=m&clientVersion=12.0.0&t={timestamp}&appid=item-view&token="
        
        sign = hashlib.md5(sign_str.encode()).hexdigest()
        
        return sign, timestamp
    
    def get_sku_info(self, sku_id: str, proxy: str = None):
        """获取商品信息"""
        device = random.choice(self.device_pool)
        
        function_id = "getWareBusiness"
        body = {
            "skuId": sku_id,
            "catId": "",
            "areaId": "19_1601_50258_51885"
        }
        
        sign, timestamp = self.generate_sign(function_id, body, device["uuid"])
        
        params = {
            "appid": "item-view",
            "functionId": function_id,
            "client": "m",
            "clientVersion": "12.0.0",
            "uuid": device["uuid"],
            "t": timestamp,
            "sign": sign,
            "body": json.dumps(body, separators=(',', ':'))
        }
        
        headers = {
            "X-DFP-ID": device["dfpid"],
            "X-ID": device["xid"]
        }
        
        proxies = {"http": proxy, "https": proxy} if proxy else None
        
        response = self.session.get(
            "https://api.m.jd.com/api",
            params=params,
            headers=headers,
            proxies=proxies,
            timeout=10
        )
        
        return response.json()

# 使用示例
# scraper = JDScraper()
# info = scraper.get_sku_info("100012043978")
```

#### 20.3 淘宝 x-sign + x-mini-wua + x-umt

```python
import hashlib
import json
import time
import requests
import hmac

class TaobaoScraper:
    """淘宝采集器"""
    
    def __init__(self, cookies: str = None):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://h5.m.taobao.com/"
        })
        
        if cookies:
            self.session.headers["Cookie"] = cookies
    
    def generate_x_sign(self, params: dict, secret: str = None) -> str:
        """
        生成x-sign
        
        注意: 淘宝签名算法复杂，需要完整逆向
        """
        # 排序参数
        sorted_params = sorted(params.items())
        sign_str = "&".join([f"{k}={v}" for k, v in sorted_params])
        
        if secret:
            sign = hmac.new(secret.encode(), sign_str.encode(), hashlib.sha256).hexdigest()
        else:
            sign = hashlib.md5(sign_str.encode()).hexdigest()
        
        return sign
    
    def generate_x_mini_wua(self, params: dict) -> str:
        """生成x-mini-wua"""
        # 设备指纹相关
        timestamp = int(time.time() * 1000)
        
        wua_data = {
            "t": timestamp,
            "r": random.randint(100000, 999999)
        }
        
        return base64.b64encode(json.dumps(wua_data).encode()).decode()
    
    def search_items(self, keyword: str, page: int = 1):
        """搜索商品"""
        url = "https://h5api.m.taobao.com/h5/mtop.taobao.search.api/1.0/"
        
        params = {
            "jsv": "2.6.1",
            "appKey": "12574478",
            "t": int(time.time() * 1000),
            "api": "mtop.taobao.search.api",
            "v": "1.0",
            "type": "jsonp",
            "dataType": "jsonp",
            "callback": "mtopjsonp1",
            "data": json.dumps({
                "q": keyword,
                "page": page,
                "pageSize": 20
            })
        }
        
        # 生成签名
        x_sign = self.generate_x_sign(params)
        
        headers = {
            "x-sign": x_sign,
            "x-mini-wua": self.generate_x_mini_wua(params)
        }
        
        response = self.session.get(url, params=params, headers=headers)
        return response.text

# 使用示例
# scraper = TaobaoScraper(cookies="YOUR_COOKIES")
# items = scraper.search_items("iPhone")
```

#### 20.4 拼多多 anti-content + X-Bogus

```python
import hashlib
import json
import time
import requests

class PDDScraper:
    """拼多多采集器"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://mobile.yangkeduo.com/"
        })
    
    def generate_anti_content(self, page_url: str) -> str:
        """
        生成anti-content
        
        注意: 拼多多anti-content是AES加密，需要逆向JS获取密钥
        """
        # 简化示例
        data = {
            "page": page_url,
            "t": int(time.time() * 1000)
        }
        
        # 实际应使用AES加密
        return base64.b64encode(json.dumps(data).encode()).decode()
    
    def generate_x_bogus(self, params: dict) -> str:
        """
        生成X-Bogus
        
        算法: 字符编码+位移运算（已破解）
        """
        # 简化示例
        param_str = json.dumps(params, sort_keys=True)
        
        # 实际算法涉及复杂的位运算
        return hashlib.md5(param_str.encode()).hexdigest()[:21]
    
    def search_goods(self, keyword: str, page: int = 1):
        """搜索商品"""
        url = "https://mobile.yangkeduo.com/proxy/api/search"
        
        params = {
            "q": keyword,
            "page": page,
            "size": 20,
            "list_id": hashlib.md5(str(time.time()).encode()).hexdigest()[:16]
        }
        
        # 生成X-Bogus
        x_bogus = self.generate_x_bogus(params)
        params["X-Bogus"] = x_bogus
        
        headers = {
            "anti-content": self.generate_anti_content(f"search?q={keyword}")
        }
        
        response = self.session.get(url, params=params, headers=headers)
        return response.json()

# 使用示例
# scraper = PDDScraper()
# goods = scraper.search_goods("手机")
```

#### 20.5 抖音 _signature + X-Bogus + msToken

```python
import hashlib
import json
import time
import requests
import random

class DouyinScraper:
    """抖音采集器"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.douyin.com/"
        })
    
    def generate_signature(self, params: dict) -> str:
        """
        生成_signature
        
        算法: 字符编码+位移运算（已破解，GitHub有开源实现）
        """
        # 简化示例
        param_str = "&".join([f"{k}={v}" for k, v in sorted(params.items())])
        
        # 实际算法更复杂
        return hashlib.md5(param_str.encode()).hexdigest()
    
    def generate_x_bogus(self, url_params: str, user_agent: str) -> str:
        """生成X-Bogus"""
        # 简化示例
        sign_str = f"{url_params}{user_agent}{int(time.time())}"
        return hashlib.md5(sign_str.encode()).hexdigest()[:21]
    
    def generate_ms_token(self) -> str:
        """生成msToken"""
        return hashlib.md5(str(random.random()).encode()).hexdigest()[:32]
    
    def get_user_videos(self, sec_user_id: str, cursor: int = 0):
        """获取用户视频"""
        url = "https://www.douyin.com/aweme/v1/web/aweme/post/"
        
        params = {
            "sec_user_id": sec_user_id,
            "count": 10,
            "cursor": cursor,
            "msToken": self.generate_ms_token()
        }
        
        # 生成签名
        params_str = "&".join([f"{k}={v}" for k, v in params.items()])
        x_bogus = self.generate_x_bogus(params_str, self.session.headers["User-Agent"])
        params["X-Bogus"] = x_bogus
        
        response = self.session.get(url, params=params)
        return response.json()

# 使用示例
# scraper = DouyinScraper()
# videos = scraper.get_user_videos("MS4wLjABAAAAxxx")
```

#### 20.6 小红书 x-s签名

```python
import hashlib
import json
import time
import requests

class XHSScraper:
    """小红书采集器"""
    
    def __init__(self, cookies: str = None):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
            "Referer": "https://www.xiaohongshu.com/"
        })
        
        if cookies:
            self.session.headers["Cookie"] = cookies
    
    def generate_xs_sign(self, api: str, params: dict = None) -> dict:
        """
        生成x-s签名
        
        注意: 小红书签名需要原型链补环境
        """
        timestamp = str(int(time.time() * 1000))
        
        # 构建签名字符串
        sign_str = api
        if params:
            sign_str += json.dumps(params, separators=(',', ':'), sort_keys=True)
        sign_str += timestamp
        
        # 实际算法需要逆向JS
        x_s = hashlib.md5(sign_str.encode()).hexdigest()
        
        return {
            "X-S": x_s,
            "X-T": timestamp
        }
    
    def get_user_notes(self, user_id: str, page: int = 1):
        """获取用户笔记"""
        api = "/api/sns/web/v1/user_posted"
        
        params = {
            "user_id": user_id,
            "page": page,
            "page_size": 20
        }
        
        # 生成签名
        headers = self.generate_xs_sign(api, params)
        
        url = f"https://www.xiaohongshu.com{api}"
        
        response = self.session.get(url, params=params, headers=headers)
        return response.json()

# 使用示例
# scraper = XHSScraper(cookies="YOUR_COOKIES")
# notes = scraper.get_user_notes("user_id")
```

### 实战技巧

1. **Cookie维护**: 中国平台对Cookie依赖严重，需要维护登录态
2. **设备指纹**: 各平台都有设备指纹检测，需要轮换
3. **签名更新**: 签名算法经常更新，需要持续维护
4. **代理选择**: 优先使用住宅代理或ISP代理
5. **行为模拟**: 模拟真实用户浏览行为，避免被识别

---

## WAF/Bot检测绕过专项

### 概述
WAF（Web应用防火墙）和Bot检测是现代网站的主要防护手段。针对不同WAF，需要不同的绕过策略。

### WAF绕过矩阵

| WAF | 检测方式 | 绕过方案 | 成功率 |
|-----|---------|---------|--------|
| **Cloudflare** | JS Challenge + Turnstile | Patchright + FlareSolverr | 85%+ |
| **DataDome** | 行为分析 + 验证码 | Camoufox + CapSolver | 70%+ |
| **Kasada** | 生物识别 + TLS | ISP代理 + 行为模拟 | 60%+ |
| **Shape Security** | ML行为分析 | GAN行为 + 住宅代理 | 55%+ |
| **Akamai Bot Manager** | 多维度指纹 | 四维一致性 + 优质代理 | 60%+ |
| **PerimeterX/HUMAN** | Canvas + 行为 | Camoufox + 行为模拟 | 65%+ |

### 代码示例

#### Cloudflare绕过

```python
# 方案1: FlareSolverr
from curl_cffi import requests

def bypass_cloudflare_flaresolverr(url: str, flaresolverr_url: str = "http://localhost:8191"):
    """使用FlareSolverr绕过Cloudflare"""
    payload = {
        "cmd": "request.get",
        "url": url,
        "maxTimeout": 60000
    }
    
    response = requests.post(f"{flaresolverr_url}/v1", json=payload)
    result = response.json()
    
    if result.get("status") == "ok":
        return result["solution"]["response"]
    else:
        raise Exception(f"FlareSolverr failed: {result}")

# 方案2: Patchright + Stealth
def bypass_cloudflare_patchright(url: str):
    """使用Patchright绕过Cloudflare"""
    from patchright.sync_api import sync_playwright
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security'
            ]
        )
        
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
        )
        
        page = context.new_page()
        
        # 注入反检测脚本
        page.add_init_script("""
            delete Object.getPrototypeOf(navigator).webdriver;
            window.chrome = { runtime: {} };
        """)
        
        page.goto(url, wait_until="networkidle", timeout=60000)
        
        # 等待CF挑战完成
        for _ in range(30):
            if "cf-browser-verification" not in page.content():
                break
            page.wait_for_timeout(1000)
        
        content = page.content()
        browser.close()
        
        return content
```

#### DataDome绕过

```python
def bypass_datadome(url: str, capsolver_key: str, proxy: str):
    """绕过DataDome"""
    from curl_cffi import requests
    
    # 使用CapSolver解决DataDome验证码
    solver = CapSolver(capsolver_key)
    
    # DataDome通常使用reCAPTCHA或自有验证码
    # 需要先获取site key
    
    session = requests.Session(impersonate="chrome120")
    session.proxies = {"http": proxy, "https": proxy}
    
    # 首次请求获取DataDome cookie
    response = session.get(url)
    
    # 如果触发验证码，使用CapSolver解决
    if "datadome" in response.text.lower():
        # 解决验证码逻辑
        pass
    
    return response.text
```

---

## 分布式架构

### 概述
分布式架构用于大规模、高并发的采集任务。通过任务队列、容器编排，实现弹性伸缩和故障恢复。

### 架构组件

| 组件 | 推荐方案 |
|------|---------|
| 任务队列 | RabbitMQ / Redis / Kafka |
| 爬虫引擎 | Scrapy / Crawlee |
| 容器编排 | Kubernetes |
| 无服务器 | AWS Lambda |
| 数据存储 | MongoDB / PostgreSQL |

### 代码示例

#### 分布式爬虫框架

```python
import asyncio
import json
from typing import List, Dict
from dataclasses import dataclass
from enum import Enum

class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    RETRY = "retry"

@dataclass
class Task:
    id: str
    url: str
    status: TaskStatus
    retry_count: int = 0
    max_retries: int = 3
    result: Dict = None
    error: str = None

class DistributedCrawler:
    """分布式爬虫框架"""
    
    def __init__(self, queue_backend: str = "memory"):
        self.queue_backend = queue_backend
        self.tasks: Dict[str, Task] = {}
        self.results = []
        
        # 初始化队列后端
        if queue_backend == "redis":
            import redis
            self.queue = redis.Redis()
        elif queue_backend == "rabbitmq":
            import pika
            # RabbitMQ初始化
            pass
        else:
            self.queue = []
    
    def add_task(self, url: str, task_id: str = None) -> str:
        """添加任务"""
        import uuid
        
        task_id = task_id or str(uuid.uuid4())
        task = Task(
            id=task_id,
            url=url,
            status=TaskStatus.PENDING
        )
        
        self.tasks[task_id] = task
        
        if self.queue_backend == "memory":
            self.queue.append(task)
        
        return task_id
    
    def add_tasks_batch(self, urls: List[str]):
        """批量添加任务"""
        for url in urls:
            self.add_task(url)
    
    async def worker(self, worker_id: int, scraper_func):
        """工作线程"""
        print(f"[Worker {worker_id}] Started")
        
        while True:
            # 获取任务
            task = await self._get_task()
            
            if not task:
                await asyncio.sleep(1)
                continue
            
            # 更新状态
            task.status = TaskStatus.RUNNING
            
            try:
                # 执行爬取
                result = await scraper_func(task.url)
                
                task.result = result
                task.status = TaskStatus.SUCCESS
                self.results.append(result)
                
                print(f"[Worker {worker_id}] Success: {task.url}")
                
            except Exception as e:
                task.error = str(e)
                task.retry_count += 1
                
                if task.retry_count < task.max_retries:
                    task.status = TaskStatus.RETRY
                    await self._requeue_task(task)
                else:
                    task.status = TaskStatus.FAILED
                
                print(f"[Worker {worker_id}] Failed: {task.url}, Error: {e}")
    
    async def _get_task(self) -> Task:
        """获取任务"""
        if self.queue_backend == "memory":
            if self.queue:
                return self.queue.pop(0)
        
        return None
    
    async def _requeue_task(self, task: Task):
        """重新入队"""
        task.status = TaskStatus.PENDING
        
        if self.queue_backend == "memory":
            self.queue.append(task)
    
    async def run(self, scraper_func, num_workers: int = 5):
        """运行分布式爬虫"""
        workers = [
            self.worker(i, scraper_func)
            for i in range(num_workers)
        ]
        
        await asyncio.gather(*workers)
    
    def get_stats(self) -> dict:
        """获取统计信息"""
        stats = {
            "total": len(self.tasks),
            "pending": sum(1 for t in self.tasks.values() if t.status == TaskStatus.PENDING),
            "running": sum(1 for t in self.tasks.values() if t.status == TaskStatus.RUNNING),
            "success": sum(1 for t in self.tasks.values() if t.status == TaskStatus.SUCCESS),
            "failed": sum(1 for t in self.tasks.values() if t.status == TaskStatus.FAILED),
            "retry": sum(1 for t in self.tasks.values() if t.status == TaskStatus.RETRY)
        }
        
        return stats
    
    def save_progress(self, filename: str):
        """保存进度"""
        progress = {
            "tasks": [
                {
                    "id": t.id,
                    "url": t.url,
                    "status": t.status.value,
                    "retry_count": t.retry_count,
                    "result": t.result,
                    "error": t.error
                }
                for t in self.tasks.values()
            ]
        }
        
        with open(filename, 'w') as f:
            json.dump(progress, f, indent=2)
    
    def load_progress(self, filename: str):
        """加载进度"""
        with open(filename, 'r') as f:
            progress = json.load(f)
        
        for task_data in progress["tasks"]:
            task = Task(
                id=task_data["id"],
                url=task_data["url"],
                status=TaskStatus(task_data["status"]),
                retry_count=task_data["retry_count"],
                result=task_data.get("result"),
                error=task_data.get("error")
            )
            
            self.tasks[task.id] = task
            
            if task.status == TaskStatus.PENDING or task.status == TaskStatus.RETRY:
                self.queue.append(task)

# 使用示例
async def example_scraper(url: str):
    """示例爬取函数"""
    import aiohttp
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return {
                "url": url,
                "status": response.status,
                "content": await response.text()
            }

async def main():
    crawler = DistributedCrawler(queue_backend="memory")
    
    # 添加任务
    urls = [f"https://example.com/page/{i}" for i in range(1, 101)]
    crawler.add_tasks_batch(urls)
    
    # 运行爬虫
    await crawler.run(example_scraper, num_workers=10)
    
    # 打印统计
    print(crawler.get_stats())

# asyncio.run(main())
```

---

## 自进化引擎

### 概述
自进化引擎是爬虫的"免疫系统"，能够自动检测页面变化、修复选择器、适应参数变化。

### 代码示例

```python
import hashlib
import json
from typing import List, Dict
from difflib import SequenceMatcher

class SelfEvolvingEngine:
    """自进化爬虫引擎"""
    
    def __init__(self):
        self.selectors_db = {}  # 选择器数据库
        self.page_snapshots = {}  # 页面快照
        self.success_patterns = {}  # 成功模式
    
    def capture_snapshot(self, page_content: str, name: str = "default") -> str:
        """捕获页面快照"""
        snapshot = {
            "content_hash": hashlib.md5(page_content.encode()).hexdigest(),
            "content_sample": page_content[:2000],
            "timestamp": time.time()
        }
        
        self.page_snapshots[name] = snapshot
        return snapshot["content_hash"]
    
    def detect_changes(self, current_content: str, snapshot_name: str = "default") -> Dict:
        """检测页面变化"""
        if snapshot_name not in self.page_snapshots:
            return {"changed": False, "reason": "no_snapshot"}
        
        old_hash = self.page_snapshots[snapshot_name]["content_hash"]
        current_hash = hashlib.md5(current_content.encode()).hexdigest()
        
        if old_hash == current_hash:
            return {"changed": False}
        
        # 计算相似度
        old_sample = self.page_snapshots[snapshot_name]["content_sample"]
        current_sample = current_content[:2000]
        
        similarity = SequenceMatcher(None, old_sample, current_sample).ratio()
        
        return {
            "changed": True,
            "similarity": similarity,
            "old_hash": old_hash,
            "current_hash": current_hash
        }
    
    def auto_fix_selector(self, page, broken_selector: str, content_hint: str) -> str:
        """
        自动修复失效选择器
        
        Args:
            page: Playwright页面对象
            broken_selector: 失效的选择器
            content_hint: 内容提示（用于定位）
        """
        # 策略1: 基于文本内容查找
        try:
            elements = page.query_selector_all("*")
            for el in elements:
                text = el.text_content()
                if text and content_hint in text:
                    # 生成新的选择器
                    tag = el.evaluate("el => el.tagName.toLowerCase()")
                    class_name = el.evaluate("el => el.className")
                    
                    if class_name:
                        new_selector = f'{tag}.{class_name.replace(" ", ".")}'
                    else:
                        new_selector = tag
                    
                    return new_selector
        except:
            pass
        
        # 策略2: 基于XPath属性查找
        try:
            new_selector = f"//*[contains(text(), '{content_hint}')]"
            return new_selector
        except:
            pass
        
        return None
    
    def adapt_parameter_changes(self, old_params: Dict, new_response: Dict) -> Dict:
        """
        适应参数变化
        
        Args:
            old_params: 旧参数
            new_response: 新响应（可能包含错误信息）
        """
        adapted_params = old_params.copy()
        
        # 检查响应中的错误信息
        if "error" in new_response:
            error_msg = new_response["error"].lower()
            
            # 常见错误处理
            if "timestamp" in error_msg or "expired" in error_msg:
                # 更新时间戳
                adapted_params["timestamp"] = int(time.time() * 1000)
            
            if "sign" in error_msg or "signature" in error_msg:
                # 需要重新生成签名
                adapted_params["_need_resign"] = True
            
            if "token" in error_msg or "unauthorized" in error_msg:
                # 需要刷新token
                adapted_params["_need_refresh_token"] = True
        
        return adapted_params
    
    def learn_success_pattern(self, task_type: str, params: Dict, result: Dict):
        """学习成功模式"""
        if task_type not in self.success_patterns:
            self.success_patterns[task_type] = []
        
        pattern = {
            "params": params,
            "result_structure": self._extract_structure(result),
            "timestamp": time.time()
        }
        
        self.success_patterns[task_type].append(pattern)
    
    def _extract_structure(self, data: Dict) -> Dict:
        """提取数据结构"""
        structure = {}
        
        for key, value in data.items():
            if isinstance(value, dict):
                structure[key] = self._extract_structure(value)
            elif isinstance(value, list):
                structure[key] = [self._extract_structure(item) if isinstance(item, dict) else type(item).__name__ 
                                 for item in value[:1]]  # 只取第一个元素的结构
            else:
                structure[key] = type(value).__name__
        
        return structure
    
    def diagnose_failure(self, error_log: str, page_content: str) -> str:
        """
        诊断失败原因
        
        可以集成LLM进行智能诊断
        """
        # 常见错误模式
        error_patterns = {
            "timeout": "请求超时，可能需要增加超时时间或使用代理",
            "403": "IP被封锁，需要更换代理",
            "404": "页面不存在，URL可能已更改",
            "selector": "选择器失效，页面结构可能已更改",
            "json": "JSON解析失败，响应格式可能已更改",
            "captcha": "触发验证码，需要使用验证码破解服务"
        }
        
        error_lower = error_log.lower()
        
        for pattern, diagnosis in error_patterns.items():
            if pattern in error_lower:
                return diagnosis
        
        return "未知错误，需要人工检查"

# 使用示例
# engine = SelfEvolvingEngine()
# 
# # 捕获快照
# engine.capture_snapshot(page_content, "homepage")
# 
# # 检测变化
# changes = engine.detect_changes(new_content, "homepage")
# if changes["changed"]:
#     print(f"页面已变化，相似度: {changes['similarity']}")
# 
# # 自动修复选择器
# new_selector = engine.auto_fix_selector(page, ".old-class", "目标文本")
```

---

## 终极速查表

### 场景-方案速查

| 场景 | 推荐方案 | 成功率 | 成本 |
|------|---------|--------|------|
| 静态页面 | curl_cffi + 代理 | 95%+ | 低 |
| JS渲染 | Playwright + Stealth | 85%+ | 中 |
| Cloudflare | FlareSolverr / Patchright | 85%+ | 中 |
| DataDome | Camoufox + CapSolver | 70%+ | 高 |
| 美团 | waimai_sign逆向 + 站大爷 | 75%+ | 已购 |
| 京东 | sign算法 + 设备指纹池 | 80%+ | 已购 |
| 淘宝 | x-sign逆向（需JS环境） | 65%+ | 高 |
| 抖音 | _signature + X-Bogus | 70%+ | 中 |
| 小红书 | x-s签名 + 补环境 | 75%+ | 中 |
| 验证码 | CapSolver | 95%+ | 按量 |
| AI提取 | Crawl4AI | 85%+ | API费 |

### 工具链推荐

```
基础层:
  - HTTP: curl_cffi, httpx, aiohttp
  - 浏览器: Camoufox > Patchright > Nodriver
  - 代理: 站大爷(已购) + ISP代理

破解层:
  - 验证码: CapSolver
  - WAF: FlareSolverr
  - 抓包: mitmproxy + Frida

AI层:
  - 提取: Crawl4AI
  - 视觉: Skyvern
  - 控制: Browser-Use

平台层:
  - 美团: waimai_sign逆向
  - 京东: sign算法
  - 淘宝: x-sign逆向
  - 抖音: _signature
  - 小红书: x-s签名
```

---

**文档版本**: Level 12 Ultimate  
**最后更新**: 2026年4月  
**适用场景**: 任何网络数据采集任务