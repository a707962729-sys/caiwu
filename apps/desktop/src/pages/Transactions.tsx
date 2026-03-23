import React, { useState } from 'react';
import './Transactions.css';

// Mock 数据
const mockTransactions = [
  { id: 1, date: '2026-03-16', type: 'expense', category: '办公费用', amount: 1500, description: '办公用品采购', status: 'confirmed' },
  { id: 2, date: '2026-03-15', type: 'income', category: '服务收入', amount: 50000, description: '项目服务费', status: 'confirmed' },
  { id: 3, date: '2026-03-14', type: 'expense', category: '差旅费', amount: 3200, description: '出差报销', status: 'pending' },
  { id: 4, date: '2026-03-13', type: 'income', category: '产品销售', amount: 28000, description: '产品销售收入', status: 'confirmed' },
  { id: 5, date: '2026-03-12', type: 'expense', category: '人员工资', amount: 45000, description: '3月工资发放', status: 'confirmed' },
];

const Transactions: React.FC = () => {
  const [transactions] = useState(mockTransactions);
  const [filterType, setFilterType] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    type: 'expense',
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const filteredTransactions = filterType === 'all' 
    ? transactions 
    : transactions.filter(t => t.type === filterType);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);

  const handleAddTransaction = () => {
    console.log('新增记账:', newTransaction);
    setShowAddModal(false);
    setNewTransaction({ type: 'expense', category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
  };

  return (
    <div className="transactions-page">
      <div className="page-header">
        <h2>记账管理</h2>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ 新增记账</button>
      </div>

      {/* 统计卡片 */}
      <div className="stats-cards">
        <div className="stat-card income">
          <div className="stat-label">总收入</div>
          <div className="stat-value">¥{totalIncome.toLocaleString()}</div>
        </div>
        <div className="stat-card expense">
          <div className="stat-label">总支出</div>
          <div className="stat-value">¥{totalExpense.toLocaleString()}</div>
        </div>
        <div className="stat-card balance">
          <div className="stat-label">结余</div>
          <div className="stat-value">¥{(totalIncome - totalExpense).toLocaleString()}</div>
        </div>
      </div>

      {/* 筛选 */}
      <div className="filter-bar">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="all">全部类型</option>
          <option value="income">收入</option>
          <option value="expense">支出</option>
        </select>
        <input type="date" />
        <input type="text" placeholder="搜索..." />
        <button className="btn-secondary">导出</button>
      </div>

      {/* 表格 */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>日期</th>
              <th>类型</th>
              <th>类别</th>
              <th>金额</th>
              <th>描述</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map(t => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>
                  <span className={`type-badge ${t.type}`}>
                    {t.type === 'income' ? '收入' : '支出'}
                  </span>
                </td>
                <td>{t.category}</td>
                <td className={`amount ${t.type}`}>
                  {t.type === 'income' ? '+' : '-'}¥{t.amount.toLocaleString()}
                </td>
                <td>{t.description}</td>
                <td>
                  <span className={`status-badge ${t.status}`}>
                    {t.status === 'confirmed' ? '已确认' : '待审核'}
                  </span>
                </td>
                <td>
                  <button className="btn-icon">编辑</button>
                  <button className="btn-icon danger">删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 新增弹窗 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>新增记账</h3>
            <div className="form-group">
              <label>类型</label>
              <select value={newTransaction.type} onChange={e => setNewTransaction({...newTransaction, type: e.target.value})}>
                <option value="expense">支出</option>
                <option value="income">收入</option>
              </select>
            </div>
            <div className="form-group">
              <label>类别</label>
              <input type="text" value={newTransaction.category} onChange={e => setNewTransaction({...newTransaction, category: e.target.value})} placeholder="输入类别" />
            </div>
            <div className="form-group">
              <label>金额</label>
              <input type="number" value={newTransaction.amount} onChange={e => setNewTransaction({...newTransaction, amount: e.target.value})} placeholder="输入金额" />
            </div>
            <div className="form-group">
              <label>日期</label>
              <input type="date" value={newTransaction.date} onChange={e => setNewTransaction({...newTransaction, date: e.target.value})} />
            </div>
            <div className="form-group">
              <label>描述</label>
              <textarea value={newTransaction.description} onChange={e => setNewTransaction({...newTransaction, description: e.target.value})} placeholder="输入描述" />
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleAddTransaction}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;