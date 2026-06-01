#!/usr/bin/env node
/**
 * jiaoyi-dev — 药赚赚项目开发助手 CLI
 * 用法: node dev-cli.ts <command> [options]
 */

const { execSync } = require('child_process');
const path = require('path');

// ============================================================
// 命令注册表
// ============================================================
const COMMANDS = {
  dev: {
    description: '启动开发服务器',
    usage: 'dev [service]',
    examples: ['dev', 'dev server', 'dev web'],
    action: (args) => {
      const service = args[0] || 'all';
      const map = {
        server: 'pnpm --filter server dev',
        web: 'pnpm --filter web dev',
        all: 'concurrently "pnpm --filter server dev" "pnpm --filter web dev"',
      };
      const cmd = map[service];
      if (!cmd) return error(`未知服务: ${service}，可用: server, web, all`);
      run(cmd);
    },
  },

  build: {
    description: '构建项目',
    usage: 'build [service]',
    examples: ['build', 'build server', 'build web'],
    action: (args) => {
      const service = args[0] || 'all';
      const map = {
        server: 'pnpm --filter server build',
        web: 'pnpm --filter web build',
        all: 'pnpm build',
      };
      const cmd = map[service];
      if (!cmd) return error(`未知服务: ${service}，可用: server, web, all`);
      run(cmd);
    },
  },

  check: {
    description: '代码检查（typecheck + lint）',
    usage: 'check',
    action: () => {
      run('pnpm typecheck');
      run('pnpm lint');
    },
  },

  db: {
    description: '数据库操作',
    usage: 'db <subcommand>',
    subcommands: {
      status: { description: '检查数据库连接状态', action: () => run('pnpm --filter server db:status || echo "无 db:status 脚本，请确认 server/package.json"') },
      migrate: { description: '运行数据库迁移', action: () => run('pnpm --filter server db:migrate || echo "无 db:migrate 脚本"') },
      seed: { description: '填充测试数据', action: () => run('pnpm --filter server db:seed || echo "无 db:seed 脚本"') },
    },
    action: (args) => {
      const sub = args[0];
      if (!sub || sub === 'help') return showHelp('db');
      const cmd = COMMANDS.db.subcommands[sub];
      if (!cmd) return error(`未知子命令: ${sub}`);
      cmd.action();
    },
  },

  deploy: {
    description: '部署到服务器',
    usage: 'deploy [target]',
    examples: ['deploy', 'deploy server'],
    action: (args) => {
      const target = args[0] || 'all';
      info(`开始部署 [${target}]...`);
      run(`bash deploy-to-server.sh ${target === 'all' ? '' : target}`);
    },
  },

  status: {
    description: '查看项目状态',
    usage: 'status',
    action: () => {
      const gitStatus = execSync('git status --short 2>/dev/null || echo ""', { encoding: 'utf8' }).trim();
      const untracked = gitStatus ? gitStatus.split('\n').length : 0;
      const pkg = require(path.join(process.cwd(), 'package.json'));

      info(`项目: ${pkg.name} v${pkg.version}`);
      info(`Node: ${process.version}`);
      info(`未提交变更: ${untracked} 个文件`);
      info('');
      info('快速命令:');
      info('  node dev-cli.ts dev       — 启动开发');
      info('  node dev-cli.ts build     — 构建');
      info('  node dev-cli.ts check     — 代码检查');
      info('  node dev-cli.ts db status — 数据库');
    },
  },
};

// ============================================================
// 辅助函数
// ============================================================

function info(msg) { console.log(`\x1b[36mℹ\x1b[0m ${msg}`); }
function success(msg) { console.log(`\x1b[32m✔\x1b[0m ${msg}`); }
function error(msg) { console.error(`\x1b[31m✘\x1b[0m ${msg}`); process.exit(1); }

function run(cmd) {
  info(`执行: ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
    success('完成');
  } catch (e) {
    error(`命令失败 (exit code: ${e.status})`);
  }
}

function showHelp(commandName) {
  const w = (s, n = 16) => s.padEnd(n);

  if (commandName && COMMANDS[commandName]) {
    const cmd = COMMANDS[commandName];
    console.log(`\n  ${commandName} — ${cmd.description}`);
    console.log(`  用法: node dev-cli.ts ${cmd.usage}`);
    if (cmd.examples) {
      console.log(`\n  示例:`);
      cmd.examples.forEach(ex => console.log(`    node dev-cli.ts ${ex}`));
    }
    if (cmd.subcommands) {
      console.log(`\n  子命令:`);
      Object.entries(cmd.subcommands).forEach(([name, sub]) => {
        console.log(`    ${w(name)} ${sub.description}`);
      });
    }
    console.log();
    return;
  }

  // 主帮助
  console.log(`
  jiaoyi-dev — 药赚赚项目开发助手

  用法: node dev-cli.ts <command> [options]

  命令:
    ${w('dev [service]')}  启动开发服务器 (server/web/all)
    ${w('build [service]')} 构建项目 (server/web/all)
    ${w('check')}          代码检查 (typecheck + lint)
    ${w('db <sub>')}       数据库操作 (status/migrate/seed)
    ${w('deploy [target]')} 部署到服务器
    ${w('status')}         查看项目状态
    ${w('help [command]')} 查看帮助

  示例:
    node dev-cli.ts dev          # 启动全部服务
    node dev-cli.ts dev server   # 仅启动后端
    node dev-cli.ts build web    # 仅构建前端
    node dev-cli.ts db status    # 检查数据库
    node dev-cli.ts help db      # 查看 db 子命令帮助

  简写: node dev-cli.ts = ./dev-cli.ts（需 chmod +x）
`);
}

// ============================================================
// 入口
// ============================================================

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp(args[1]);
    process.exit(0);
  }

  const cmd = COMMANDS[command];
  if (!cmd) {
    error(`未知命令: "${command}"\n  可用命令: ${Object.keys(COMMANDS).join(', ')}\n  试试: node dev-cli.ts help`);
  }

  cmd.action(args.slice(1));
}

main();
