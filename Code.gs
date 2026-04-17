// ═══════════════════════════════════════════════════════════════════════
// ConnectHub QMS — Google Apps Script Backend  v1.0
// วิธีใช้: Extensions → Apps Script → วางใน Code.gs
//          สร้าง Index.html → Deploy > New deployment > Web app
//          Execute as: Me | Who has access: Anyone in organization
// ═══════════════════════════════════════════════════════════════════════

const SHEET_HEADERS = {
NCR:             [‘id’,‘dept’,‘no’,‘issue’,‘opened’,‘status’,‘severity’,‘closedDate’],
CAPA:            [‘id’,‘dept’,‘no’,‘ncr_ref’,‘action’,‘due’,‘status’,‘owner’],
Documents:       [‘id’,‘dept’,‘code’,‘title’,‘rev’,‘effectiveDate’,‘status’,‘owner’],
KPI:             [‘id’,‘dept’,‘label’,‘value’,‘target’,‘unit’,‘status’,‘updatedDate’],
Announcements:   [‘id’,‘dept’,‘title’,‘body’,‘postedDate’,‘urgent’,‘pinned’,‘postedBy’],
Audit:           [‘id’,‘dept’,‘lastDate’,‘result’,‘nextDate’,‘auditor’,‘scope’],
Training:        [‘id’,‘name’,‘target’,‘done’,‘dueDate’,‘status’,‘trainer’],
Employees:       [‘id’,‘name’,‘position’,‘dept’,‘email’,‘empStatus’,‘evaluation’],
Budget:          [‘id’,‘category’,‘budget’,‘actual’,‘period’],
Approvals:       [‘id’,‘no’,‘dept’,‘amount’,‘item’,‘status’,‘requestDate’,‘requester’],
SalesOrders:     [‘id’,‘no’,‘customer’,‘amount’,‘status’,‘dueDate’,‘product’],
SalesTargets:    [‘id’,‘product’,‘target’,‘actual’,‘period’],
Complaints:      [‘id’,‘no’,‘customer’,‘contact’,‘product’,‘type’,‘detail’,‘severity’,‘status’,‘date’,‘qaNotified’,‘qaLink’],
Suppliers:       [‘id’,‘name’,‘category’,‘rating’,‘otd’,‘status’,‘lastEval’],
PurchaseOrders:  [‘id’,‘no’,‘supplier’,‘amount’,‘status’,‘dueDate’,‘item’],
ProductionLines: [‘id’,‘name’,‘lineStatus’,‘output’,‘target’,‘product’,‘oee’,‘updatedDate’],
DailyProduction: [‘id’,‘date’,‘shift’,‘output’,‘target’,‘defect’,‘operator’,‘lineId’],
Inspection:      [‘id’,‘type’,‘lot’,‘qty’,‘passed’,‘result’,‘date’,‘inspector’],
Calibration:     [‘id’,‘name’,‘calDate’,‘nextDate’,‘calStatus’,‘calibratedBy’],
Inventory:       [‘id’,‘code’,‘name’,‘qty’,‘unit’,‘minQty’,‘maxQty’,‘location’],
StockMovements:  [‘id’,‘date’,‘time’,‘moveType’,‘code’,‘qty’,‘unit’,‘by’,‘note’],
WorkOrders:      [‘id’,‘no’,‘machine’,‘location’,‘issue’,‘priority’,‘woStatus’,‘tech’,‘openedDate’,‘closedDate’],
PMPlan:          [‘id’,‘machine’,‘pmType’,‘lastDate’,‘nextDate’,‘pmStatus’,‘tech’],
Events:          [‘id’,‘title’,‘dept’,‘date’,‘time’,‘type’,‘by’,‘note’],
};

