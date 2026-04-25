const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();

// 解析 JSON 请求
app.use(express.json());

// ========================
// SQLite 数据库（自动创建文件，重启不丢数据）
// ========================
const db = new sqlite3.Database('./unlocks.db', (err) => {
  if (err) {
    console.error('数据库启动失败:', err);
  } else {
    console.log('✅ SQLite 数据库已连接');
    // 自动建表（永远不用手动操作）
    db.run(`
      CREATE TABLE IF NOT EXISTS unlocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        openid TEXT NOT NULL,
        drama_id TEXT NOT NULL,
        episode INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
});

// ========================
// 核心接口：解锁剧集
// ========================
app.post('/api/pay/unlock', (req, res) => {
  try {
    const { openid, drama_id, episode } = req.body;

    if (!openid || !drama_id || !episode) {
      return res.json({ code: -1, msg: '参数不完整' });
    }

    db.run(
      'INSERT INTO unlocks (openid, drama_id, episode) VALUES (?, ?, ?)',
      [openid, drama_id, episode],
      function (err) {
        if (err) {
          return res.json({ code: -1, msg: '解锁失败', error: err.message });
        }
        res.json({ code: 0, msg: '解锁成功' });
      }
    );
  } catch (e) {
    res.json({ code: -1, msg: '服务器错误' });
  }
});

// ========================
// 健康检查
// ========================
app.get('/', (req, res) => {
  res.send('✅ 短剧后端服务运行中（SQLite 永久存储）');
});

// 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 服务已启动，端口：${PORT}`);
});
