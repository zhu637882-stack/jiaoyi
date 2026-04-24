-- 插入测试药品数据
INSERT INTO drugs (id, name, code, "purchasePrice", "sellingPrice", "actualSellingPrice", "totalQuantity", "subscribedQuantity", "batchNo", status, "operationFeeRate", "slowSellingDays", "createdAt", "updatedAt")
VALUES 
    (gen_random_uuid(), '阿莫西林胶囊', 'DRUG-001', 8.00, 15.00, 18.50, 10000, 6500, 'BATCH-001', 'funding', 0.05, 10, NOW(), NOW()),
    (gen_random_uuid(), '板蓝根颗粒', 'DRUG-002', 5.00, 12.00, 14.80, 8000, 4200, 'BATCH-002', 'funding', 0.05, 10, NOW(), NOW()),
    (gen_random_uuid(), '布洛芬缓释胶囊', 'DRUG-003', 10.00, 25.00, 28.50, 12000, 8900, 'BATCH-003', 'funding', 0.05, 10, NOW(), NOW()),
    (gen_random_uuid(), '连花清瘟胶囊', 'DRUG-004', 12.00, 28.00, 32.00, 15000, 11200, 'BATCH-004', 'funding', 0.05, 10, NOW(), NOW()),
    (gen_random_uuid(), '复方丹参滴丸', 'DRUG-005', 20.00, 45.00, 52.00, 6000, 3800, 'BATCH-005', 'funding', 0.05, 10, NOW(), NOW()),
    (gen_random_uuid(), '三九感冒灵', 'DRUG-006', 6.00, 18.00, 21.50, 20000, 15600, 'BATCH-006', 'funding', 0.05, 10, NOW(), NOW()),
    (gen_random_uuid(), '蒙脱石散', 'DRUG-007', 4.00, 10.00, 12.80, 9000, 5200, 'BATCH-007', 'funding', 0.05, 10, NOW(), NOW()),
    (gen_random_uuid(), '头孢克肟片', 'DRUG-008', 15.00, 35.00, 42.00, 7000, 4800, 'BATCH-008', 'funding', 0.05, 10, NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- 为每个药品生成30天K线数据
DO $$
DECLARE
    drug_record RECORD;
    start_date DATE := CURRENT_DATE - INTERVAL '30 days';
    end_date DATE := CURRENT_DATE;
    current_date_val DATE;
    
    base_purchase_price DECIMAL(10,2);
    base_selling_price DECIMAL(10,2);
    actual_price DECIMAL(10,2);
    
    base_daily_return DECIMAL(8,4);
    cumulative_return DECIMAL(8,4) := 0;
    
    daily_sales_qty INTEGER;
    daily_revenue DECIMAL(12,2);
    total_funding DECIMAL(12,2);
    funding_heat INTEGER;
    
    price_volatility DECIMAL(5,4) := 0.015;
    trend_direction INTEGER;
BEGIN
    FOR drug_record IN 
        SELECT id, "purchasePrice", "sellingPrice", "totalQuantity", "subscribedQuantity" 
        FROM drugs 
        WHERE status = 'funding'
    LOOP
        base_purchase_price := drug_record."purchasePrice";
        base_selling_price := drug_record."sellingPrice";
        -- 使用初始设定的实际成交价
        actual_price := base_selling_price * 1.2; -- 实际成交价比估价高20%
        cumulative_return := 0;
        
        current_date_val := start_date;
        WHILE current_date_val <= end_date LOOP
            -- 随机趋势
            trend_direction := CASE 
                WHEN random() < 0.42 THEN -1
                WHEN random() < 0.58 THEN 0
                ELSE 1
            END;
            
            -- 价格波动
            actual_price := actual_price * (1 + (random() - 0.5) * price_volatility * 2 + trend_direction * 0.004);
            actual_price := GREATEST(actual_price, base_purchase_price * 0.96);
            
            -- 计算客户收益率
            base_daily_return := ((actual_price - base_purchase_price) / base_purchase_price * 0.3) + (0.05 / 365);
            base_daily_return := base_daily_return * (0.96 + random() * 0.08);
            cumulative_return := cumulative_return + base_daily_return;
            
            -- 销量和热度
            funding_heat := LEAST(drug_record."subscribedQuantity" + FLOOR(random() * 30)::INTEGER, drug_record."totalQuantity");
            daily_sales_qty := FLOOR(random() * 150 + 80)::INTEGER;
            daily_revenue := daily_sales_qty * actual_price;
            total_funding := drug_record."subscribedQuantity" * base_purchase_price;
            
            INSERT INTO market_snapshots (
                id, "drugId", "snapshotDate", "dailySalesQuantity", "dailySalesRevenue",
                "averageSellingPrice", "dailyReturn", "cumulativeReturn", "totalFundingAmount",
                "fundingHeat", "queueDepth", "createdAt"
            ) VALUES (
                gen_random_uuid(), drug_record.id, current_date_val, daily_sales_qty, daily_revenue,
                actual_price, base_daily_return, cumulative_return, total_funding,
                funding_heat, FLOOR(random() * 15)::INTEGER, NOW()
            )
            ON CONFLICT ("drugId", "snapshotDate") DO UPDATE SET
                "dailySalesQuantity" = EXCLUDED."dailySalesQuantity",
                "dailySalesRevenue" = EXCLUDED."dailySalesRevenue",
                "averageSellingPrice" = EXCLUDED."averageSellingPrice",
                "dailyReturn" = EXCLUDED."dailyReturn",
                "cumulativeReturn" = EXCLUDED."cumulativeReturn",
                "totalFundingAmount" = EXCLUDED."totalFundingAmount",
                "fundingHeat" = EXCLUDED."fundingHeat";
            
            current_date_val := current_date_val + INTERVAL '1 day';
        END LOOP;
        
        UPDATE drugs SET "actualSellingPrice" = actual_price, "actualPriceUpdatedAt" = NOW()
        WHERE id = drug_record.id;
    END LOOP;
END $$;

-- 验证数据
SELECT d.name, d."purchasePrice", d."sellingPrice", d."actualSellingPrice",
       COUNT(ms.id) as days,
       MAX(ms."cumulativeReturn") * 100 as total_return
FROM drugs d
LEFT JOIN market_snapshots ms ON d.id = ms."drugId"
GROUP BY d.id, d.name, d."purchasePrice", d."sellingPrice", d."actualSellingPrice"
ORDER BY d.name;
