import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './ServiceAgreement.css'

const ServiceAgreement: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const handleAgree = () => {
    // 标记用户已同意协议（localStorage持久化 + URL参数）
    localStorage.setItem('agreed_to_agreement', 'true')
    localStorage.setItem('agreed_to_agreement_time', new Date().toISOString())
    // 跳转回注册页（带agreed参数）
    navigate('/m/login?tab=register&agreed=true', { replace: true })
  }

  const handleBack = () => {
    navigate(-1)
  }

  return (
    <div className="agreement-page">
      {/* 顶部导航 */}
      <div className="agreement-header">
        <button
          className="agreement-back-btn"
          onClick={handleBack}
          type="button"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="agreement-header-title">服务规则</h1>
        <div className="agreement-header-placeholder" />
      </div>

      {/* 内容区域 */}
      <div className="agreement-content">
        <h1 className="agreement-main-title">零钱宝·药品供应链合作认购服务规则</h1>

        {/* 第一章 总则 */}
        <div className="agreement-chapter">
          <h2 className="agreement-chapter-title">第一章 总则</h2>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第一条 规则效力与适用范围</h3>
            <div className="agreement-clause">
              <p>1.1 本规则是零钱宝药品供应链合作认购服务的唯一正式执行依据，适用于平台方、结算方、药品供应链服务方、终端医药机构（药店/诊所/医院）及合作方（用户），围绕药品预售认购、订单确认、资金结算、滞销退货等全流程合作开展，与相关服务协议具有同等法律效力。</p>
            </div>
            <div className="agreement-clause">
              <p>1.2 任何主体通过平台完成注册、登录、认购、确认、结算等相关操作，即视为已完整阅读、充分理解并自愿接受本规则全部条款，无任何异议。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第二条 核心定义</h3>
            <div className="agreement-clause">
              <p>1. 合作认购：合作方自愿参与平台发布的药品采购需求份额认购，提供对应资金支持，按规则享有服务酬劳、份额退回/转让权利，并承担对应市场风险的合作模式。</p>
            </div>
            <div className="agreement-clause">
              <p>2. 认购份额：合作方认购的药品数量单位，以"盒"为最小计量，对应专属权益与风险。</p>
            </div>
            <div className="agreement-clause">
              <p>3. 滞销退货：药品入库满90天未完成销售，触发供应链服务方按约定回收份额的保障机制。</p>
            </div>
          </div>
        </div>

        {/* 第二章 参与主体与职责 */}
        <div className="agreement-chapter">
          <h2 className="agreement-chapter-title">第二章 参与主体与职责</h2>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第三条 平台方</h3>
            <div className="agreement-clause">
              <p className="agreement-sub-text">主体：一诺美（浙江）科技有限公司</p>
            </div>
            <div className="agreement-clause">
              <p>1. 统计全渠道当日药品采购需求量，在指定互联网药品信息认购平台发布采购需求；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 展示药品基础信息、近7日销售数据、采购周期等核心信息；</p>
            </div>
            <div className="agreement-clause">
              <p>3. 提供订单管理、系统运维、数据核算、规则解释与合规运营服务；</p>
            </div>
            <div className="agreement-clause">
              <p>4. 按约定享有平台服务酬劳分配权益。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第四条 结算方</h3>
            <div className="agreement-clause">
              <p>1. 负责全流程交易数据统计、对账核对、客户咨询服务；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 协助平台方完成规则解读、争议协调与结算执行。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第五条 合作方（用户）</h3>
            <div className="agreement-clause">
              <p>1. 自愿参与药品份额认购，完成实名认证与数据授权；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 按规则享有份额退回、提前回收、份额转让及服务酬劳分配权利；</p>
            </div>
            <div className="agreement-clause">
              <p>3. 自愿承担市场波动、药品滞销等对应风险，履行合作义务。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第六条 药品供应链服务方</h3>
            <div className="agreement-clause">
              <p>1. 负责订单全程监督、账款核对、结算落地执行；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 严格履行药品入库满90天滞销退货保障义务；</p>
            </div>
            <div className="agreement-clause">
              <p>3. 保障药品溯源合规、三票合一、采购流程规范。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第七条 终端医药机构（药店/诊所/医院）</h3>
            <div className="agreement-clause">
              <p>1. 负责药品线下销售、库存管理、销售数据实时回传；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 按约定享有服务酬劳分配，承担对应市场风险；</p>
            </div>
            <div className="agreement-clause">
              <p>3. 配合平台、供应链服务方完成对账、核验等工作。</p>
            </div>
          </div>
        </div>

        {/* 第三章 认购规则 */}
        <div className="agreement-chapter">
          <h2 className="agreement-chapter-title">第三章 认购规则</h2>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第八条 认购门槛与方式</h3>
            <div className="agreement-clause">
              <p>1. 平台实时发布各终端医药机构药品采购需求，合作方可自主选择认购标的；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 最小认购单位为1盒，支持单品类部分认购或全额认购；</p>
            </div>
            <div className="agreement-clause">
              <p>3. 认购遵循自愿原则，平台不强制、不诱导。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第九条 订单与权益确认</h3>
            <div className="agreement-clause">
              <p>1. 认购成功后，系统自动生成唯一电子订单凭证，实行"一盒一码、一笔一号"；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 按认购时间先后顺序确认权益，订单信息可实时查询、不可篡改。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第十条 资金使用规范</h3>
            <div className="agreement-clause">
              <p>1. 认购资金专款专用，仅用于对应采购订单的药品采购，不得挪作他用；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 药品全程溯源，严格执行三票合一制度，资金流向可查询、可追溯；</p>
            </div>
            <div className="agreement-clause">
              <p>3. 平台不设立资金池，保障资金安全与合规。</p>
            </div>
          </div>
        </div>

        {/* 第四章 订单生效与结算周期 */}
        <div className="agreement-chapter">
          <h2 className="agreement-chapter-title">第四章 订单生效与结算周期</h2>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第十一条 订单生效时效</h3>
            <div className="agreement-clause">
              <p>1. 认购申请：T+0系统确认；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 订单正式生效：T+1。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第十二条 结算周期</h3>
            <div className="agreement-clause">
              <p>结算周期自订单生效当日起，至认购份额全部结清或滞销退货完成并到账之日止。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第十三条 酬劳说明</h3>
            <div className="agreement-clause">
              <p>服务酬劳根据药品实际销售情况核算发放，平台不承诺固定收益、不承诺保本保息。</p>
            </div>
          </div>
        </div>

        {/* 第五章 份额退回、提前回收与转让 */}
        <div className="agreement-chapter">
          <h2 className="agreement-chapter-title">第五章 份额退回、提前回收与转让</h2>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第十四条 份额如期退回</h3>
            <div className="agreement-clause">
              <p>1. 药品销售回款优先用于退回合作方认购本金，以实际销售盈利为准，合作方最大亏损不超过药品采购价的5%；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 退回顺序：按认购时间先认先退；资金到账规则：快递配送3天+7天无理由退货期，合计10天进入系统账户，合作方可申请提现或继续认购；药品售罄即可发起结算；</p>
            </div>
            <div className="agreement-clause">
              <p>3. 份额全部退回并结算完成后，该笔合作自动终止，不再参与任何酬劳分配。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第十五条 份额提前回收</h3>
            <div className="agreement-clause">
              <p>1. 适用场景：未到如期退回顺序、未触发滞销退货条件，合作方需提前收回本金；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 办理要求：自愿放弃该笔订单全部服务酬劳，缴纳3%提前回收手续费；</p>
            </div>
            <div className="agreement-clause">
              <p>3. 回收价格：按申请当日药品实际采购价执行，与原认购价格无关。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第十六条 份额转让</h3>
            <div className="agreement-clause">
              <p>1. 适用场景：未到如期退回顺序、未触发滞销退货条件，合作方自愿转让份额；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 办理要求：转让方自愿放弃该笔订单全部服务酬劳，由受让方承接全部权利与义务；</p>
            </div>
            <div className="agreement-clause">
              <p>3. 交易规则：转让金额由转让双方协商确定，平台仅提供流程协助，不干预交易价格。</p>
            </div>
          </div>
        </div>

        {/* 第六章 酬劳分配与风险承担 */}
        <div className="agreement-chapter">
          <h2 className="agreement-chapter-title">第六章 酬劳分配与风险承担</h2>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第十七条 可分配收益计算</h3>
            <div className="agreement-clause">
              <p>单笔订单可分配收益 = 实际销售额 − 采购成本 − 平台运营费用（平台扣点、快递费、其他合理费用）。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第十八条 酬劳分配比例</h3>
            <div className="agreement-clause">
              <p>可分配收益按以下比例分配：</p>
            </div>
            <div className="agreement-clause">
              <p>1. 合作方：30%</p>
            </div>
            <div className="agreement-clause">
              <p>2. 终端医药机构：70%</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第十九条 风险承担比例</h3>
            <div className="agreement-clause">
              <p>市场波动、药品滞销等经营风险按以下比例共同承担：</p>
            </div>
            <div className="agreement-clause">
              <p>1. 合作方：30%</p>
            </div>
            <div className="agreement-clause">
              <p>2. 终端医药机构：70%</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第二十条 风险抵扣规则</h3>
            <div className="agreement-clause">
              <p>风险损失优先从合作方应得服务酬劳中抵扣；酬劳不足抵扣部分，按本规则及相关协议执行。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第二十一条 资金空置补贴</h3>
            <div className="agreement-clause">
              <p>合作方认购资金未实际参与业务、处于空置期间，按年化4.16%结算空置补贴，随对应资金一并发放。</p>
            </div>
          </div>
        </div>

        {/* 第七章 滞销退货保障 */}
        <div className="agreement-chapter">
          <h2 className="agreement-chapter-title">第七章 滞销退货保障</h2>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第二十二条 滞销触发条件</h3>
            <div className="agreement-clause">
              <p>认购药品自入库之日起满90天未售出，自动认定为滞销，触发退货保障。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第二十三条 退货执行标准</h3>
            <div className="agreement-clause">
              <p>1. 供应链服务方按合作方实际认购份额，以当日采购成交价下浮5%回收；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 滞销退货不收取任何费用，不发放该笔订单服务酬劳；</p>
            </div>
            <div className="agreement-clause">
              <p>3. 回收资金足额到账后，该笔合作终止，双方权利义务结清。</p>
            </div>
          </div>
        </div>

        {/* 第八章 对账与资金结算 */}
        <div className="agreement-chapter">
          <h2 className="agreement-chapter-title">第八章 对账与资金结算</h2>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第二十四条 对账机制</h3>
            <div className="agreement-clause">
              <p>实行日清日结对账，系统每日自动统计销量、营收、成本、可分配酬劳等数据，合作方可实时查询。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第二十五条 结算时效</h3>
            <div className="agreement-clause">
              <p>资金划转最迟不超过T+1工作日，遇法定节假日顺延。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第二十六条 数据效力</h3>
            <div className="agreement-clause">
              <p>所有结算数据以平台系统官方记录为准，各方均认可其真实性、准确性、完整性与合法性。</p>
            </div>
          </div>
        </div>

        {/* 第九章 风险揭示与确认 */}
        <div className="agreement-chapter">
          <h2 className="agreement-chapter-title">第九章 风险揭示与确认</h2>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第二十七条 风险提示</h3>
            <div className="agreement-clause">
              <p>本业务存在药品滞销、市场波动、经营盈亏、价格变动等风险，平台已充分揭示：不存在固定收益、不存在保本承诺、不刚性兑付。合作方明确知晓：收益与风险并存，盈利享有、亏损自担。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第二十八条 确认效力</h3>
            <div className="agreement-clause">
              <p>合作方通过平台小程序/系统完成注册、登录、点击"确认/同意"本规则，即视为：</p>
            </div>
            <div className="agreement-clause">
              <p>1. 已完整阅读、充分理解并完全接受本规则全部内容；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 已收到并清晰理解全部风险提示，自愿承担相关风险；</p>
            </div>
            <div className="agreement-clause">
              <p>3. 认可平台方对规则的解释，无任何歧义与争议。</p>
            </div>
          </div>
        </div>

        {/* 第十章 权利与义务 */}
        <div className="agreement-chapter">
          <h2 className="agreement-chapter-title">第十章 权利与义务</h2>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第二十九条 合作方权利义务</h3>
            <div className="agreement-clause">
              <p>1. 权利：按规则退回认购份额、获取服务酬劳、享受90天滞销退货保障、查询订单与资金数据；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 义务：按约定承担风险、完成实名认证、配合数据授权、遵守平台规则。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第三十条 平台方权利义务</h3>
            <div className="agreement-clause">
              <p>1. 权利：按约定享有平台服务酬劳分配；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 义务：保障系统稳定运行、核算数据准确、及时完成结算、合规合法运营。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第三十一条 供应链服务方权利义务</h3>
            <div className="agreement-clause">
              <p>1. 权利：按约定履行服务并获取对应收益；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 义务：监督订单、核对账款、执行结算、严格履行90天滞销退货保障。</p>
            </div>
          </div>
        </div>

        {/* 第十一章 附则 */}
        <div className="agreement-chapter">
          <h2 className="agreement-chapter-title">第十一章 附则</h2>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第三十二条 规则生效</h3>
            <div className="agreement-clause">
              <p>本规则自合作方线上确认同意之日起正式生效。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第三十三条 补充与修订</h3>
            <div className="agreement-clause">
              <p>1. 本规则未尽事宜，由各方协商一致后签订书面补充协议，补充协议与本规则具有同等法律效力；</p>
            </div>
            <div className="agreement-clause">
              <p>2. 平台可根据业务发展与监管要求修订本规则，修订后通过平台公示生效，合作方继续使用服务即视为接受修订后规则。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第三十四条 解释权</h3>
            <div className="agreement-clause">
              <p>平台方（一诺美（浙江）科技有限公司）对本规则及相关业务事项拥有最终合法解释权。</p>
            </div>
          </div>

          <div className="agreement-article">
            <h3 className="agreement-article-title">第三十五条 争议解决</h3>
            <div className="agreement-clause">
              <p>因本规则产生的争议，各方应友好协商解决；协商不成的，提交平台方所在地有管辖权的人民法院诉讼解决。</p>
            </div>
          </div>
        </div>

        {/* 底部间距 */}
        <div className="agreement-bottom-spacer" />
      </div>

      {/* 底部按钮 */}
      <div className="agreement-footer">
        <button
          className="agreement-agree-btn"
          onClick={handleAgree}
          type="button"
        >
          我已阅读并同意《零钱宝合作认购协议》
        </button>
      </div>
    </div>
  )
}

export default ServiceAgreement
