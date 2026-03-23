import React, { useState } from 'react';
import './Contracts.css';

const mockContracts = [
  { id: 1, name: '软件开发服务合同', partner: '科技有限公司', amount: 150000, startDate: '2026-01-01', endDate: '2026-12-31', status: 'active' },
  { id: 2, name: '产品采购合同', partner: '供应商A', amount: 80000, startDate: '2026-02-15', endDate: '2026-08-15', status: 'active' },
  { id: 3, name: '咨询服务协议', partner: '咨询公司', amount: 50000, startDate: '2025-06-01', endDate: '2026-05-31', status: 'expiring' },
  { id: 4, name: '设备租赁合同', partner: '设备租赁商', amount: 30000, startDate: '2025-01-01', endDate: '2025-12-31', status: 'expired' },
];

const Contracts: React.FC = () => {
  const [contracts] = useState(mockContracts);
  const [showAddModal, setShowAddModal] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedContract, setSelectedContract] = useState<any>(null);

  const statusMap: Record<string, { label: string; class: string }> = {
    active: { label: '执行中', class: 'active' },
    expiring: { label: '即将到期', class: 'expiring' },
    expired: { label: '已过期', class: 'expired' },
  };

  return (
    <div className="contracts-page">
      <div className="page-header">
        <h2>合同管理</h2>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ 新增合同</button>
      </div>

      <div className="filter-bar">
        <select><option>全部状态</option><option>执行中</option><option>即将到期</option><option>已过期</option></select>
        <input type="text" placeholder="搜索合同..." />
      </div>

      <div className="contracts-grid">
        {contracts.map(contract => (
          <div key={contract.id} className="contract-card" onClick={() => setSelectedContract(contract)}>
            <div className="contract-header">
              <h3>{contract.name}</h3>
              <span className={`status-badge ${statusMap[contract.status].class}`}>
                {statusMap[contract.status].label}
              </span>
            </div>
            <div className="contract-body">
              <div className="contract-info">
                <span className="label">合作方</span>
                <span className="value">{contract.partner}</span>
              </div>
              <div className="contract-info">
                <span className="label">合同金额</span>
                <span className="value amount">¥{contract.amount.toLocaleString()}</span>
              </div>
              <div className="contract-info">
                <span className="label">有效期</span>
                <span className="value">{contract.startDate} ~ {contract.endDate}</span>
              </div>
            </div>
            <div className="contract-footer">
              <button className="btn-text">查看详情</button>
              <button className="btn-text">编辑</button>
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>新增合同</h3>
            <div className="form-group"><label>合同名称</label><input type="text" placeholder="输入合同名称" /></div>
            <div className="form-group"><label>合作方</label><input type="text" placeholder="输入合作方名称" /></div>
            <div className="form-row">
              <div className="form-group"><label>合同金额</label><input type="number" placeholder="金额" /></div>
              <div className="form-group"><label>签订日期</label><input type="date" /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>开始日期</label><input type="date" /></div>
              <div className="form-group"><label>结束日期</label><input type="date" /></div>
            </div>
            <div className="form-group"><label>备注</label><textarea placeholder="合同备注" /></div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>取消</button>
              <button className="btn-primary">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contracts;