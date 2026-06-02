#!/usr/bin/env node
/**
 * dev-cli.test.ts — 测试脚本
 * 用法: node dev-cli.test.ts
 */

const { execSync } = require('child_process');
const path = require('path');

const CLI = `node ${path.join(__dirname, 'dev-cli.ts')}`;
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    passed++;
  } else {
    console.log(`  \x1b[31m✘\x1b[0m ${label}`);
    failed++;
  }
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', cwd: __dirname, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

console.log('\n\x1b[1mdev-cli.ts 测试套件\x1b[0m\n');

// ---- 测试 1: --help ----
console.log('\x1b[33m[测试1] --help 输出\x1b[0m');
const helpOutput = run(`${CLI} --help`);
assert(helpOutput.includes('jiaoyi-dev'), '输出包含标题');
assert(helpOutput.includes('dev [service]'), '列出 dev 命令');
assert(helpOutput.includes('build [service]'), '列出 build 命令');
assert(helpOutput.includes('check'), '列出 check 命令');
assert(helpOutput.includes('db <sub>'), '列出 db 命令');
assert(helpOutput.includes('deploy'), '列出 deploy 命令');
assert(helpOutput.includes('help [command]'), '列出 help 命令');

// ---- 测试 2: -h 简写 ----
console.log('\n\x1b[33m[测试2] -h 简写\x1b[0m');
const hOutput = run(`${CLI} -h`);
assert(hOutput.includes('jiaoyi-dev'), '-h 输出正确');

// ---- 测试 3: help status ----
console.log('\n\x1b[33m[测试3] help <command> 子命令帮助\x1b[0m');
const helpStatus = run(`${CLI} help status`);
assert(helpStatus.includes('status'), 'help status 显示 status');
assert(helpStatus.includes('项目状态'), 'help status 显示描述');

// ---- 测试 4: help db ----
console.log('\n\x1b[33m[测试4] help db 子命令帮助\x1b[0m');
const helpDb = run(`${CLI} help db`);
assert(helpDb.includes('子命令'), 'help db 显示子命令');
assert(helpDb.includes('status'), '列出 status 子命令');
assert(helpDb.includes('migrate'), '列出 migrate 子命令');
assert(helpDb.includes('seed'), '列出 seed 子命令');

// ---- 测试 5: status 命令 ----
console.log('\n\x1b[33m[测试5] status 命令\x1b[0m');
const statusOutput = run(`${CLI} status`);
assert(statusOutput.includes('jiaoyi-monorepo'), '显示项目名');
assert(statusOutput.includes('v1.0.0'), '显示版本号');

// ---- 测试 6: 未知命令 ----
console.log('\n\x1b[33m[测试6] 未知命令\x1b[0m');
const unknown = run(`${CLI} nonexistent`);
assert(unknown.includes('未知命令'), '提示未知命令');

// ---- 测试 7: 无参数（等同 --help） ----
console.log('\n\x1b[33m[测试7] 无参数\x1b[0m');
const noArgs = run(`${CLI}`);
assert(noArgs.includes('jiaoyi-dev'), '无参数显示帮助');
assert(noArgs.includes('用法'), '无参数显示用法');

// ---- 汇总 ----
console.log(`\n\x1b[1m结果: ${passed} 通过, ${failed} 失败 / ${passed + failed} 总计\x1b[0m\n`);
process.exit(failed > 0 ? 1 : 0);
