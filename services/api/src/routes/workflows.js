const express = require('express');
const router = express.Router();
const { getDatabaseCompat } = require('../database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ============== 流程定义 API ==============

// 获取流程定义列表
router.get('/definitions', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, type, status, search } = req.query;
    const offset = (page - 1) * pageSize;
    
    let sql = 'SELECT * FROM workflow_definitions WHERE company_id = ?';
    const params = [req.user.companyId];
    
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (search) {
      sql += ' AND name LIKE ?';
      params.push(`%${search}%`);
    }
    
    // 获取总数
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const total = db.prepare(countSql).get(...params).total;
    
    // 获取列表
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);
    
    const list = db.prepare(sql).all(...params).map(item => ({
      ...item,
      nodes: item.nodes ? JSON.parse(item.nodes) : []
    }));
    
    res.json({ success: true, list, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    console.error('获取流程定义失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取流程定义详情
router.get('/definitions/:id', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { id } = req.params;
    
    const item = db.prepare('SELECT * FROM workflow_definitions WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    
    if (!item) {
      return res.status(404).json({ success: false, error: '流程定义不存在' });
    }
    
    res.json({
      success: true,
      data: {
        ...item,
        nodes: item.nodes ? JSON.parse(item.nodes) : []
      }
    });
  } catch (error) {
    console.error('获取流程定义详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建流程定义
router.post('/definitions', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { name, type, description, status = 'active', nodes = [] } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ success: false, error: '流程名称和类型不能为空' });
    }
    
    const result = db.prepare(`
      INSERT INTO workflow_definitions (company_id, name, type, description, status, nodes, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(req.user.companyId, name, type, description || null, status, JSON.stringify(nodes), req.user.id);
    
    res.json({ success: true, data: { id: result.lastInsertRowid, name, type, status, nodes } });
  } catch (error) {
    console.error('创建流程定义失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新流程定义
router.put('/definitions/:id', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const { name, type, description, status, nodes } = req.body;
    
    // 检查是否存在
    const existing = db.prepare('SELECT * FROM workflow_definitions WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!existing) {
      return res.status(404).json({ success: false, error: '流程定义不存在' });
    }
    
    // 构建更新字段
    const updates = [];
    const params = [];
    
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (nodes !== undefined) { updates.push('nodes = ?'); params.push(JSON.stringify(nodes)); }
    
    updates.push('updated_at = datetime("now")');
    params.push(id, req.user.companyId);
    
    db.prepare(`UPDATE workflow_definitions SET ${updates.join(', ')} WHERE id = ? AND company_id = ?`).run(...params);
    
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新流程定义失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除流程定义
router.delete('/definitions/:id', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { id } = req.params;
    
    // 检查是否有进行中的实例
    const instances = db.prepare('SELECT COUNT(*) as count FROM workflow_instances WHERE definition_id = ? AND status = "pending"').get(id);
    if (instances.count > 0) {
      return res.status(400).json({ success: false, error: '该流程有进行中的实例，无法删除' });
    }
    
    db.prepare('DELETE FROM workflow_definitions WHERE id = ? AND company_id = ?').run(id, req.user.companyId);
    
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除流程定义失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 切换流程状态
router.put('/definitions/:id/toggle-status', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM workflow_definitions WHERE id = ? AND company_id = ?').get(id, req.user.companyId);
    if (!existing) {
      return res.status(404).json({ success: false, error: '流程定义不存在' });
    }
    
    const newStatus = existing.status === 'active' ? 'inactive' : 'active';
    db.prepare('UPDATE workflow_definitions SET status = ?, updated_at = datetime("now") WHERE id = ?').run(newStatus, id);
    
    res.json({ success: true, data: { ...existing, status: newStatus } });
  } catch (error) {
    console.error('切换流程状态失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== 待办任务 API ==============

// 获取我的待办
router.get('/tasks/pending', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, status, workflow_type, search } = req.query;
    const offset = (page - 1) * pageSize;
    
    let sql = `
      SELECT 
        t.*,
        wd.name as workflow_name,
        wd.type as workflow_type,
        wi.title,
        wi.initiator_id,
        u.name as initiator_name,
        wi.business_type,
        wi.business_id,
        wi.business_no
      FROM workflow_tasks t
      JOIN workflow_instances wi ON t.instance_id = wi.id
      JOIN workflow_definitions wd ON wi.definition_id = wd.id
      LEFT JOIN users u ON wi.initiator_id = u.id
      WHERE t.company_id = ? AND t.assignee_id = ?
    `;
    const params = [req.user.companyId, req.user.id];
    
    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    } else {
      sql += ' AND t.status = "pending"';
    }
    
    if (workflow_type) {
      sql += ' AND wd.type = ?';
      params.push(workflow_type);
    }
    
    if (search) {
      sql += ' AND (wi.title LIKE ? OR wd.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    // 获取总数
    const countSql = sql.replace(/SELECT[\s\S]+?FROM/, 'SELECT COUNT(*) as total FROM');
    const total = db.prepare(countSql).get(...params).total;
    
    // 获取列表
    sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);
    
    const list = db.prepare(sql).all(...params);
    
    res.json({ success: true, list, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    console.error('获取待办任务失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取任务详情
router.get('/tasks/:id', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { id } = req.params;
    
    const task = db.prepare(`
      SELECT 
        t.*,
        wd.name as workflow_name,
        wd.type as workflow_type,
        wi.title,
        wi.initiator_id,
        u.name as initiator_name,
        wi.form_data,
        wi.business_type,
        wi.business_id,
        wi.business_no
      FROM workflow_tasks t
      JOIN workflow_instances wi ON t.instance_id = wi.id
      JOIN workflow_definitions wd ON wi.definition_id = wd.id
      LEFT JOIN users u ON wi.initiator_id = u.id
      WHERE t.id = ? AND t.company_id = ?
    `).get(id, req.user.companyId);
    
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    
    res.json({
      success: true,
      data: {
        ...task,
        form_data: task.form_data ? JSON.parse(task.form_data) : null
      }
    });
  } catch (error) {
    console.error('获取任务详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 审批通过
router.post('/tasks/:id/approve', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const { comment } = req.body;
    
    // 获取任务信息
    const task = db.prepare(`
      SELECT t.*, wi.definition_id, wi.current_node_id
      FROM workflow_tasks t
      JOIN workflow_instances wi ON t.instance_id = wi.id
      WHERE t.id = ? AND t.company_id = ? AND t.assignee_id = ?
    `).get(id, req.user.companyId, req.user.id);
    
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在或无权限' });
    }
    
    if (task.status !== 'pending') {
      return res.status(400).json({ success: false, error: '任务已处理' });
    }
    
    // 更新任务状态
    db.prepare(`
      UPDATE workflow_tasks 
      SET status = 'approved', action = 'approve', comment = ?, processed_at = datetime('now')
      WHERE id = ?
    `).run(comment || '', id);
    
    // 记录历史
    db.prepare(`
      INSERT INTO workflow_history (company_id, instance_id, task_id, node_name, operator_id, operator_name, action, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'approve', ?, datetime('now'))
    `).run(req.user.companyId, task.instance_id, id, task.node_name || '', req.user.id, req.user.real_name || req.user.name || '', comment || '');
    
    // 检查是否还有其他待处理任务
    const pendingTasks = db.prepare('SELECT COUNT(*) as count FROM workflow_tasks WHERE instance_id = ? AND status = "pending"').get(task.instance_id);
    
    if (pendingTasks.count === 0) {
      // 获取流程定义的节点配置
      const definition = db.prepare('SELECT nodes FROM workflow_definitions WHERE id = ?').get(task.definition_id);
      const nodes = definition?.nodes ? JSON.parse(definition.nodes) : [];
      
      // 找到下一个节点
      const currentNodeIndex = nodes.findIndex(n => n.id === task.current_node_id);
      const nextNode = nodes[currentNodeIndex + 1];
      
      if (nextNode && nextNode.type === 'approval') {
        // 创建下一个审批任务
        let assigneeId = null;
        
        if (nextNode.approverType === 'user' && nextNode.approverIds?.length > 0) {
          assigneeId = nextNode.approverIds[0];
        } else if (nextNode.approverType === 'supervisor') {
          // 获取直属上级
          const initiator = db.prepare('SELECT supervisor_id FROM users WHERE id = ?').get(task.initiator_id);
          assigneeId = initiator?.supervisor_id;
        } else if (nextNode.approverType === 'dept_leader') {
          // 获取部门负责人
          const dept = db.prepare('SELECT leader_id FROM departments WHERE id = (SELECT department_id FROM users WHERE id = ?)').get(task.initiator_id);
          assigneeId = dept?.leader_id;
        }
        
        if (assigneeId) {
          db.prepare(`
            INSERT INTO workflow_tasks (company_id, instance_id, node_id, node_name, assignee_id, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
          `).run(req.user.companyId, task.instance_id, nextNode.id, nextNode.name, assigneeId);
          
          // 更新当前节点
          db.prepare('UPDATE workflow_instances SET current_node_id = ? WHERE id = ?').run(nextNode.id, task.instance_id);
        } else {
          // 没有找到审批人，流程结束
          db.prepare('UPDATE workflow_instances SET status = "approved", result = "approved", completed_at = datetime("now") WHERE id = ?').run(task.instance_id);
        }
      } else {
        // 流程结束
        db.prepare('UPDATE workflow_instances SET status = "approved", result = "approved", completed_at = datetime("now") WHERE id = ?').run(task.instance_id);
      }
    }
    
    res.json({ success: true, message: '审批通过' });
  } catch (error) {
    console.error('审批失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 驳回任务
router.post('/tasks/:id/reject', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { id } = req.params;
    const { comment } = req.body;
    
    // 获取任务信息
    const task = db.prepare(`
      SELECT t.*, wi.definition_id
      FROM workflow_tasks t
      JOIN workflow_instances wi ON t.instance_id = wi.id
      WHERE t.id = ? AND t.company_id = ? AND t.assignee_id = ?
    `).get(id, req.user.companyId, req.user.id);
    
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在或无权限' });
    }
    
    if (task.status !== 'pending') {
      return res.status(400).json({ success: false, error: '任务已处理' });
    }
    
    // 更新任务状态
    db.prepare(`
      UPDATE workflow_tasks 
      SET status = 'rejected', action = 'reject', comment = ?, processed_at = datetime('now')
      WHERE id = ?
    `).run(comment || '', id);
    
    // 记录历史
    db.prepare(`
      INSERT INTO workflow_history (company_id, instance_id, task_id, node_name, operator_id, operator_name, action, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'reject', ?, datetime('now'))
    `).run(req.user.companyId, task.instance_id, id, task.node_name || '', req.user.id, req.user.real_name || req.user.name || '', comment || '');
    
    // 取消其他待处理任务
    db.prepare(`
      UPDATE workflow_tasks 
      SET status = 'cancelled', processed_at = datetime('now')
      WHERE instance_id = ? AND status = 'pending'
    `).run(task.instance_id);
    
    // 更新实例状态
    db.prepare('UPDATE workflow_instances SET status = "rejected", result = "rejected", completed_at = datetime("now") WHERE id = ?').run(task.instance_id);
    
    res.json({ success: true, message: '已驳回' });
  } catch (error) {
    console.error('驳回失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 批量审批
router.post('/tasks/batch-approve', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { task_ids, comment } = req.body;
    
    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      return res.status(400).json({ success: false, error: '请选择要审批的任务' });
    }
    
    let success = 0;
    let failed = 0;
    const errors = [];
    
    for (const id of task_ids) {
      try {
        // 简化版批量审批
        const result = db.prepare(`
          UPDATE workflow_tasks 
          SET status = 'approved', action = 'approve', comment = ?, processed_at = datetime('now')
          WHERE id = ? AND company_id = ? AND assignee_id = ? AND status = 'pending'
        `).run(comment || null, id, req.user.companyId, req.user.id);
        
        if (result.changes > 0) {
          success++;
        } else {
          failed++;
          errors.push({ task_id: id, error: '任务不存在或已处理' });
        }
      } catch (e) {
        failed++;
        errors.push({ task_id: id, error: e.message });
      }
    }
    
    res.json({ success: true, data: { success, failed, errors } });
  } catch (error) {
    console.error('批量审批失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 批量驳回
router.post('/tasks/batch-reject', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { task_ids, comment } = req.body;
    
    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      return res.status(400).json({ success: false, error: '请选择要驳回的任务' });
    }
    
    const result = db.prepare(`
      UPDATE workflow_tasks 
      SET status = 'rejected', action = 'reject', comment = ?, processed_at = datetime('now')
      WHERE id IN (${task_ids.map(() => '?').join(',')}) AND company_id = ? AND assignee_id = ? AND status = 'pending'
    `).run(comment || null, ...task_ids, req.user.companyId, req.user.id);
    
    res.json({ success: true, data: { success: result.changes, failed: task_ids.length - result.changes } });
  } catch (error) {
    console.error('批量驳回失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============== 流程实例 API ==============

// 获取流程实例列表
router.get('/instances', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, status, workflow_type, initiator_id } = req.query;
    const offset = (page - 1) * pageSize;
    
    let sql = `
      SELECT 
        wi.*,
        wd.name as workflow_name,
        wd.type as workflow_type,
        u.name as initiator_name
      FROM workflow_instances wi
      JOIN workflow_definitions wd ON wi.definition_id = wd.id
      LEFT JOIN users u ON wi.initiator_id = u.id
      WHERE wi.company_id = ?
    `;
    const params = [req.user.companyId];
    
    if (status) {
      sql += ' AND wi.status = ?';
      params.push(status);
    }
    
    if (workflow_type) {
      sql += ' AND wd.type = ?';
      params.push(workflow_type);
    }
    
    if (initiator_id) {
      sql += ' AND wi.initiator_id = ?';
      params.push(initiator_id);
    }
    
    // 获取总数
    const countSql = sql.replace(/SELECT[\s\S]+?FROM/, 'SELECT COUNT(*) as total FROM');
    const total = db.prepare(countSql).get(...params).total;
    
    // 获取列表
    sql += ' ORDER BY wi.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);
    
    const list = db.prepare(sql).all(...params);
    
    res.json({ success: true, list, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    console.error('获取流程实例失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取实例详情
router.get('/instances/:id', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { id } = req.params;
    
    const instance = db.prepare(`
      SELECT 
        wi.*,
        wd.name as workflow_name,
        wd.type as workflow_type,
        wd.nodes as definition_nodes,
        u.name as initiator_name
      FROM workflow_instances wi
      JOIN workflow_definitions wd ON wi.definition_id = wd.id
      LEFT JOIN users u ON wi.initiator_id = u.id
      WHERE wi.id = ? AND wi.company_id = ?
    `).get(id, req.user.companyId);
    
    if (!instance) {
      return res.status(404).json({ success: false, error: '实例不存在' });
    }
    
    // 获取审批步骤
    const steps = db.prepare(`
      SELECT 
        t.id,
        t.node_id,
        t.node_name as step_name,
        t.status,
        t.action,
        t.comment,
        t.processed_at,
        u.name as approver_name,
        ROW_NUMBER() OVER (ORDER BY t.created_at) as step_no
      FROM workflow_tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.instance_id = ?
      ORDER BY t.created_at
    `).all(id);
    
    res.json({
      success: true,
      data: {
        ...instance,
        form_data: instance.form_data ? JSON.parse(instance.form_data) : null,
        nodes: instance.definition_nodes ? JSON.parse(instance.definition_nodes) : [],
        steps
      }
    });
  } catch (error) {
    console.error('获取实例详情失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取审批历史
router.get('/tasks/history', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { page = 1, pageSize = 20, status, workflow_type, start_date, end_date, initiator_id, approver_id } = req.query;
    const offset = (page - 1) * pageSize;
    
    let sql = `
      SELECT 
        t.*,
        wd.name as workflow_name,
        wd.type as workflow_type,
        wi.title,
        wi.initiator_id,
        u.name as initiator_name,
        wi.business_type,
        wi.business_no
      FROM workflow_tasks t
      JOIN workflow_instances wi ON t.instance_id = wi.id
      JOIN workflow_definitions wd ON wi.definition_id = wd.id
      LEFT JOIN users u ON wi.initiator_id = u.id
      WHERE t.company_id = ? AND t.assignee_id = ? AND t.status != 'pending'
    `;
    const params = [req.user.companyId, req.user.id];
    
    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }
    
    if (workflow_type) {
      sql += ' AND wd.type = ?';
      params.push(workflow_type);
    }
    
    if (start_date) {
      sql += ' AND date(t.processed_at) >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      sql += ' AND date(t.processed_at) <= ?';
      params.push(end_date);
    }
    
    // 获取总数
    const countSql = sql.replace(/SELECT[\s\S]+?FROM/, 'SELECT COUNT(*) as total FROM');
    const total = db.prepare(countSql).get(...params).total;
    
    // 获取列表
    sql += ' ORDER BY t.processed_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);
    
    const list = db.prepare(sql).all(...params);
    
    res.json({ success: true, list, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (error) {
    console.error('获取审批历史失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 发起流程
router.post('/instances', (req, res) => {
  try {
    const db = getDatabaseCompat();
    const { definition_id, title, business_type, business_id, business_no, form_data } = req.body;
    
    if (!definition_id) {
      return res.status(400).json({ success: false, error: '流程定义ID不能为空' });
    }
    
    // 获取流程定义
    const definition = db.prepare('SELECT * FROM workflow_definitions WHERE id = ? AND company_id = ? AND status = "active"').get(definition_id, req.user.companyId);
    
    if (!definition) {
      return res.status(404).json({ success: false, error: '流程定义不存在或已停用' });
    }
    
    const nodes = definition.nodes ? JSON.parse(definition.nodes) : [];
    
    // 创建流程实例
    const insertResult = db.prepare(`
      INSERT INTO workflow_instances (company_id, definition_id, title, initiator_id, status, business_type, business_id, business_no, form_data, current_node_id, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      req.user.companyId,
      definition_id,
      title || definition.name,
      req.user.id,
      business_type || null,
      business_id || null,
      business_no || null,
      form_data ? JSON.stringify(form_data) : null,
      nodes[0]?.id || null
    );
    
    // 获取新创建的实例 ID（通过查询最大 ID）
    const maxIdResult = db.prepare('SELECT MAX(id) as id FROM workflow_instances').get();
    const instanceId = maxIdResult?.id;
    
    if (!instanceId) {
      return res.status(500).json({ success: false, error: '创建流程实例失败' });
    }
    
    // 创建第一个审批任务（如果有）
    const firstApprovalNode = nodes.find(n => n.type === 'approval');
    if (firstApprovalNode) {
      let assigneeId = null;
      
      if (firstApprovalNode.approverType === 'user' && firstApprovalNode.approverIds?.length > 0) {
        assigneeId = firstApprovalNode.approverIds[0];
      } else if (firstApprovalNode.approverType === 'supervisor') {
        const user = db.prepare('SELECT supervisor_id FROM users WHERE id = ?').get(req.user.id);
        assigneeId = user?.supervisor_id;
      } else if (firstApprovalNode.approverType === 'dept_leader') {
        const dept = db.prepare('SELECT leader_id FROM departments WHERE id = (SELECT department_id FROM users WHERE id = ?)').get(req.user.id);
        assigneeId = dept?.leader_id;
      }
      
      if (assigneeId) {
        db.prepare(`
          INSERT INTO workflow_tasks (company_id, instance_id, node_id, node_name, assignee_id, status, created_at)
          VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
        `).run(req.user.companyId, instanceId, firstApprovalNode.id, firstApprovalNode.name, assigneeId);
        
        // 更新当前节点
        db.prepare('UPDATE workflow_instances SET current_node_id = ? WHERE id = ?').run(firstApprovalNode.id, instanceId);
      }
    }
    
    res.json({ success: true, data: { id: instanceId } });
  } catch (error) {
    console.error('发起流程失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;