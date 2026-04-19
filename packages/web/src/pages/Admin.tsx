import { useEffect, useState, useCallback } from 'react'
import './Admin.css'
import { Card, Tabs, Typography, Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, DatePicker, message, Popconfirm, Statistic, Row, Col, Divider, Alert, Steps } from 'antd'
import { UserOutlined, MedicineBoxOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ShoppingCartOutlined, CalculatorOutlined, CheckCircleOutlined, ArrowRightOutlined, DollarOutlined, BarChartOutlined, OrderedListOutlined, WalletOutlined, FileTextOutlined, NotificationOutlined, SendOutlined, SwapOutlined, AuditOutlined, ReloadOutlined } from '@ant-design/icons'
import { drugApi, salesApi, settlementApi, adminApi, subscriptionApi, accountApi, systemMessageApi, yieldApi } from '../services/api'
import logoPng from '../assets/logo.png'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select

// 药品状态枚举
enum DrugStatus {
  PENDING = 'pending',
  FUNDING = 'funding',
  SELLING = 'selling',
  COMPLETED = 'completed',
}

// 用户状态枚举
enum UserStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

// 用户数据类型
interface User {
  id: string
  username: string
  role: 'admin' | 'investor'
  status: UserStatus
  realName?: string
  phone?: string
  reviewRemark?: string
  reviewedAt?: string
  createdAt: string
  updatedAt?: string
}

// 药品数据类型
interface Drug {
  id: string
  name: string
  code: string
  purchasePrice: number
  sellingPrice: number
  totalQuantity: number
  fundedQuantity: number
  remainingQuantity: number
  status: DrugStatus
  annualRate: number
  batchNo: string
  unitFee: number
  createdAt: string
}

// 销售记录数据类型
interface SalesRecord {
  id: string
  drugId: string
  drugName: string
  drugCode: string
  saleDate: string
  quantity: number
  actualSellingPrice: number
  totalRevenue: number
  terminal: string
  createdAt: string
}

// 清算记录数据类型
interface SettlementRecord {
  id: string
  drugId: string
  drugName: string
  drugCode: string
  settlementDate: string
  totalSalesRevenue: number
  totalCost: number
  totalFees: number
  totalInterest: number
  netProfit: number
  investorProfitShare: number
  platformProfitShare: number
  investorLossShare: number
  platformLossShare: number
  settledPrincipal: number
  settledOrderCount: number
  status: string
  createdAt: string
}

// 委托订单数据类型
interface PendingOrder {
  id: string
  orderNo: string
  userId: string
  username: string
  realName?: string
  drugId: string
  drugName: string
  drugCode: string
  type: 'limit_buy' | 'limit_sell'
  targetPrice: number
  quantity: number
  filledQuantity: number
  frozenAmount: number  // deprecated: pending_orders已移除，保留兼容
  status: 'pending' | 'triggered' | 'cancelled' | 'expired' | 'partial'
  expireAt?: string
  triggeredAt?: string
  fundingOrderId?: string
  createdAt: string
}

// 委托统计类型
interface PendingOrderStats {
  pendingCount: number
  triggeredCount: number
  cancelledCount: number
  expiredCount: number
  totalFrozenAmount: number
}

// 用户余额数据类型
interface UserBalance {
  userId: string
  username: string
  realName?: string
  availableBalance: number
  frozenBalance: number
  totalProfit: number
  totalInvested: number
}

// 资金总览类型
interface AccountOverview {
  totalRecharge: number
  totalWithdraw: number
  totalFrozen: number
  totalAvailable: number
  activeUserCount: number
}

// 审计日志类型
interface AuditLog {
  id: string
  userId: string
  action: string
  targetType: string
  targetId: string
  detail: string
  ipAddress: string
  createdAt: string
}

// 系统消息类型
interface SystemMessage {
  id: string
  title: string
  content: string
  type: 'announcement' | 'notification' | 'maintenance'
  status: 'draft' | 'published' | 'archived'
  publishedBy?: string
  publishedAt?: string
  createdAt: string
  updatedAt: string
}

// 审计日志动作类型映射
const auditActionMap: Record<string, { label: string; color: string }> = {
  LOGIN: { label: '登录', color: '#1890FF' },
  PRICE_UPDATE: { label: '调价', color: '#FAAD14' },
  FORCE_CANCEL: { label: '撤单', color: '#00b96b' },
  SETTLEMENT: { label: '清算', color: '#52C41A' },
  RECHARGE: { label: '充值', color: '#cf1322' },
  WITHDRAW: { label: '提现', color: '#00b96b' },
  SELL: { label: '卖出', color: '#722ED1' },
}

// 系统消息类型映射
const messageTypeMap: Record<string, { label: string; color: string }> = {
  announcement: { label: '公告', color: '#D4A017' },
  notification: { label: '通知', color: '#1890FF' },
  maintenance: { label: '维护', color: '#FA8C16' },
}

// 系统消息状态映射
const messageStatusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: '#8B949E' },
  published: { label: '已发布', color: '#52C41A' },
  archived: { label: '已归档', color: '#FAAD14' },
}