// ─── ENTRY POINT ─────────────────────────────────────────────────────
function doGet() {
return HtmlService.createHtmlOutputFromFile(‘Index’)
.setTitle(‘ConnectHub QMS Portal’)
.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ─── SHEET HELPERS ───────────────────────────────────────────────────
function getSheet(name) {
const ss = SpreadsheetApp.getActiveSpreadsheet();
let sh = ss.getSheetByName(name);
if (!sh) {
sh = ss.insertSheet(name);
const h = SHEET_HEADERS[name];
if (h) {
sh.appendRow(h);
sh.getRange(1,1,1,h.length)
.setFontWeight(‘bold’)
.setBackground(’#0f172a’)
.setFontColor(’#06b6d4’);
sh.setFrozenRows(1);
}
}
return sh;
}

function sheetToObjects(name) {
const sh = getSheet(name);
const data = sh.getDataRange().getValues();
if (data.length < 2) return [];
const headers = data[0];
return data.slice(1)
.filter(row => row.some(c => c !== ‘’))
.map(row => {
const obj = {};
headers.forEach((h, i) => {
const v = row[i];
obj[h] = v instanceof Date
? Utilities.formatDate(v, Session.getScriptTimeZone(), ‘dd/MM/yyyy’)
: (v === null || v === undefined ? ‘’ : String(v));
});
return obj;
});
}

function appendToSheet(name, obj) {
const sh = getSheet(name);
const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
if (!obj.id) obj.id = Utilities.getUuid();
sh.appendRow(headers.map(h => obj[h] !== undefined ? obj[h] : ‘’));
return { success: true, id: obj.id };
}

function updateInSheet(name, id, updates) {
const sh = getSheet(name);
const data = sh.getDataRange().getValues();
const headers = data[0];
const idCol = headers.indexOf(‘id’);
for (let i = 1; i < data.length; i++) {
if (String(data[i][idCol]) === String(id)) {
Object.keys(updates).forEach(k => {
const col = headers.indexOf(k);
if (col >= 0) sh.getRange(i+1, col+1).setValue(updates[k]);
});
return { success: true };
}
}
return { success: false, error: ‘ID not found’ };
}

function deleteFromSheet(name, id) {
const sh = getSheet(name);
const data = sh.getDataRange().getValues();
const idCol = data[0].indexOf(‘id’);
for (let i = 1; i < data.length; i++) {
if (String(data[i][idCol]) === String(id)) {
sh.deleteRow(i + 1);
return { success: true };
}
}
return { success: false, error: ‘ID not found’ };
}

function today() {
return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), ‘dd/MM/yyyy’);
}
function genNo(prefix) {
const yr = new Date().getFullYear();
const rnd = String(Math.floor(Math.random() * 9000 + 1000));
return `${prefix}-${yr}-${rnd}`;
}

// ─── SETUP ───────────────────────────────────────────────────────────
function setupAllSheets() {
Object.keys(SHEET_HEADERS).forEach(name => getSheet(name));
return { success: true, sheets: Object.keys(SHEET_HEADERS) };
}

// ─── DASHBOARD ───────────────────────────────────────────────────────
function getDashboard() {
const ncr   = sheetToObjects(‘NCR’);
const capa  = sheetToObjects(‘CAPA’);
const anns  = sheetToObjects(‘Announcements’);
const wo    = sheetToObjects(‘WorkOrders’);
return {
totalNcr:   ncr.length,
openNcr:    ncr.filter(r => r.status !== ‘ปิดแล้ว’).length,
totalCapa:  capa.length,
openCapa:   capa.filter(r => r.status !== ‘เสร็จสิ้น’).length,
totalAnns:  anns.length,
openWO:     wo.filter(r => r.woStatus !== ‘เสร็จแล้ว’).length,
recentNcr:  ncr.slice(-5).reverse(),
recentAnns: anns.slice(-3).reverse(),
};
}

// ─── NCR ─────────────────────────────────────────────────────────────
function getNCR(dept) {
const d = sheetToObjects(‘NCR’);
return dept ? d.filter(r => r.dept === dept) : d;
}
function addNCR(data) {
data.no     = genNo(‘NCR-’ + (data.dept || ‘’).toUpperCase());
data.opened = today();
data.status = ‘อยู่ระหว่างดำเนินการ’;
return appendToSheet(‘NCR’, data);
}
function updateNCR(id, u) { return updateInSheet(‘NCR’, id, u); }
function deleteNCR(id)     { return deleteFromSheet(‘NCR’, id); }

// ─── CAPA ─────────────────────────────────────────────────────────────
function getCAPA(dept) {
const d = sheetToObjects(‘CAPA’);
return dept ? d.filter(r => r.dept === dept) : d;
}
function addCAPA(data) {
data.no     = genNo(‘CAPA-’ + (data.dept || ‘’).toUpperCase());
data.status = ‘รอดำเนินการ’;
return appendToSheet(‘CAPA’, data);
}
function updateCAPA(id, u) { return updateInSheet(‘CAPA’, id, u); }
function deleteCAPA(id)     { return deleteFromSheet(‘CAPA’, id); }

// ─── DOCUMENTS ───────────────────────────────────────────────────────
function getDocuments(dept) {
const d = sheetToObjects(‘Documents’);
return dept ? d.filter(r => r.dept === dept) : d;
}
function addDocument(data)      { return appendToSheet(‘Documents’, data); }
function updateDocument(id, u)  { return updateInSheet(‘Documents’, id, u); }
function deleteDocument(id)     { return deleteFromSheet(‘Documents’, id); }

// ─── KPI ─────────────────────────────────────────────────────────────
function getKPI(dept) {
const d = sheetToObjects(‘KPI’);
return dept ? d.filter(r => r.dept === dept) : d;
}
function addKPI(data) {
data.updatedDate = today();
data.status = parseFloat(data.value) >= parseFloat(data.target) ? ‘pass’ : ‘fail’;
return appendToSheet(‘KPI’, data);
}
function updateKPI(id, u) {
u.updatedDate = today();
return updateInSheet(‘KPI’, id, u);
}
function deleteKPI(id) { return deleteFromSheet(‘KPI’, id); }

// ─── ANNOUNCEMENTS ───────────────────────────────────────────────────
function getAnnouncements(dept) {
const d = sheetToObjects(‘Announcements’);
return dept ? d.filter(r => r.dept === dept) : d;
}
function addAnnouncement(data) {
data.postedDate = today();
return appendToSheet(‘Announcements’, data);
}
function updateAnnouncement(id, u) { return updateInSheet(‘Announcements’, id, u); }
function deleteAnnouncement(id)     { return deleteFromSheet(‘Announcements’, id); }

// ─── AUDIT ───────────────────────────────────────────────────────────
function getAudit(dept) {
const d = sheetToObjects(‘Audit’);
return dept ? d.filter(r => r.dept === dept) : d;
}
function addAudit(data)      { return appendToSheet(‘Audit’, data); }
function updateAudit(id, u)  { return updateInSheet(‘Audit’, id, u); }
function deleteAudit(id)     { return deleteFromSheet(‘Audit’, id); }

// ─── HR: TRAINING ────────────────────────────────────────────────────
function getTraining()         { return sheetToObjects(‘Training’); }
function addTraining(data)     { return appendToSheet(‘Training’, data); }
function updateTraining(id, u) { return updateInSheet(‘Training’, id, u); }
function deleteTraining(id)    { return deleteFromSheet(‘Training’, id); }

// ─── HR: EMPLOYEES ───────────────────────────────────────────────────
function getEmployees(dept) {
const d = sheetToObjects(‘Employees’);
return dept ? d.filter(r => r.dept === dept) : d;
}
function addEmployee(data)      { return appendToSheet(‘Employees’, data); }
function updateEmployee(id, u)  { return updateInSheet(‘Employees’, id, u); }
function deleteEmployee(id)     { return deleteFromSheet(‘Employees’, id); }

// ─── AC: BUDGET ──────────────────────────────────────────────────────
function getBudget()         { return sheetToObjects(‘Budget’); }
function addBudget(data)     { return appendToSheet(‘Budget’, data); }
function updateBudget(id, u) { return updateInSheet(‘Budget’, id, u); }
function deleteBudget(id)    { return deleteFromSheet(‘Budget’, id); }

// ─── AC: APPROVALS ───────────────────────────────────────────────────
function getApprovals() { return sheetToObjects(‘Approvals’); }
function addApproval(data) {
data.no          = genNo(‘EXP’);
data.requestDate = today();
data.status      = ‘รออนุมัติ’;
return appendToSheet(‘Approvals’, data);
}
function updateApproval(id, u) { return updateInSheet(‘Approvals’, id, u); }
function deleteApproval(id)    { return deleteFromSheet(‘Approvals’, id); }

// ─── SA: SALES ORDERS ────────────────────────────────────────────────
function getSalesOrders() { return sheetToObjects(‘SalesOrders’); }
function addSalesOrder(data) {
data.no = genNo(‘SO’);
return appendToSheet(‘SalesOrders’, data);
}
function updateSalesOrder(id, u) { return updateInSheet(‘SalesOrders’, id, u); }
function deleteSalesOrder(id)    { return deleteFromSheet(‘SalesOrders’, id); }

// ─── SA: SALES TARGETS ───────────────────────────────────────────────
function getSalesTargets() { return sheetToObjects(‘SalesTargets’); }
function addSalesTarget(data)      { return appendToSheet(‘SalesTargets’, data); }
function updateSalesTarget(id, u)  { return updateInSheet(‘SalesTargets’, id, u); }
function deleteSalesTarget(id)     { return deleteFromSheet(‘SalesTargets’, id); }

// ─── SA: COMPLAINTS ──────────────────────────────────────────────────
function getComplaints() { return sheetToObjects(‘Complaints’); }
function addComplaint(data) {
data.no          = genNo(‘CMP’);
data.date        = today();
data.status      = ‘รับเรื่องแล้ว’;
data.qaNotified  = ‘TRUE’;
data.qaLink      = `connecthub/qa/complaints/${data.no}`;
const result     = appendToSheet(‘Complaints’, data);
// notify QA sheet via new announcement
addAnnouncement({
dept:     ‘qa’,
title:    `[แจ้งเตือน] ข้อร้องเรียนใหม่ ${data.no} จากฝ่ายขาย`,
body:     `ลูกค้า: ${data.customer} | ประเภท: ${data.type} | ความรุนแรง: ${data.severity}`,
urgent:   ‘TRUE’,
pinned:   ‘FALSE’,
postedBy: ‘ระบบ SA’,
});
return result;
}
function updateComplaint(id, u) { return updateInSheet(‘Complaints’, id, u); }
function deleteComplaint(id)    { return deleteFromSheet(‘Complaints’, id); }

// ─── PU: SUPPLIERS ───────────────────────────────────────────────────
function getSuppliers() { return sheetToObjects(‘Suppliers’); }
function addSupplier(data)      { return appendToSheet(‘Suppliers’, data); }
function updateSupplier(id, u)  { return updateInSheet(‘Suppliers’, id, u); }
function deleteSupplier(id)     { return deleteFromSheet(‘Suppliers’, id); }

// ─── PU: PURCHASE ORDERS ─────────────────────────────────────────────
function getPurchaseOrders() { return sheetToObjects(‘PurchaseOrders’); }
function addPurchaseOrder(data) {
data.no = genNo(‘PO’);
return appendToSheet(‘PurchaseOrders’, data);
}
function updatePurchaseOrder(id, u) { return updateInSheet(‘PurchaseOrders’, id, u); }
function deletePurchaseOrder(id)    { return deleteFromSheet(‘PurchaseOrders’, id); }

// ─── PD: PRODUCTION LINES ────────────────────────────────────────────
function getProductionLines() { return sheetToObjects(‘ProductionLines’); }
function addProductionLine(data) {
data.updatedDate = today();
return appendToSheet(‘ProductionLines’, data);
}
function updateProductionLine(id, u) {
u.updatedDate = today();
return updateInSheet(‘ProductionLines’, id, u);
}
function deleteProductionLine(id) { return deleteFromSheet(‘ProductionLines’, id); }

// ─── PD: DAILY PRODUCTION ────────────────────────────────────────────
function getDailyProduction(dateStr) {
const d = sheetToObjects(‘DailyProduction’);
return dateStr ? d.filter(r => r.date === dateStr) : d;
}
function addDailyProduction(data) {
if (!data.date) data.date = today();
return appendToSheet(‘DailyProduction’, data);
}
function updateDailyProduction(id, u) { return updateInSheet(‘DailyProduction’, id, u); }
function deleteDailyProduction(id)    { return deleteFromSheet(‘DailyProduction’, id); }

// ─── QA: INSPECTION ──────────────────────────────────────────────────
function getInspection() { return sheetToObjects(‘Inspection’); }
function addInspection(data) {
if (!data.date) data.date = today();
const qty    = parseInt(data.qty) || 0;
const passed = parseInt(data.passed) || 0;
const rate   = qty > 0 ? passed / qty : 0;
data.result  = rate >= 0.99 ? ‘ผ่าน’ : rate >= 0.97 ? ‘ผ่านมีข้อสังเกต’ : ‘ไม่ผ่าน’;
return appendToSheet(‘Inspection’, data);
}
function updateInspection(id, u) { return updateInSheet(‘Inspection’, id, u); }
function deleteInspection(id)    { return deleteFromSheet(‘Inspection’, id); }

// ─── QA: CALIBRATION ─────────────────────────────────────────────────
function getCalibration() {
const d = sheetToObjects(‘Calibration’);
const now = new Date();
return d.map(r => {
if (!r.nextDate) return r;
const parts = r.nextDate.split(’/’);
if (parts.length < 3) return r;
const next = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
const diff  = (next - now) / (1000 * 60 * 60 * 24);
r.calStatus = diff < 0 ? ‘หมดอายุแล้ว’ : diff <= 30 ? ‘ใกล้หมดอายุ’ : ‘ปกติ’;
return r;
});
}
function addCalibration(data)      { return appendToSheet(‘Calibration’, data); }
function updateCalibration(id, u)  { return updateInSheet(‘Calibration’, id, u); }
function deleteCalibration(id)     { return deleteFromSheet(‘Calibration’, id); }

// ─── WH: INVENTORY ───────────────────────────────────────────────────
function getInventory() { return sheetToObjects(‘Inventory’); }
function addInventoryItem(data)      { return appendToSheet(‘Inventory’, data); }
function updateInventoryItem(id, u)  { return updateInSheet(‘Inventory’, id, u); }
function deleteInventoryItem(id)     { return deleteFromSheet(‘Inventory’, id); }

// ─── WH: STOCK MOVEMENTS ─────────────────────────────────────────────
function getStockMovements(dateStr) {
const d = sheetToObjects(‘StockMovements’);
return dateStr ? d.filter(r => r.date === dateStr) : d;
}
function addStockMovement(data) {
if (!data.date) data.date = today();
if (!data.time) data.time = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), ‘HH:mm’);
const result = appendToSheet(‘StockMovements’, data);
// update qty in Inventory
const inv = sheetToObjects(‘Inventory’);
const item = inv.find(r => r.code === data.code);
if (item) {
const qty = parseFloat(item.qty) || 0;
const delta = parseFloat(data.qty) || 0;
const newQty = data.moveType === ‘รับเข้า’ ? qty + delta : qty - delta;
updateInSheet(‘Inventory’, item.id, { qty: String(Math.max(0, newQty)) });
}
return result;
}
function deleteStockMovement(id) { return deleteFromSheet(‘StockMovements’, id); }

