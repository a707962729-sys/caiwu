import React, { useState } from 'react';
import './Receivables.css';

const mockReceivables = [
  { id: 1, type: 'receivable', partner: '科技有限公司', amount: 50000, dueDate: '2026-04-15', status: 'normal', daysLeft: 30 },
  { id: 2, type: 'receivable', partner: '创新科技', amount: 30000, dueDate: '2026-03-20', status: 'warning', daysLeft: 4 },
  { id: 3, type: 'receivable', partner: '数据公司', amount: 20000, dueDate: '2026-03-10', status: 'overdue', daysLeft: -6 },
  { id: 4, type: 'payable', partner: '供应商A', amount: 40000, dueDate: '2026-04-01', status: 'normal', daysLeft: 16 },
  { id: 5, type: 'payable', partner: '服务商B', amount: 15000, dueDate: '2026-03-25', status: 'warning', daysLeft: 9 },
];

const Receivables: React.FC = () => {
  const [records] = useState(mockReceivables);
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable');

  const filteredRecords = records.filter(r => r.type === activeTab);
  const totalReceivable = records.filter(r => r.type === 'receivable').reduce((s, r) => s + r.amount, 0);
  const totalPayable = records.filter(r => r.type === 'payable').reduce((s, r) => s + r.amount, 0);

  const statusMap: Record<string, { label: string; class: string }> = {
    normal: { label: '正常', class: 'normal' },
    warning: { label: '即将到期', class: 'warning' },
    overdue: { label: '已逾期', class: 'overdue' },
  };

  return (
    <div className="receivables-page">
      <div className="page-header">
        <h2>应收应付管理</h2>
        <button className="btn-primary">+ 新增记录</button>
      </div>

      <div className="summary-cards">
        <div className={`summary-card ${activeTab === 'receivable' ? 'active' : ''}`} onClick={() => setActiveTab('receivable')}>
          <div className="card-title">应收账款</div>
          <div className="card-amount income">¥{totalReceivable.toLocaleString()}</div>
          <div className="card-count">{records.filter(r => r.type === 'receivable').length} 笔</div>
        </div>
        <div className={`summary-card ${activeTab === 'payable' ? 'active' : ''}`} onClick={() => setActiveTab('payable')}>
          <div className="card-title">应付账款</div>
          <div className="card-amount expense">¥{totalPayable.toLocaleString()}</div>
          <div className="card-count">{records.filter(r => r.type === 'payable').length} 笔</div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr><th>{activeTab === 'receivable' ? '客户' : '供应商'}</th><th>金额</th><th>到期日</th><th>剩余天数</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            {filteredRecords.map(r => (
              <tr key={r.id}>
                <td>{r.partner}</td>
                <td className={`amount ${r.type === 'receivable' ? 'income' : 'expense'}`}>¥{r.amount.toLocaleString()}</td>
                <td>{r.dueDate}</td>
                <td className={r.daysLeft < 0 ? 'overdue' : r.daysLeft < 7 ? 'warning' : ''}>
                  {r.daysLeft < 0 ? `逾期 ${Math.abs(r.daysLeft)} 天` : `${r.daysLeft} 天`}
                </td>
                <td><span className={`status-badge ${statusMap[r.status].class}`}>{statusMap[r.status].label}</span></td>
                <td>
                  <button className="btn-text">{r.type === 'receivable' ? '收款' : '付款'}</button>
                  <button className="btn-text">详情</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Receivables;