const fs = require('fs');

const FILE = 'packages/web/src/pages/Admin.tsx';
let lines = fs.readFileSync(FILE, 'utf8').split('\n');

// Tab boundaries (1-indexed, inclusive)
const tabs = {
  users:          { start: 2315, end: 2368 },
  drugs:          { start: 2369, end: 2484 },
  sales:          { start: 2485, end: 2530 },
  settlements:    { start: 2531, end: 2617 },
  subscriptions:  { start: 2618, end: 2701 },
  fundMonitor:    { start: 2702, end: 2811 },
  systemMessages: { start: 2812, end: 2870 },
  auditLogs:      { start: 2871, end: 2920 },
  returnReview:   { start: 2921, end: 3020 },
  withdrawOrders: { start: 3021, end: 3091 },
  subscriptionAudit: { start: 3092, end: 3141 },
  subsidy:        { start: 3142, end: 3242 },
  partnerProfit:  { start: 3243, end: 3354 },
  marketing:      { start: 3355, end: 3653 },
};

// Extract lines for a tab (0-indexed)
function getLines(start1, end1) {
  return lines.slice(start1 - 1, end1);
}

// 1. Modify users → customers
let customersLines = getLines(tabs.users.start, tabs.users.end);
customersLines = customersLines.map(l =>
  l.replace(/key: 'users'/, "key: 'customers'").replace(/用户管理/, '客户管理')
);

// 2. Extract inner content of sales Card (without the <Card> and </Card> wrappers)
const salesLines = getLines(tabs.sales.start, tabs.sales.end);
// Find <Card className="admin-content-card"> and </Card>
let salesCardOpen = -1, salesCardClose = -1;
for (let i = 0; i < salesLines.length; i++) {
  if (salesLines[i].includes('<Card className="admin-content-card">')) salesCardOpen = i;
  if (salesLines[i].trim() === '</Card>' && salesCardOpen !== -1 && salesCardClose === -1) salesCardClose = i;
}
const salesInner = salesLines.slice(salesCardOpen + 1, salesCardClose);

// 3. Extract inner content of settlements Card
const settlementsLines = getLines(tabs.settlements.start, tabs.settlements.end);
let settlementsCardOpen = -1, settlementsCardClose = -1;
for (let i = 0; i < settlementsLines.length; i++) {
  if (settlementsLines[i].includes('<Card className="admin-content-card">')) settlementsCardOpen = i;
  if (settlementsLines[i].trim() === '</Card>' && settlementsCardOpen !== -1 && settlementsCardClose === -1) settlementsCardClose = i;
}
const settlementsInner = settlementsLines.slice(settlementsCardOpen + 1, settlementsCardClose);

// 4. Build operations tab
const operationsLines = [
  '    {',
  "      key: 'operations',",
  '      label: (',
  '        <span>',
  '          <ShoppingCartOutlined style={{ marginRight: 8 }} />',
  '          运营管理',
  '        </span>',
  '      ),',
  '      children: (',
  '        <Card className="admin-content-card">',
  '          <div style={{ marginBottom: 16 }}>',
  '            <Text style={{ color: \'#E6EDF3\', fontSize: 16, fontWeight: 600 }}>销售数据</Text>',
  '          </div>',
  ...salesInner,
  '          <div style={{ borderTop: \'1px solid #30363D\', margin: \'24px 0\' }} />',
  '          <div style={{ marginBottom: 16 }}>',
  '            <Text style={{ color: \'#E6EDF3\', fontSize: 16, fontWeight: 600 }}>清算管理</Text>',
  '          </div>',
  ...settlementsInner,
  '        </Card>',
  '      ),',
  '    },',
];

// 5. Assemble new tab order
const newTabOrder = [
  'customers',
  'drugs',
  'subscriptions',
  'operations',
  'marketing',
  'fundMonitor',
  'systemMessages',
  'auditLogs',
  'returnReview',
  'withdrawOrders',
  'subscriptionAudit',
  'subsidy',
  'partnerProfit',
];

const tabContents = {
  customers: customersLines,
  drugs: getLines(tabs.drugs.start, tabs.drugs.end),
  operations: operationsLines,
  subscriptions: getLines(tabs.subscriptions.start, tabs.subscriptions.end),
  fundMonitor: getLines(tabs.fundMonitor.start, tabs.fundMonitor.end),
  systemMessages: getLines(tabs.systemMessages.start, tabs.systemMessages.end),
  auditLogs: getLines(tabs.auditLogs.start, tabs.auditLogs.end),
  returnReview: getLines(tabs.returnReview.start, tabs.returnReview.end),
  withdrawOrders: getLines(tabs.withdrawOrders.start, tabs.withdrawOrders.end),
  subscriptionAudit: getLines(tabs.subscriptionAudit.start, tabs.subscriptionAudit.end),
  subsidy: getLines(tabs.subsidy.start, tabs.subsidy.end),
  partnerProfit: getLines(tabs.partnerProfit.start, tabs.partnerProfit.end),
  marketing: getLines(tabs.marketing.start, tabs.marketing.end),
};

// 6. Rebuild file
const prefix = lines.slice(0, 2314); // up to and including `const tabItems = [`
const suffix = lines.slice(3653);    // from `]` onwards

const newLines = [
  ...prefix,
  ...newTabOrder.flatMap((key, idx) => {
    const content = tabContents[key];
    return content;
  }),
  ...suffix,
];

// 7. Fix useEffect: update activeTab logic
// Convert array back to string for regex replace
let newContent = newLines.join('\n');

// Replace the useEffect block
const oldEffect = `  useEffect(() => {
    if (activeTab === 'customers') {
      fetchUsers()
    } else if (activeTab === 'drugs') {
      fetchDrugs()
    } else if (activeTab === 'operations') {
      fetchSales()
      fetchSettlements()
      fetchSettlementSummary()
    } else if (activeTab === 'subscriptions') {
      fetchPendingOrders()
      fetchPendingOrderStats()
      fetchReturnReviewList()
      fetchWithdrawOrders()
    } else if (activeTab === 'riskControl') {
      fetchUserBalances()
      fetchAccountOverview()
      fetchAuditLogs()
      fetchSystemMessages()
    } else if (activeTab === 'marketing') {
      fetchTrialBonusList()
      fetchInvitationList()
    }
  }, [activeTab, fetchDrugs])`;

const newEffect = `  useEffect(() => {
    if (activeTab === 'customers') {
      fetchUsers()
    } else if (activeTab === 'drugs') {
      fetchDrugs()
    } else if (activeTab === 'subscriptions') {
      fetchPendingOrders()
      fetchPendingOrderStats()
      fetchReturnReviewList()
      fetchWithdrawOrders()
    } else if (activeTab === 'operations') {
      fetchSales()
      fetchSettlements()
      fetchSettlementSummary()
    } else if (activeTab === 'marketing') {
      fetchTrialBonusList()
      fetchInvitationList()
    } else if (activeTab === 'fundMonitor') {
      fetchUserBalances()
      fetchAccountOverview()
    } else if (activeTab === 'auditLogs') {
      fetchAuditLogs()
    } else if (activeTab === 'systemMessages') {
      fetchSystemMessages()
    }
  }, [activeTab, fetchDrugs])`;

if (newContent.includes(oldEffect)) {
  newContent = newContent.replace(oldEffect, newEffect);
  console.log('useEffect updated successfully');
} else {
  console.log('WARNING: Could not find old useEffect block to replace');
}

fs.writeFileSync(FILE, newContent);
console.log('File updated successfully');
