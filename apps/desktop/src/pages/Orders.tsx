import React, { useState } from 'react';
import './Orders.css';

const mockOrders = [
  { id: 1, name: '企业管理系统开发', client: '科技有限公司', budget: 200000, cost: 120000, progress: 75, status: 'active', deadline: '2026-06-30' },
  { id: 2, name: '移动APP开发', client: '创新科技', budget: 150000, cost: 80000, progress: 45, status: 'active', deadline: '2026-08-15' },
  { id: 3, name: '数据分析平台', client: '数据公司', budget: 100000, cost: 95000, progress: 100, status: 'completed', deadline: '2026-03-01' },
  { id: 4, name: '网站改版项目', client: '网络公司', budget: 50000, cost: 48000, progress: 100, status: 'completed', deadline: '2026-02-28' },
];

const Orders: React.FC = () => {
  const [orders] = useState(mockOrders);
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredOrders = filterStatus === 'all' ? orders : orders.filter(o => o.status === filterStatus);

  const totalProfit = orders.reduce((sum, o) => sum + (o.budget - o.cost), 0);
  const activeProjects = orders.filter(o => o.status === 'active').length;

  return (
    <div className="orders-page">
      <div className="page-header">
        <h2>订单/项目管理</h2>
        <button className="btn-primary">+ 新建项目</button>
      </div>

      <div className="stats-row">
        <div className="stat-item"><span className="stat-value">{activeProjects}</span><span className="stat-label">进行中项目</span></div>
        <div className="stat-item"><span className="stat-value">¥{totalProfit.toLocaleString()}</span><span className="stat-label">总利润</span></div>
        <div className="stat-item"><span className="stat-value">{orders.length}</span><span className="stat-label">总项目数</span></div>
      </div>

      <div className="filter-bar">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">全部状态</option>
          <option value="active">进行中</option>
          <option value="completed">已完成</option>
        </select>
      </div>

      <div className="orders-list">
        {filteredOrders.map(order => (
          <div key={order.id} className="order-card">
            <div className="order-main">
              <div className="order-info">
                <h3>{order.name}</h3>
                <p className="client">{order.client}</p>
              </div>
              <div className="order-financial">
                <div className="financial-item">
                  <span className="label">预算</span>
                  <span className="value">¥{order.budget.toLocaleString()}</span>
                </div>
                <div className="financial-item">
                  <span className="label">成本</span>
                  <span className="value expense">¥{order.cost.toLocaleString()}</span>
                </div>
                <div className="financial-item">
                  <span className="label">利润</span>
                  <span className="value profit">¥{(order.budget - order.cost).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="order-progress">
              <div className="progress-header">
                <span>进度 {order.progress}%</span>
                <span className="deadline">截止: {order.deadline}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${order.progress}%` }} />
              </div>
            </div>
            <div className="order-actions">
              <button className="btn-text">详情</button>
              <button className="btn-text">编辑</button>
              <button className="btn-text">工时</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Orders;