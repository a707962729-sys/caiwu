import React, { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { reimbursementApi } from '@/api';
import type { Reimbursement, ReimbursementListParams } from '@/types';
import './Reimbursements.css';

const Reimbursements: React.FC = () => {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  const [formData, setFormData] = useState({
    title: '',
    reimbursement_type: '差旅费',
    amount: 0,
    currency: 'CNY',
    application_date: new Date().toISOString().split('T')[0],
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    items: [{ item_date: new Date().toISOString().split('T')[0], category: '差旅费', description: '', amount: 0 }]
  });

  const fetchReimbursements = useCallback(async () => {
    setLoading(true);
    try {
      const params: ReimbursementListParams = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...(filterStatus && { status: filterStatus }),
        ...(searchText && { search: searchText })
      };
      const res = await reimbursementApi.getList(params);
      setReimbursements(res.list);
      setPagination(prev => ({ ...prev, total: res.pagination.total }));
    } catch (err) {
      message.error('获取报销列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filterStatus, searchText]);

  useEffect(() => {
    fetchReimbursements();
  }, [fetchReimbursements]);

  const handleAdd = async () => {
    try {
      await reimbursementApi.create(formData);
      message.success('提交成功');
      setShowApplyModal(false);
      setFormData({
        title: '',
        reimbursement_type: '差旅费',
        amount: 0,
        currency: 'CNY',
        application_date: new Date().toISOString().split('T')[0],
        expense_date: new Date().toISOString().split('T')[0],
        description: '',
        items: [{ item_date: new Date().toISOString().split('T')[0], category: '差旅费', description: '', amount: 0 }]
      });
      fetchReimbursements();
    } catch {
      message.error('提交失败');
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await reimbursementApi.approve(id, { action: 'approve' });
      message.success('已通过');
      fetchReimbursements();
    } catch {
      message.error('操作失败');
    }
  };

  const handleReject = async (id: number) => {
    try {
      await reimbursementApi.approve(id, { action: 'reject', reject_reason: '管理员拒绝' });
      message.success('已拒绝');
      fetchReimbursements();
    } catch {
      message.error('操作失败');
    }
  };

  const handlePay = async (id: number) => {
    try {
      await reimbursementApi.pay(id);
      message.success('已打款');
      fetchReimbursements();
    } catch {
      message.error('操作失败');
    }
  };

  const statusMap: Record<string, { label: string; class: string }> = {
    draft: { label: '草稿', class: 'draft' },
    pending: { label: '待审批', class: 'pending' },
    approved: { label: '已通过', class: 'approved' },
    rejected: { label: '已拒绝', class: 'rejected' },
    paid: { label: '已打款', class: 'paid' }
  };

  const pendingAmount = reimbursements.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);
  const approvedAmount = reimbursements.filter(r => r.status === 'approved').reduce((s, r) => s + r.amount, 0);

  return (
    <div className="reimbursements-page">
      <div className="page-header">
        <h2>报销管理</h2>
        <button className="btn-primary" onClick={() => setShowApplyModal(true)}>+ 申请报销</button>
      </div>

      <div className="stats-cards">
        <div className="stat-card warning"><div className="stat-value">¥{pendingAmount.toLocaleString()}</div><div className="stat-label">待审批金额</div></div>
        <div className="stat-card success"><div className="stat-value">¥{approvedAmount.toLocaleString()}</div><div className="stat-label">待打款金额</div></div>
        <div className="stat-card"><div className="stat-value">{reimbursements.filter(r => r.status === 'pending').length}</div><div className="stat-label">待处理</div></div>
      </div>

      <div className="filter-bar">
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}>
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="pending">待审批</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
          <option value="paid">已打款</option>
        </select>
        <input type="text" placeholder="搜索..." value={searchText} onChange={e => { setSearchText(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} />
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr><th>编号</th><th>类型</th><th>金额</th><th>明细数</th><th>申请日期</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="loading-cell">加载中...</td></tr>
            ) : reimbursements.length === 0 ? (
              <tr><td colSpan={7} className="empty-cell">暂无数据</td></tr>
            ) : (
              reimbursements.map(r => (
                <tr key={r.id}>
                  <td>{r.reimbursement_no}</td>
                  <td>{r.reimbursement_type}</td>
                  <td className="amount">¥{r.amount.toLocaleString()}</td>
                  <td>{r.items?.length || 0} 项</td>
                  <td>{r.application_date}</td>
                  <td><span className={`status-badge ${statusMap[r.status]?.class || ''}`}>{statusMap[r.status]?.label || r.status}</span></td>
                  <td>
                    {r.status === 'pending' && (
                      <>
                        <button className="btn-text" onClick={() => handleApprove(r.id)}>通过</button>
                        <button className="btn-text danger" onClick={() => handleReject(r.id)}>拒绝</button>
                      </>
                    )}
                    {r.status === 'approved' && (
                      <button className="btn-text" onClick={() => handlePay(r.id)}>打款</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination.total > 0 && (
        <div className="pagination">
          <span>共 {pagination.total} 条</span>
          <button disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>上一页</button>
          <span>{pagination.page} / {Math.ceil(pagination.total / pagination.pageSize)}</span>
          <button disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>下一页</button>
        </div>
      )}

      {showApplyModal && (
        <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>申请报销</h3>
            <div className="form-group"><label>报销标题</label><input type="text" placeholder="报销标题" value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="form-group"><label>报销类型</label>
              <select value={formData.reimbursement_type} onChange={e => setFormData(f => ({ ...f, reimbursement_type: e.target.value }))}>
                <option>差旅费</option><option>办公用品</option><option>交通费</option><option>餐饮费</option><option>其他</option>
              </select>
            </div>
            <div className="form-group"><label>金额</label><input type="number" placeholder="报销金额" value={formData.amount || ''} onChange={e => setFormData(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
            <div className="form-group"><label>说明</label><textarea placeholder="报销说明" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowApplyModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleAdd}>提交申请</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reimbursements;
