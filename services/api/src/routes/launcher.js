const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

// 检测端口是否被占用
function checkPort(port) {
  return new Promise((resolve) => {
    exec(`lsof -i:${port} -t`, { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// 执行命令并返回结果
function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: PROJECT_ROOT, timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

// 启动服务
router.post('/start', async (req, res) => {
  const { service, port } = req.body;

  try {
    // 先检查端口
    const portInUse = await checkPort(port);
    if (portInUse) {
      return res.json({ success: false, error: `端口 ${port} 已被占用，请先停止现有服务` });
    }

    let cmd;

    switch (service) {
      case 'api':
        cmd = `cd ${PROJECT_ROOT}/services/api && node src/index.js &`;
        break;
      case 'ai':
        cmd = `cd ${PROJECT_ROOT}/services/ai && node src/index.js`;
        break;
      case 'frontend':
        cmd = `cd ${PROJECT_ROOT}/apps/admin && npm run dev &`;
        break;
      default:
        return res.json({ success: false, error: '未知服务类型' });
    }

    runCommand(cmd).then(() => {
      res.json({ success: true, message: `${service} 启动命令已发送` });
    }).catch((err) => {
      res.json({ success: false, error: err.message });
    });

  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// 停止服务
router.post('/stop', async (req, res) => {
  const { service, port } = req.body;

  try {
    let pidCmd;

    switch (service) {
      case 'api':
        pidCmd = `lsof -i:${port} -t`;
        break;
      case 'ai':
        pidCmd = `lsof -i:${port} -t`;
        break;
      case 'frontend':
        pidCmd = `lsof -i:${port} -t`;
        break;
      default:
        return res.json({ success: false, error: '未知服务类型' });
    }

    exec(pidCmd, { timeout: 5000 }, (err, stdout) => {
      if (err || !stdout.trim()) {
        return res.json({ success: true, message: `端口 ${port} 当前没有服务运行` });
      }

      const pids = stdout.trim().split('\n');
      let killed = 0;

      pids.forEach((pid) => {
        try {
          process.kill(parseInt(pid), 'SIGTERM');
          killed++;
        } catch (e) {
          // 忽略kill失败
        }
      });

      res.json({ success: true, message: `已终止 ${killed} 个进程 (端口 ${port})` });
    });

  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// 获取所有服务状态
router.get('/status', async (req, res) => {
  const ports = [3000, 3001, 5174];
  const results = {};

  for (const port of ports) {
    const inUse = await checkPort(port);
    results[port] = inUse ? 'running' : 'stopped';
  }

  res.json({ success: true, status: results });
});

module.exports = router;