// ─── MN: WORK ORDERS ─────────────────────────────────────────────────
function getWorkOrders() { return sheetToObjects(‘WorkOrders’); }
function addWorkOrder(data) {
data.no         = genNo(‘WO’);
data.openedDate = today();
data.woStatus   = ‘รอดำเนินการ’;
return appendToSheet(‘WorkOrders’, data);
}
function updateWorkOrder(id, u) {
if (u.woStatus === ‘เสร็จแล้ว’ && !u.closedDate) u.closedDate = today();
return updateInSheet(‘WorkOrders’, id, u);
}
function deleteWorkOrder(id) { return deleteFromSheet(‘WorkOrders’, id); }

// ─── MN: PM PLAN ─────────────────────────────────────────────────────
function getPMPlan() {
const d = sheetToObjects(‘PMPlan’);
const now = new Date();
return d.map(r => {
if (!r.nextDate) return r;
const parts = r.nextDate.split(’/’);
if (parts.length < 3) return r;
const next = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
const diff  = (next - now) / (1000 * 60 * 60 * 24);
r.pmStatus = diff < 0 ? ‘เกินกำหนด’ : diff <= 7 ? ‘ใกล้กำหนด’ : ‘ปกติ’;
return r;
});
}
function addPMPlan(data)      { return appendToSheet(‘PMPlan’, data); }
function updatePMPlan(id, u)  { return updateInSheet(‘PMPlan’, id, u); }
function deletePMPlan(id)     { return deleteFromSheet(‘PMPlan’, id); }

