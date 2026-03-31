const config = require("../config");
const logger = require("../utils/logger");
const API_BASE = 'http://localhost:3000/api';
function getAuth(token) { return token ? {Authorization:'Bearer '+token} : {}; }
async function execInvoiceOCR(params, token) {
  try {
    if (!params.image) return {success:false, error:'缺少图片'};
    const r = await fetch(API_BASE+'/internal/ocr', {method:'POST',headers:{'Content-Type':'application/json','x-internal-api-key':'caiwu-internal-service-key-2024'},body:JSON.stringify({image:params.image})});
    const json = await r.json();
    // /internal/ocr 返回 {success, data: invoiceData}，直接透传 data，不要再套一层
    return {success: json.success !== false, data: json.data || json};
  } catch(e) { return {success:false, error:e.message}; }
}
async function execParseInvoiceText(params) {
  const t = params.invoice_text || '';
  if (!t) return {success:false, error:'缺少文字'};
  const d = {invoice_no:'',date:'',amount:0,tax:0,total:0,buyer:'',seller:'',status:'有效'};
  const lines = t.split('\n').map(l=>l.trim()).filter(l=>l);
  for (const l of lines) {
    // 发票号码
    const im = l.match(/(?:发票号(?:码|)?[：:]\s*)([A-Z0-9]{6,})/i) || l.match(/(?:invoice|no)[：:\s]*([A-Z0-9]{6,})/i);
    if (im) d.invoice_no = im[1];
    // 日期：支持年月日、不完整日期
    const dm = l.match(/(\d{4})[年\-/](\d{1,2})[月\-/]?(\d{0,2})/) || l.match(/开票日期[：:\s]*(\d{4})[年\-/](\d{1,2})[月\-/]?(\d{0,2})/);
    if (dm) d.date = dm[1] + '-' + dm[2].padStart(2,'0') + '-' + (dm[3]||'01').padStart(2,'0');
  }
  // 金额：优先匹配"价税合计"，然后处理其他金额字段
  let amount = 0, tax = 0, total = 0;
  // 1. 优先匹配价税合计（最准确的总金额）
  // 滴滴发票：价税合计（大写）行 + 小写¥数字分开，跨行匹配
  let totalMatch = t.match(/价税合计[^¥￥\n]*?([\d,]+\.?\d*)\s*(?:元|NT)?/);
  if (totalMatch) total = parseFloat(totalMatch[1].replace(/,/g,''));
  // 备选：直接匹配"（小写）¥数字"或"小写数字"（滴滴格式有空格和全角括号）
  if (!total || total === 0) {
    const smallMatch = t.match(/[（(]\s*小\s*写\s*[）)]\s*[¥￥]?\s*([\d,]+\.?\d*)/);
    if (smallMatch) total = parseFloat(smallMatch[1].replace(/,/g,''));
  }
  // 2. 优先匹配 ¥前缀的含税金额（滴滴发票：¥752.20 是实际不含税金额，¥22.57是税额，¥774.77是总额）
  //    滴滴发票中金 额行796.67是原始金额，¥752.20才是实际扣除税后的金额
  const yenAmounts = [...t.matchAll(/¥\s*([\d,]+\.?\d*)/g)].map(m=>parseFloat(m[1].replace(/,/g,'')));
  if (yenAmounts.length >= 3) {
    // 最大的是总额，中间的是不含税，最小的是税额（或按滴滴格式：最大=总额，其他两=金额和税额）
    const sorted = [...yenAmounts].sort((a,b)=>a-b);
    total = sorted[sorted.length-1]; // 最大值是价税合计
    // 剩下两个：滴滴发票 ¥752.20（不含税）> ¥22.57（税额）
    amount = sorted[1]; // 次大=不含税金额
    tax = sorted[0];    // 最小=税额
  } else if (yenAmounts.length === 2) {
    total = Math.max(...yenAmounts);
    amount = Math.min(...yenAmounts);
  } else if (yenAmounts.length === 1) {
    total = yenAmounts[0];
  }
  // 备选：原始格式匹配（仅当没有¥前缀金额时使用）
  if (!amount || amount === 0) {
    const amtMatch = t.match(/金\s*额[：:\s]*\n?\s*([\d,]+\.?\d*)/);
    if (amtMatch) amount = parseFloat(amtMatch[1].replace(/,/g,''));
  }
  if (!tax || tax === 0) {
    const taxMatch = t.match(/税\s*额[：:\s]*\n?\s*([\d,]+\.?\d*)/);
    if (taxMatch) tax = parseFloat(taxMatch[1].replace(/,/g,''));
  }
  // 4. 如果没有找到价税合计，从候选数字中取最大的作为总额
  if (!total) {
    const nums = (t.match(/[￥¥]?\s*[\d,]+\.?\d*/g)||[])
      .map(a=>parseFloat(a.replace(/[￥¥,\s]/g,'')))
      .filter(n=>n>10&&n<1000000);
    if (nums.length>0) {
      if (!amount) amount = nums[0];
      if (!tax && nums.length>1) tax = nums[1];
      if (!total) total = nums.reduce((max,n)=>n>max?n:max,0);
    }
  }
  d.amount = amount;
  d.tax = tax;
  d.total = total || amount;
  if (t.includes('作废')) d.status = '作废';
  // 只要有内容就尝试返回（宽松匹配）
  const hasSomething = d.invoice_no || d.date || d.amount > 0 || d.buyer || d.seller;
  if (!hasSomething) return {success:false, error:'无法解析'};
  if (!d.total && d.amount) d.total = d.amount;
  return {success:true, data:d, message:'成功'};
}
const executors = {invoice_ocr:execInvoiceOCR, parse_invoice_text:execParseInvoiceText};
async function executeTool(name, params, token) {
  const f = executors[name]; if (!f) throw new Error('Unknown:'+name);
  try { return await f(params, token); } catch(e) { return {success:false, error:e.message}; }
}
module.exports = {executeTool, parse_invoice_text:execParseInvoiceText};
