import React, { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { orderApi } from '@/api';
import type { Order, OrderListParams } from '@/types';
import './Orders.css';

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: OrderListParams = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...(filterStatus !== 'all' && { status: filterStatus })
      };
      const res = await orderApi.getList(params);
      setOrders(res.list);
      setPagination(prev => ({ ...prev, total: res.pagination.total }));
    } catch (err) {
      message.error('获取订单列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filterStatus]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleDelete = async (id: number) => {
    try {
      await orderApi.delete(id);
      message.success('删除成功');
      fetchOrders();
    } catch {
      message.error('删除失败');
    }
  };

  const statusMap: Record<string, { label: string; class: string }> = {
    draft: { label: '草稿', class: 'draft' },
    pending: { label: '待确认', class: 'pending' },
    confirmed: { label: '已确认', class: 'confirmed' },
    shipped: { label: '已发货', class: 'shipped' },
    completed: { label: '已完成', class: 'completed' },
    cancelled: { label: '已取消', class: 'cancelled' }
  };

  // 简单统计
  const totalProfit = orders.reduce((sum, o) => sum + o.amount, 0);
  const activeProjects = orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled').length;

  return (
    <div className="orders-page">
      <div className="page-header">
        <h2>订单/项目管理</h2>
        <button className="btn-primary">+ 新建项目</button>
      </div>

      <div className="stats-row">
        <div className="stat-item"><span className="stat-value">{activeProjects}</span><span className="stat-label">进行中项目</span></div>
        <div className="stat-item"><span className="stat-value">¥{totalProfit.toLocaleString()}</span><span className="stat-label">总金额</span></div>
        <div className="stat-item"><span className="stat-value">{orders.length}</span><span className="stat-label">总项目数</span></div>
      </div>

      <div className="filter-bar">
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}>
          <option value="all">全部状态</option>
          <option value="draft">草稿</option>
          <option value="pending">待确认</option>
          <option value="confirmed">已确认</option>
          <option value="shipped">已发货</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>

      <div className="orders-list">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="empty">暂无订单</div>
        ) : (
          orders.map(order => (
            <div key={order.id} className="order-card">
              <div className="order-main">
                <div className="order-info">
                  <h3>{order.order_no}</h3>
                  <p className="client">{order.partner?.name || '-'}</p>
                  <p className="description">{order.description}</p>
                </div>
                <div className="order-financial">
                  <div className="financial-item">
                    <span className="label">金额</span>
                    <span className="value">¥{order.amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="order-meta">
                <span className={`status-badge ${statusMap[order.status]?.class || ''}`}>
                  {statusMap[order.status]?.label || order.status}
                </span>
                <span className="order-date">订单日期: {order.order_date}</span>
                {order.delivery_date && <span className="deadline">交付: {order.delivery_date}</span>}
              </div>
              <div className="order-actions">
                <button className="btn-text">详情</button>
                <button className="btn-text">编辑</button>
                <button className="btn-text danger" onClick={() => handleDelete(order.id)}>删除</button>
              </div>
            </div>
          ))
        )}
      </div>

      {pagination.total > 0 && (
        <div className="pagination">
          <span>共 {pagination.total} 条</span>
          <button disabled={pagination.page <= 1} onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}>上一页</button>
          <span>{pagination.page} / {Math.ceil(pagination.total / pagination.pageSize)}</span>
          <button disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)} onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}>下一页</button>
        </div>
      )}
    </div>
  );
};

export default Orders;
