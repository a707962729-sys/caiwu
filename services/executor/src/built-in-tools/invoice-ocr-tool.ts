/**
 * 内置工具：invoice_ocr
 * 识别发票图片，自动归档到系统
 * 优先使用 tesseract OCR（macOS 本地），无 API 费用
 */

import { ToolDefinition, ToolContext, ToolResult } from '../types';
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';

export const invoiceOcrTool: ToolDefinition = {
  id: 'executor_invoice_ocr',
  name: 'invoice_ocr',
  description: '识别发票图片，提取信息并自动归档到财务系统。接收发票照片路径，返回识别结果和归档状态。',
  parameters: {
    type: 'object',
    properties: {
      image_path: {
        type: 'string',
        description: '发票图片的本地路径或 URL'
      },
      direction: {
        type: 'string',
        enum: ['income', 'expense'],
        default: 'income',
        description: '发票方向：income(进项/收到) 或 expense(销项/开出)'
      }
    },
    required: ['image_path']
  },
  enabled: true,
  handler: executeInvoiceOcr
};

function runTesseract(imagePath: string): string {
  const tesseract = '/opt/homebrew/bin/tesseract';
  const fs = require('fs');
  const tmpName = `ocr_${Date.now()}`;
  const safePath = `/tmp/${tmpName}.jpg`;
  try {
    fs.copyFileSync(imagePath, safePath);
  } catch (_) {
    return '';
  }
  try {
    const result = execSync(`cd /tmp && ${tesseract} ${tmpName}.jpg stdout --oem 1 --psm 6 -l chi_sim+eng 2>/dev/null`, {
      encoding: 'utf-8',
      timeout: 30000
    });
    return result;
  } catch (e) {
    try {
      const result = execSync(`cd /tmp && ${tesseract} ${tmpName}.jpg stdout --oem 1 --psm 6 -l eng 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 30000
      });
      return result;
    } catch (_) {
      return '';
    }
  } finally {
    try { fs.unlinkSync(safePath); } catch (_) {}
  }
}

function parseInvoiceText(text: string): any {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // 提取发票号
  const invoiceNoMatch = text.match(/[一二三四五六七八九十]?[0-9]{10,}/) ||
    text.match(/FP[\w]{10,}/i) ||
    text.match(/[0-9]{12,}/) ||
    text.match(/发票号[：:]\s*([\w]+)/) ||
    text.match(/(?:invoice|发票)[-#]?\s*([\w]+)/i);
  const invoiceNo = invoiceNoMatch ? invoiceNoMatch[1] || invoiceNoMatch[0] : `OCR${Date.now()}`;

  // 提取金额
  const amountMatches = text.match(/(?:金额|总额|价税合计|合计)[：:\s]*[￥¥]?\s*([\d,]+\.?\d*)/);
  const amountMatch2 = text.match(/[￥¥]\s*([\d,]+\.\d{2})/);
  const amount = amountMatches ? parseFloat(amountMatches[1].replace(/,/g, '')) :
                amountMatch2 ? parseFloat(amountMatch2[1].replace(/,/g, '')) : 0;

  // 提取日期
  const dateMatch = text.match(/(\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?)/) ||
                   text.match(/(\d{4}\/\d{1,2}\/\d{1,2})/) ||
                   text.match(/开票日期[：:]\s*([\d-]+)/);
  let issueDate = new Date().toISOString().slice(0, 10);
  if (dateMatch) {
    const d = dateMatch[1].replace(/[年月日]/g, '-').replace(/--/g, '-').replace(/-$/g, '');
    const parts = d.split('-').filter(Boolean);
    if (parts.length >= 3) {
      issueDate = `${parts[0].padStart(4,'0')}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`;
    }
  }

  // 提取销售方
  const sellerMatch = text.match(/(?:销售方|开票方|卖方|供应商)[：:\s]*([^\n,，]{2,30})/) ||
                      text.match(/(?:名称)[：:\s]*([^\n,，]{2,30})/);
  const seller = sellerMatch ? sellerMatch[1].trim() : '未知';

  // 提取购买方
  const buyerMatch = text.match(/(?:购买方|购货方|买方|客户)[：:\s]*([^\n,，]{2,30})/);
  const buyer = buyerMatch ? buyerMatch[1].trim() : '';

  // 提取税率
  const taxRateMatch = text.match(/(?:税率|征收率)[：:\s]*([\d%.]+)/);
  const taxRate = taxRateMatch ? parseFloat(taxRateMatch[1].replace(/%/g, '')) : 6;
  const amountBeforeTax = Math.round(amount / (1 + taxRate / 100) * 100) / 100;
  const taxAmount = Math.round((amount - amountBeforeTax) * 100) / 100;

  // 识别发票类型
  let invoiceType = 'vat_invoice';
  if (text.includes('电子发票') || text.includes('增值税电子')) invoiceType = 'electronic_invoice';
  else if (text.includes('普通发票') || text.includes('增值税普通')) invoiceType = 'normal_invoice';
  else if (text.includes('出租车') || text.includes(' Taxi ')) invoiceType = 'taxi_receipt';
  else if (text.includes('火车') || text.includes('铁路')) invoiceType = 'train_ticket';
  else if (text.includes('餐饮') || text.includes('定额')) invoiceType = 'other';

  return {
    invoice_no: invoiceNo,
    invoice_type: invoiceType,
    total_amount: amount || 0,
    amount_before_tax: amountBeforeTax || 0,
    tax_amount: taxAmount || 0,
    issue_date: issueDate,
    seller_name: seller,
    buyer_name: buyer,
    raw_text: text.slice(0, 500)
  };
}

export async function executeInvoiceOcr(
  args: { image_path?: string; direction?: string },
  context: ToolContext
): Promise<ToolResult> {
  const { image_path, direction = 'income' } = args;

  if (!image_path) {
    return { success: false, output: '缺少图片路径参数 image_path' };
  }

  const fs = require('fs');
  const https = require('https');
  const http = require('http');
  const path = require('path');

  try {
    let imagePath = image_path;

    // 如果是 URL，先下载
    if (image_path.startsWith('http://') || image_path.startsWith('https://')) {
      const tmpPath = `/tmp/invoice_${Date.now()}.jpg`;
      await new Promise<void>((resolve, reject) => {
        const protocol = image_path.startsWith('https') ? https : http;
        protocol.get(image_path, (res: any) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            // 处理重定向
            protocol.get(res.headers.location, (res2: any) => {
              const ws = fs.createWriteStream(tmpPath);
              res2.pipe(ws);
              ws.on('close', () => resolve());
              ws.on('error', reject);
            }).on('error', reject);
          } else {
            const ws = fs.createWriteStream(tmpPath);
            res.pipe(ws);
            ws.on('close', () => resolve());
            ws.on('error', reject);
          }
        }).on('error', reject);
      });
      imagePath = tmpPath;
    }

    if (!existsSync(imagePath)) {
      return { success: false, output: `图片文件不存在: ${imagePath}` };
    }

    // 如果是 PDF，先转成图片
    if (imagePath.toLowerCase().endsWith('.pdf')) {
      const pdfTmpName = `/tmp/pdf_ocr_${Date.now()}`;
      try {
        execSync(`/opt/homebrew/bin/pdftoppm -jpeg -r 200 "${imagePath}" "${pdfTmpName}" 2>/dev/null`, { timeout: 30000 });
        const pdfPage = `${pdfTmpName}-1.jpg`;
        if (existsSync(pdfPage)) {
          imagePath = pdfPage;
        }
      } catch (_) {
        return { success: false, output: `PDF 转图片失败，请确保文件是有效的 PDF 文档` };
      }
    }

    // 执行 OCR
    const text = runTesseract(imagePath);
    if (!text || text.trim().length < 5) {
      return { success: false, output: `OCR 识别失败，无法从图片中提取文字。请确保图片清晰。` };
    }

    // 解析发票信息
    const data = parseInvoiceText(text);

    // 调用 API 创建发票记录
    const invoicesApiUrl = process.env.INVOICES_API_URL || 'http://localhost:3000';
    let invoiceRecord: any = null;
    let createError: string | null = null;

    try {
      const createRes = await fetch(`${invoicesApiUrl}/api/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.API_JWT_TOKEN || 'test-token'}`
        },
        body: JSON.stringify({
          invoice_no: data.invoice_no,
          invoice_type: data.invoice_type,
          type: data.invoice_type,
          amount: data.total_amount,
          amount_before_tax: data.amount_before_tax,
          tax_amount: data.tax_amount,
          total_amount: data.total_amount,
          invoice_date: data.issue_date,
          issue_date: data.issue_date,
          direction: direction === 'expense' ? 'out' : 'in',
          issuer: data.seller_name,
          payer: data.buyer_name,
          status: 'pending'
        })
      });

      if (createRes.ok) {
        invoiceRecord = await createRes.json();
      } else {
        createError = `HTTP ${createRes.status}: ${await createRes.text()}`;
      }
    } catch (e: any) {
      createError = e.message;
    }

    const output = [
      `📄 发票 OCR 识别结果（tesseract 本地识别）：`,
      ``,
      `识别原文：${text.slice(0, 200).replace(/\n/g, ' ')}...`,
      ``,
      `**提取信息：**`,
      `- 发票号：${data.invoice_no}`,
      `- 类型：${data.invoice_type}`,
      `- 金额：¥${data.total_amount}`,
      `- 税额：¥${data.tax_amount}`,
      `- 价税合计：¥${data.total_amount}`,
      `- 开票日期：${data.issue_date}`,
      `- 销售方：${data.seller_name}`,
      `- 购买方：${data.buyer_name || '未知'}`,
      `- 方向：${direction === 'income' ? '进项（收到）' : '销项（开出）'}`,
      ``,
      invoiceRecord?.success
        ? `✅ 发票已归档到系统（ID: ${invoiceRecord.data?.id}）`
        : `⚠️ 识别完成，但归档失败：${createError || '未知错误'}`,
      ``,
      invoiceRecord?.success ? '' : `请手动录入：${invoicesApiUrl}/invoices`
    ].filter(Boolean).join('\n');

    return {
      success: !!invoiceRecord?.success,
      output
    };

  } catch (err: any) {
    return {
      success: false,
      output: `发票 OCR 处理失败: ${err.message}`
    };
  }
}
