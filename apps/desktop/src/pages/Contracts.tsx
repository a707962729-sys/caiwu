import React, { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { contractApi } from '@/api';
import type { Contract, ContractListParams } from '@/types';
import './Contracts.css';

const Contracts: React.FC = () => {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [, setSelectedContract] = useState<Contract | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  // 表单状态
  const [formData, setFormData] = useState({
    title: '',
    partner_id: 0,
    contract_type: 'service' as const,
    amount: 0,
    currency: 'CNY',
    start_date: '',
    end_date: '',
    sign_date: '',
    description: ''
  });

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params: ContractListParams = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...(filterStatus && { status: filterStatus }),
        ...(searchText && { search: searchText })
      };
      const res = await contractApi.getList(params);
      setContracts(res.list);
      setPagination(prev => ({ ...prev, total: res.pagination.total }));
    } catch (err) {
      message.error('获取合同列表失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filterStatus, searchText]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const handleAdd = async () => {
    try {
      await contractApi.create(formData);
      message.success('创建成功');
      setShowAddModal(false);
      setFormData({ title: '', partner_id: 0, contract_type: 'service', amount: 0, currency: 'CNY', start_date: '', end_date: '', sign_date: '', description: '' });
      fetchContracts();
    } catch {
      message.error('创建失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await contractApi.delete(id);
      message.success('删除成功');
      fetchContracts();
    } catch {
      message.error('删除失败');
    }
  };

  const statusMap: Record<string, { label: string; class: string }> = {
    draft: { label: '草稿', class: 'draft' },
    pending: { label: '待生效', class: 'pending' },
    active: { label: '执行中', class: 'active' },
    completed: { label: '已完成', class: 'completed' },
    terminated: { label: '已终止', class: 'terminated' }
  };

  return (
    <div className="contracts-page">
      <div className="page-header">
        <h2>合同管理</h2>
        <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ 新增合同</button>
      </div>

      <div className="filter-bar">
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}>
          <option value="">全部状态</option>
          <option value="draft">草稿</option>
          <option value="pending">待生效</option>
          <option value="active">执行中</option>
          <option value="completed">已完成</option>
          <option value="terminated">已终止</option>
        </select>
        <input type="text" placeholder="搜索合同..." value={searchText} onChange={e => { setSearchText(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} />
      </div>

      <div className="contracts-grid">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : contracts.length === 0 ? (
          <div className="empty">暂无合同</div>
        ) : (
          contracts.map(contract => (
            <div key={contract.id} className="contract-card" onClick={() => setSelectedContract(contract)}>
              <div className="contract-header">
                <h3>{contract.title}</h3>
                <span className={`status-badge ${statusMap[contract.status]?.class || ''}`}>
                  {statusMap[contract.status]?.label || contract.status}
                </span>
              </div>
              <div className="contract-body">
                <div className="contract-info">
                  <span className="label">合作方</span>
                  <span className="value">{contract.partner?.name || '-'}</span>
                </div>
                <div className="contract-info">
                  <span className="label">合同金额</span>
                  <span className="value amount">¥{contract.amount.toLocaleString()}</span>
                </div>
                <div className="contract-info">
                  <span className="label">有效期</span>
                  <span className="value">{contract.start_date} ~ {contract.end_date}</span>
                </div>
              </div>
              <div className="contract-footer">
                <button className="btn-text" onClick={e => { e.stopPropagation(); setSelectedContract(contract); }}>查看详情</button>
                <button className="btn-text danger" onClick={e => { e.stopPropagation(); handleDelete(contract.id); }}>删除</button>
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

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>新增合同</h3>
            <div className="form-group"><label>合同名称</label><input type="text" placeholder="输入合同名称" value={formData.title} onChange={e => setFormData(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="form-group"><label>合作方ID</label><input type="number" placeholder="合作方ID" value={formData.partner_id || ''} onChange={e => setFormData(f => ({ ...f, partner_id: Number(e.target.value) }))} /></div>
            <div className="form-row">
              <div className="form-group"><label>合同类型</label>
                <select value={formData.contract_type} onChange={e => setFormData(f => ({ ...f, contract_type: e.target.value as any }))}>
                  <option value="sales">销售</option>
                  <option value="purchase">采购</option>
                  <option value="service">服务</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div className="form-group"><label>合同金额</label><input type="number" placeholder="金额" value={formData.amount || ''} onChange={e => setFormData(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>签订日期</label><input type="date" value={formData.sign_date} onChange={e => setFormData(f => ({ ...f, sign_date: e.target.value }))} /></div>
              <div className="form-group"><label>开始日期</label><input type="date" value={formData.start_date} onChange={e => setFormData(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div className="form-group"><label>结束日期</label><input type="date" value={formData.end_date} onChange={e => setFormData(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div className="form-group"><label>备注</label><textarea placeholder="合同备注" value={formData.description} onChange={e => setFormData(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowAddModal(false)}>取消</button>
              <button className="btn-primary" onClick={handleAdd}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contracts;
