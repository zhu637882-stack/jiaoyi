const fs = require('fs');

const FILE = 'packages/web/src/pages/Admin.tsx';
const content = fs.readFileSync(FILE, 'utf8');
const lines = content.split('\n');

// Find tabItems start/end dynamically
const tabItemsStartIdx = lines.findIndex(l => l.includes('const tabItems = ['));
const tabItemsEndIdx = lines.findIndex((l, i) => i > tabItemsStartIdx && l.trim() === ']');

if (tabItemsStartIdx === -1 || tabItemsEndIdx === -1) {
  console.error('Could not find tabItems array');
  process.exit(1);
}

console.log('tabItems range:', tabItemsStartIdx + 1, '-', tabItemsEndIdx + 1);

// Find all tab keys and their start positions within tabItems
const tabKeys = [];
for (let i = tabItemsStartIdx + 1; i < tabItemsEndIdx; i++) {
  const match = lines[i].match(/key: '([a-zA-Z]+)'/);
  if (match) {
    tabKeys.push({ key: match[1], keyLine: i });
  }
}

// Determine tab boundaries: each tab starts at keyLine - 1 (the `{` line) and ends at the next tab's keyLine - 2
for (let i = 0; i < tabKeys.length; i++) {
  tabKeys[i].start = tabKeys[i].keyLine - 1; // line with `    {`
  if (i < tabKeys.length - 1) {
    tabKeys[i].end = tabKeys[i + 1].keyLine - 2; // line before next `    {`
  } else {
    tabKeys[i].end = tabItemsEndIdx - 1; // line before `  ]`
  }
}

tabKeys.forEach(t => console.log(t.key + ': lines ' + (t.start + 1) + '-' + (t.end + 1)));

// Extract tab content as line arrays
const tabContents = {};
tabKeys.forEach(t => {
  tabContents[t.key] = lines.slice(t.start, t.end + 1);
});

// 1. Modify users → customers
let customersLines = [...tabContents.users];
customersLines = customersLines.map(l =>
  l.replace(/key: 'users'/, "key: 'customers'").replace(/用户管理/, '客户管理')
);

// 2. Extract inner content of sales Card
const salesLines = tabContents.sales;
let salesCardOpen = -1, salesCardClose = -1;
for (let i = 0; i < salesLines.length; i++) {
  if (salesLines[i].includes('<Card className="admin-content-card">')) salesCardOpen = i;
  if (salesLines[i].trim() === '</Card>' && salesCardOpen !== -1 && salesCardClose === -1) salesCardClose = i;
}
if (salesCardOpen === -1 || salesCardClose === -1) {
  console.error('Could not find sales Card boundaries');
  process.exit(1);
}
const salesInner = salesLines.slice(salesCardOpen + 1, salesCardClose);
console.log('sales inner lines:', salesInner.length);

// 3. Extract inner content of settlements Card
const settlementsLines = tabContents.settlements;
let settlementsCardOpen = -1, settlementsCardClose = -1;
for (let i = 0; i < settlementsLines.length; i++) {
  if (settlementsLines[i].includes('<Card className="admin-content-card">')) settlementsCardOpen = i;
  if (settlementsLines[i].trim() === '</Card>' && settlementsCardOpen !== -1 && settlementsCardClose === -1) settlementsCardClose = i;
}
if (settlementsCardOpen === -1 || settlementsCardClose === -1) {
  console.error('Could not find settlements Card boundaries');
  process.exit(1);
}
const settlementsInner = settlementsLines.slice(settlementsCardOpen + 1, settlementsCardClose);
console.log('settlements inner lines:', settlementsInner.length);

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

// 5. New tab order
const newTabOrder = [
  'customers',
  'drugs',
  'pendingOrders',
  'operations',
  'fundMonitor',
  'systemMessages',
  'auditLogs',
  'returnReview',
  'withdrawOrders',
  'subscriptionAudit',
  'subsidy',
];

const newTabContents = {
  customers: customersLines,
  drugs: tabContents.drugs,
  pendingOrders: tabContents.pendingOrders,
  operations: operationsLines,
  fundMonitor: tabContents.fundMonitor,
  systemMessages: tabContents.systemMessages,
  auditLogs: tabContents.auditLogs,
  returnReview: tabContents.returnReview,
  withdrawOrders: tabContents.withdrawOrders,
  subscriptionAudit: tabContents.subscriptionAudit,
  subsidy: tabContents.subsidy,
};

// 6. Rebuild file
const prefix = lines.slice(0, tabItemsStartIdx + 1); // include `const tabItems = [`
const suffix = lines.slice(tabItemsEndIdx); // include `]` onwards

const newLines = [
  ...prefix,
  ...newTabOrder.flatMap(key => newTabContents[key]),
  ...suffix,
];

let newContent = newLines.join('\n');

// 7. Fix useEffect
const oldEffect = `  useEffect(() => {
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
      fetchReturnReviewList()
      fetchWithdrawOrders()
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
  }, [activeTab, fetchDrugs])`;

const newEffect = `  useEffect(() => {
    if (activeTab === 'customers') {
      fetchUsers()
    } else if (activeTab === 'drugs') {
      fetchDrugs()
    } else if (activeTab === 'pendingOrders') {
      fetchPendingOrders()
      fetchPendingOrderStats()
      fetchReturnReviewList()
      fetchWithdrawOrders()
    } else if (activeTab === 'operations') {
      fetchSales()
      fetchSettlements()
      fetchSettlementSummary()
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
  }, [activeTab, fetchDrugs])`;

if (newContent.includes(oldEffect)) {
  newContent = newContent.replace(oldEffect, newEffect);
  console.log('useEffect updated successfully');
} else {
  console.log('WARNING: Could not find old useEffect block to replace');
}

// 8. Fix initial activeTab
newContent = newContent.replace(
  "const [activeTab, setActiveTab] = useState('users')",
  "const [activeTab, setActiveTab] = useState('customers')"
);

fs.writeFileSync(FILE, newContent);
console.log('File updated successfully');