const Admin = () => {
  const [activeTab, setActiveTab] = useState('users')
  const [drugs, setDrugs] = useState<Drug[]>([])
  const [drugsLoading, setDrugsLoading] = useState(false)
  const [isDrugModalOpen, setIsDrugModalOpen] = useState(false)
  const [editingDrug, setEditingDrug] = useState<Drug | null>(null)
  const [drugForm] = Form.useForm()
  const [submitLoading, setSubmitLoading] = useState(false)

  // 用户管理状态
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [userSearchText, setUserSearchText] = useState<string>('')
  const [userStatusFilter, setUserStatusFilter] = useState<UserStatus | 'all'>('all')
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [reviewingUser, setReviewingUser] = useState<User | null>(null)
  const [reviewForm] = Form.useForm()
  const [reviewLoading, setReviewLoading] = useState(false)

  // 销售管理状态
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false)
  const [editingSales, setEditingSales] = useState<SalesRecord | null>(null)
  const [salesForm] = Form.useForm()
  const [salesFilterDrug, setSalesFilterDrug] = useState<string>('')

  // 清算管理状态
  const [settlements, setSettlements] = useState<SettlementRecord[]>([])
  const [settlementsLoading, setSettlementsLoading] = useState(false)
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false)
  const [settlementPreview, setSettlementPreview] = useState<any>(null)
  const [settlementPreviewLoading, setSettlementPreviewLoading] = useState(false)
  const [settlementForm] = Form.useForm()
  const [settlementSummary, setSettlementSummary] = useState<any>(null)

  // 委托管理状态
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([])
  const [pendingOrdersLoading, setPendingOrdersLoading] = useState(false)
  const [pendingOrderStats, setPendingOrderStats] = useState<PendingOrderStats | null>(null)
  const [pendingOrderFilterStatus, setPendingOrderFilterStatus] = useState<string>('')
  const [pendingOrderPage, setPendingOrderPage] = useState(1)
  const [pendingOrderPageSize, setPendingOrderPageSize] = useState(10)
  const [pendingOrderTotal, setPendingOrderTotal] = useState(0)
  const [returnReviewList, setReturnReviewList] = useState<any[]>([])

  // 资金监控状态
  const [userBalances, setUserBalances] = useState<UserBalance[]>([])
  const [userBalancesLoading, setUserBalancesLoading] = useState(false)
  const [accountOverview, setAccountOverview] = useState<AccountOverview | null>(null)
  const [balancePage, setBalancePage] = useState(1)
  const [balancePageSize, setBalancePageSize] = useState(10)
  const [balanceTotal, setBalanceTotal] = useState(0)
  const [balanceSearchText, setBalanceSearchText] = useState<string>('')

  // 审计日志状态
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditLogsLoading, setAuditLogsLoading] = useState(false)
  const [auditLogFilterAction, setAuditLogFilterAction] = useState<string>('')
  const [auditLogPage, setAuditLogPage] = useState(1)
  const [auditLogPageSize, setAuditLogPageSize] = useState(10)
  const [auditLogTotal, setAuditLogTotal] = useState(0)

  // 出金管理状态
  const [withdrawOrders, setWithdrawOrders] = useState<any[]>([])
  const [withdrawOrdersLoading, setWithdrawOrdersLoading] = useState(false)
  const [withdrawFilterStatus, setWithdrawFilterStatus] = useState<string>('')
  const [withdrawPage, setWithdrawPage] = useState(1)
  const [withdrawTotal, setWithdrawTotal] = useState(0)

  // 出金确认/驳回弹窗状态
  const [approveModalVisible, setApproveModalVisible] = useState(false)
  const [approveOrderId, setApproveOrderId] = useState<string>('')
  const [approveOrderInfo, setApproveOrderInfo] = useState<any>(null)
  const [approveForm] = Form.useForm()
  const [approveLoading, setApproveLoading] = useState(false)

  const [rejectModalVisible, setRejectModalVisible] = useState(false)
  const [rejectOrderId, setRejectOrderId] = useState<string>('')
  const [rejectOrderInfo, setRejectOrderInfo] = useState<any>(null)
  const [rejectForm] = Form.useForm()
  const [rejectLoading, setRejectLoading] = useState(false)

  // 系统消息管理状态
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([])
  const [systemMessagesLoading, setSystemMessagesLoading] = useState(false)
  const [systemMessageFilterStatus, setSystemMessageFilterStatus] = useState<string>('')
  const [systemMessagePage, setSystemMessagePage] = useState(1)
  const [systemMessagePageSize, setSystemMessagePageSize] = useState(10)
  const [systemMessageTotal, setSystemMessageTotal] = useState(0)
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false)
  const [editingMessage, setEditingMessage] = useState<SystemMessage | null>(null)
  const [messageForm] = Form.useForm()

  // 补贴金管理状态
  const [pendingSubsidyList, setPendingSubsidyList] = useState<any[]>([])
  const [pendingSubsidyLoading, setPendingSubsidyLoading] = useState(false)
  const [subsidyYieldDate, setSubsidyYieldDate] = useState<string>(dayjs().format('YYYY-MM-DD'))


  // 获取药品列表
  const fetchDrugs = useCallback(async () => {
    setDrugsLoading(true)
    try {
      const res: any = await drugApi.getDrugs({ page: 1, pageSize: 100 })
      if (res.success) {
        setDrugs(res.data.items)
      }
    } catch (error) {
      console.error('获取药品列表失败:', error)
      message.error('获取药品列表失败')
    } finally {
      setDrugsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    } else if (activeTab === 'drugs') {
      fetchDrugs()
    } else if (activeTab === 'sales') {
      fetchSales()
    } else if (activeTab === 'settlements') {
      fetchSettlements()
      fetchSettlementSummary()
    } else if (activeTab === 'pendingOrders') {
      fetchPendingOrders()
      fetchPendingOrderStats()
    } else if (activeTab === 'fundMonitor') {
      fetchUserBalances()
      fetchAccountOverview()
    } else if (activeTab === 'auditLogs') {
      fetchAuditLogs()
    } else if (activeTab === 'systemMessages') {
      fetchSystemMessages()
    } else if (activeTab === 'withdrawOrders') {
      fetchWithdrawOrders()
    } else if (activeTab === 'returnReview') {
      fetchReturnReviewList()
    } else if (activeTab === 'subsidy') {
      fetchPendingSubsidy()
    }
  }, [activeTab, fetchDrugs])

  // 获取用户列表
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res: any = await adminApi.getUsers()
      // API 直接返回用户数组
      if (Array.isArray(res)) {
        setUsers(res)
      } else if (res.success && res.data) {
        setUsers(res.data)
      }
    } catch (error) {
      console.error('获取用户列表失败:', error)
      message.error('获取用户列表失败')
    } finally {
      setUsersLoading(false)
    }
  }, [])

  // 打开审核用户弹窗
  const handleReviewUser = (record: User) => {
    setReviewingUser(record)
    reviewForm.resetFields()
    setIsReviewModalOpen(true)
  }

  // 提交审核
  const handleReviewSubmit = async (values: { status: UserStatus; remark?: string }) => {
    if (!reviewingUser) return
    setReviewLoading(true)
    try {
      const res: any = await adminApi.reviewUser(reviewingUser.id, values)
      if (res.message) {
        message.success(res.message)
        setIsReviewModalOpen(false)
        fetchUsers()
      }
    } catch (error) {
      console.error('审核失败:', error)
      message.error('审核失败')
    } finally {
      setReviewLoading(false)
    }
  }

  // ==================== 药品管理 ====================

  // 打开新增药品弹窗
  const handleAddDrug = () => {
    setEditingDrug(null)
    drugForm.resetFields()
    setIsDrugModalOpen(true)
  }

  // 打开编辑药品弹窗
  const handleEditDrug = (record: Drug) => {
    setEditingDrug(record)
    drugForm.setFieldsValue({
      name: record.name,
      code: record.code,
      purchasePrice: record.purchasePrice,
      sellingPrice: record.sellingPrice,
      totalQuantity: record.totalQuantity,
      batchNo: record.batchNo,
      annualRate: record.annualRate,
      unitFee: record.unitFee,
    })
    setIsDrugModalOpen(true)
  }

  // 提交药品表单
  const handleSubmitDrug = async () => {
    try {
      const values = await drugForm.validateFields()
      setSubmitLoading(true)

      if (editingDrug) {
        const res: any = await drugApi.updateDrug(editingDrug.id, values)
        if (res.success) {
          message.success('药品更新成功')
          setIsDrugModalOpen(false)
          fetchDrugs()
        }
      } else {
        const res: any = await drugApi.createDrug(values)
        if (res.success) {
          message.success('药品创建成功')
          setIsDrugModalOpen(false)
          fetchDrugs()
        }
      }
    } catch (error) {
      console.error('提交失败:', error)
    } finally {
      setSubmitLoading(false)
    }
  }

  // 删除药品
  const handleDeleteDrug = async (id: string) => {
    try {
      const res: any = await drugApi.deleteDrug(id)
      if (res.success) {
        message.success('药品删除成功')
        fetchDrugs()
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '删除失败')
    }
  }

  // 切换药品状态
  const handleChangeDrugStatus = async (id: string, status: string) => {
    try {
      const res: any = await drugApi.updateDrugStatus(id, { status })
      if (res.success) {
        message.success('药品状态更新成功')
        fetchDrugs()
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '状态更新失败')
    }
  }

  // ==================== 销售管理 ====================

  // 获取销售记录列表
  const fetchSales = useCallback(async () => {
    setSalesLoading(true)
    try {
      const res: any = await salesApi.getSales({
        drugId: salesFilterDrug || undefined,
        page: 1,
        pageSize: 100,
      })
      if (res.success) {
        setSalesRecords(res.data.list)
      }
    } catch (error) {
      console.error('获取销售记录失败:', error)
      message.error('获取销售记录失败')
    } finally {
      setSalesLoading(false)
    }
  }, [salesFilterDrug])

  // 打开新增销售弹窗
  const handleAddSales = () => {
    setEditingSales(null)
    salesForm.resetFields()
    salesForm.setFieldsValue({
      saleDate: dayjs(),
    })
    setIsSalesModalOpen(true)
  }

  // 打开编辑销售弹窗
  const handleEditSales = (record: SalesRecord) => {
    setEditingSales(record)
    salesForm.setFieldsValue({
      drugId: record.drugId,
      saleDate: dayjs(record.saleDate),
      quantity: record.quantity,
      actualSellingPrice: record.actualSellingPrice,
      terminal: record.terminal,
    })
    setIsSalesModalOpen(true)
  }

  // 提交销售表单
  const handleSubmitSales = async () => {
    try {
      const values = await salesForm.validateFields()
      setSubmitLoading(true)

      const data = {
        ...values,
        saleDate: values.saleDate.format('YYYY-MM-DD'),
      }

      if (editingSales) {
        const res: any = await salesApi.updateSales(editingSales.id, data)
        if (res.success) {
          message.success('销售记录更新成功')
          setIsSalesModalOpen(false)
          fetchSales()
        }
      } else {
        const res: any = await salesApi.createSales(data)
        if (res.success) {
          message.success('销售记录创建成功')
          setIsSalesModalOpen(false)
          fetchSales()
        }
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '提交失败')
    } finally {
      setSubmitLoading(false)
    }
  }

  // 删除销售记录
  const handleDeleteSales = async (id: string) => {
    try {
      const res: any = await salesApi.deleteSales(id)
      if (res.success) {
        message.success('销售记录删除成功')
        fetchSales()
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '删除失败')
    }
  }

  // ==================== 清算管理 ====================

  // 获取清算记录列表
  const fetchSettlements = useCallback(async () => {
    setSettlementsLoading(true)
    try {
      const res: any = await settlementApi.getSettlements({
        page: 1,
        pageSize: 100,
      })
      if (res.success) {
        setSettlements(res.data.list)
      }
    } catch (error) {
      console.error('获取清算记录失败:', error)
      message.error('获取清算记录失败')
    } finally {
      setSettlementsLoading(false)
    }
  }, [])

  // 获取清算汇总统计
  const fetchSettlementSummary = useCallback(async () => {
    try {
      const res: any = await settlementApi.getSettlementSummary()
      if (res.success) {
        setSettlementSummary(res.data)
      }
    } catch (error) {
      console.error('获取清算统计失败:', error)
    }
  }, [])

  // ==================== 认购管理 ====================

  // 获取认购列表
  const fetchPendingOrders = useCallback(async () => {
    setPendingOrdersLoading(true)
    try {
      const res: any = await subscriptionApi.getAdminSubscriptions({
        status: pendingOrderFilterStatus || undefined,
        page: pendingOrderPage,
        limit: pendingOrderPageSize,
      })
      if (res.success) {
        setPendingOrders(res.data?.list || [])
        setPendingOrderTotal(res.data?.pagination?.total || 0)
      }
    } catch (error) {
      console.error('获取认购列表失败:', error)
      message.error('获取认购列表失败')
    } finally {
      setPendingOrdersLoading(false)
    }
  }, [pendingOrderFilterStatus, pendingOrderPage, pendingOrderPageSize])

  // 获取认购统计
  const fetchPendingOrderStats = useCallback(async () => {
    try {
      const res: any = await subscriptionApi.getAdminSubscriptionStats()
      if (res.success) {
        setPendingOrderStats(res.data)
      }
    } catch (error) {
      console.error('获取认购统计失败:', error)
    }
  }, [])

  // 获取退回审核列表
  const fetchReturnReviewList = useCallback(async () => {
    try {
      const res: any = await subscriptionApi.getAdminSubscriptions({ status: 'return_pending', page: 1, limit: 50 })
      setReturnReviewList(res?.data?.list || [])
    } catch (error) {
      console.error('获取退回审核列表失败:', error)
    }
  }, [])

  // ==================== 资金监控 ====================

  // 获取用户余额列表
  const fetchUserBalances = useCallback(async () => {
    setUserBalancesLoading(true)
    try {
      const res: any = await accountApi.adminGetBalances({
        page: balancePage,
        pageSize: balancePageSize,
      })
      if (res.success) {
        setUserBalances(res.data.list)
        setBalanceTotal(res.data.pagination.total)
      }
    } catch (error) {
      console.error('获取用户余额列表失败:', error)
      message.error('获取用户余额列表失败')
    } finally {
      setUserBalancesLoading(false)
    }
  }, [balancePage, balancePageSize])

  // 获取资金总览
  const fetchAccountOverview = useCallback(async () => {
    try {
      const res: any = await accountApi.adminGetOverview()
      if (res.success) {
        setAccountOverview(res.data)
      }
    } catch (error) {
      console.error('获取资金总览失败:', error)
    }
  }, [])

  // ==================== 审计日志 ====================

  // 获取审计日志列表
  const fetchAuditLogs = useCallback(async () => {
    setAuditLogsLoading(true)
    try {
      const res: any = await accountApi.getAuditLogs({
        action: auditLogFilterAction || undefined,
        page: auditLogPage,
        pageSize: auditLogPageSize,
      })
      if (res.success) {
        setAuditLogs(res.data.items)
        setAuditLogTotal(res.data.total)
      }
    } catch (error) {
      console.error('获取审计日志失败:', error)
      message.error('获取审计日志失败')
    } finally {
      setAuditLogsLoading(false)
    }
  }, [auditLogFilterAction, auditLogPage, auditLogPageSize])

  // ==================== 出金管理 ====================

  // 获取出金申请列表
  const fetchWithdrawOrders = useCallback(async () => {
    setWithdrawOrdersLoading(true)
    try {
      const res: any = await accountApi.adminGetWithdrawOrders({
        status: withdrawFilterStatus || undefined,
        page: withdrawPage,
        limit: 10,
      })
      if (res.list) {
        setWithdrawOrders(res.list)
        setWithdrawTotal(res.pagination?.total || 0)
      }
    } catch (error) {
      console.error('获取出金申请失败:', error)
      message.error('获取出金申请失败')
    } finally {
      setWithdrawOrdersLoading(false)
    }
  }, [withdrawFilterStatus, withdrawPage])

  // 获取待填写补贴金列表（自动先生成再加载）
  const fetchPendingSubsidy = useCallback(async () => {
    setPendingSubsidyLoading(true)
    try {
      // 直接从有效认购订单加载客户列表，无需先生成日收益记录
      const res: any = await yieldApi.getPendingSubsidyList({ yieldDate: subsidyYieldDate })
      if (res.success) {
        setPendingSubsidyList(res.data?.list || [])
      }
    } catch (error) {
      console.error('获取补贴金客户列表失败:', error)
      message.error('加载客户列表失败')
    } finally {
      setPendingSubsidyLoading(false)
    }
  }, [subsidyYieldDate])

  // 日期变更时自动重新加载
  useEffect(() => {
    if (activeTab === 'subsidy') {
      fetchPendingSubsidy()
    }
  }, [subsidyYieldDate, activeTab, fetchPendingSubsidy])

  // 提交单条补贴金
  const handleSingleSubsidySubmit = async (record: any, value: number) => {
    if (!value || value <= 0) {
      message.warning('请输入有效的合伙收益金额')
      return
    }
    try {
      const res: any = await yieldApi.fillSubsidy({
        yieldDate: subsidyYieldDate,
        items: [{ orderId: record.orderId, subsidy: value }],
      })
      if (res.success) {
        message.success(res.message || '补贴金填写成功')
        fetchPendingSubsidy()
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '提交补贴金失败')
    }
  }

  // 确认出金 - 打开确认弹窗
  const openApproveModal = (record: any) => {
    setApproveOrderId(record.id)
    setApproveOrderInfo(record)
    approveForm.resetFields()
    setApproveModalVisible(true)
  }

  // 确认出金 - 提交
  const handleApproveWithdraw = async () => {
    try {
      const values = await approveForm.validateFields()
      setApproveLoading(true)
      const res: any = await accountApi.adminApproveWithdraw(approveOrderId, values.bankTransactionNo)
      if (res.success) {
        message.success('出金已确认，冻结余额已扣减')
        setApproveModalVisible(false)
        fetchWithdrawOrders()
      }
    } catch (error: any) {
      if (error.response) {
        const errMsg = error.response?.data?.message
        message.error(Array.isArray(errMsg) ? errMsg.join('; ') : (errMsg || '确认出金失败'))
      }
    } finally {
      setApproveLoading(false)
    }
  }

  // 驳回出金 - 打开驳回弹窗
  const openRejectModal = (record: any) => {
    setRejectOrderId(record.id)
    setRejectOrderInfo(record)
    rejectForm.resetFields()
    setRejectModalVisible(true)
  }

  // 驳回出金 - 提交
  const handleRejectWithdraw = async () => {
    try {
      const values = await rejectForm.validateFields()
      setRejectLoading(true)
      const res: any = await accountApi.adminRejectWithdraw(rejectOrderId, values.rejectReason)
      if (res.success) {
        message.success('出金申请已驳回，余额已退回')
        setRejectModalVisible(false)
        fetchWithdrawOrders()
      }
    } catch (error: any) {
      if (error.response) {
        const errMsg = error.response?.data?.message
        message.error(Array.isArray(errMsg) ? errMsg.join('; ') : (errMsg || '驳回出金失败'))
      }
    } finally {
      setRejectLoading(false)
    }
  }

  // ==================== 系统消息管理 ====================

  // 获取系统消息列表
  const fetchSystemMessages = useCallback(async () => {
    setSystemMessagesLoading(true)
    try {
      const res: any = await systemMessageApi.adminGetList({
        status: systemMessageFilterStatus || undefined,
        page: systemMessagePage,
        pageSize: systemMessagePageSize,
      })
      if (res.success) {
        setSystemMessages(res.data.list)
        setSystemMessageTotal(res.data.pagination.total)
      }
    } catch (error) {
      console.error('获取系统消息失败:', error)
      message.error('获取系统消息失败')
    } finally {
      setSystemMessagesLoading(false)
    }
  }, [systemMessageFilterStatus, systemMessagePage, systemMessagePageSize])

  // 打开新增消息弹窗
  const handleAddMessage = () => {
    setEditingMessage(null)
    messageForm.resetFields()
    messageForm.setFieldsValue({ type: 'announcement' })
    setIsMessageModalOpen(true)
  }

  // 打开编辑消息弹窗
  const handleEditMessage = (record: SystemMessage) => {
    setEditingMessage(record)
    messageForm.setFieldsValue({
      title: record.title,
      content: record.content,
      type: record.type,
    })
    setIsMessageModalOpen(true)
  }

  // 提交消息表单
  const handleSubmitMessage = async () => {
    try {
      const values = await messageForm.validateFields()
      setSubmitLoading(true)

      if (editingMessage) {
        const res: any = await systemMessageApi.adminUpdate(editingMessage.id, values)
        if (res.success) {
          message.success('消息更新成功')
          setIsMessageModalOpen(false)
          fetchSystemMessages()
        }
      } else {
        const res: any = await systemMessageApi.adminCreate(values)
        if (res.success) {
          message.success('消息创建成功')
          setIsMessageModalOpen(false)
          fetchSystemMessages()
        }
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '提交失败')
    } finally {
      setSubmitLoading(false)
    }
  }

  // 删除消息
  const handleDeleteMessage = async (id: string) => {
    try {
      const res: any = await systemMessageApi.adminDelete(id)
      if (res.success) {
        message.success('消息删除成功')
        fetchSystemMessages()
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '删除失败')
    }
  }

  // 发布消息
  const handlePublishMessage = async (id: string) => {
    try {
      const res: any = await systemMessageApi.adminPublish(id)
      if (res.success) {
        message.success('消息发布成功')
        fetchSystemMessages()
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '发布失败')
    }
  }

  // 预览清算
  const handlePreviewSettlement = async () => {
    try {
      const values = await settlementForm.validateFields()
      setSettlementPreviewLoading(true)

      const res: any = await settlementApi.getSettlementPreview(
        values.drugId,
        values.date.format('YYYY-MM-DD')
      )

      if (res.success) {
        setSettlementPreview(res.data)
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '预览失败')
    } finally {
      setSettlementPreviewLoading(false)
    }
  }

  // 执行清算
  const handleExecuteSettlement = async () => {
    try {
      const values = await settlementForm.validateFields()
      setSubmitLoading(true)

      const res: any = await settlementApi.executeSettlement({
        drugId: values.drugId,
        settlementDate: values.date.format('YYYY-MM-DD'),
      })

      if (res.success) {
        message.success('清算执行成功')
        setIsSettlementModalOpen(false)
        setSettlementPreview(null)
        settlementForm.resetFields()
        fetchSettlements()
        fetchSettlementSummary()
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '清算失败')
    } finally {
      setSubmitLoading(false)
    }
  }

  // 状态标签渲染
  const renderStatus = (status: DrugStatus) => {
    const config: Record<DrugStatus, { className: string; text: string }> = {
      [DrugStatus.PENDING]: { className: 'status-tag-pending', text: '待发布' },
      [DrugStatus.FUNDING]: { className: 'status-tag-funding', text: '垫资中' },
      [DrugStatus.SELLING]: { className: 'status-tag-selling', text: '销售中' },
      [DrugStatus.COMPLETED]: { className: 'status-tag-completed', text: '已完成' },
    }
    const { className, text } = config[status] || { className: 'status-tag-pending', text: status }
    return (
      <Tag className={`status-tag ${className}`}>
        {text}
      </Tag>
    )
  }

  // 用户表格列
  const userColumns: ColumnsType<User> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => <span className="table-cell-primary">{text}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: UserStatus) => {
        const statusMap = {
          [UserStatus.PENDING]: { label: '待审核', color: 'orange' },
          [UserStatus.APPROVED]: { label: '已通过', color: 'green' },
          [UserStatus.REJECTED]: { label: '已拒绝', color: 'red' },
        }
        const config = statusMap[status] || { label: status, color: 'default' }
        return <Tag color={config.color}>{config.label}</Tag>
      },
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag className={`status-tag ${role === 'admin' ? 'status-tag-funding' : 'status-tag-selling'}`}>
          {role === 'admin' ? '管理员' : '投资者'}
        </Tag>
      ),
    },
    {
      title: '姓名',
      dataIndex: 'realName',
      key: 'realName',
      render: (text: string) => <span className="table-cell-primary">{text || '-'}</span>,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      render: (text: string) => <span className="table-cell-tertiary">{text || '-'}</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => (
        <span className="table-cell-tertiary">{text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'}</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space>
          {record.status === UserStatus.PENDING && (
            <Button
              type="primary"
              size="small"
              onClick={() => handleReviewUser(record)}
            >
              审核
            </Button>
          )}
          {record.status === UserStatus.REJECTED && record.reviewRemark && (
            <span className="table-cell-tertiary" style={{ fontSize: 12 }}>
              原因: {record.reviewRemark}
            </span>
          )}
        </Space>
      ),
    },
  ]

  // 药品表格列
  const drugColumns: ColumnsType<Drug> = [
    {
      title: '药品名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Drug) => (
        <div className="table-cell-with-sub">
          <span className="table-cell-primary table-cell-bold">{text}</span>
          <span className="table-cell-code">{record.code}</span>
        </div>
      ),
    },
    {
      title: '采购价',
      dataIndex: 'purchasePrice',
      key: 'purchasePrice',
      align: 'right',
      render: (price: number) => (
        <span className="table-cell-mono">¥{Number(price || 0).toFixed(2)}</span>
      ),
    },
    {
      title: '售价',
      dataIndex: 'sellingPrice',
      key: 'sellingPrice',
      align: 'right',
      render: (price: number) => (
        <span className="table-cell-mono table-cell-bold">¥{Number(price || 0).toFixed(2)}</span>
      ),
    },
    {
      title: '总数量',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      align: 'right',
      render: (quantity: number) => (
        <span className="table-cell-mono">{Number(quantity || 0).toLocaleString()}</span>
      ),
    },
    {
      title: '已认购',
      dataIndex: 'subscribedQuantity',
      key: 'subscribedQuantity',
      align: 'right',
      render: (quantity: number) => (
        <span className="table-cell-mono table-cell-success">{Number(quantity || 0).toLocaleString()}</span>
      ),
    },
    {
      title: '运营费率',
      dataIndex: 'operationFeeRate',
      key: 'operationFeeRate',
      align: 'right',
      render: (rate: number) => (
        <span className="table-cell-mono table-cell-primary-color table-cell-bold">{Number(rate || 0).toFixed(4)}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: DrugStatus) => renderStatus(status),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record: Drug) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditDrug(record)}
            style={{ color: 'var(--color-primary)' }}
          >
            编辑
          </Button>
          {record.status === DrugStatus.PENDING && (
            <Popconfirm
              title="发布药品"
              description="确定将该药品发布为「垫资中」状态？"
              onConfirm={() => handleChangeDrugStatus(record.id, DrugStatus.FUNDING)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                size="small"
                icon={<SwapOutlined />}
                style={{ color: '#FAAD14' }}
              >
                发布
              </Button>
            </Popconfirm>
          )}
          {record.status === DrugStatus.FUNDING && (
            <Popconfirm
              title="开始销售"
              description="确定将该药品状态切换为「销售中」？"
              onConfirm={() => handleChangeDrugStatus(record.id, DrugStatus.SELLING)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                size="small"
                icon={<SwapOutlined />}
                style={{ color: '#00b96b' }}
              >
                开售
              </Button>
            </Popconfirm>
          )}
          {record.status === DrugStatus.SELLING && (
            <Popconfirm
              title="完成销售"
              description="确定将该药品标记为「已完成」？"
              onConfirm={() => handleChangeDrugStatus(record.id, DrugStatus.COMPLETED)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                size="small"
                icon={<CheckCircleOutlined />}
                style={{ color: '#52C41A' }}
              >
                完成
              </Button>
            </Popconfirm>
          )}
          {record.status === DrugStatus.PENDING && (
            <Popconfirm
              title="确认删除"
              description="确定要删除该药品吗？此操作不可恢复。"
              onConfirm={() => handleDeleteDrug(record.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                danger
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  // 销售记录表格列
  const salesColumns: ColumnsType<SalesRecord> = [
    {
      title: '药品',
      dataIndex: 'drugName',
      key: 'drugName',
      render: (text: string, record: SalesRecord) => (
        <div className="table-cell-with-sub">
          <span className="table-cell-primary table-cell-bold">{text}</span>
          <span className="table-cell-code">{record.drugCode}</span>
        </div>
      ),
    },
    {
      title: '销售日期',
      dataIndex: 'saleDate',
      key: 'saleDate',
      render: (date: string) => (
        <span className="table-cell-mono">{dayjs(date).format('YYYY-MM-DD')}</span>
      ),
    },
    {
      title: '终端',
      dataIndex: 'terminal',
      key: 'terminal',
      render: (terminal: string) => (
        <Tag className="terminal-tag">
          {terminal}
        </Tag>
      ),
    },
    {
      title: '销量',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
      render: (quantity: number) => (
        <span className="table-cell-mono">{Number(quantity || 0).toLocaleString()}</span>
      ),
    },
    {
      title: '实际售价',
      dataIndex: 'actualSellingPrice',
      key: 'actualSellingPrice',
      align: 'right',
      render: (price: number) => (
        <span className="table-cell-mono">¥{Number(price || 0).toFixed(2)}</span>
      ),
    },
    {
      title: '总销售额',
      dataIndex: 'totalRevenue',
      key: 'totalRevenue',
      align: 'right',
      render: (revenue: number) => (
        <span className="table-cell-mono table-cell-success table-cell-bold">¥{Number(revenue || 0).toFixed(2)}</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, record: SalesRecord) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditSales(record)}
            style={{ color: 'var(--color-primary)' }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="确定要删除该销售记录吗？"
            onConfirm={() => handleDeleteSales(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              danger
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 清算记录表格列
  const settlementColumns: ColumnsType<SettlementRecord> = [
    {
      title: '药品',
      dataIndex: 'drugName',
      key: 'drugName',
      render: (text: string, record: SettlementRecord) => (
        <div className="table-cell-with-sub">
          <span className="table-cell-primary table-cell-bold">{text}</span>
          <span className="table-cell-code">{record.drugCode}</span>
        </div>
      ),
    },
    {
      title: '清算日期',
      dataIndex: 'settlementDate',
      key: 'settlementDate',
      render: (date: string) => (
        <span className="table-cell-mono">{dayjs(date).format('YYYY-MM-DD')}</span>
      ),
    },
    {
      title: '销售额',
      dataIndex: 'totalSalesRevenue',
      key: 'totalSalesRevenue',
      align: 'right',
      render: (value: number) => (
        <span className="table-cell-mono">¥{Number(value || 0).toFixed(2)}</span>
      ),
    },
    {
      title: '净利润',
      dataIndex: 'netProfit',
      key: 'netProfit',
      align: 'right',
      render: (value: number) => (
        <span className={`table-cell-mono table-cell-bold ${value >= 0 ? 'table-cell-success' : 'table-cell-error'}`}>
          {value >= 0 ? '+' : ''}¥{Number(value || 0).toFixed(2)}
        </span>
      ),
    },
    {
      title: '垫资方分润',
      dataIndex: 'investorProfitShare',
      key: 'investorProfitShare',
      align: 'right',
      render: (value: number, record: SettlementRecord) => {
        const displayValue = value > 0 ? value : record.investorLossShare
        return (
          <span className={`table-cell-mono ${value > 0 ? 'table-cell-success' : 'table-cell-error'}`}>
            {value > 0 ? '+' : '-'}¥{Number(displayValue || 0).toFixed(2)}
          </span>
        )
      },
    },
    {
      title: '解套订单数',
      dataIndex: 'settledOrderCount',
      key: 'settledOrderCount',
      align: 'center',
      render: (value: number) => (
        <span className="table-cell-mono">{value}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag className={`status-tag ${status === 'completed' ? 'status-tag-selling' : 'status-tag-warning'}`}>
          {status === 'completed' ? '已完成' : '处理中'}
        </Tag>
      ),
    },
  ]

  // 委托订单表格列
  const pendingOrderColumns: ColumnsType<PendingOrder> = [
    {
      title: '订单号',
      dataIndex: 'orderNo',
      key: 'orderNo',
      render: (text: string) => (
        <span style={{ fontFamily: 'monospace', color: '#58A6FF', fontSize: 12 }}>{text}</span>
      ),
    },
    {
      title: '客户',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: any) => (
        <div className="table-cell-with-sub">
          <span className="table-cell-primary table-cell-bold">{record.realName || text}</span>
          <span className="table-cell-code">{text}</span>
        </div>
      ),
    },
    {
      title: '药品',
      dataIndex: 'drugName',
      key: 'drugName',
      render: (text: string, record: any) => (
        <div className="table-cell-with-sub">
          <span className="table-cell-primary">{text || '-'}</span>
          <span className="table-cell-code">{record.drugCode || '-'}</span>
        </div>
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
      render: (quantity: number) => (
        <span className="table-cell-mono">
          {Number(quantity || 0).toLocaleString()} 盒
        </span>
      ),
    },
    {
      title: '认购金额',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (amount: number) => (
        <span className="table-cell-mono">¥{Number(amount || 0).toFixed(2)}</span>
      ),
    },
    {
      title: '未结金额',
      dataIndex: 'unsettledAmount',
      key: 'unsettledAmount',
      align: 'right',
      render: (amount: number) => (
        <span className="table-cell-mono table-cell-warning">¥{Number(amount || 0).toFixed(2)}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config: Record<string, { className: string; text: string }> = {
          confirmed: { className: 'status-tag-warning', text: '已确认' },
          effective: { className: 'status-tag-success', text: '生效中' },
          cancelled: { className: 'status-tag-default', text: '已取消' },
          settled: { className: 'status-tag-success', text: '已结算' },
        }
        const { className, text } = config[status] || { className: 'status-tag-default', text: status }
        return (
          <Tag className={`status-tag ${className}`}>
            {text}
          </Tag>
        )
      },
    },
    {
      title: '生效时间',
      dataIndex: 'effectiveAt',
      key: 'effectiveAt',
      render: (text: string) => (
        <span className="table-cell-tertiary">{text ? dayjs(text).format('MM-DD HH:mm') : '-'}</span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => (
        <span className="table-cell-tertiary">{text ? dayjs(text).format('MM-DD HH:mm') : '-'}</span>
      ),
    },
  ]

  // 用户余额表格列
  const userBalanceColumns: ColumnsType<UserBalance> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => <span className="table-cell-primary table-cell-bold">{text || '-'}</span>,
    },
    {
      title: '真实姓名',
      dataIndex: 'realName',
      key: 'realName',
      render: (text: string) => <span className="table-cell-primary">{text || '-'}</span>,
    },
    {
      title: '可用余额',
      dataIndex: 'availableBalance',
      key: 'availableBalance',
      align: 'right',
      render: (value: number) => (
        <span className="table-cell-mono">¥{Number(value || 0).toFixed(2)}</span>
      ),
    },
    {
      title: '冻结金额',
      dataIndex: 'frozenBalance',
      key: 'frozenBalance',
      align: 'right',
      render: (value: number) => (
        <span className="table-cell-mono table-cell-warning">¥{Number(value || 0).toFixed(2)}</span>
      ),
    },
    {
      title: '累计收益',
      dataIndex: 'totalProfit',
      key: 'totalProfit',
      align: 'right',
      render: (value: number) => (
        <span className={`table-cell-mono ${value >= 0 ? 'table-cell-success' : 'table-cell-error'}`}>
          {value >= 0 ? '+' : ''}¥{Number(value || 0).toFixed(2)}
        </span>
      ),
    },
    {
      title: '累计投资',
      dataIndex: 'totalInvested',
      key: 'totalInvested',
      align: 'right',
      render: (value: number) => (
        <span className="table-cell-mono">¥{Number(value || 0).toFixed(2)}</span>
      ),
    },
  ]

  // 审计日志表格列
  const auditLogColumns: ColumnsType<AuditLog> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => (
        <span className="table-cell-mono">{text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'}</span>
      ),
    },
    {
      title: '操作人',
      dataIndex: 'userId',
      key: 'userId',
      width: 220,
      render: (text: string) => (
        <span className="table-cell-code">{text || '-'}</span>
      ),
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (action: string) => {
        const config = auditActionMap[action] || { label: action, color: '#8B949E' }
        return (
          <Tag style={{ background: `${config.color}20`, borderColor: config.color, color: config.color }}>
            {config.label}
          </Tag>
        )
      },
    },
    {
      title: '目标类型',
      dataIndex: 'targetType',
      key: 'targetType',
      width: 120,
      render: (text: string) => <span className="table-cell-tertiary">{text || '-'}</span>,
    },
    {
      title: '目标ID',
      dataIndex: 'targetId',
      key: 'targetId',
      width: 220,
      render: (text: string) => (
        <span className="table-cell-code">{text || '-'}</span>
      ),
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      render: (text: string) => {
        if (!text) return <span className="table-cell-tertiary">-</span>
        try {
          const detail = JSON.parse(text)
          return (
            <span className="table-cell-code" style={{ fontSize: 12 }}>
              {JSON.stringify(detail, null, 2).substring(0, 100)}
              {JSON.stringify(detail).length > 100 ? '...' : ''}
            </span>
          )
        } catch {
          return <span className="table-cell-tertiary">{text}</span>
        }
      },
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
      render: (text: string) => <span className="table-cell-tertiary">{text || '-'}</span>,
    },
  ]

  // 系统消息表格列
  const systemMessageColumns: ColumnsType<SystemMessage> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => (
        <span className="table-cell-primary table-cell-bold">{text}</span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        const config = messageTypeMap[type] || { label: type, color: '#8B949E' }
        return (
          <Tag style={{ background: `${config.color}20`, borderColor: config.color, color: config.color }}>
            {config.label}
          </Tag>
        )
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = messageStatusMap[status] || { label: status, color: '#8B949E' }
        return (
          <Tag style={{ background: `${config.color}20`, borderColor: config.color, color: config.color }}>
            {config.label}
          </Tag>
        )
      },
    },
    {
      title: '发布者',
      dataIndex: 'publishedBy',
      key: 'publishedBy',
      width: 220,
      render: (text: string) => (
        <span className="table-cell-code">{text || '-'}</span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => (
        <span className="table-cell-tertiary">{text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'}</span>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 180,
      render: (text: string) => (
        <span className="table-cell-tertiary">{text ? dayjs(text).format('YYYY-MM-DD HH:mm') : '-'}</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record: SystemMessage) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditMessage(record)}
            style={{ color: 'var(--color-primary)' }}
            disabled={record.status === 'published'}
          >
            编辑
          </Button>
          {record.status === 'draft' && (
            <Button
              type="text"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handlePublishMessage(record.id)}
              style={{ color: 'var(--color-success)' }}
            >
              发布
            </Button>
          )}
          <Popconfirm
            title="确认删除"
            description="确定要删除该消息吗？此操作不可恢复。"
            onConfirm={() => handleDeleteMessage(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              danger
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const tabItems = [
    {
      key: 'users',
      label: (
        <span>
          <UserOutlined style={{ marginRight: 8 }} />
          用户管理
        </span>
      ),
      children: (
        <Card className="admin-content-card">
          <div className="admin-action-bar">
            <Input.Search
              placeholder="搜索用户名/姓名/手机号"
              allowClear
              style={{ width: 280 }}
              value={userSearchText}
              onChange={(e) => setUserSearchText(e.target.value)}
            />
            <Select
              placeholder="筛选状态"
              allowClear
              style={{ width: 120, marginLeft: 12 }}
              value={userStatusFilter}
              onChange={(value) => setUserStatusFilter(value || 'all')}
            >
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value={UserStatus.PENDING}>待审核</Select.Option>
              <Select.Option value={UserStatus.APPROVED}>已通过</Select.Option>
              <Select.Option value={UserStatus.REJECTED}>已拒绝</Select.Option>
            </Select>
          </div>
          <Table
            columns={userColumns}
            dataSource={users.filter(u => {
              // 状态筛选
              if (userStatusFilter !== 'all' && u.status !== userStatusFilter) return false
              // 搜索筛选
              if (!userSearchText) return true
              const keyword = userSearchText.toLowerCase()
              return (
                u.username?.toLowerCase().includes(keyword) ||
                u.realName?.toLowerCase().includes(keyword) ||
                u.phone?.includes(keyword)
              )
            })}
            rowKey="id"
            loading={usersLoading}
            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
            scroll={{ x: 'max-content' }}
            rowClassName={() => 'admin-table-row'}
          />
        </Card>
      ),
    },
    {
      key: 'drugs',
      label: (
        <span>
          <MedicineBoxOutlined style={{ marginRight: 8 }} />
          药品管理
        </span>
      ),
      children: (
        <Card className="admin-content-card">
          <div className="admin-action-bar">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddDrug}
              style={{
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-success) 100%)',
                border: 'none',
              }}
            >
              新增药品
            </Button>
          </div>
          <Table 
            columns={drugColumns} 
            dataSource={drugs}
            rowKey="id"
            loading={drugsLoading}
            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
            scroll={{ x: 'max-content' }}
            rowClassName={() => 'admin-table-row'}
          />
        </Card>
      ),
    },
    {
      key: 'sales',
      label: (
        <span>
          <ShoppingCartOutlined style={{ marginRight: 8 }} />
          销售管理
        </span>
      ),
      children: (
        <Card className="admin-content-card">
          <div className="admin-action-bar">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddSales}
              style={{
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-success) 100%)',
                border: 'none',
              }}
            >
              录入销售
            </Button>
            <Select
              placeholder="筛选药品"
              allowClear
              style={{ width: 200 }}
              onChange={(value) => setSalesFilterDrug(value)}
              value={salesFilterDrug || undefined}
            >
              {drugs.map((drug) => (
                <Option key={drug.id} value={drug.id}>{drug.name}</Option>
              ))}
            </Select>
          </div>
          <Table 
            columns={salesColumns} 
            dataSource={salesRecords}
            rowKey="id"
            loading={salesLoading}
            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
            scroll={{ x: 'max-content' }}
            rowClassName={() => 'admin-table-row'}
          />
        </Card>
      ),
    },
    {
      key: 'settlements',
      label: (
        <span>
          <CalculatorOutlined style={{ marginRight: 8 }} />
          日清日结
        </span>
      ),
      children: (
        <Card className="admin-content-card">
          {/* 统计卡片 */}
          {settlementSummary && (
            <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card className="admin-stat-card">
                  <Statistic
                    title="总清算次数"
                    value={settlementSummary.totalSettlementCount}
                    valueStyle={{ color: 'var(--color-text-primary)', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card className="admin-stat-card">
                  <Statistic
                    title="总销售额"
                    value={settlementSummary.totalSalesRevenue}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: 'var(--color-success)', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card className="admin-stat-card">
                  <Statistic
                    title="认购方总分润"
                    value={settlementSummary.totalInvestorProfit}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: 'var(--color-success)', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card className="admin-stat-card">
                  <Statistic
                    title="认购方总亏损"
                    value={settlementSummary.totalInvestorLoss}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: 'var(--color-error)', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <div className="admin-action-bar">
            <Button
              type="primary"
              icon={<CalculatorOutlined />}
              onClick={() => {
                setSettlementPreview(null)
                settlementForm.resetFields()
                setIsSettlementModalOpen(true)
              }}
              style={{
                background: 'linear-gradient(135deg, var(--color-warning) 0%, #FF7A45 100%)',
                border: 'none',
              }}
            >
              执行清算
            </Button>
          </div>
          <Table 
            columns={settlementColumns} 
            dataSource={settlements}
            rowKey="id"
            loading={settlementsLoading}
            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
            scroll={{ x: 'max-content' }}
            rowClassName={() => 'admin-table-row'}
          />
        </Card>
      ),
    },
    {
      key: 'pendingOrders',
      label: (
        <span>
          <OrderedListOutlined style={{ marginRight: 8 }} />
          认购管理
        </span>
      ),
      children: (
        <Card className="admin-content-card">
          {/* 统计卡片 */}
          {pendingOrderStats && (
            <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
              <Col xs={24} sm={8}>
                <Card className="admin-stat-card">
                  <Statistic
                    title="待触发委托"
                    value={pendingOrderStats.pendingCount}
                    valueStyle={{ color: 'var(--color-warning)', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card className="admin-stat-card">
                  <Statistic
                    title="已触发委托"
                    value={pendingOrderStats.triggeredCount}
                    valueStyle={{ color: 'var(--color-success)', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card className="admin-stat-card">
                  <Statistic
                    title="总冻结金额"
                    value={pendingOrderStats.totalFrozenAmount}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: 'var(--color-error)', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <div className="admin-action-bar">
            <Select
              placeholder="筛选状态"
              allowClear
              style={{ width: 160 }}
              onChange={(value) => {
                setPendingOrderFilterStatus(value)
                setPendingOrderPage(1)
              }}
              value={pendingOrderFilterStatus || undefined}
            >
              <Option value="pending">待触发</Option>
              <Option value="triggered">已触发</Option>
              <Option value="cancelled">已撤销</Option>
              <Option value="expired">已过期</Option>
            </Select>
          </div>
          <Table
            columns={pendingOrderColumns}
            dataSource={pendingOrders}
            rowKey="id"
            loading={pendingOrdersLoading}
            pagination={{
              current: pendingOrderPage,
              pageSize: pendingOrderPageSize,
              total: pendingOrderTotal,
              onChange: (page, pageSize) => {
                setPendingOrderPage(page)
                setPendingOrderPageSize(pageSize || 10)
              },
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 'max-content' }}
            rowClassName={() => 'admin-table-row'}
          />
        </Card>
      ),
    },
    {
      key: 'fundMonitor',
      label: (
        <span>
          <WalletOutlined style={{ marginRight: 8 }} />
          资金监控
        </span>
      ),
      children: (
        <Card className="admin-content-card">
          {/* 统计卡片 */}
          {accountOverview && (
            <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
              <Col xs={24} sm={12} lg={6}>
                <Card className="admin-stat-card">
                  <Statistic
                    title="总充值金额"
                    value={accountOverview.totalRecharge}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: 'var(--color-success)', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card className="admin-stat-card">
                  <Statistic
                    title="总提现金额"
                    value={accountOverview.totalWithdraw}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: 'var(--color-error)', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card className="admin-stat-card">
                  <Statistic
                    title="总冻结金额"
                    value={accountOverview.totalFrozen}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: 'var(--color-warning)', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card className="admin-stat-card">
                  <Statistic
                    title="总可用余额"
                    value={accountOverview.totalAvailable}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: 'var(--color-primary)', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <Card className="admin-stat-card">
                  <Statistic
                    title="活跃用户数"
                    value={accountOverview.activeUserCount}
                    valueStyle={{ color: 'var(--color-text-primary)', fontFamily: "'JetBrains Mono', monospace" }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          <div className="admin-action-bar">
            <Input.Search
              placeholder="搜索用户名/姓名"
              allowClear
              style={{ width: 240 }}
              value={balanceSearchText}
              onChange={(e) => setBalanceSearchText(e.target.value)}
            />
          </div>

          <Table
            columns={userBalanceColumns}
            dataSource={userBalances.filter(u => {
              if (!balanceSearchText) return true
              const keyword = balanceSearchText.toLowerCase()
              return (
                u.username?.toLowerCase().includes(keyword) ||
                u.realName?.toLowerCase().includes(keyword)
              )
            })}
            rowKey="userId"
            loading={userBalancesLoading}
            pagination={{
              current: balancePage,
              pageSize: balancePageSize,
              total: balanceTotal,
              onChange: (page, pageSize) => {
                setBalancePage(page)
                setBalancePageSize(pageSize || 10)
              },
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 'max-content' }}
            rowClassName={() => 'admin-table-row'}
          />
        </Card>
      ),
    },
    {
      key: 'systemMessages',
      label: (
        <span>
          <NotificationOutlined style={{ marginRight: 8 }} />
          系统消息
        </span>
      ),
      children: (
        <Card className="admin-content-card">
          <div className="admin-action-bar">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddMessage}
              style={{
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-success) 100%)',
                border: 'none',
              }}
            >
              发布新消息
            </Button>
            <Select
              placeholder="筛选状态"
              allowClear
              style={{ width: 160 }}
              onChange={(value) => {
                setSystemMessageFilterStatus(value)
                setSystemMessagePage(1)
              }}
              value={systemMessageFilterStatus || undefined}
            >
              <Option value="draft">草稿</Option>
              <Option value="published">已发布</Option>
              <Option value="archived">已归档</Option>
            </Select>
          </div>
          <Table
            columns={systemMessageColumns}
            dataSource={systemMessages}
            rowKey="id"
            loading={systemMessagesLoading}
            pagination={{
              current: systemMessagePage,
              pageSize: systemMessagePageSize,
              total: systemMessageTotal,
              onChange: (page, pageSize) => {
                setSystemMessagePage(page)
                setSystemMessagePageSize(pageSize || 10)
              },
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 'max-content' }}
            rowClassName={() => 'admin-table-row'}
          />
        </Card>
      ),
    },
    {
      key: 'auditLogs',
      label: (
        <span>
          <FileTextOutlined style={{ marginRight: 8 }} />
          操作日志
        </span>
      ),
      children: (
        <Card className="admin-content-card">
          <div className="admin-action-bar">
            <Select
              placeholder="筛选操作类型"
              allowClear
              style={{ width: 180 }}
              onChange={(value) => {
                setAuditLogFilterAction(value)
                setAuditLogPage(1)
              }}
              value={auditLogFilterAction || undefined}
            >
              <Option value="LOGIN">登录</Option>
              <Option value="PRICE_UPDATE">调价</Option>
              <Option value="FORCE_CANCEL">撤单</Option>
              <Option value="RECHARGE">充值</Option>
              <Option value="WITHDRAW">提现</Option>
            </Select>
          </div>
          <Table
            columns={auditLogColumns}
            dataSource={auditLogs}
            rowKey="id"
            loading={auditLogsLoading}
            pagination={{
              current: auditLogPage,
              pageSize: auditLogPageSize,
              total: auditLogTotal,
              onChange: (page, pageSize) => {
                setAuditLogPage(page)
                setAuditLogPageSize(pageSize || 20)
              },
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 'max-content' }}
            rowClassName={() => 'admin-table-row'}
          />
        </Card>
      ),
    },
    {
      key: 'returnReview',
      label: (
        <span>
          <AuditOutlined style={{ marginRight: 8 }} />
          退回审核
        </span>
      ),
      children: (
        <Card className="admin-content-card">
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: '#E6EDF3', fontSize: 16, fontWeight: 500 }}>退回申请审核</Text>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={() => {
                subscriptionApi.getAdminSubscriptions({ status: 'return_pending', page: 1, limit: 50 }).then((res: any) => {
                  setReturnReviewList(res?.data?.list || [])
                })
              }}
              style={{ background: '#1890FF', borderColor: '#1890FF' }}
            >
              刷新
            </Button>
          </div>
          <Table
            dataSource={returnReviewList}
            rowKey="id"
            pagination={{ pageSize: 10, showTotal: (total: number) => `共 ${total} 条` }}
            scroll={{ x: 'max-content' }}
            rowClassName={() => 'admin-table-row'}
            locale={{ emptyText: <Text style={{ color: '#8B949E' }}>暂无待审核的退回申请</Text> }}
          >
            <Table.Column title="订单号" dataIndex="orderNo" key="orderNo" width={150} render={(v: string) => <Text style={{ color: '#8B949E', fontFamily: 'monospace', fontSize: 12 }}>{v}</Text>} />
            <Table.Column title="客户" key="customer" width={120} render={(_: any, record: any) => <Text style={{ color: '#E6EDF3' }}>{(record as any).realName || (record as any).username || '-'}</Text>} />
            <Table.Column title="药品" key="drug" width={120} render={(_: any, record: any) => <Text style={{ color: '#E6EDF3' }}>{(record as any).drugName || '-'}</Text>} />
            <Table.Column title="数量" dataIndex="quantity" key="quantity" width={80} align="center" render={(v: number) => <Text style={{ color: '#E6EDF3' }}>{v}盒</Text>} />
            <Table.Column title="认购金额" dataIndex="amount" key="amount" width={110} align="right" render={(v: number) => <Text style={{ color: '#E6EDF3' }}>¥{Number(v || 0).toFixed(2)}</Text>} />
            <Table.Column title="未结算金额" dataIndex="unsettledAmount" key="unsettledAmount" width={110} align="right" render={(v: number) => <Text style={{ color: '#FAAD14', fontWeight: 600 }}>¥{Number(v || 0).toFixed(2)}</Text>} />
            <Table.Column title="累计收益" key="profit" width={110} align="right" render={(_: any, record: any) => {
              const profit = Number(record.totalProfit || 0) - Number(record.totalLoss || 0)
              return <Text style={{ color: profit >= 0 ? '#00b96b' : '#cf1322', fontWeight: 600 }}>{profit >= 0 ? '+' : ''}¥{profit.toFixed(2)}</Text>
            }} />
            <Table.Column title="申请时间" dataIndex="returnRequestedAt" key="returnRequestedAt" width={160} render={(v: string) => <Text style={{ color: '#8B949E', fontSize: 12 }}>{v ? new Date(v).toLocaleString('zh-CN') : '-'}</Text>} />
            <Table.Column
              title="操作"
              key="action"
              width={180}
              align="center"
              fixed="right"
              render={(_: any, record: any) => (
                <Space>
                  <Button
                    type="primary"
                    size="small"
                    style={{ background: '#00b96b', borderColor: '#00b96b' }}
                    onClick={async () => {
                      try {
                        const res: any = await subscriptionApi.approveReturn(record.id)
                        if (res.success) {
                          message.success('退回已核准，本金和收益已退还客户')
                          // 刷新列表
                          const refreshRes: any = await subscriptionApi.getAdminSubscriptions({ status: 'return_pending', page: 1, limit: 50 })
                          setReturnReviewList(refreshRes?.data?.list || [])
                        }
                      } catch (error: any) {
                        const errMsg = error.response?.data?.message
                        message.error(Array.isArray(errMsg) ? errMsg.join('; ') : (errMsg || '核准失败'))
                      }
                    }}
                  >
                    核准退回
                  </Button>
                  <Popconfirm
                    title="确定驳回该退回申请？"
                    onConfirm={async () => {
                      try {
                        const res: any = await subscriptionApi.rejectReturn(record.id, '管理员驳回')
                        if (res.success) {
                          message.success('退回申请已驳回')
                          const refreshRes: any = await subscriptionApi.getAdminSubscriptions({ status: 'return_pending', page: 1, limit: 50 })
                          setReturnReviewList(refreshRes?.data?.list || [])
                        }
                      } catch (error: any) {
                        const errMsg = error.response?.data?.message
                        message.error(Array.isArray(errMsg) ? errMsg.join('; ') : (errMsg || '驳回失败'))
                      }
                    }}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button size="small" danger>驳回</Button>
                  </Popconfirm>
                </Space>
              )}
            />
          </Table>
        </Card>
      ),
    },
    {
      key: 'withdrawOrders',
      label: (
        <span>
          <DollarOutlined style={{ marginRight: 8 }} />
          出金管理
        </span>
      ),
      children: (
        <Card className="admin-content-card" title={
          <span style={{ color: '#E6EDF3' }}>
            <DollarOutlined style={{ color: '#1890FF', marginRight: 8 }} />
            出金申请管理（T+1）
          </span>
        } extra={
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#8B949E', fontSize: 12, whiteSpace: 'nowrap' }}>状态筛选：</Text>
            <Select
              value={withdrawFilterStatus || undefined}
              placeholder="全部状态"
              allowClear
              style={{ width: 120 }}
              onChange={(v) => { setWithdrawFilterStatus(v || ''); setWithdrawPage(1) }}
              styles={{ popup: { root: { background: '#161B22', border: '1px solid #30363D' } } }}
            >
              <Option value="pending">出金中</Option>
              <Option value="approved">已确认</Option>
              <Option value="rejected">已驳回</Option>
            </Select>
          </div>
        }>
          <Table
            dataSource={withdrawOrders}
            loading={withdrawOrdersLoading}
            rowKey="id"
            pagination={{
              current: withdrawPage,
              total: withdrawTotal,
              pageSize: 10,
              onChange: (page) => setWithdrawPage(page),
              showTotal: (total) => `共 ${total} 条`,
            }}
            scroll={{ x: 'max-content' }}
            rowClassName={() => 'admin-table-row'}
          >
            <Table.Column title="订单号" dataIndex="orderNo" key="orderNo" render={(v: string) => <span style={{ fontFamily: 'monospace', color: '#58A6FF' }}>{v}</span>} />
            <Table.Column title="用户" key="user" render={(_: any, r: any) => <span>{r.realName || r.username || '-'}</span>} />
            <Table.Column title="金额" dataIndex="amount" key="amount" render={(v: number) => <span style={{ color: '#00b96b', fontWeight: 600 }}>¥{Number(v).toFixed(2)}</span>} />
            <Table.Column title="银行信息" dataIndex="bankInfo" key="bankInfo" render={(v: string) => v || '-'} />
            <Table.Column title="状态" dataIndex="status" key="status" render={(v: string) => {
              const map: Record<string, { label: string; color: string }> = {
                pending: { label: '出金中', color: '#FAAD14' },
                approved: { label: '已确认', color: '#00b96b' },
                rejected: { label: '已驳回', color: '#F5222D' },
              }
              const s = map[v] || { label: v, color: '#8B949E' }
              return <span style={{ color: s.color, fontWeight: 500 }}>{s.label}</span>
            }} />
            <Table.Column title="申请时间" dataIndex="createdAt" key="createdAt" render={(v: string) => new Date(v).toLocaleString('zh-CN')} />
            <Table.Column title="确认时间" dataIndex="approvedAt" key="approvedAt" render={(v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-'} />
            <Table.Column title="驳回原因" dataIndex="rejectReason" key="rejectReason" render={(v: string) => v || '-'} />
            <Table.Column title="操作" key="action" render={(_: any, r: any) => r.status === 'pending' ? (
              <Space>
                <Button size="small" type="primary" onClick={() => openApproveModal(r)} style={{ background: '#00b96b', border: 'none' }}>确认出金</Button>
                <Button size="small" danger onClick={() => openRejectModal(r)}>驳回</Button>
              </Space>
            ) : '-'} />
          </Table>
        </Card>
      ),
    },
    {
      key: 'subsidy',
      label: (
        <span>
          <DollarOutlined style={{ marginRight: 8 }} />
          补贴金管理
        </span>
      ),
      children: (
        <Card className="admin-content-card" title={
          <span style={{ color: '#E6EDF3' }}>
            <DollarOutlined style={{ color: '#F0B90B', marginRight: 8 }} />
            每日补贴金填写（在持客户列表）
          </span>
        } extra={
          <Space>
            <Text style={{ color: '#8B949E' }}>收益日期：</Text>
            <Input
              type="date"
              value={subsidyYieldDate}
              onChange={(e) => {
                const newDate = e.target.value
                setSubsidyYieldDate(newDate)
              }}
              style={{ width: 150, background: '#0D1117', borderColor: '#30363D', color: '#E6EDF3' }}
            />
          </Space>
        }>
          <div className="admin-action-bar" style={{ marginBottom: 8 }}>
            {pendingSubsidyList.length > 0 && (
              <Text style={{ color: '#8B949E', marginLeft: 'auto' }}>
                在持客户 <span style={{ color: '#E6EDF3', fontWeight: 600 }}>{pendingSubsidyList.length}</span> 人，
                本金合计：<span style={{ color: '#E6EDF3', fontWeight: 600 }}>¥{pendingSubsidyList.reduce((sum: number, item: any) => sum + Number(item.principalBalance || 0), 0).toFixed(2)}</span>，
                补贴金合计：<span style={{ color: '#00b96b', fontWeight: 600 }}>+¥{pendingSubsidyList.reduce((sum: number, item: any) => sum + Number(item.baseYield || 0), 0).toFixed(2)}</span>
              </Text>
            )}
          </div>

          {pendingSubsidyList.length > 0 ? (
            <Table
              dataSource={pendingSubsidyList}
              loading={pendingSubsidyLoading}
              rowKey="orderId"
              pagination={{ pageSize: 8, showTotal: (total) => `共 ${total} 条`, size: 'small' }}
              scroll={{ x: 'max-content' }}
              size="small"
              rowClassName={(record: any) => `admin-table-row${record.subsidyFilled ? ' subsidy-filled-row' : ''}`}
            >
              <Table.Column title="真实姓名" dataIndex="realName" key="realName" width={80} fixed="left" render={(v: string) => <span style={{ color: '#E6EDF3', fontWeight: 600 }}>{v || '-'}</span>} />
              <Table.Column title="手机号" dataIndex="phone" key="phone" width={120} render={(v: string) => <span style={{ color: '#8B949E' }}>{v || '-'}</span>} />
              <Table.Column title="药品" dataIndex="drugName" key="drugName" width={110} />
              <Table.Column title="数量" dataIndex="quantity" key="quantity" width={70} align="right" render={(v: number) => <span style={{ color: '#8B949E' }}>{Number(v || 0).toLocaleString()}盒</span>} />
              <Table.Column title="认购金额" dataIndex="amount" key="amount" width={100} align="right" render={(v: number) => <span style={{ color: '#E6EDF3' }}>¥{Number(v || 0).toFixed(2)}</span>} />
              <Table.Column title="本金余额" dataIndex="principalBalance" key="principalBalance" width={100} align="right" render={(v: number) => <span style={{ color: '#E6EDF3', fontWeight: 600 }}>¥{Number(v || 0).toFixed(2)}</span>} />
              <Table.Column title="补贴金" dataIndex="baseYield" key="baseYield" width={140} align="right" render={(v: number) => <span style={{ color: '#00b96b', fontWeight: 600 }}>+¥{Number(v || 0).toFixed(2)}</span>} />
              <Table.Column
                title="合伙收益"
                key="subsidy"
                width={220}
                align="center"
                fixed="right"
                render={(_: any, record: any) => (
                  record.subsidyFilled ? (
                    <span style={{ color: '#52C41A', fontWeight: 600 }}>¥{Number(record.currentSubsidy || 0).toFixed(2)} <Tag color="green" style={{ marginLeft: 4, fontSize: 11 }}>已填</Tag></span>
                  ) : (
                    <Space>
                      <InputNumber
                        id={`subsidy-input-${record.orderId}`}
                        min={0}
                        precision={2}
                        placeholder="输入合伙收益"
                        defaultValue={record.currentSubsidy || 0}
                        style={{ width: 110 }}
                      />
                      <Button
                        type="primary"
                        size="small"
                        style={{ background: '#00b96b', borderColor: '#00b96b' }}
                        onClick={() => {
                          const input = document.getElementById(`subsidy-input-${record.orderId}`) as any
                          const value = input?.value !== undefined ? parseFloat(input.value) : NaN
                          handleSingleSubsidySubmit(record, value)
                        }}
                      >
                        提交
                      </Button>
                    </Space>
                  )
                )}
              />
            </Table>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Text style={{ color: '#8B949E', fontSize: 14 }}>
                {pendingSubsidyLoading ? '加载中...' : '该日期暂无在持客户'}
              </Text>
            </div>
          )}
        </Card>
      ),
    },

  ]

  return (
    <div className="admin-page">
      {/* 页面标题 */}
      <div className="admin-page-header" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={logoPng} alt="零钱保" style={{ width: 32, height: 32, borderRadius: 6 }} />
        <div>
          <Title level={3} className="admin-page-title" style={{ marginBottom: 0 }}>
            零钱保 · 管理后台
          </Title>
          <Text className="admin-page-subtitle">
            多客数智旗下 · 系统管理与配置中心
          </Text>
        </div>
      </div>
      
      <Tabs 
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />

      {/* 审核用户弹窗 */}
      <Modal
        title="审核用户"
        open={isReviewModalOpen}
        onOk={() => reviewForm.submit()}
        onCancel={() => setIsReviewModalOpen(false)}
        confirmLoading={reviewLoading}
        width={480}
        style={{ top: 100 }}
        className="admin-modal"
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-success) 100%)',
            border: 'none',
          }
        }}
        cancelButtonProps={{
          className: 'admin-modal-cancel-btn'
        }}
      >
        {reviewingUser && (
          <div style={{ marginBottom: 24 }}>
            <p><strong>用户名：</strong>{reviewingUser.username}</p>
            <p><strong>姓名：</strong>{reviewingUser.realName || '-'}</p>
            <p><strong>手机号：</strong>{reviewingUser.phone || '-'}</p>
            <p><strong>注册时间：</strong>{dayjs(reviewingUser.createdAt).format('YYYY-MM-DD HH:mm')}</p>
          </div>
        )}
        <Form
          form={reviewForm}
          layout="vertical"
          requiredMark={false}
          className="admin-form"
          onFinish={handleReviewSubmit}
        >
          <Form.Item
            name="status"
            label="审核结果"
            rules={[{ required: true, message: '请选择审核结果' }]}
          >
            <Select placeholder="请选择">
              <Select.Option value={UserStatus.APPROVED}>通过</Select.Option>
              <Select.Option value={UserStatus.REJECTED}>拒绝</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.status !== curr.status}
          >
            {({ getFieldValue }) => {
              const status = getFieldValue('status')
              return status === UserStatus.REJECTED ? (
                <Form.Item
                  name="remark"
                  label="拒绝原因"
                  rules={[{ required: true, message: '请填写拒绝原因' }]}
                >
                  <Input.TextArea rows={3} placeholder="请填写拒绝原因，用户将看到此信息" />
                </Form.Item>
              ) : null
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增/编辑药品弹窗 */}
      <Modal
        title={editingDrug ? '编辑药品' : '新增药品'}
        open={isDrugModalOpen}
        onOk={handleSubmitDrug}
        onCancel={() => setIsDrugModalOpen(false)}
        confirmLoading={submitLoading}
        width={600}
        style={{ top: 100 }}
        className="admin-modal"
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-success) 100%)',
            border: 'none',
          }
        }}
        cancelButtonProps={{
          className: 'admin-modal-cancel-btn'
        }}
      >
        <Form
          form={drugForm}
          layout="vertical"
          requiredMark={false}
          className="admin-form"
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
            <Form.Item
              name="name"
              label="药品名称"
              rules={[{ required: true, message: '请输入药品名称' }]}
            >
              <Input placeholder="请输入药品名称" />
            </Form.Item>
            <Form.Item
              name="code"
              label="药品编码"
              rules={[{ required: true, message: '请输入药品编码' }]}
            >
              <Input placeholder="请输入药品编码" disabled={!!editingDrug} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
            <Form.Item
              name="purchasePrice"
              label="采购价 (¥)"
              rules={[{ required: true, message: '请输入采购价' }]}
            >
              <InputNumber
                min={0}
                precision={2}
                placeholder="0.00"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              name="sellingPrice"
              label="售价 (¥)"
              rules={[{ required: true, message: '请输入售价' }]}
            >
              <InputNumber
                min={0}
                precision={2}
                placeholder="0.00"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
            <Form.Item
              name="totalQuantity"
              label="总数量"
              rules={[{ required: true, message: '请输入总数量' }]}
            >
              <InputNumber
                min={1}
                precision={0}
                placeholder="0"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              name="batchNo"
              label="批次号"
              rules={[{ required: true, message: '请输入批次号' }]}
            >
              <Input placeholder="请输入批次号" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
            <Form.Item
              name="annualRate"
              label="年化利率 (%)"
              initialValue={5.0}
            >
              <InputNumber
                min={0}
                max={100}
                precision={2}
                placeholder="5.00"
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              name="unitFee"
              label="单位费用 (¥)"
              initialValue={1.0}
            >
              <InputNumber
                min={0}
                precision={2}
                placeholder="1.00"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 新增/编辑销售记录弹窗 */}
      <Modal
        title={editingSales ? '编辑销售记录' : '录入销售数据'}
        open={isSalesModalOpen}
        onOk={handleSubmitSales}
        onCancel={() => setIsSalesModalOpen(false)}
        confirmLoading={submitLoading}
        width={500}
        style={{ top: 100 }}
        className="admin-modal"
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-success) 100%)',
            border: 'none',
          }
        }}
        cancelButtonProps={{
          className: 'admin-modal-cancel-btn'
        }}
      >
        <Form
          form={salesForm}
          layout="vertical"
          requiredMark={false}
          className="admin-form"
        >
          <Form.Item
            name="drugId"
            label="药品"
            rules={[{ required: true, message: '请选择药品' }]}
          >
            <Select
              placeholder="请选择药品"
              disabled={!!editingSales}
            >
              {drugs.map((drug) => (
                <Option key={drug.id} value={drug.id}>{drug.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="saleDate"
            label="销售日期"
            rules={[{ required: true, message: '请选择销售日期' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabled={!!editingSales}
            />
          </Form.Item>

          <Form.Item
            name="terminal"
            label="终端"
            rules={[{ required: true, message: '请输入终端名称' }]}
          >
            <Input placeholder="如：医院A、药店B" />
          </Form.Item>

          <Form.Item
            name="quantity"
            label="销量"
            rules={[{ required: true, message: '请输入销量' }]}
          >
            <InputNumber
              min={1}
              precision={0}
              placeholder="0"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="actualSellingPrice"
            label="实际售价 (¥)"
            rules={[{ required: true, message: '请输入实际售价' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              placeholder="0.00"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 执行清算弹窗 */}
      <Modal
        title={
          <>
            <CalculatorOutlined style={{ marginRight: 8 }} />
            执行日清日结清算
          </>
        }
        open={isSettlementModalOpen}
        onOk={handleExecuteSettlement}
        onCancel={() => {
          setIsSettlementModalOpen(false)
          setSettlementPreview(null)
        }}
        confirmLoading={submitLoading}
        width={700}
        style={{ top: 80 }}
        okText="确认执行清算"
        cancelText="取消"
        className="admin-modal"
        okButtonProps={{
          disabled: !settlementPreview,
          style: {
            background: 'linear-gradient(135deg, var(--color-warning) 0%, #FF7A45 100%)',
            border: 'none',
          }
        }}
        cancelButtonProps={{
          className: 'admin-modal-cancel-btn'
        }}
      >
        <Form
          form={settlementForm}
          layout="vertical"
          requiredMark={false}
          className="admin-form"
        >
          <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'flex-end' }}>
            <Form.Item
              name="drugId"
              label="选择药品"
              rules={[{ required: true, message: '请选择药品' }]}
              style={{ flex: 1, marginBottom: 0 }}
            >
              <Select placeholder="请选择药品">
                {drugs.map((drug) => (
                  <Option key={drug.id} value={drug.id}>{drug.name}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="date"
              label="清算日期"
              rules={[{ required: true, message: '请选择日期' }]}
              style={{ flex: 1, marginBottom: 0 }}
            >
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                onClick={handlePreviewSettlement}
                loading={settlementPreviewLoading}
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-success) 100%)',
                  border: 'none',
                }}
              >
                预览
              </Button>
            </Form.Item>
          </div>
        </Form>

        {settlementPreview && (
          <div style={{ marginTop: 24 }}>
            <Divider style={{ borderColor: '#30363D' }} />
            
            <Alert
              message="清算预览"
              description="请确认以下清算结果后再执行"
              type="warning"
              showIcon
              style={{ 
                background: '#FAAD1420', 
                border: '1px solid #FAAD1440',
                marginBottom: 8,              }}
            />

            {/* 清算步骤展示 */}
            <Steps
              direction="vertical"
              size="small"
              current={6}
              style={{ marginBottom: 8 }}
              items={[
                {
                  title: <Text style={{ color: '#E6EDF3' }}>汇总销售数据</Text>,
                  description: (
                    <div style={{ color: '#8B949E' }}>
                      总销量: <Text style={{ color: '#cf1322' }}>{settlementPreview.salesSummary.totalQuantity}</Text> 盒，
                      总销售额: <Text style={{ color: '#cf1322' }}>¥{Number(settlementPreview.salesSummary.totalRevenue || 0).toFixed(2)}</Text>
                    </div>
                  ),
                  icon: <BarChartOutlined style={{ color: '#1890FF' }} />,
                },
                {
                  title: <Text style={{ color: '#E6EDF3' }}>计算成本</Text>,
                  description: (
                    <div style={{ color: '#8B949E' }}>
                      采购成本: ¥{Number(settlementPreview.costSummary.purchaseCost || 0).toFixed(2)}，
                      相关费用: ¥{Number(settlementPreview.costSummary.totalFees || 0).toFixed(2)}
                    </div>
                  ),
                  icon: <DollarOutlined style={{ color: '#1890FF' }} />,
                },
                {
                  title: <Text style={{ color: '#E6EDF3' }}>FIFO解套</Text>,
                  description: (
                    <div style={{ color: '#8B949E' }}>
                      预计解套 {settlementPreview.estimatedSettlements.length} 笔订单，
                      剩余未解套: {settlementPreview.estimatedUnsettledQuantity} 盒
                    </div>
                  ),
                  icon: <ArrowRightOutlined style={{ color: '#1890FF' }} />,
                },
                {
                  title: <Text style={{ color: '#E6EDF3' }}>计算利息</Text>,
                  description: (
                    <div style={{ color: '#8B949E' }}>
                      预计利息: ¥{Number(settlementPreview.costSummary.estimatedInterest || 0).toFixed(2)}
                    </div>
                  ),
                  icon: <DollarOutlined style={{ color: '#1890FF' }} />,
                },
                {
                  title: <Text style={{ color: '#E6EDF3' }}>计算净利润</Text>,
                  description: (
                    <div style={{ color: '#8B949E' }}>
                      预计净利润: 
                      <Text style={{ 
                        color: settlementPreview.estimatedProfit.isProfit ? '#cf1322' : '#00b96b',
                        fontWeight: 600,
                      }}>
                        {settlementPreview.estimatedProfit.isProfit ? '+' : ''}
                        ¥{Number(settlementPreview.estimatedProfit.netProfit || 0).toFixed(2)}
                      </Text>
                    </div>
                  ),
                  icon: <CheckCircleOutlined style={{ color: '#1890FF' }} />,
                },
                {
                  title: <Text style={{ color: '#E6EDF3' }}>3:7分润/共担</Text>,
                  description: (
                    <div style={{ color: '#8B949E' }}>
                      {settlementPreview.estimatedProfit.isProfit ? (
                        <>
                          垫资方分润(30%): <Text style={{ color: '#cf1322' }}>¥{Number(settlementPreview.estimatedProfit.investorShare || 0).toFixed(2)}</Text>，
                          平台分润(70%): <Text style={{ color: '#cf1322' }}>¥{Number(settlementPreview.estimatedProfit.platformShare || 0).toFixed(2)}</Text>
                        </>
                      ) : (
                        <>
                          垫资方承担(30%): <Text style={{ color: '#00b96b' }}>¥{Number(settlementPreview.estimatedProfit.investorShare || 0).toFixed(2)}</Text>，
                          平台承担(70%): <Text style={{ color: '#00b96b' }}>¥{Math.abs(Number(settlementPreview.estimatedProfit.platformShare || 0)).toFixed(2)}</Text>
                        </>
                      )}
                    </div>
                  ),
                  icon: <DollarOutlined style={{ color: '#1890FF' }} />,
                },
                {
                  title: <Text style={{ color: '#E6EDF3' }}>创建清算记录</Text>,
                  description: <Text style={{ color: '#8B949E' }}>保存清算结果并更新订单状态</Text>,
                  icon: <CheckCircleOutlined style={{ color: '#cf1322' }} />,
                },
              ]}
            />

            {/* 解套订单明细 */}
            {settlementPreview.estimatedSettlements.length > 0 && (
              <>
                <Divider style={{ borderColor: '#30363D' }} />
                <Text style={{ color: '#E6EDF3', fontWeight: 600, display: 'block', marginBottom: 12 }}>
                  预计解套订单明细
                </Text>
                <Table
                  size="small"
                  dataSource={settlementPreview.estimatedSettlements}
                  rowKey="orderId"
                  pagination={false}
                  columns={[
                    {
                      title: '订单号',
                      dataIndex: 'orderNo',
                      key: 'orderNo',
                      render: (text: string) => (
                        <Text style={{ color: '#8B949E', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                          {text}
                        </Text>
                      ),
                    },
                    {
                      title: '垫资方',
                      dataIndex: 'username',
                      key: 'username',
                      render: (text: string) => (
                        <Text style={{ color: '#E6EDF3' }}>{text}</Text>
                      ),
                    },
                    {
                      title: '解套数量',
                      dataIndex: 'estimatedSettleQuantity',
                      key: 'estimatedSettleQuantity',
                      align: 'right',
                      render: (value: number) => (
                        <Text style={{ color: '#cf1322', fontFamily: "'JetBrains Mono', monospace" }}>
                          {value}
                        </Text>
                      ),
                    },
                    {
                      title: '解套金额',
                      dataIndex: 'estimatedSettleAmount',
                      key: 'estimatedSettleAmount',
                      align: 'right',
                      render: (value: number) => (
                        <Text style={{ color: '#cf1322', fontFamily: "'JetBrains Mono', monospace" }}>
                          ¥{value.toFixed(2)}
                        </Text>
                      ),
                    },
                  ]}
                />
              </>
            )}
          </div>
        )}
      </Modal>

      {/* 新增/编辑系统消息弹窗 */}
      <Modal
        title={editingMessage ? '编辑消息' : '发布新消息'}
        open={isMessageModalOpen}
        onOk={handleSubmitMessage}
        onCancel={() => setIsMessageModalOpen(false)}
        confirmLoading={submitLoading}
        width={600}
        style={{ top: 100 }}
        className="admin-modal"
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-success) 100%)',
            border: 'none',
          }
        }}
        cancelButtonProps={{
          className: 'admin-modal-cancel-btn'
        }}
      >
        <Form
          form={messageForm}
          layout="vertical"
          requiredMark={false}
          className="admin-form"
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入消息标题' }]}
          >
            <Input placeholder="请输入消息标题" maxLength={100} showCount />
          </Form.Item>

          <Form.Item
            name="type"
            label="类型"
            rules={[{ required: true, message: '请选择消息类型' }]}
          >
            <Select placeholder="请选择消息类型">
              <Option value="announcement">平台公告</Option>
              <Option value="notification">系统通知</Option>
              <Option value="maintenance">维护通知</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="content"
            label="内容"
            rules={[{ required: true, message: '请输入消息内容' }]}
          >
            <Input.TextArea 
              placeholder="请输入消息内容" 
              rows={6}
              maxLength={2000}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 确认出金弹窗 */}
      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#00b96b' }} />
            <span>确认出金</span>
          </Space>
        }
        open={approveModalVisible}
        onOk={handleApproveWithdraw}
        onCancel={() => setApproveModalVisible(false)}
        confirmLoading={approveLoading}
        okText="确认出金"
        width={480}
        className="admin-modal"
        okButtonProps={{
          style: {
            background: 'linear-gradient(135deg, #00b96b 0%, #00d4aa 100%)',
            border: 'none',
          }
        }}
        cancelButtonProps={{
          className: 'admin-modal-cancel-btn'
        }}
      >
        {approveOrderInfo && (
          <div style={{ marginBottom: 12 }}>
            <Alert
              message="请确认银行已将出金金额打入客户账户后，再点击确认"
              type="warning"
              showIcon
              style={{ marginBottom: 16, background: '#FAAD1420', border: '1px solid #FAAD1440' }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16, background: '#0D1117', borderRadius: 8, border: '1px solid #30363D' }}>
              <div>
                <Text style={{ color: '#8B949E', fontSize: 12 }}>用户</Text>
                <div style={{ color: '#E6EDF3', fontWeight: 500 }}>{approveOrderInfo.realName || approveOrderInfo.username || '-'}</div>
              </div>
              <div>
                <Text style={{ color: '#8B949E', fontSize: 12 }}>出金金额</Text>
                <div style={{ color: '#00b96b', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 18 }}>¥{Number(approveOrderInfo.amount).toFixed(2)}</div>
              </div>
              <div>
                <Text style={{ color: '#8B949E', fontSize: 12 }}>订单号</Text>
                <div style={{ color: '#58A6FF', fontFamily: 'monospace', fontSize: 12 }}>{approveOrderInfo.orderNo}</div>
              </div>
              <div>
                <Text style={{ color: '#8B949E', fontSize: 12 }}>申请时间</Text>
                <div style={{ color: '#E6EDF3', fontSize: 13 }}>{approveOrderInfo.createdAt ? new Date(approveOrderInfo.createdAt).toLocaleString('zh-CN') : '-'}</div>
              </div>
            </div>
          </div>
        )}
        <Form form={approveForm} layout="vertical" requiredMark={false} className="admin-form">
          <Form.Item
            name="bankTransactionNo"
            label={<Text style={{ color: '#8B949E' }}>银行流水号（选填）</Text>}
          >
            <Input
              placeholder="输入银行转账流水号"
              style={{ background: '#0D1117', borderColor: '#30363D' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 驳回出金弹窗 */}
      <Modal
        title={
          <Space>
            <DeleteOutlined style={{ color: '#F5222D' }} />
            <span>驳回出金申请</span>
          </Space>
        }
        open={rejectModalVisible}
        onOk={handleRejectWithdraw}
        onCancel={() => setRejectModalVisible(false)}
        confirmLoading={rejectLoading}
        okText="确认驳回"
        okButtonProps={{
          danger: true,
          style: {
            background: 'linear-gradient(135deg, #F5222D 0%, #CF1322 100%)',
            border: 'none',
          }
        }}
        cancelButtonProps={{
          className: 'admin-modal-cancel-btn'
        }}
        width={480}
        className="admin-modal"
      >
        {rejectOrderInfo && (
          <div style={{ marginBottom: 12, padding: 16, background: '#0D1117', borderRadius: 8, border: '1px solid #30363D' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <Text style={{ color: '#8B949E', fontSize: 12 }}>用户</Text>
                <div style={{ color: '#E6EDF3', fontWeight: 500 }}>{rejectOrderInfo.realName || rejectOrderInfo.username || '-'}</div>
              </div>
              <div>
                <Text style={{ color: '#8B949E', fontSize: 12 }}>出金金额</Text>
                <div style={{ color: '#00b96b', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", fontSize: 18 }}>¥{Number(rejectOrderInfo.amount).toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}
        <Form form={rejectForm} layout="vertical" requiredMark={false} className="admin-form">
          <Form.Item
            name="rejectReason"
            label={<Text style={{ color: '#8B949E' }}>驳回原因</Text>}
            rules={[{ required: true, message: '请输入驳回原因' }]}
          >
            <Input.TextArea
              placeholder="请输入驳回原因"
              rows={3}
              maxLength={500}
              showCount
              style={{ background: '#0D1117', borderColor: '#30363D' }}
            />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  )
}

export default Admin
