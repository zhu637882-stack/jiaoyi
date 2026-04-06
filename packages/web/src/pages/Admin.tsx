import { useEffect, useState, useCallback } from 'react'
import './Admin.css'
import { Card, Tabs, Typography, Table, Button, Space, Tag, Modal, Form, Input, InputNumber, Select, DatePicker, message, Popconfirm, Statistic, Row, Col, Divider, Alert, Steps } from 'antd'
import { UserOutlined, MedicineBoxOutlined, SettingOutlined, PlusOutlined, EditOutlined, DeleteOutlined, ShoppingCartOutlined, CalculatorOutlined, CheckCircleOutlined, ArrowRightOutlined, DollarOutlined, BarChartOutlined, OrderedListOutlined, WalletOutlined, FileTextOutlined, NotificationOutlined, SendOutlined } from '@ant-design/icons'
import { drugApi, salesApi, settlementApi, adminApi, pendingOrderApi, accountApi, systemMessageApi } from '../services/api'
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

// 用户数据类型
interface User {
  id: string
  username: string
  role: 'admin' | 'investor'
  realName?: string
  phone?: string
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
  frozenAmount: number
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
  FORCE_CANCEL: { label: '撤单', color: '#FF4D4F' },
  SETTLEMENT: { label: '清算', color: '#52C41A' },
  RECHARGE: { label: '充值', color: '#00D4AA' },
  WITHDRAW: { label: '提现', color: '#FF4D4F' },
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

  // 资金监控状态
  const [userBalances, setUserBalances] = useState<UserBalance[]>([])
  const [userBalancesLoading, setUserBalancesLoading] = useState(false)
  const [accountOverview, setAccountOverview] = useState<AccountOverview | null>(null)
  const [balancePage, setBalancePage] = useState(1)
  const [balancePageSize, setBalancePageSize] = useState(10)
  const [balanceTotal, setBalanceTotal] = useState(0)

  // 审计日志状态
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [auditLogsLoading, setAuditLogsLoading] = useState(false)
  const [auditLogFilterAction, setAuditLogFilterAction] = useState<string>('')
  const [auditLogPage, setAuditLogPage] = useState(1)
  const [auditLogPageSize, setAuditLogPageSize] = useState(20)
  const [auditLogTotal, setAuditLogTotal] = useState(0)

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

  // ==================== 委托管理 ====================

  // 获取委托列表
  const fetchPendingOrders = useCallback(async () => {
    setPendingOrdersLoading(true)
    try {
      const res: any = await pendingOrderApi.adminGetList({
        status: pendingOrderFilterStatus || undefined,
        page: pendingOrderPage,
        pageSize: pendingOrderPageSize,
      })
      if (res.success) {
        setPendingOrders(res.data.list)
        setPendingOrderTotal(res.data.pagination.total)
      }
    } catch (error) {
      console.error('获取委托列表失败:', error)
      message.error('获取委托列表失败')
    } finally {
      setPendingOrdersLoading(false)
    }
  }, [pendingOrderFilterStatus, pendingOrderPage, pendingOrderPageSize])

  // 获取委托统计
  const fetchPendingOrderStats = useCallback(async () => {
    try {
      const res: any = await pendingOrderApi.adminGetStats()
      if (res.success) {
        setPendingOrderStats(res.data)
      }
    } catch (error) {
      console.error('获取委托统计失败:', error)
    }
  }, [])

