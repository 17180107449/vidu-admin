const express = require('express');
const Database = require('better-sqlite3');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// 数据库（永久不丢）
// ========================
const db = new Database('./unlocks.db', { verbose: console.log });
db.exec(`
  CREATE TABLE IF NOT EXISTS unlocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openid TEXT NOT NULL,
    drama_id TEXT NOT NULL,
    episode INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// ========================
// 前端接口：解锁剧集
// ========================
app.post('/api/pay/unlock', (req, res) => {
  try {
    const { openid, drama_id, episode } = req.body;

    if (!openid || !drama_id || !episode) {
      return res.json({ code: -1, msg: '参数不完整' });
    }

    db.prepare('INSERT INTO unlocks (openid, drama_id, episode) VALUES (?, ?, ?)')
      .run(openid, drama_id, episode);

    res.json({ code: 0, msg: '解锁成功' });
  } catch (e) {
    res.json({ code: -1, msg: '解锁失败', error: e.message });
  }
});

// ========================
// 管理后台：查看所有记录
// ========================
app.get('/admin', (req, res) => {
  const rows = db.prepare('SELECT * FROM unlocks ORDER BY id DESC').all();
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>短剧解锁管理后台</title>
      <style>
        body { padding: 20px; font-family: Arial; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
        th { background: #f5f5f5; }
        a { color: #007bff; text-decoration: none; }
      </style>
    </head>
    <body>
      <h1>短剧解锁管理后台</h1>
      <p><a href="/admin/add">➕ 手动添加解锁记录</a></p>
      <table>
        <tr>
          <th>ID</th>
          <th>用户ID</th>
          <th>短剧ID</th>
          <th>剧集</th>
          <th>解锁时间</th>
        </tr>
        ${rows.map(row => `
          <tr>
            <td>${row.id}</td>
            <td>${row.openid}</td>
            <td>${row.drama_id}</td>
            <td>${row.episode}</td>
            <td>${row.created_at}</td>
          </tr>
        `).join('')}
      </table>
    </body>
    </html>
  `);
});

// ========================
// 管理后台：添加解锁页面
// ========================
app.get('/admin/add', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>添加解锁记录</title>
      <style>
        body { padding: 30px; font-family: Arial; }
        input { width: 300px; padding: 8px; margin: 5px 0; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>手动添加解锁</h1>
      <form action="/admin/add" method="POST">
        用户ID（openid）：<br>
        <input name="openid" required><br><br>

        短剧ID（drama_id）：<br>
        <input name="drama_id" required><br><br>

        剧集号（episode）：<br>
        <input name="episode" type="number" required><br><br>

        <button type="submit">✅ 确认添加</button>
      </form>
      <br>
      <a href="/admin">返回后台</a>
    </body>
    </html>
  `);
});

// 执行添加
app.post('/admin/add', (req, res) => {
  const { openid, drama_id, episode } = req.body;
  db.prepare('INSERT INTO unlocks (openid, drama_id, episode) VALUES (?, ?, ?)')
    .run(openid, drama_id, episode);
  res.send(`
    <h3>✅ 添加成功！</h3>
    <a href="/admin">返回后台</a>
  `);
});

// ========================
// 首页
// ========================
app.get('/', (req, res) => {
  res.send(`
    <div style="padding:30px">
      <h2>✅ 短剧后端服务运行正常</h2>
      <p>接口地址：/api/pay/unlock</p>
      <p>管理后台：<a href="/admin">/admin</a></p>
    </div>
  `);
});

// ========================
// 启动服务
// ========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 服务启动成功：端口 ${PORT}`);
});
