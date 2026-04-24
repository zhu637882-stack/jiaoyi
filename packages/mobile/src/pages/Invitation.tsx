import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Toast } from 'antd-mobile'
import { invitationApi } from '../services/api'
import './Invitation.css'

// 返回箭头图标
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// 复制图标
const CopyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// 邀请记录状态标签
const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  registered: { label: '已注册', color: '#848E9C', bg: 'rgba(132,142,156,0.12)' },
  subscribed: { label: '已认购', color: '#F0B90B', bg: 'rgba(240,185,11,0.12)' },
  rewarded: { label: '已发放', color: '#0ECB81', bg: 'rgba(14,203,129,0.12)' },
}

const Invitation: React.FC = () => {
  const navigate = useNavigate()
  const [inviteCode, setInviteCode] = useState<string>('')
  const [stats, setStats] = useState<any>(null)
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [codeRes, statsRes, recordsRes] = await Promise.all([
        invitationApi.getMyCode().catch(() => null) as any,
        invitationApi.getStats().catch(() => null) as any,
        invitationApi.getRecords().catch(() => null) as any,
      ])
      const code = codeRes?.data?.code || codeRes?.code || ''
      setInviteCode(code)
      setStats(statsRes?.data || statsRes)
      const list = recordsRes?.data?.list || recordsRes?.data || recordsRes?.list || recordsRes || []
      setRecords(Array.isArray(list) ? list : [])
    } catch (e) {
      console.error('Load invitation data error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = () => {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode).then(() => {
      Toast.show({ content: '邀请码已复制', icon: 'success' })
    }).catch(() => {
      // 兼容不支持clipboard API的场景
      const textarea = document.createElement('textarea')
      textarea.value = inviteCode
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      try {
        document.execCommand('copy')
        Toast.show({ content: '邀请码已复制', icon: 'success' })
      } catch {
        Toast.show({ content: '复制失败，请手动复制', icon: 'fail' })
      }
      document.body.removeChild(textarea)
    })
  }

  const handleCopyLink = () => {
    if (!inviteCode) return
    const origin = window.location.origin
    const link = `${origin}/m/login?tab=register&code=${inviteCode}`
    navigator.clipboard.writeText(link).then(() => {
      Toast.show({ content: '邀请链接已复制', icon: 'success' })
    }).catch(() => {
      const textarea = document.createElement('textarea')
      textarea.value = link
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      try {
        document.execCommand('copy')
        Toast.show({ content: '邀请链接已复制', icon: 'success' })
      } catch {
        Toast.show({ content: '复制失败', icon: 'fail' })
      }
      document.body.removeChild(textarea)
    })
  }

  // 生成二维码URL（使用免费API）
  const getQrUrl = () => {
    if (!inviteCode) return ''
    const origin = window.location.origin
    const registerUrl = `${origin}/m/login?tab=register&code=${inviteCode}`
    return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(registerUrl)}&size=200x200&color=0B0E11&bgcolor=F0B90B`
  }

  // 格式化时间
  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays === 0) return '今天'
    if (diffDays === 1) return '昨天'
    if (diffDays < 30) return `${diffDays}天前`
    return `${date.getMonth() + 1}月${date.getDate()}日`
  }

  return (
    <div className="invitation-page">
      {/* 顶部导航 */}
      <div className="invitation-header">
        <button className="inv-back-btn" onClick={() => navigate(-1)}>
          <BackIcon />
        </button>
        <h1 className="inv-header-title">我的邀请</h1>
        <div className="inv-header-placeholder" />
      </div>

      {loading ? (
        <div className="inv-loading">
          <div className="inv-loading-spinner" />
          <span>加载中...</span>
        </div>
      ) : (
        <div className="inv-content">
          {/* 邀请码卡片 */}
          <div className="inv-code-card">
            <div className="inv-code-header">
              <span className="inv-code-tag">我的专属邀请码</span>
            </div>
            <div className="inv-code-display">
              {inviteCode ? (
                <span className="inv-code-text">{inviteCode}</span>
              ) : (
                <span className="inv-code-empty">暂无邀请码</span>
              )}
            </div>

            {inviteCode && (
              <>
                {/* 二维码 */}
                <div className="inv-qr-section">
                  <div className="inv-qr-wrapper">
                    <img
                      src={getQrUrl()}
                      alt="邀请二维码"
                      className="inv-qr-img"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                  <p className="inv-qr-tip">扫码注册，自动绑定邀请关系</p>
                </div>

                {/* 操作按钮 */}
                <div className="inv-actions">
                  <button className="inv-btn-primary" onClick={handleCopyCode}>
                    <CopyIcon />
                    复制邀请码
                  </button>
                  <button className="inv-btn-secondary" onClick={handleCopyLink}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    复制邀请链接
                  </button>
                </div>
              </>
            )}
          </div>

          {/* 奖励规则说明 */}
          <div className="inv-rule-card">
            <div className="inv-rule-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#F0B90B" strokeWidth="2"/>
                <line x1="12" y1="8" x2="12" y2="12" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="16" x2="12.01" y2="16" stroke="#F0B90B" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span>邀请奖励规则</span>
            </div>
            <div className="inv-rule-list">
              <div className="inv-rule-item">
                <span className="inv-rule-dot" />
                <span>好友通过你的邀请码注册并完成首次认购</span>
              </div>
              <div className="inv-rule-item">
                <span className="inv-rule-dot" />
                <span>你将获得 <strong className="inv-rule-highlight">¥10</strong> 奖励金</span>
              </div>
              <div className="inv-rule-item">
                <span className="inv-rule-dot" />
                <span>好友同时获得 <strong className="inv-rule-highlight">¥5</strong> 体验金</span>
              </div>
              <div className="inv-rule-item">
                <span className="inv-rule-dot" />
                <span>每人最多可邀请 50 位好友</span>
              </div>
            </div>
          </div>

          {/* 邀请统计 */}
          {stats && (
            <div className="inv-stats-card">
              <div className="inv-stats-title">邀请统计</div>
              <div className="inv-stats-grid">
                <div className="inv-stat-item">
                  <span className="inv-stat-value">{stats.invitedCount ?? 0}</span>
                  <span className="inv-stat-label">已邀请</span>
                </div>
                <div className="inv-stat-divider" />
                <div className="inv-stat-item">
                  <span className="inv-stat-value">{stats.remainingQuota ?? 50}</span>
                  <span className="inv-stat-label">剩余名额</span>
                </div>
                <div className="inv-stat-divider" />
                <div className="inv-stat-item">
                  <span className="inv-stat-value inv-stat-gold">¥{Number(stats.totalReward ?? 0).toFixed(2)}</span>
                  <span className="inv-stat-label">累计奖励</span>
                </div>
              </div>
            </div>
          )}

          {/* 邀请记录 */}
          <div className="inv-records-section">
            <div className="inv-records-title">邀请记录</div>
            {records.length === 0 ? (
              <div className="inv-records-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#2B3139" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="9" cy="7" r="4" stroke="#2B3139" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="#2B3139" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="#2B3139" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p>暂无邀请记录</p>
                <p className="inv-empty-sub">快去邀请好友吧！</p>
              </div>
            ) : (
              <div className="inv-records-list">
                {records.map((record: any, index: number) => {
                  const statusInfo = statusMap[record.status] || statusMap['registered']
                  return (
                    <div key={record.id || index} className="inv-record-item">
                      <div className="inv-record-avatar">
                        <span>{(record.inviteeName || record.username || '?').charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="inv-record-info">
                        <div className="inv-record-name">{record.inviteeName || record.username || '未知用户'}</div>
                        <div className="inv-record-time">{formatTime(record.createdAt || record.joinedAt)}</div>
                      </div>
                      <div className="inv-record-right">
                        <span
                          className="inv-record-status"
                          style={{ color: statusInfo.color, backgroundColor: statusInfo.bg }}
                        >
                          {statusInfo.label}
                        </span>
                        {record.rewardAmount && Number(record.rewardAmount) > 0 && (
                          <span className="inv-record-reward">+¥{Number(record.rewardAmount).toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Invitation
