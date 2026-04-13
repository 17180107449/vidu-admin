/**
 * Vidu批量生成工具 - 后台管理服务
 * 支持本地运行和云平台部署
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 配置（支持环境变量）
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// 管理员账号（优先使用环境变量）
const ADMIN = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASS || 'admin123'  // 部署后请修改
};

// 生成Token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 读取数据
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('读取数据失败:', e);
  }
  return { users: [] };
}

// 保存数据
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    console.error('保存数据失败:', e);
    return false;
  }
}

// 解析请求体
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

// 返回JSON
function sendJson(res, data) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// 检查管理员Token
function checkAdminToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  const data = loadData();
  return data.adminToken === token;
}

// 创建HTTP服务器
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const method = req.method;

  // 处理OPTIONS预检
  if (method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // 路由处理
  try {
    // ========== 管理员登录 ==========
    if (url === '/api/admin/login' && method === 'POST') {
      const body = await parseBody(req);
      
      if (body.username === ADMIN.username && body.password === ADMIN.password) {
        const token = generateToken();
        const data = loadData();
        data.adminToken = token;
        saveData(data);
        
        sendJson(res, { success: true, token });
      } else {
        sendJson(res, { success: false, message: '用户名或密码错误' });
      }
      return;
    }

    // ========== 检查管理员登录状态 ==========
    if (url === '/api/admin/check' && method === 'GET') {
      sendJson(res, { success: checkAdminToken(req) });
      return;
    }

    // ========== 管理员退出 ==========
    if (url === '/api/admin/logout' && method === 'POST') {
      if (checkAdminToken(req)) {
        const data = loadData();
        delete data.adminToken;
        saveData(data);
      }
      sendJson(res, { success: true });
      return;
    }

    // ========== 获取用户列表 ==========
    if (url === '/api/admin/users' && method === 'GET') {
      if (!checkAdminToken(req)) {
        sendJson(res, { success: false, message: '未登录' });
        return;
      }
      
      const data = loadData();
      const users = (data.users || []).map(u => ({
        id: u.id,
        username: u.username,
        expireTime: u.expireTime,
        status: u.status,
        createdAt: u.createdAt
      }));
      
      sendJson(res, { success: true, users });
      return;
    }

    // ========== 添加用户 ==========
    if (url === '/api/admin/users' && method === 'POST') {
      if (!checkAdminToken(req)) {
        sendJson(res, { success: false, message: '未登录' });
        return;
      }
      
      const body = await parseBody(req);
      const { username, password, expireDays } = body;
      
      if (!username || !password || !expireDays) {
        sendJson(res, { success: false, message: '参数不完整' });
        return;
      }
      
      const data = loadData();
      
      // 检查用户名是否已存在
      if (data.users.some(u => u.username === username)) {
        sendJson(res, { success: false, message: '用户名已存在' });
        return;
      }
      
      // 创建用户
      const user = {
        id: Date.now().toString(),
        username,
        password,  // 生产环境建议加密
        expireTime: Date.now() + expireDays * 24 * 60 * 60 * 1000,
        status: 1,
        createdAt: Date.now()
      };
      
      data.users.push(user);
      saveData(data);
      
      sendJson(res, { success: true, message: '添加成功', user: { id: user.id, username: user.username } });
      return;
    }

    // ========== 修改用户 ==========
    if (url.startsWith('/api/admin/users/') && method === 'PUT') {
      if (!checkAdminToken(req)) {
        sendJson(res, { success: false, message: '未登录' });
        return;
      }
      
      const userId = url.split('/')[4];
      const body = await parseBody(req);
      const { password, expireDays, status } = body;
      
      const data = loadData();
      const userIndex = data.users.findIndex(u => u.id === userId);
      
      if (userIndex === -1) {
        sendJson(res, { success: false, message: '用户不存在' });
        return;
      }
      
      // 更新用户信息
      if (password) {
        data.users[userIndex].password = password;
      }
      if (expireDays !== undefined) {
        data.users[userIndex].expireTime = Date.now() + expireDays * 24 * 60 * 60 * 1000;
      }
      if (status !== undefined) {
        data.users[userIndex].status = status;
      }
      
      saveData(data);
      sendJson(res, { success: true, message: '修改成功' });
      return;
    }

    // ========== 删除用户 ==========
    if (url.startsWith('/api/admin/users/') && method === 'DELETE') {
      if (!checkAdminToken(req)) {
        sendJson(res, { success: false, message: '未登录' });
        return;
      }
      
      const userId = url.split('/')[4];
      const data = loadData();
      
      data.users = data.users.filter(u => u.id !== userId);
      saveData(data);
      
      sendJson(res, { success: true, message: '删除成功' });
      return;
    }

    // ========== 用户登录（给插件使用） ==========
    if (url === '/api/login' && method === 'POST') {
      const body = await parseBody(req);
      const { username, password } = body;
      
      const data = loadData();
      const user = data.users.find(u => u.username === username && u.password === password);
      
      if (!user) {
        sendJson(res, { success: false, message: '用户名或密码错误' });
        return;
      }
      
      if (user.status === 0) {
        sendJson(res, { success: false, message: '账号已被禁用' });
        return;
      }
      
      if (Date.now() > user.expireTime) {
        sendJson(res, { success: false, message: '账号已过期' });
        return;
      }
      
      const token = generateToken();
      user.token = token;
      saveData(data);
      
      sendJson(res, {
        success: true,
        token,
        expireTime: user.expireTime,
        userInfo: { name: user.username }
      });
      return;
    }

    // ========== 用户验证（给插件使用） ==========
    if (url === '/api/verify' && method === 'POST') {
      const auth = req.headers.authorization || '';
      const token = auth.replace('Bearer ', '');
      
      const data = loadData();
      const user = data.users.find(u => u.token === token);
      
      if (!user) {
        sendJson(res, { success: false, valid: false });
        return;
      }
      
      const valid = user.status === 1 && Date.now() <= user.expireTime;
      sendJson(res, { success: valid, valid });
      return;
    }

    // ========== 静态文件 ==========
    if (url === '/' || url === '/index.html') {
      const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    // 404
    sendJson(res, { success: false, message: '接口不存在' });

  } catch (error) {
    console.error('服务器错误:', error);
    sendJson(res, { success: false, message: '服务器错误' });
  }
});

// 启动服务器
server.listen(PORT, () => {
  console.log('========================================');
  console.log('  Vidu批量生成工具 - 后台管理系统');
  console.log('========================================');
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  管理员账号: ${ADMIN.username}`);
  console.log(`  管理员密码: ${ADMIN.password}`);
  console.log('========================================');
  console.log('  提示: 请修改 ADMIN 配置更改默认密码');
  console.log('========================================');
});
