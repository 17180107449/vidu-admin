const express = require('express');
const Database = require('better-sqlite3');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 数据库
const db = new Database('./dramas.db');

// 创建表
db.exec(`
CREATE TABLE IF NOT EXISTS dramas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drama_id TEXT NOT NULL UNIQUE,
  title TEXT,
  intro TEXT,
  total_episodes INTEGER,
  cover TEXT,
  create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_unlock (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid TEXT,
  drama_id TEXT,
  episode INTEGER,
  unlock_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);

// ==========================================
// 【小程序接口：全部齐全】
// ==========================================

// 1. 短剧列表（小程序用）
app.get('/api/dramas', (req, res) => {
  const list = db.prepare("SELECT * FROM dramas ORDER BY id DESC").all();
  res.json({ code: 0, list });
});

// 2. 短剧详情
app.post('/api/drama/info', (req, res) => {
  const { drama_id } = req.body;
  const info = db.prepare("SELECT * FROM dramas WHERE drama_id = ?").get(drama_id);
  res.json({ code: 0, data: info || null });
});

// 3. 解锁剧集
app.post('/api/pay/unlock', (req, res) => {
  const { openid, drama_id, episode } = req.body;
  if (!openid || !drama_id || !episode) {
    return res.json({ code: -1, msg: "参数不完整" });
  }

  const drama = db.prepare("SELECT * FROM dramas WHERE drama_id = ?").get(drama_id);
  if (!drama) return res.json({ code: -1, msg: "短剧不存在" });

  db.prepare("INSERT INTO user_unlock (openid, drama_id, episode) VALUES (?,?,?)")
    .run(openid, drama_id, episode);

  res.json({
    code: 0,
    msg: "解锁成功",
    data: {
      drama_id: drama.drama_id,
      title: drama.title,
      intro: drama.intro,
      total_episodes: drama.total_episodes,
      cover: drama.cover,
      unlock_episode: episode
    }
  });
});

// 4. 检查是否解锁
app.post('/api/check/unlock', (req, res) => {
  const { openid, drama_id, episode } = req.body;
  const row = db.prepare("SELECT * FROM user_unlock WHERE openid=? AND drama_id=? AND episode=?")
    .get(openid, drama_id, episode);
  res.json({ code: 0, is_unlock: !!row });
});

// ==========================================
// 【管理后台】
// ==========================================
app.get("/admin", (req, res) => {
  const dramas = db.prepare("SELECT * FROM dramas ORDER BY id DESC").all();
  const logs = db.prepare("SELECT * FROM user_unlock ORDER BY id DESC LIMIT 40").all();

  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>短剧管理</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:Arial}
      body{padding:24px;background:#f5f7fa}
      .card{background:#fff;border-radius:12px;box-shadow:0 2px 10px #00000010;padding:20px;margin-bottom:20px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{padding:12px;text-align:left;border-bottom:1px solid #eee}
      th{background:#f9fafb}
      img{width:50px;height:50px;object-fit:cover;border-radius:6px}
      .btn{padding:8px 14px;background:#007bff;color:#fff;border-radius:6px;text-decoration:none}
    </style>
  </head>
  <body>
    <div class="card">
      <h1>🎬 短剧管理后台</h1>
      <p><a href="/admin/add" class="btn">➕ 添加短剧</a></p>
    </div>

    <div class="card">
      <h3>短剧列表</h3>
      <table>
        <tr><th>封面</th><th>ID</th><th>剧名</th><th>集数</th></tr>
        ${dramas.map(d => `
        <tr>
          <td><img src="${d.cover || ''}" onerror="this.style.display='none'"></td>
          <td>${d.drama_id}</td>
          <td>${d.title}</td>
          <td>${d.total_episodes}</td>
        </tr>
        `).join('')}
      </table>
    </div>
  </body>
  </html>
  `);
});

app.get("/admin/add", (req, res) => {
  res.send(`
  <div style="padding:30px">
    <h2>添加短剧</h2>
    <form action="/admin/save" method="POST" style="max-width:400px">
      <div>短剧ID：<input name="drama_id" required style="width:100%;padding:8px;margin:6px 0"></div>
      <div>剧名：<input name="title" required style="width:100%;padding:8px;margin:6px 0"></div>
      <div>简介：<textarea name="intro" style="width:100%;padding:8px;margin:6px 0"></textarea></div>
      <div>总集数：<input name="total_episodes" type="number" required style="width:100%;padding:8px;margin:6px 0"></div>
      <div>封面链接：<input name="cover" style="width:100%;padding:8px;margin:6px 0"></div>
      <button style="background:#007bff;color:#fff;border:none;padding:10px;width:100%">保存</button>
    </form>
  </div>
  `);
});

app.post("/admin/save", (req, res) => {
  const { drama_id, title, intro, total_episodes, cover } = req.body;
  try {
    db.prepare(`INSERT INTO dramas (drama_id, title, intro, total_episodes, cover)
                VALUES (?,?,?,?,?)`).run(drama_id, title, intro, total_episodes, cover);
  } catch (e) {}
  res.redirect("/admin");
});

app.get("/", (req, res) => {
  res.send("服务正常 → <a href='/admin'>后台</a>");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("服务启动成功");
});
