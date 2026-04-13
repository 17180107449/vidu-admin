/**
 * Vidu批量生成工具 - 后台管理服务
 * 使用 MongoDB Atlas 持久化存储
 */

const http = require('http');
const crypto = require('crypto');
const mongoose = require('mongoose');

// 配置（支持环境变量）
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vidu-admin';

// 管理员账号（优先使用环境变量）
const ADMIN = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASS || 'admin123'
};

// MongoDB 连接
let isConnected = false;

async function connectDB() {
  // 检查 mongoose 连接状态
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  
  try {
    console.log('正在连接 MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 1,
      connectTimeoutMS: 10000
    });
    isConnected = true;
    console.log('MongoDB 连接成功');
  } catch (e) {
    console.error('MongoDB 连接失败:', e.message);
    isConnected = false;
  }
}

// 监听连接事件
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB 连接断开');
  isConnected = false;
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB 连接错误:', err);
  isConnected = false;
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB 重新连接成功');
  isConnected = true;
});

// 定义 Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  expireTime: { type: Number, required: true },
  status: { type: Number, default: 1 },
  createdAt: { type: Number, default: Date.now }
});

const adminSessionSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  createdAt: { type: Number, default: Date.now }
});

// 创建模型
const User = mongoose.model('User', userSchema);
const AdminSession = mongoose.model('AdminSession', adminSessionSchema);

// 生成Token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
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
async function checkAdminToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.replace('Bearer ', '');
  
  const session = await AdminSession.findOne({ token });
  return !!session;
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

  // 确保数据库连接
  await connectDB();

  // 路由处理
  try {
    // ========== 管理员登录 ==========
    if (url === '/api/admin/login' && method === 'POST') {
      const body = await parseBody(req);
      
      if (body.username === ADMIN.username && body.password === ADMIN.password) {
        const token = generateToken();
        
        // 删除旧session，创建新session
        await AdminSession.deleteMany({});
        await AdminSession.create({ token });
        
        sendJson(res, { success: true, token });
      } else {
        sendJson(res, { success: false, message: '用户名或密码错误' });
      }
      return;
    }

    // ========== 检查管理员登录状态 ==========
    if (url === '/api/admin/check' && method === 'GET') {
      const isValid = await checkAdminToken(req);
      sendJson(res, { success: isValid });
      return;
    }

    // ========== 管理员退出 ==========
    if (url === '/api/admin/logout' && method === 'POST') {
      const auth = req.headers.authorization || '';
      const token = auth.replace('Bearer ', '');
      await AdminSession.deleteOne({ token });
      sendJson(res, { success: true });
      return;
    }

    // ========== 获取用户列表 ==========
    if (url === '/api/admin/users' && method === 'GET') {
      if (!await checkAdminToken(req)) {
        sendJson(res, { success: false, message: '未登录' });
        return;
      }
      
      const users = await User.find({}, { password: 0 });
      const userList = users.map(u => ({
        id: u._id.toString(),
        username: u.username,
        expireTime: u.expireTime,
        status: u.status,
        createdAt: u.createdAt
      }));
      
      sendJson(res, { success: true, users: userList });
      return;
    }

    // ========== 添加用户 ==========
    if (url === '/api/admin/users' && method === 'POST') {
      if (!await checkAdminToken(req)) {
        sendJson(res, { success: false, message: '未登录' });
        return;
      }
      
      const body = await parseBody(req);
      const { username, password, expireDays } = body;
      
      if (!username || !password || !expireDays) {
        sendJson(res, { success: false, message: '参数不完整' });
        return;
      }
      
      // 检查用户名是否已存在
      const existing = await User.findOne({ username });
      if (existing) {
        sendJson(res, { success: false, message: '用户名已存在' });
        return;
      }
      
      // 创建用户
      const user = await User.create({
        username,
        password,
        expireTime: Date.now() + expireDays * 24 * 60 * 60 * 1000,
        status: 1,
        createdAt: Date.now()
      });
      
      sendJson(res, { success: true, message: '添加成功', user: { id: user._id.toString(), username: user.username } });
      return;
    }

    // ========== 修改用户 ==========
    if (url.startsWith('/api/admin/users/') && method === 'PUT') {
      if (!await checkAdminToken(req)) {
        sendJson(res, { success: false, message: '未登录' });
        return;
      }
      
      const userId = url.split('/')[4];
      const body = await parseBody(req);
      const { password, expireDays, status } = body;
      
      const updateData = {};
      if (password) updateData.password = password;
      if (expireDays) updateData.expireTime = Date.now() + expireDays * 24 * 60 * 60 * 1000;
      if (status !== undefined) updateData.status = status;
      
      await User.findByIdAndUpdate(userId, updateData);
      
      sendJson(res, { success: true, message: '修改成功' });
      return;
    }

    // ========== 删除用户 ==========
    if (url.startsWith('/api/admin/users/') && method === 'DELETE') {
      if (!await checkAdminToken(req)) {
        sendJson(res, { success: false, message: '未登录' });
        return;
      }
      
      const userId = url.split('/')[4];
      await User.findByIdAndDelete(userId);
      
      sendJson(res, { success: true, message: '删除成功' });
      return;
    }

    // ========== 用户登录验证 ==========
    if (url === '/api/login' && method === 'POST') {
      const body = await parseBody(req);
      const { username, password } = body;
      
      if (!username || !password) {
        sendJson(res, { success: false, message: '请输入用户名和密码' });
        return;
      }
      
      const user = await User.findOne({ username, password });
      
      if (!user) {
        sendJson(res, { success: false, message: '用户名或密码错误' });
        return;
      }
      
      if (user.status !== 1) {
        sendJson(res, { success: false, message: '账号已被禁用' });
        return;
      }
      
      if (Date.now() > user.expireTime) {
        sendJson(res, { success: false, message: '账号已过期' });
        return;
      }
      
      sendJson(res, { 
        success: true, 
        token: generateToken(),
        expireTime: user.expireTime,
        username: user.username
      });
      return;
    }

    // ========== Token验证 ==========
    if (url === '/api/verify' && method === 'POST') {
      const body = await parseBody(req);
      const { username } = body;
      
      if (!username) {
        sendJson(res, { success: false, message: '缺少用户名' });
        return;
      }
      
      const user = await User.findOne({ username });
      
      if (!user) {
        sendJson(res, { success: false, message: '用户不存在' });
        return;
      }
      
      if (user.status !== 1) {
        sendJson(res, { success: false, message: '账号已被禁用' });
        return;
      }
      
      if (Date.now() > user.expireTime) {
        sendJson(res, { success: false, message: '账号已过期' });
        return;
      }
      
      sendJson(res, { 
        success: true, 
        expireTime: user.expireTime
      });
      return;
    }

    // 404
    sendJson(res, { success: false, message: '接口不存在' });

  } catch (e) {
    console.error('请求处理错误:', e);
    sendJson(res, { success: false, message: '服务器错误' });
  }
});

// 启动服务器
async function start() {
  await connectDB();
  
  server.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    console.log(`管理员账号: ${ADMIN.username}`);
  });
}

start();
