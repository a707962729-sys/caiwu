import React, { useState } from 'react';
import './Settings.css';

const mockUsers = [
  { id: 1, name: '管理员', email: 'admin@company.com', role: 'boss', status: 'active' },
  { id: 2, name: '财务经理', email: 'finance@company.com', role: 'accountant', status: 'active' },
  { id: 3, name: '员工张三', email: 'zhangsan@company.com', role: 'employee', status: 'active' },
];

const Settings: React.FC = () => {
  const [activeSection, setActiveSection] = useState('company');
  const [users] = useState(mockUsers);

  const roleMap: Record<string, string> = {
    boss: '老板',
    accountant: '财务',
    employee: '员工',
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>系统设置</h2>
      </div>

      <div className="settings-container">
        <div className="settings-sidebar">
          <div className={`menu-item ${activeSection === 'company' ? 'active' : ''}`} onClick={() => setActiveSection('company')}>公司信息</div>
          <div className={`menu-item ${activeSection === 'users' ? 'active' : ''}`} onClick={() => setActiveSection('users')}>用户管理</div>
          <div className={`menu-item ${activeSection === 'permissions' ? 'active' : ''}`} onClick={() => setActiveSection('permissions')}>权限设置</div>
          <div className={`menu-item ${activeSection === 'backup' ? 'active' : ''}`} onClick={() => setActiveSection('backup')}>数据备份</div>
        </div>

        <div className="settings-content">
          {activeSection === 'company' && (
            <div className="settings-section">
              <h3>公司信息</h3>
              <div className="form-group"><label>公司名称</label><input type="text" defaultValue="财务管家科技有限公司" /></div>
              <div className="form-row">
                <div className="form-group"><label>联系人</label><input type="text" defaultValue="张经理" /></div>
                <div className="form-group"><label>联系电话</label><input type="text" defaultValue="13800138000" /></div>
              </div>
              <div className="form-group"><label>公司地址</label><input type="text" defaultValue="北京市朝阳区xxx路xxx号" /></div>
              <div className="form-group"><label>统一社会信用代码</label><input type="text" defaultValue="91110105XXXXXXXXXX" /></div>
              <button className="btn-primary">保存修改</button>
            </div>
          )}

          {activeSection === 'users' && (
            <div className="settings-section">
              <div className="section-header">
                <h3>用户管理</h3>
                <button className="btn-primary">+ 添加用户</button>
              </div>
              <table className="data-table">
                <thead><tr><th>姓名</th><th>邮箱</th><th>角色</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td><span className="role-badge">{roleMap[u.role]}</span></td>
                      <td><span className="status-badge active">正常</span></td>
                      <td><button className="btn-text">编辑</button><button className="btn-text danger">禁用</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeSection === 'permissions' && (
            <div className="settings-section">
              <h3>权限设置</h3>
              <div className="permission-group">
                <h4>老板权限</h4>
                <div className="permission-list">
                  <label><input type="checkbox" defaultChecked /> 查看所有数据</label>
                  <label><input type="checkbox" defaultChecked /> 审批报销</label>
                  <label><input type="checkbox" defaultChecked /> 管理用户</label>
                  <label><input type="checkbox" defaultChecked /> 系统设置</label>
                </div>
              </div>
              <div className="permission-group">
                <h4>财务权限</h4>
                <div className="permission-list">
                  <label><input type="checkbox" defaultChecked /> 记账管理</label>
                  <label><input type="checkbox" defaultChecked /> 合同管理</label>
                  <label><input type="checkbox" defaultChecked /> 报表查看</label>
                  <label><input type="checkbox" /> 用户管理</label>
                </div>
              </div>
              <button className="btn-primary">保存权限</button>
            </div>
          )}

          {activeSection === 'backup' && (
            <div className="settings-section">
              <h3>数据备份</h3>
              <div className="backup-info">
                <div className="info-item"><span className="label">上次备份时间</span><span className="value">2026-03-15 23:00</span></div>
                <div className="info-item"><span className="label">备份文件大小</span><span className="value">12.5 MB</span></div>
              </div>
              <div className="backup-actions">
                <button className="btn-primary">立即备份</button>
                <button className="btn-secondary">导出数据</button>
                <button className="btn-secondary">恢复数据</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;