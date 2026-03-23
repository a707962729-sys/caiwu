/**
 * 审计日志中间件
 * 自动记录所有数据变更操作
 */

const { getDatabaseCompat, saveDatabase } = require('../database');

/**
 * 记录审计日志
 * @param {Object} options - 日志选项
 * @param {number} options.companyId - 公司ID
 * @param {number} options.userId - 用户ID
 * @param {string} options.action - 操作类型 (create/update/delete/confirm/reverse/approve/reject/pay)
 * @param {string} options.module - 模块名称 (transactions/reimbursements/contracts等)
 * @param {number} options.recordId - 记录ID
 * @param {Object} options.oldValue - 旧值
 * @param {Object} options.newValue - 新值
 * @param {Object} options.req - Express请求对象 (可选，用于获取IP等)
 */
function logAudit(options) {
  const {
    companyId,
    userId,
    action,
    module,
    recordId,
    oldValue = null,
    newValue = null,
    req = null
  } = options;

  try {
    const db = getDatabaseCompat();
    
    const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || null;
    const userAgent = req?.headers?.['user-agent'] || null;

    db.prepare(`
      INSERT INTO audit_logs (
        company_id, user_id, action, entity_type, entity_id,
        old_value, new_value, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      companyId,
      userId,
      action,
      module,
      recordId,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ipAddress,
      userAgent
    );

    saveDatabase();
    return true;
  } catch (error) {
    console.error('Audit log error:', error);
    return false;
  }
}

/**
 * 审计日志中间件工厂函数
 * 创建一个中间件，在请求处理后自动记录日志
 * 
 * @param {Object} options - 配置选项
 * @param {string} options.module - 模块名称
 * @param {string} options.action - 操作类型
 * @param {Function} options.getRecordId - 从请求中获取记录ID的函数 (req) => id
 * @param {Function} options.getOldData - 获取旧数据的函数 (req) => Promise<Object>
 * @param {Function} options.getNewData - 获取新数据的函数 (req, res) => Promise<Object>
 * @returns {Function} Express中间件
 */
function auditMiddleware(options) {
  const {
    module,
    action,
    getRecordId = (req) => req.params.id,
    getOldData = null,
    getNewData = null
  } = options;

  return async (req, res, next) => {
    // 保存原始的 res.json 方法
    const originalJson = res.json.bind(res);
    
    // 用于存储旧数据
    let oldData = null;
    
    // 如果需要获取旧数据，在请求处理前获取
    if (getOldData && req.user) {
      try {
        oldData = await getOldData(req);
      } catch (error) {
        console.error('Failed to get old data for audit:', error);
      }
    }

    // 重写 res.json 方法
    res.json = function(data) {
      // 调用原始的 json 方法
      originalJson(data);

      // 如果请求成功，记录审计日志
      if (data && data.success !== false && req.user) {
        const recordId = getRecordId(req);
        
        if (recordId) {
          let newData = null;
          
          // 获取新数据
          if (getNewData) {
            try {
              newData = getNewData(req, data);
            } catch (error) {
              console.error('Failed to get new data for audit:', error);
            }
          } else if (data.data) {
            newData = data.data;
          }

          logAudit({
            companyId: req.user.companyId,
            userId: req.user.id,
            action,
            module,
            recordId: parseInt(recordId),
            oldValue: oldData,
            newValue: newData,
            req
          });
        }
      }
    };

    next();
  };
}

/**
 * 创建审计日志辅助函数 - 用于手动记录
 */
const AuditLogger = {
  /**
   * 记录创建操作
   */
  logCreate(module, recordId, newData, req) {
    return logAudit({
      companyId: req.user.companyId,
      userId: req.user.id,
      action: 'create',
      module,
      recordId,
      newValue: newData,
      req
    });
  },

  /**
   * 记录更新操作
   */
  logUpdate(module, recordId, oldData, newData, req) {
    return logAudit({
      companyId: req.user.companyId,
      userId: req.user.id,
      action: 'update',
      module,
      recordId,
      oldValue: oldData,
      newValue: newData,
      req
    });
  },

  /**
   * 记录删除操作
   */
  logDelete(module, recordId, oldData, req) {
    return logAudit({
      companyId: req.user.companyId,
      userId: req.user.id,
      action: 'delete',
      module,
      recordId,
      oldValue: oldData,
      req
    });
  },

  /**
   * 记录确认操作
   */
  logConfirm(module, recordId, oldData, newData, req) {
    return logAudit({
      companyId: req.user.companyId,
      userId: req.user.id,
      action: 'confirm',
      module,
      recordId,
      oldValue: oldData,
      newValue: newData,
      req
    });
  },

  /**
   * 记录审批操作
   */
  logApprove(module, recordId, oldData, newData, req) {
    return logAudit({
      companyId: req.user.companyId,
      userId: req.user.id,
      action: 'approve',
      module,
      recordId,
      oldValue: oldData,
      newValue: newData,
      req
    });
  },

  /**
   * 记录拒绝操作
   */
  logReject(module, recordId, oldData, newData, req) {
    return logAudit({
      companyId: req.user.companyId,
      userId: req.user.id,
      action: 'reject',
      module,
      recordId,
      oldValue: oldData,
      newValue: newData,
      req
    });
  },

  /**
   * 记录支付操作
   */
  logPay(module, recordId, oldData, newData, req) {
    return logAudit({
      companyId: req.user.companyId,
      userId: req.user.id,
      action: 'pay',
      module,
      recordId,
      oldValue: oldData,
      newValue: newData,
      req
    });
  },

  /**
   * 记录冲销操作
   */
  logReverse(module, recordId, oldData, newData, req) {
    return logAudit({
      companyId: req.user.companyId,
      userId: req.user.id,
      action: 'reverse',
      module,
      recordId,
      oldValue: oldData,
      newValue: newData,
      req
    });
  },

  /**
   * 记录提交操作
   */
  logSubmit(module, recordId, oldData, newData, req) {
    return logAudit({
      companyId: req.user.companyId,
      userId: req.user.id,
      action: 'submit',
      module,
      recordId,
      oldValue: oldData,
      newValue: newData,
      req
    });
  },

  /**
   * 通用日志记录
   */
  log(options) {
    return logAudit(options);
  }
};

module.exports = {
  logAudit,
  auditMiddleware,
  AuditLogger
};