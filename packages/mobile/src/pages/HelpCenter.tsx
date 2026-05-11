import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Collapse } from 'antd-mobile'
import './HelpCenter.css'

// 步骤项组件
const StepItem = ({
  step,
  title,
  desc,
  isLast = false,
}: {
  step: number
  title: string
  desc: string
  isLast?: boolean
}) => (
  <div className="hc-step-item">
    <div className="hc-step-line-wrap">
      <div className="hc-step-circle">{step}</div>
      {!isLast && <div className="hc-step-line" />}
    </div>
    <div className="hc-step-content">
      <div className="hc-step-title">{title}</div>
      <div className="hc-step-desc">{desc}</div>
    </div>
  </div>
)

// 步骤区块组件
const StepSection = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) => (
  <div className="hc-section">
    <div className="hc-section-header">
      <div className="hc-section-icon">{icon}</div>
      <h2 className="hc-section-title">{title}</h2>
    </div>
    <div className="hc-section-body">{children}</div>
  </div>
)

// 纯文本区块
const TextSection = ({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) => (
  <div className="hc-section">
    <div className="hc-section-header">
      <div className="hc-section-icon">{icon}</div>
      <h2 className="hc-section-title">{title}</h2>
    </div>
    <div className="hc-section-body">{children}</div>
  </div>
)

const HelpCenter: React.FC = () => {
  const navigate = useNavigate()

  const handleBack = () => {
    navigate(-1)
  }

  const faqItems = [
    {
      key: '1',
      title: 'Q：充值多久到账？',
      content: 'A：实时到账。支付成功后资金将立即计入您的账户余额。',
    },
    {
      key: '2',
      title: 'Q：收益什么时候发放？',
      content: 'A：每日计算，T+1日到账。系统每日自动核算收益并发放至您的账户。',
    },
    {
      key: '3',
      title: 'Q：提现有手续费吗？',
      content: 'A：暂无手续费。当前提现功能免手续费，具体以平台公告为准。',
    },
    {
      key: '4',
      title: 'Q：最低购买金额是多少？',
      content: 'A：100元起。零钱保产品最低认购金额为100元，支持追加购买。',
    },
    {
      key: '5',
      title: 'Q：如何联系客服？',
      content: 'A：请关注微信公众号"多客宝"留言咨询，客服将在工作时间内尽快回复。',
    },
  ]

  return (
    <div className="help-center-page">
      {/* 顶部导航 */}
      <div className="hc-header">
        <button className="hc-back-btn" onClick={handleBack} type="button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="hc-header-title">帮助中心</h1>
        <div className="hc-header-placeholder" />
      </div>

      {/* 内容区域 */}
      <div className="hc-content">
        {/* 如何充值 */}
        <StepSection
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="6" width="20" height="12" rx="2" stroke="#F0B90B" strokeWidth="2"/>
              <line x1="2" y1="10" x2="22" y2="10" stroke="#F0B90B" strokeWidth="2"/>
              <circle cx="7" cy="14" r="1" fill="#F0B90B"/>
            </svg>
          }
          title="如何充值"
        >
          <StepItem step={1} title="进入交易页面" desc='在底部导航栏选择"交易"，进入交易页面后选择"充值"功能' />
          <StepItem step={2} title="输入充值金额" desc="在充值页面输入您想要充值的金额" />
          <StepItem step={3} title="选择支付方式" desc="支持微信支付和支付宝两种支付方式，选择您偏好的支付渠道" />
          <StepItem step={4} title="完成支付" desc="按提示完成支付操作，资金将实时到账您的账户" isLast />
        </StepSection>

        {/* 如何购买零钱保 */}
        <StepSection
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          title="如何购买零钱保"
        >
          <StepItem step={1} title="查看产品" desc="进入首页，查看零钱保产品信息和当前收益率" />
          <StepItem step={2} title="点击购买" desc='点击"立即购买"按钮，进入认购页面' />
          <StepItem step={3} title="输入金额" desc="输入购买金额，最低100元起购" />
          <StepItem step={4} title="确认购买" desc="确认购买信息，T+1日开始计息收益" isLast />
        </StepSection>

        {/* 如何查看收益 */}
        <TextSection
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M18 20V10M12 20V4M6 20v-6" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          title="如何查看收益"
        >
          <div className="hc-text-block">
            <p>进入"持仓"页面，您可以查看当前持有的零钱保份额和累计收益情况。</p>
            <p>收益每日更新，T+1日到账，系统自动核算并发放至您的账户余额。</p>
          </div>
        </TextSection>

        {/* 如何提现 */}
        <StepSection
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="#F0B90B" strokeWidth="2"/>
              <path d="M12 8v8M8 12h8" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          }
          title="如何提现"
        >
          <StepItem step={1} title="进入交易页面" desc='在底部导航栏选择"交易"，进入交易页面后选择"提现"功能' />
          <StepItem step={2} title="输入提现金额" desc="输入您想要提现的金额，确保账户余额充足" />
          <StepItem step={3} title="确认提现" desc="确认提现信息，T+1工作日到账至您绑定的银行卡" isLast />
        </StepSection>

        {/* 常见问题FAQ */}
        <div className="hc-section">
          <div className="hc-section-header">
            <div className="hc-section-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#F0B90B" strokeWidth="2"/>
                <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="17" r="0.5" fill="#F0B90B"/>
              </svg>
            </div>
            <h2 className="hc-section-title">常见问题FAQ</h2>
          </div>
          <div className="hc-section-body">
            <Collapse className="hc-collapse">
              {faqItems.map(item => (
                <Collapse.Panel key={item.key} title={item.title}>
                  <div className="hc-faq-answer">{item.content}</div>
                </Collapse.Panel>
              ))}
            </Collapse>
          </div>
        </div>

        {/* 底部间距 */}
        <div className="hc-bottom-spacer" />
      </div>
    </div>
  )
}

export default HelpCenter
