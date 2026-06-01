#!/usr/bin/env python3
"""
订单导入脚本 v1.0
==================
从Excel读取外部平台订单 → 校验 → 匹配药品 → 导入 daily_sales 表

用法:
  python3 import_orders.py                    # 试运行（不写库，仅校验）
  python3 import_orders.py --commit           # 正式导入
  python3 import_orders.py --db /path/to/db   # 指定数据库路径
"""

import sqlite3
import uuid
import re
import sys
import json
from datetime import datetime, date
from pathlib import Path
from collections import defaultdict
from typing import Optional, List, Dict, Tuple

import openpyxl

# ============================================================
# 配置
# ============================================================
EXCEL_PATH = '/Users/a1234/Desktop/订单导入模板0526-27.xlsx'
DB_PATH = '/Users/a1234/jiaoyi/packages/server/data/jiaoyi_import.db'
ERROR_LOG = '/Users/a1234/jiaoyi/import_errors.log'

# ============================================================
# 工具函数
# ============================================================

def parse_drug_name(raw: str) -> Tuple[str, str, str]:
    """
    解析药品名称 [Brand]GenericName → (brand, generic, full)
    例: "[Hwa/思华迭力]加巴喷丁胶囊" → ("Hwa/思华迭力", "加巴喷丁胶囊", "加巴喷丁胶囊")
        "[中美华东]二甲双胍恩格列净片(Ⅰ)" → ("中美华东", "二甲双胍恩格列净片(Ⅰ)", "二甲双胍恩格列净片(Ⅰ)")
    """
    raw = raw.strip()
    m = re.match(r'^\[(.+?)\](.+)$', raw)
    if m:
        return m.group(1).strip(), m.group(2).strip(), raw
    return '', raw, raw

def generate_drug_code(name: str) -> str:
    """生成药品编码: 取拼音首字母或使用通用名"""
    # 简单方案: 移除品牌前缀，取前8个字符的hash
    _, generic, _ = parse_drug_name(name)
    # 取通用名的前几个字符
    code = re.sub(r'[^a-zA-Z一-鿿]', '', generic)[:12]
    # 如果太短，用全名
    if len(code) < 3:
        code = re.sub(r'[^a-zA-Z一-鿿]', '', name)[:12]
    # 加时间戳确保唯一
    return f"DRUG-{code}"

def parse_date(val) -> Optional[date]:
    """解析下单时间"""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        val = val.strip()
        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%Y/%m/%d %H:%M:%S', '%Y/%m/%d']:
            try:
                return datetime.strptime(val, fmt).date()
            except ValueError:
                continue
    return None

def parse_amount(val) -> Optional[float]:
    """解析金额"""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        return round(float(val), 2)
    if isinstance(val, str):
        val = val.strip().replace('¥', '').replace('元', '').replace(',', '')
        try:
            return round(float(val), 2)
        except ValueError:
            return None
    return None

# ============================================================
# SQLite 数据库操作
# ============================================================

def create_tables(db: sqlite3.Connection):
    """创建与TypeORM实体匹配的表结构"""
    db.executescript("""
    CREATE TABLE IF NOT EXISTS drugs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        purchasePrice REAL DEFAULT 0,
        sellingPrice REAL DEFAULT 0,
        actualSellingPrice REAL DEFAULT 0,
        actualPriceUpdatedAt TEXT,
        totalQuantity INTEGER DEFAULT 999999,
        subscribedQuantity INTEGER DEFAULT 0,
        batchNo TEXT DEFAULT 'IMPORT-20260528',
        status TEXT DEFAULT 'selling',
        operationFeeRate REAL DEFAULT 0,
        slowSellingDays INTEGER DEFAULT 10,
        isColdChain INTEGER DEFAULT 0,
        imageUrl TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_sales (
        id TEXT PRIMARY KEY,
        drugId TEXT NOT NULL,
        saleDate TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        actualSellingPrice REAL NOT NULL,
        totalRevenue REAL NOT NULL,
        terminal TEXT NOT NULL,
        createdAt TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (drugId) REFERENCES drugs(id)
    );

    CREATE INDEX IF NOT EXISTS idx_daily_sales_drug_date ON daily_sales(drugId, saleDate);

    -- 导入日志表
    CREATE TABLE IF NOT EXISTS import_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT,
        order_no TEXT,
        row_num INTEGER,
        status TEXT,           -- success | error | warning
        message TEXT,
        raw_data TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    """)
    db.commit()

# ============================================================
# 导入引擎
# ============================================================