// ─── EVENTS ──────────────────────────────────────────────────────────
function getEvents(dept) {
const d = sheetToObjects(‘Events’);
return dept ? d.filter(r => r.dept === dept) : d;
}
function addEvent(data)      { return appendToSheet(‘Events’, data); }
function updateEvent(id, u)  { return updateInSheet(‘Events’, id, u); }
function deleteEvent(id)     { return deleteFromSheet(‘Events’, id); }

// ─── ROUTER (called from frontend) ───────────────────────────────────
function callServer(action, payload) {
try {
const p = payload || {};
const map = {
setupAllSheets,
getDashboard,
// NCR
getNCR:             () => getNCR(p.dept),
addNCR:             () => addNCR(p.data),
updateNCR:          () => updateNCR(p.id, p.data),
deleteNCR:          () => deleteNCR(p.id),
// CAPA
getCAPA:            () => getCAPA(p.dept),
addCAPA:            () => addCAPA(p.data),
updateCAPA:         () => updateCAPA(p.id, p.data),
deleteCAPA:         () => deleteCAPA(p.id),
// Documents
getDocuments:       () => getDocuments(p.dept),
addDocument:        () => addDocument(p.data),
updateDocument:     () => updateDocument(p.id, p.data),
deleteDocument:     () => deleteDocument(p.id),
// KPI
getKPI:             () => getKPI(p.dept),
addKPI:             () => addKPI(p.data),
updateKPI:          () => updateKPI(p.id, p.data),
deleteKPI:          () => deleteKPI(p.id),
// Announcements
getAnnouncements:   () => getAnnouncements(p.dept),
addAnnouncement:    () => addAnnouncement(p.data),
updateAnnouncement: () => updateAnnouncement(p.id, p.data),
deleteAnnouncement: () => deleteAnnouncement(p.id),
// Audit
getAudit:           () => getAudit(p.dept),
addAudit:           () => addAudit(p.data),
updateAudit:        () => updateAudit(p.id, p.data),
deleteAudit:        () => deleteAudit(p.id),
// HR
getTraining:        () => getTraining(),
addTraining:        () => addTraining(p.data),
updateTraining:     () => updateTraining(p.id, p.data),
deleteTraining:     () => deleteTraining(p.id),
getEmployees:       () => getEmployees(p.dept),
addEmployee:        () => addEmployee(p.data),
updateEmployee:     () => updateEmployee(p.id, p.data),
deleteEmployee:     () => deleteEmployee(p.id),
// AC
getBudget:          () => getBudget(),
addBudget:          () => addBudget(p.data),
updateBudget:       () => updateBudget(p.id, p.data),
deleteBudget:       () => deleteBudget(p.id),
getApprovals:       () => getApprovals(),
addApproval:        () => addApproval(p.data),
updateApproval:     () => updateApproval(p.id, p.data),
deleteApproval:     () => deleteApproval(p.id),
// SA
getSalesOrders:     () => getSalesOrders(),
addSalesOrder:      () => addSalesOrder(p.data),
updateSalesOrder:   () => updateSalesOrder(p.id, p.data),
deleteSalesOrder:   () => deleteSalesOrder(p.id),
getSalesTargets:    () => getSalesTargets(),
addSalesTarget:     () => addSalesTarget(p.data),
updateSalesTarget:  () => updateSalesTarget(p.id, p.data),
deleteSalesTarget:  () => deleteSalesTarget(p.id),
getComplaints:      () => getComplaints(),
addComplaint:       () => addComplaint(p.data),
updateComplaint:    () => updateComplaint(p.id, p.data),
deleteComplaint:    () => deleteComplaint(p.id),
// PU
getSuppliers:       () => getSuppliers(),
addSupplier:        () => addSupplier(p.data),
updateSupplier:     () => updateSupplier(p.id, p.data),
deleteSupplier:     () => deleteSupplier(p.id),
getPurchaseOrders:  () => getPurchaseOrders(),
addPurchaseOrder:   () => addPurchaseOrder(p.data),
updatePurchaseOrder:() => updatePurchaseOrder(p.id, p.data),
deletePurchaseOrder:() => deletePurchaseOrder(p.id),
// PD
getProductionLines: () => getProductionLines(),
addProductionLine:  () => addProductionLine(p.data),
updateProductionLine:()=> updateProductionLine(p.id, p.data),
deleteProductionLine:()=> deleteProductionLine(p.id),
getDailyProduction: () => getDailyProduction(p.date),
addDailyProduction: () => addDailyProduction(p.data),
updateDailyProduction:()=> updateDailyProduction(p.id, p.data),
deleteDailyProduction:()=> deleteDailyProduction(p.id),
// QA
getInspection:      () => getInspection(),
addInspection:      () => addInspection(p.data),
updateInspection:   () => updateInspection(p.id, p.data),
deleteInspection:   () => deleteInspection(p.id),
getCalibration:     () => getCalibration(),
addCalibration:     () => addCalibration(p.data),
updateCalibration:  () => updateCalibration(p.id, p.data),
deleteCalibration:  () => deleteCalibration(p.id),
// WH
getInventory:       () => getInventory(),
addInventoryItem:   () => addInventoryItem(p.data),
updateInventoryItem:() => updateInventoryItem(p.id, p.data),
deleteInventoryItem:() => deleteInventoryItem(p.id),
getStockMovements:  () => getStockMovements(p.date),
addStockMovement:   () => addStockMovement(p.data),
deleteStockMovement:() => deleteStockMovement(p.id),
// MN
getWorkOrders:      () => getWorkOrders(),
addWorkOrder:       () => addWorkOrder(p.data),
updateWorkOrder:    () => updateWorkOrder(p.id, p.data),
deleteWorkOrder:    () => deleteWorkOrder(p.id),
getPMPlan:          () => getPMPlan(),
addPMPlan:          () => addPMPlan(p.data),
updatePMPlan:       () => updatePMPlan(p.id, p.data),
deletePMPlan:       () => deletePMPlan(p.id),
// Events
getEvents:          () => getEvents(p.dept),
addEvent:           () => addEvent(p.data),
updateEvent:        () => updateEvent(p.id, p.data),
deleteEvent:        () => deleteEvent(p.id),
};
if (!map[action]) return { error: `Unknown action: ${action}` };
return map[action]();
} catch (e) {
return { error: e.message, stack: e.stack };
}
}
