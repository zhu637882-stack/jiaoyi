-- 生成一个月的 K 线测试数据
-- 基于新的业务逻辑：显示客户收益率而非价格
-- 客户收益率 = (实际成交价 - 进价) / 进价 * 30% + 5%年化补贴

-- 首先清空现有的测试数据（保留最近的真实数据）
-- DELETE FROM market_snapshots WHERE snapshot_date >= CURRENT_DATE - INTERVAL '30 days';

-- 为每个药品生成一个月的测试数据
DO $$
DECLARE
    drug_record RECORD;
    start_date DATE := CURRENT_DATE - INTERVAL '30 days';
    end_date DATE := CURRENT_DATE;
    current_date_val DATE;
    
    -- 价格参数
    base_purchase_price DECIMAL(10,2);  -- 进价（固定）
    base_selling_price DECIMAL(10,2);   -- 估价（参考）
    actual_price DECIMAL(10,2);         -- 实际成交价
    
    -- 收益率参数
    base_daily_return DECIMAL(8,4);     -- 基础日收益率
    cumulative_return DECIMAL(8,4) := 0; -- 累计收益率
    
    -- 销量参数
    daily_sales_qty INTEGER;
    daily_revenue DECIMAL(12,2);
    total_funding DECIMAL(12,2);
    funding_heat INTEGER;
    
    -- 波动参数
    price_volatility DECIMAL(5,4) := 0.02; -- 价格波动率 2%
    trend_direction INTEGER;               -- 趋势方向
BEGIN
    -- 遍历所有药品
    FOR drug_record IN 
        SELECT id, "purchasePrice", "sellingPrice", "totalQuantity", "subscribedQuantity" 
        FROM drugs 
        WHERE status IN ('funding', 'selling', 'completed')
    LOOP
        -- 初始化参数
        base_purchase_price := drug_record."purchasePrice";
        base_selling_price := drug_record."sellingPrice";
        actual_price := COALESCE(
            (SELECT actual_selling_price FROM drugs WHERE id = drug_record.id),
            base_selling_price
        );
        cumulative_return := 0;
        
        -- 生成30天的数据
        current_date_val := start_date;
        WHILE current_date_val <= end_date LOOP
            -- 模拟价格波动（基于随机游走）
            -- 添加轻微的趋势性，让K线看起来更自然
            trend_direction := CASE 
                WHEN random() < 0.45 THEN -1  -- 45% 下跌
                WHEN random() < 0.55 THEN 0   -- 10% 横盘
                ELSE 1                         -- 45% 上涨
            END;
            
            -- 计算当日实际成交价波动
            actual_price := actual_price * (1 + (random() - 0.5) * price_volatility * 2 + trend_direction * 0.005);
            
            -- 确保价格不低于进价的 95%（保证客户基本不会亏损）
            actual_price := GREATEST(actual_price, base_purchase_price * 0.95);
            
            -- 计算客户日收益率
            -- 合伙收益 = (实际成交价 - 进价) / 进价 * 30%
            -- 固定补贴 = 5% / 365
            base_daily_return := ((actual_price - base_purchase_price) / base_purchase_price * 0.3) + (0.05 / 365);
            
            -- 添加一些随机波动让数据更真实
            base_daily_return := base_daily_return * (0.95 + random() * 0.1);
            
            -- 累计收益率
            cumulative_return := cumulative_return + base_daily_return;
            
            -- 计算销量（基于认购热度和随机因素）
            funding_heat := LEAST(
                drug_record."subscribedQuantity" + FLOOR(random() * 20)::INTEGER,
                drug_record."totalQuantity"
            );
            
            daily_sales_qty := FLOOR(random() * 100 + 50)::INTEGER; -- 每日50-150盒
            daily_revenue := daily_sales_qty * actual_price;
            total_funding := drug_record."subscribedQuantity" * base_purchase_price;
            
            -- 插入或更新快照数据
            INSERT INTO market_snapshots (
                id,
                "drugId",
                "snapshotDate",
                "dailySalesQuantity",
                "dailySalesRevenue",
                "averageSellingPrice",
                "dailyReturn",
                "cumulativeReturn",
                "totalFundingAmount",
                "fundingHeat",
                "queueDepth",
                "createdAt"
            ) VALUES (
                gen_random_uuid(),
                drug_record.id,
                current_date_val,
                daily_sales_qty,
                daily_revenue,
                actual_price,
                base_daily_return,
                cumulative_return,
                total_funding,
                funding_heat,
                FLOOR(random() * 10)::INTEGER, -- queue_depth
                NOW()
            )
            ON CONFLICT ("drugId", "snapshotDate") DO UPDATE SET
                "dailySalesQuantity" = EXCLUDED."dailySalesQuantity",
                "dailySalesRevenue" = EXCLUDED."dailySalesRevenue",
                "averageSellingPrice" = EXCLUDED."averageSellingPrice",
                "dailyReturn" = EXCLUDED."dailyReturn",
                "cumulativeReturn" = EXCLUDED."cumulativeReturn",
                "totalFundingAmount" = EXCLUDED."totalFundingAmount",
                "fundingHeat" = EXCLUDED."fundingHeat",
                "queueDepth" = EXCLUDED."queueDepth";
            
            current_date_val := current_date_val + INTERVAL '1 day';
        END LOOP;
        
        -- 更新药品的实际成交价为最新值
        UPDATE drugs 
        SET actual_selling_price = actual_price,
            actual_price_updated_at = NOW()
        WHERE id = drug_record.id;
        
    END LOOP;
END $$;

-- 验证生成的数据
SELECT 
    d.name as drug_name,
    d."purchasePrice",
    d."sellingPrice",
    d."actualSellingPrice" as actual_selling_price,
    COUNT(ms.id) as snapshot_count,
    MIN(ms."snapshotDate") as start_date,
    MAX(ms."snapshotDate") as end_date,
    MAX(ms."cumulativeReturn") * 100 as total_return_percent
FROM drugs d
LEFT JOIN market_snapshots ms ON d.id = ms."drugId"
WHERE ms."snapshotDate" >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY d.id, d.name, d."purchasePrice", d."sellingPrice", d."actualSellingPrice"
ORDER BY d.name;