  // 强制撤单
  const handleAdminCancelOrder = async (orderId: string) => {
    try {
      const res: any = await pendingOrderApi.adminCancel(orderId)
      if (res.success) {
        message.success('委托订单已强制撤销')
        fetchPendingOrders()
        fetchPendingOrderStats()
      }
    } catch (error: any) {
      message.error(error?.response?.data?.message || '撤单失败')
    }
  }

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
      width: 140,
      render: () => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            style={{ color: 'var(--color-primary)' }}
          >
            编辑
          </Button>
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
        <span className="table-cell-mono">{quantity.toLocaleString()}</span>
      ),
    },
    {
      title: '已垫资',
      dataIndex: 'fundedQuantity',
      key: 'fundedQuantity',
      align: 'right',
      render: (quantity: number) => (
        <span className="table-cell-mono table-cell-success">{quantity.toLocaleString()}</span>
      ),
    },
    {
      title: '年化利率',
      dataIndex: 'annualRate',
      key: 'annualRate',
      align: 'right',
      render: (rate: number) => (
        <span className="table-cell-mono table-cell-primary-color table-cell-bold">{Number(rate || 0).toFixed(2)}%</span>
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
      width: 140,
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
        <span className="table-cell-mono">{quantity.toLocaleString()}</span>
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
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string, record: PendingOrder) => (
        <div className="table-cell-with-sub">
          <span className="table-cell-primary table-cell-bold">{text || '-'}</span>
          <span className="table-cell-code">{record.realName || '-'}</span>
        </div>
      ),
    },
    {
      title: '药品',
      dataIndex: 'drugName',
      key: 'drugName',
      render: (text: string, record: PendingOrder) => (
        <div className="table-cell-with-sub">
          <span className="table-cell-primary">{text || '-'}</span>
          <span className="table-cell-code">{record.drugCode || '-'}</span>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag className={`status-tag ${type === 'limit_buy' ? 'status-tag-error' : 'status-tag-success'}`}>
          {type === 'limit_buy' ? '买入' : '卖出'}
        </Tag>
      ),
    },
    {
      title: '目标价',
      dataIndex: 'targetPrice',
      key: 'targetPrice',
      align: 'right',
      render: (price: number) => (
        <span className="table-cell-mono">¥{Number(price || 0).toFixed(2)}</span>
      ),
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
      render: (quantity: number, record: PendingOrder) => (
        <span className="table-cell-mono">
          {record.filledQuantity > 0 ? `${record.filledQuantity}/${quantity}` : quantity}
        </span>
      ),
    },
    {
      title: '冻结金额',
      dataIndex: 'frozenAmount',
      key: 'frozenAmount',
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
          pending: { className: 'status-tag-warning', text: '待触发' },
          triggered: { className: 'status-tag-success', text: '已触发' },
          cancelled: { className: 'status-tag-default', text: '已撤销' },
          expired: { className: 'status-tag-error', text: '已过期' },
          partial: { className: 'status-tag-warning', text: '部分成交' },
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
      width: 120,
      render: (_, record: PendingOrder) => (
        <Space size="small">
          {record.status === 'pending' || record.status === 'partial' ? (
            <Popconfirm
              title="确认强制撤单"
              description="确定要强制撤销该委托订单吗？冻结资金将返还给用户。"
              onConfirm={() => handleAdminCancelOrder(record.id)}
              okText="确认撤单"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                size="small"
                danger
              >
                强制撤单
              </Button>
            </Popconfirm>
          ) : (
            <span className="table-cell-tertiary">-</span>
          )}
        </Space>
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
            <Button
              type="primary"
              icon={<PlusOutlined />}
              style={{
                background: 'linear-gradient(135deg, var(--color-primary) 0%, #096DD9 100%)',
                border: 'none',
              }}
            >
              新增用户
            </Button>
          </div>
          <Table
            columns={userColumns}
            dataSource={users}
            rowKey="id"
            loading={usersLoading}
            pagination={false}
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
            pagination={false}
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
            pagination={false}
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
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
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
                    title="垫资方总分润"
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
                    title="垫资方总亏损"
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
            pagination={false}
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
          委托管理
        </span>
      ),
      children: (
        <Card className="admin-content-card">
          {/* 统计卡片 */}
          {pendingOrderStats && (
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
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
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
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

          <Table
            columns={userBalanceColumns}
            dataSource={userBalances}
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
      key: 'settings',
      label: (
        <span>
          <SettingOutlined style={{ marginRight: 8 }} />
          系统设置
        </span>
      ),
      children: (
        <Card className="admin-content-card">
          <Text style={{ color: 'var(--color-text-secondary)' }}>系统设置功能开发中...</Text>
        </Card>
      ),
    },
  ]

  return (
    <div className="admin-page">
      {/* 页面标题 */}
      <div className="admin-page-header">
        <Title level={3} className="admin-page-title">
          管理后台
        </Title>
        <Text className="admin-page-subtitle">
          系统管理与配置中心
        </Text>
      </div>
      
      <Tabs 
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />

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
                marginBottom: 16,
              }}
            />

            {/* 清算步骤展示 */}
            <Steps
              direction="vertical"
              size="small"
              current={6}
              style={{ marginBottom: 16 }}
              items={[
                {
                  title: <Text style={{ color: '#E6EDF3' }}>汇总销售数据</Text>,
                  description: (
                    <div style={{ color: '#8B949E' }}>
                      总销量: <Text style={{ color: '#00D4AA' }}>{settlementPreview.salesSummary.totalQuantity}</Text> 盒，
                      总销售额: <Text style={{ color: '#00D4AA' }}>¥{Number(settlementPreview.salesSummary.totalRevenue || 0).toFixed(2)}</Text>
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
                        color: settlementPreview.estimatedProfit.isProfit ? '#00D4AA' : '#FF4D4F',
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
                          垫资方分润(30%): <Text style={{ color: '#00D4AA' }}>¥{Number(settlementPreview.estimatedProfit.investorShare || 0).toFixed(2)}</Text>，
                          平台分润(70%): <Text style={{ color: '#00D4AA' }}>¥{Number(settlementPreview.estimatedProfit.platformShare || 0).toFixed(2)}</Text>
                        </>
                      ) : (
                        <>
                          垫资方承担(30%): <Text style={{ color: '#FF4D4F' }}>¥{Number(settlementPreview.estimatedProfit.investorShare || 0).toFixed(2)}</Text>，
                          平台承担(70%): <Text style={{ color: '#FF4D4F' }}>¥{Math.abs(Number(settlementPreview.estimatedProfit.platformShare || 0)).toFixed(2)}</Text>
                        </>
                      )}
                    </div>
                  ),
                  icon: <DollarOutlined style={{ color: '#1890FF' }} />,
                },
                {
                  title: <Text style={{ color: '#E6EDF3' }}>创建清算记录</Text>,
                  description: <Text style={{ color: '#8B949E' }}>保存清算结果并更新订单状态</Text>,
                  icon: <CheckCircleOutlined style={{ color: '#00D4AA' }} />,
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
                        <Text style={{ color: '#00D4AA', fontFamily: "'JetBrains Mono', monospace" }}>
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
                        <Text style={{ color: '#00D4AA', fontFamily: "'JetBrains Mono', monospace" }}>
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

    </div>
  )
}

export default Admin
