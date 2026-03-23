import React, { useState } from 'react';
import './Reimbursements.css';

const mockReimbursements = [
  { id: 1, applicant: '张三', type: '差旅费', amount: 3500, status: 'pending', date: '2026-03-16', items: [{ desc: '机票', amount: 2000 }, { desc: '酒店', amount: 1500 }] },
  { id: 2, applicant: '李四', type: '办公用品', amount: 800, status: 'approved', date: '2026-03-15', items: [{ desc: '文具', amount: 800 }] },
  { id: 3, applicant: '王五', type: '交通费', amount: 200, status: 'paid', date: '2026-03-14', items: [{ desc: '打车', amount: 200 }] },
];

const Reimbursements: React.FC = () => {
  const [reimbursements] = useState(mockReimbursements);
  const [showApplyModal, setShowApplyModal] = useState(false);

  const statusMap: Record<string, { label: string; class: string }> = {
    pending: { label: '待审批', class: 'pending' },
    approved: { label: '已通过', class: 'approved' },
    rejected: { label: '已拒绝', class: 'rejected' },
    paid: { label: '已打款', class: 'paid' },
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
        <select><option>全部状态</option><option>待审批</option><option>已通过</option><option>已打款</option></select>
        <input type="text" placeholder="搜索..." />
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr><th>申请人</th><th>类型</th><th>金额</th><th>明细数</th><th>申请日期</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            {reimbursements.map(r => (
              <tr key={r.id}>
                <td>{r.applicant}</td>
                <td>{r.type}</td>
                <td className="amount">¥{r.amount.toLocaleString()}</td>
                <td>{r.items.length} 项</td>
                <td>{r.date}</td>
                <td><span className={`status-badge ${statusMap[r.status].class}`}>{statusMap[r.status].label}</span></td>
                <td>
                  <button className="btn-text">查看</button>
                  {r.status === 'pending' && <><button className="btn-text">通过</button><button className="btn-text danger">拒绝</button></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showApplyModal && (
        <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>申请报销</h3>
            <div className="form-group"><label>报销类型</label><select><option>差旅费</option><option>办公用品</option><option>交通费</option><option>其他</option></select></div>
            <div className="form-group"><label>金额</label><input type="number" placeholder="报销金额" /></div>
            <div className="form-group"><label>说明</label><textarea placeholder="报销说明" /></div>
            <div className="form-group"><label>上传票据</label><input type="file" multiple /></div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowApplyModal(false)}>取消</button>
              <button className="btn-primary">提交申请</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reimbursements;