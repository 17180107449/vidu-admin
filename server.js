const express = require('express');
const Database = require('better-sqlite3');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========================
// 数据库（升级！包含剧名、简介、集数、封面）
// ========================
const db = new Database('./dramas.db', { verbose: console.log });
db.exec(`
  CREATE TABLE IF NOT EXISTS dramas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drama_id TEXT NOT NULL,        -- 短剧ID
    title TEXT NOT NULL,           -- 剧名
    intro TEXT,                    -- 简介
    total_episodes INTEGER,        -- 总集数
    cover TEXT,                    -- 封面链接
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS unlocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openid TEXT NOT NULL,
    drama_id TEXT NOT NULL,
    episode INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// ========================
// 1. 添加短剧（后台）
// ========================
app.post('/api/admin/drama/add', (req, res) => {
  const { drama_id, title, intro, total_episodes, cover } = req.body;
  db.prepare(`
    INSERT INTO dramas (drama_id, title, intro, total_episodes, cover)
    VALUES (?, ?, ?, ?, ?)
  `).run(drama_id, title, intro, total_episodes, cover);
  res.json({ code: 0, msg: "添加成功" });
});

// ========================
// 2. 获取所有短剧列表
// ========================
app.get('/api/dramas', (req, res) => {
  const list = db.prepare("SELECT * FROM dramas ORDER BY id DESC").all();
  res.json({ code: 0, list });
});

// ========================
// 3. 解锁剧集（返回完整信息）
// ========================
app.post('/api/pay/unlock', (req, res) => {
  try {
    const { openid, drama_id, episode } = req.body;

    // 查询短剧信息
    const drama = db.prepare("SELECT * FROM dramas WHERE drama_id = ?").get(drama_id);
    if (!drama) {
      return res.json({ code: -1, msg: "短剧不存在" });
    }

    // 解锁
    db.prepare("INSERT INTO unlocks (openid, drama_id, episode) VALUES (?, ?, ?)")
      .run(openid, drama_id, episode);

    // 返回完整数据（你要的全部字段）
    res.json({
      code: 0,
      msg: "解锁成功",
      data: {
        drama_id: drama.drama_id,
        title: drama.title,        // 剧名
        intro: drama.intro,        // 简介
        total_episodes: drama.total_episodes, // 总集数
        cover: drama.cover,        // 封面
        unlock_episode: episode,   // 已解锁剧集
        unlock_time: new Date().toLocaleString()
      }
    });
  } catch (e) {
    res.json({ code: -1, msg: "失败" });
  }
});

// ========================
// 4. 检查是否解锁
// ========================
app.post('/api/check/unlock', (req, res) => {
  const { openid, drama_id, episode } = req.body;
  const row = db.prepare("SELECT * FROM unlocks WHERE openid=? AND drama_id=? AND episode=?").get(openid, drama_id, episode);
  res.json({ code: 0, unlocked: !!row });
});

// ========================
// 管理后台
// ========================
app.get('/admin', (req, res) => {
  const dramas = db.prepare("SELECT * FROM dramas ORDER BY id DESC").all();
  res.send(`
    <h1>短剧管理后台</h1>
    <a href="/admin/drama/add">添加短剧</a>
    <h3>短剧列表</h3>
    <table border=1 cellpadding=8>
      <tr><th>ID</th><th>剧名</th><th>封面</th><th>集数</th></tr>
      ${dramas.map(d => `
        <tr>
          <td>${d.drama_id}</td>
          <td>${d.title}</td>
          <td><img src="${d.cover}" width=50></td>
          <td>${d.total_episodes}</td>
        </tr>
      `).join('')}
    </table>
  `);
});

// 添加短剧页面
app.get('/admin/drama/add', (req, res) => {
  res.send(`
    <h1>添加短剧</h1>
    <form action="/api/admin/drama/add" method="POST">
      短剧ID：<input name="drama_id" required><br><br>
      剧名：<input name="title" required><br><br>
      简介：<textarea name="intro"></textarea><br><br>
      总集数：<input name="total_episodes" type="number" required><br><br>
      封面链接：<input name="cover"><br><br>
      <button>提交</button>
    </form>
  `);
});

// 首页
app.get('/', (req, res) => {
  res.send('✅ 服务运行正常<br><a href="/admin">后台</a>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('服务启动');
});