class OrderImporter:
    def __init__(self, db_path: str, excel_path: str, commit: bool = False):
        self.db_path = db_path
        self.excel_path = excel_path
        self.commit = commit
        self.db: Optional[sqlite3.Connection] = None
        self.errors: List[Dict] = []
        self.warnings: List[Dict] = []
        self.success_count = 0
        self.drug_cache: Dict[str, str] = {}  # drug_name → drug_id

    def log_error(self, row_num: int, platform: str, order_no: str, msg: str, raw: List):
        self.errors.append({
            'row': row_num, 'platform': platform, 'order_no': order_no,
            'message': msg, 'raw': [str(c)[:80] for c in raw]
        })

    def log_warning(self, row_num: int, platform: str, order_no: str, msg: str, raw: List):
        self.warnings.append({
            'row': row_num, 'platform': platform, 'order_no': order_no,
            'message': msg
        })

    def open_db(self):
        self.db = sqlite3.connect(self.db_path)
        self.db.row_factory = sqlite3.Row
        if self.commit:
            create_tables(self.db)

    def close_db(self):
        if self.db:
            self.db.close()

    def get_or_create_drug(self, drug_name: str, drug_spec: str) -> Optional[str]:
        """查找或创建药品，返回 drug_id"""
        drug_name = drug_name.strip()

        # 缓存命中
        if drug_name in self.drug_cache:
            return self.drug_cache[drug_name]

        # 1. 按名称查找
        row = self.db.execute(
            "SELECT id FROM drugs WHERE name = ?", (drug_name,)
        ).fetchone()
        if row:
            self.drug_cache[drug_name] = row['id']
            return row['id']

        # 2. 按通用名模糊查找
        _, generic, _ = parse_drug_name(drug_name)
        row = self.db.execute(
            "SELECT id, name FROM drugs WHERE name LIKE ?", (f'%{generic}%',)
        ).fetchone()
        if row:
            self.drug_cache[drug_name] = row['id']
            return row['id']

        if not self.commit:
            # 试运行模式：返回虚拟ID
            fake_id = str(uuid.uuid4())
            self.drug_cache[drug_name] = fake_id
            return fake_id

        # 3. 创建新药品
        _, generic, _ = parse_drug_name(drug_name)
        drug_id = str(uuid.uuid4())
        code = generate_drug_code(drug_name)

        # 确保code唯一
        exist = self.db.execute("SELECT id FROM drugs WHERE code = ?", (code,)).fetchone()
        if exist:
            code = f"{code}-{drug_id[:6]}"

        try:
            self.db.execute("""
                INSERT INTO drugs (id, name, code, batchNo, status)
                VALUES (?, ?, ?, 'IMPORT-20260528', 'selling')
            """, (drug_id, drug_name, code))
            self.drug_cache[drug_name] = drug_id
            return drug_id
        except Exception as e:
            self.log_error(0, '', '', f'创建药品失败: {drug_name} - {e}', [drug_name])
            return None

    def read_excel(self) -> List[Dict]:
        """读取Excel，返回解析后的记录列表"""
        wb = openpyxl.load_workbook(self.excel_path, data_only=True)
        ws = wb['订单导入']
        records = []

        for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if not any(c is not None for c in row):
                continue

            platform, order_no, order_time, name, receiver, phone, gender, addr, drug, spec, qty, amount = row

            record = {
                'row': i,
                'platform': str(platform).strip() if platform else '',
                'order_no': str(order_no).strip() if order_no else '',
                'order_time': parse_date(order_time),
                'customer_name': str(name).strip() if name else '',
                'receiver': str(receiver).strip() if receiver else '',
                'phone': str(phone).strip() if phone else '',
                'gender': str(gender).strip() if gender else '',
                'address': str(addr).strip() if addr else '',
                'drug_name': str(drug).strip() if drug else '',
                'drug_spec': str(spec).strip() if spec else '',
                'quantity': int(qty) if qty is not None else 0,
                'amount': parse_amount(amount),
                'raw': [str(c)[:100] if c else '' for c in row]
            }
            records.append(record)

        return records

    def validate(self, rec: Dict) -> List[str]:
        """校验单条记录，返回错误列表"""
        errs = []
        if not rec['platform']:
            errs.append('订单平台为空')
        elif rec['platform'] not in ('天猫', '拼多多', '京东', '美团'):
            errs.append(f'未知平台: {rec["platform"]}')

        if not rec['order_no']:
            errs.append('平台订单号为空')

        if rec['order_time'] is None:
            errs.append('下单时间解析失败')

        if not rec['drug_name']:
            errs.append('药品名称为空')

        if rec['quantity'] <= 0:
            errs.append(f'数量异常: {rec["quantity"]}')
        elif rec['quantity'] > 1000:
            errs.append(f'数量过大: {rec["quantity"]}')

        if rec['amount'] is None:
            errs.append('订单金额解析失败')
        elif rec['amount'] <= 0:
            errs.append(f'订单金额异常: {rec["amount"]}')
        elif rec['amount'] > 100000:
            errs.append(f'订单金额过大: {rec["amount"]}')

        if not rec['phone']:
            errs.append('客户电话为空')  # 这是常见情况，记录但不阻止

        return errs

    def run(self):
        """主导入流程"""
        print("=" * 60)
        print("  订单导入脚本 v1.0")
        print("=" * 60)
        print(f"  Excel: {self.excel_path}")
        print(f"  数据库: {self.db_path}")
        print(f"  模式: {'正式导入' if self.commit else '试运行（仅校验）'}")
        print()

        # 1. 打开数据库
        self.open_db()

        # 2. 读取Excel
        print("📖 正在读取Excel...")
        records = self.read_excel()
        print(f"   读取到 {len(records)} 条记录")

        # 3. 逐条校验
        print("\n🔍 正在校验数据...")
        valid_records = []
        for rec in records:
            errs = self.validate(rec)
            if errs:
                err_msg = ' | '.join(errs)
                self.log_error(rec['row'], rec['platform'], rec['order_no'], err_msg, rec['raw'])
            else:
                valid_records.append(rec)
                # 电话为空只记warning
                if not rec['phone']:
                    self.log_warning(rec['row'], rec['platform'], rec['order_no'],
                                    '客户电话为空', rec['raw'])

        print(f"   校验通过: {len(valid_records)} 条")
        print(f"   校验失败: {len(self.errors)} 条")
        print(f"   警告: {len(self.warnings)} 条")

        if not valid_records:
            print("\n❌ 没有有效数据，退出")
            self.write_error_log()
            return

        # 4. 匹配药品
        print("\n💊 正在匹配药品...")
        drug_matched = 0
        drug_created = 0
        drug_failed = 0
        for rec in valid_records:
            drug_id = self.get_or_create_drug(rec['drug_name'], rec['drug_spec'])
            if drug_id:
                rec['drug_id'] = drug_id
                drug_matched += 1
                if rec['drug_name'] not in self.drug_cache:
                    drug_created += 1
            else:
                drug_failed += 1
                self.log_error(rec['row'], rec['platform'], rec['order_no'],
                             f'药品匹配失败: {rec["drug_name"]}', rec['raw'])

        print(f"   匹配成功: {drug_matched} 条")
        print(f"   新创建药品: {len(self.drug_cache)} 个")
        print(f"   匹配失败: {drug_failed} 条")

        # 5. 按 drug+terminal+date 聚合
        print("\n📊 正在聚合销售数据...")
        aggregated = defaultdict(lambda: {'quantity': 0, 'totalRevenue': 0.0, 'count': 0})
        for rec in valid_records:
            if 'drug_id' not in rec:
                continue
            key = (rec['drug_id'], rec['platform'], str(rec['order_time']))
            agg = aggregated[key]
            agg['quantity'] += rec['quantity']
            agg['totalRevenue'] += rec['amount']
            agg['count'] += 1

        print(f"   聚合后 {len(aggregated)} 条销售记录")

        # 6. 导入 daily_sales
        if self.commit:
            print("\n💾 正在写入数据库...")
            inserted = 0
            skipped = 0
            for (drug_id, terminal, sale_date), agg in aggregated.items():
                actual_price = round(agg['totalRevenue'] / agg['quantity'], 2) if agg['quantity'] > 0 else 0

                # 检查是否已存在
                exist = self.db.execute(
                    "SELECT id FROM daily_sales WHERE drugId = ? AND saleDate = ? AND terminal = ?",
                    (drug_id, sale_date, terminal)
                ).fetchone()

                if exist:
                    # 更新已有记录
                    self.db.execute("""
                        UPDATE daily_sales
                        SET quantity = quantity + ?, totalRevenue = totalRevenue + ?,
                            actualSellingPrice = (totalRevenue + ?) / (quantity + ?)
                        WHERE id = ?
                    """, (agg['quantity'], agg['totalRevenue'], agg['totalRevenue'], agg['quantity'], exist['id']))
                    skipped += 1
                else:
                    sale_id = str(uuid.uuid4())
                    self.db.execute("""
                        INSERT INTO daily_sales (id, drugId, saleDate, quantity, actualSellingPrice, totalRevenue, terminal)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (sale_id, drug_id, sale_date, agg['quantity'], actual_price, round(agg['totalRevenue'], 2), terminal))
                    inserted += 1

                # 记录到日志表
                self.db.execute("""
                    INSERT INTO import_log (platform, order_no, row_num, status, message, raw_data)
                    VALUES (?, ?, ?, 'success', ?, ?)
                """, (terminal, f'BATCH-{sale_date}', 0,
                      f'聚合导入: {agg["count"]}笔订单, 数量{agg["quantity"]}, 金额{agg["totalRevenue"]}',
                      json.dumps({'drug_id': drug_id, 'terminal': terminal, 'date': sale_date, 'order_count': agg['count']}, ensure_ascii=False)))

            self.db.commit()
            self.success_count = inserted + skipped
            print(f"   新增: {inserted} 条")
            print(f"   更新: {skipped} 条")
            print(f"   总计: {self.success_count} 条")

        # 7. 写错误日志
        self.write_error_log()

        # 8. 打印汇总
        self.print_summary(aggregated)
        self.close_db()

    def write_error_log(self):
        """写错误日志文件"""
        if not self.errors and not self.warnings:
            return

        with open(ERROR_LOG, 'w', encoding='utf-8') as f:
            f.write(f"订单导入错误日志 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"{'='*60}\n\n")

            if self.errors:
                f.write(f"## 错误 ({len(self.errors)} 条)\n\n")
                for e in self.errors:
                    f.write(f"  Row {e['row']} | {e['platform']} | {e['order_no']}\n")
                    f.write(f"    ❌ {e['message']}\n")
                    f.write(f"    原始数据: {e['raw']}\n\n")

            if self.warnings:
                f.write(f"\n## 警告 ({len(self.warnings)} 条)\n\n")
                for w in self.warnings[:50]:  # 最多50条
                    f.write(f"  Row {w['row']} | {w['platform']} | {w['order_no']}\n")
                    f.write(f"    ⚠️ {w['message']}\n")
                if len(self.warnings) > 50:
                    f.write(f"  ... 还有 {len(self.warnings) - 50} 条警告\n")

        print(f"\n📝 错误日志已写入: {ERROR_LOG}")

    def print_summary(self, aggregated: Dict):
        """打印汇总表格"""
        print("\n" + "=" * 60)
        print("  导入汇总")
        print("=" * 60)

        # 按药品汇总
        drug_summary = defaultdict(lambda: {'qty': 0, 'amt': 0.0, 'orders': 0})
        for (drug_id, terminal, sale_date), agg in aggregated.items():
            # 反查药品名
            drug_name = next((k for k, v in self.drug_cache.items() if v == drug_id), drug_id[:12])
            key = drug_name[:40]
            drug_summary[key]['qty'] += agg['quantity']
            drug_summary[key]['amt'] += agg['totalRevenue']
            drug_summary[key]['orders'] += agg['count']

        print(f"\n{'药品':<42} {'订单数':>6} {'总数量':>8} {'总金额':>10}")
        print("-" * 68)
        total_qty = 0
        total_amt = 0.0
        total_orders = 0
        for name in sorted(drug_summary.keys()):
            d = drug_summary[name]
            print(f"{name:<42} {d['orders']:>6} {d['qty']:>8} {d['amt']:>10.2f}")
            total_qty += d['qty']
            total_amt += d['amt']
            total_orders += d['orders']
        print("-" * 68)
        print(f"{'合计':<42} {total_orders:>6} {total_qty:>8} {total_amt:>10.2f}")

        # 按平台汇总
        platform_summary = defaultdict(lambda: {'qty': 0, 'amt': 0.0, 'orders': 0})
        for (drug_id, terminal, sale_date), agg in aggregated.items():
            platform_summary[terminal]['qty'] += agg['quantity']
            platform_summary[terminal]['amt'] += agg['totalRevenue']
            platform_summary[terminal]['orders'] += agg['count']

        print(f"\n{'平台':<10} {'订单数':>8} {'总数量':>8} {'总金额':>10}")
        print("-" * 38)
        for platform in ('天猫', '拼多多', '京东', '美团'):
            if platform in platform_summary:
                d = platform_summary[platform]
                print(f"{platform:<10} {d['orders']:>8} {d['qty']:>8} {d['amt']:>10.2f}")

        print(f"\n✅ {'试运行' if not self.commit else '导入'}完成！")
        if not self.commit:
            print("💡 使用 --commit 参数执行正式导入")


# ============================================================
# 入口
# ============================================================
if __name__ == '__main__':
    commit = '--commit' in sys.argv
    db_path = DB_PATH

    # 解析 --db 参数
    for i, arg in enumerate(sys.argv):
        if arg == '--db' and i + 1 < len(sys.argv):
            db_path = sys.argv[i + 1]

    importer = OrderImporter(db_path=db_path, excel_path=EXCEL_PATH, commit=commit)
    importer.run()
