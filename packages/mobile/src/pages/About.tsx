import React from 'react'
import { useNavigate } from 'react-router-dom'
import logoImg from '../assets/logo.png'
import './About.css'

// 信息项组件
const InfoItem = ({ label, value }: { label: string; value: string }) => (
  <div className="about-info-item">
    <span className="about-info-label">{label}</span>
    <span className="about-info-value">{value}</span>
  </div>
)

// 优势项组件
const AdvantageItem = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <div className="about-advantage-item">
    <div className="about-advantage-icon">{icon}</div>
    <div className="about-advantage-content">
      <div className="about-advantage-title">{title}</div>
      <div className="about-advantage-desc">{desc}</div>
    </div>
  </div>
)

// 产品卡片组件
const ProductCard = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <div className="about-product-card">
    <div className="about-product-icon">{icon}</div>
    <div className="about-product-title">{title}</div>
    <div className="about-product-desc">{desc}</div>
  </div>
)

const About: React.FC = () => {
  const navigate = useNavigate()

  const handleBack = () => {
    navigate(-1)
  }

  return (
    <div className="about-page">
      {/* 顶部导航 */}
      <div className="about-header">
        <button className="about-back-btn" onClick={handleBack} type="button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="about-header-title">关于我们</h1>
        <div className="about-header-placeholder" />
      </div>

      {/* 内容区域 */}
      <div className="about-content">
        {/* Logo区域 */}
        <div className="about-logo-section">
          <div className="about-logo-wrap">
            <img src={logoImg} alt="多客" className="about-logo-img" />
          </div>
          <div className="about-logo-name">多客 Duoke</div>
          <div className="about-logo-slogan">让理财更简单</div>
        </div>

        {/* 公司简介 */}
        <div className="about-section">
          <div className="about-section-header">
            <div className="about-section-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="9 22 9 12 15 12 15 22" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="about-section-title">公司简介</h2>
          </div>
          <div className="about-section-body">
            <p className="about-desc-text">
              多客（Duoke）是一家专注于互联网金融科技的创新型企业，致力于为用户提供安全、便捷、高收益的理财服务。公司秉承"让理财更简单"的理念，通过先进的技术手段和严格的风控体系，为广大用户打造一站式智能理财平台。
            </p>
          </div>
        </div>

        {/* 核心产品 */}
        <div className="about-section">
          <div className="about-section-header">
            <div className="about-section-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17l10 5 10-5" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12l10 5 10-5" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="about-section-title">核心产品</h2>
          </div>
          <div className="about-section-body">
            <div className="about-product-list">
              <ProductCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="6" width="20" height="12" rx="2" stroke="#F0B90B" strokeWidth="2"/>
                    <line x1="2" y1="10" x2="22" y2="10" stroke="#F0B90B" strokeWidth="2"/>
                    <circle cx="7" cy="14" r="1" fill="#F0B90B"/>
                  </svg>
                }
                title="零钱保"
                desc="活期理财产品，灵活存取，每日计息"
              />
              <ProductCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" stroke="#F0B90B" strokeWidth="2"/>
                    <path d="M12 6v6l4 2" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                }
                title="智能投顾"
                desc="基于AI算法的个性化投资建议"
              />
              <ProductCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M9 12l2 2 4-4" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                }
                title="安全保障"
                desc="银行级加密技术，资金安全有保障"
              />
            </div>
          </div>
        </div>

        {/* 企业优势 */}
        <div className="about-section">
          <div className="about-section-header">
            <div className="about-section-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="about-section-title">企业优势</h2>
          </div>
          <div className="about-section-body">
            <AdvantageItem
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="9" cy="7" r="4" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M16 3.13a4 4 0 010 7.75" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              }
              title="专业团队"
              desc="金融+技术双背景核心团队"
            />
            <AdvantageItem
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="14 2 14 8 20 8" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 15l2 2 4-4" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
              title="合规运营"
              desc="持有相关金融牌照"
            />
            <AdvantageItem
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="4" width="16" height="16" rx="2" ry="2" stroke="#F0B90B" strokeWidth="2"/>
                  <rect x="9" y="9" width="6" height="6" stroke="#F0B90B" strokeWidth="2"/>
                  <line x1="9" y1="1" x2="9" y2="4" stroke="#F0B90B" strokeWidth="2"/>
                  <line x1="15" y1="1" x2="15" y2="4" stroke="#F0B90B" strokeWidth="2"/>
                  <line x1="9" y1="20" x2="9" y2="23" stroke="#F0B90B" strokeWidth="2"/>
                  <line x1="15" y1="20" x2="15" y2="23" stroke="#F0B90B" strokeWidth="2"/>
                </svg>
              }
              title="技术驱动"
              desc="AI赋能的智能风控系统"
            />
            <AdvantageItem
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
              title="用户至上"
              desc="7x24小时客服支持"
            />
          </div>
        </div>

        {/* 联系我们 */}
        <div className="about-section">
          <div className="about-section-header">
            <div className="about-section-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="about-section-title">联系我们</h2>
          </div>
          <div className="about-section-body">
            <InfoItem label="官网" value="www.duokeer.com" />
            <InfoItem label="微信公众号" value="多客宝" />
            <InfoItem label="客服邮箱" value="229834571@qq.com" />
            <InfoItem label="公司地址" value="杭州市萧山区汇宇智创园" />
          </div>
        </div>

        {/* 版本信息 */}
        <div className="about-version">
          <div className="about-version-item">
            <span className="about-version-label">当前版本</span>
            <span className="about-version-value">v1.0.0</span>
          </div>
          <div className="about-version-item">
            <span className="about-version-label">更新日期</span>
            <span className="about-version-value">2026年</span>
          </div>
        </div>

        {/* 底部间距 */}
        <div className="about-bottom-spacer" />
      </div>
    </div>
  )
}

export default About
