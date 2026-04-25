const express = require('express');
const Database = require('better-sqlite3');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = new Database('./system.db');

// 数据表
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

// ------------------------------
// 接口
// ------------------------------
app.post("/api/pay/unlock", (req, res) => {
  const { openid, drama_id, episode } = req.body;
  if (!openid || !drama_id || !episode) return res.json({ code: -1, msg: "参数不完整" });

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

app.post("/api/drama/info", (req, res) => {
  const info = db.prepare("SELECT * FROM dramas WHERE drama_id = ?").get(req.body.drama_id);
  res.json({ code: 0, data: info || null });
});

// ------------------------------
// ✅ 美观版后台管理系统
// ------------------------------
app.get("/admin", (req, res) => {
  const dramas = db.prepare("SELECT * FROM dramas ORDER BY id DESC").all();
  const logs = db.prepare("SELECT * FROM user_unlock ORDER BY id DESC LIMIT 40").all();

  res.send(`
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <title>短剧管理系统</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;font-family:system-ui,-apple-system,Segoe UI,Roboto}
      body{padding:24px;background:#f5f7fa}
      .card{background:#fff;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.06);padding:20px;margin-bottom:20px}
      h1{font-size:22px;margin-bottom:16px;color:#222}
      h2{font-size:18px;margin:12px 0;color:#333}
      .btn{padding:8px 14px;background:#007bff;color:#fff;border-radius:6px;text-decoration:none}
      .btn-green{background:#07b179}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{padding:12px;text-align:left;border-bottom:1px solid #eee}
      th{background:#f9fafb}
      img{width:50px;height:50px;object-fit:cover;border-radius:6px}
      .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
    </style>
  </head>
  <body>
    <div class="card">
      <div class="header">
        <h1>🎬 短剧管理系统</h1>
        <a href="/admin/add" class="btn btn-green">➕ 添加短剧</a>
      </div>
    </div>

    <div class="card">
      <h2>📘 短剧列表</h2>
      <table>
        <tr>
          <th>封面</th>
          <th>短剧ID</th>
          <th>剧名</th>
          <th>集数</th>
          <th>创建时间</th>
        </tr>
        ${dramas.map(d => `
        <tr>
          <td><img src="${d.cover || ''}" onerror="this.style.display='none'"></td>
          <td>${d.drama_id}</td>
          <td>${d.title}</td>
          <td>${d.total_episodes}</td>
          <td>${d.create_time}</td>
        </tr>
        `).join('')}
      </table>
    </div>

    <div class="card">
      <h2>🔓 最新解锁记录</h2>
      <table>
        <tr>
          <th>用户ID</th>
          <th>短剧ID</th>
          <th>剧集</th>
          <th>解锁时间</th>
        </tr>
        ${logs.map(l => `
        <tr>
          <td>${l.openid}</td>
          <td>${l.drama_id}</td>
          <td>${l.episode}</td>
          <td>${l.unlock_time}</td>
        </tr>
        `).join('')}
      </table>
    </div>
  </body>
  </html>
  `);
});

// 添加短剧页面
app.get("/admin/add", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <title>添加短剧</title>
    <style>
      body{padding:30px;background:#f5f7fa}
      .box{max-width:500px;background:#fff;padding:24px;border-radius:12px;box-shadow:0 2px 10px rgba(0,0,0,0.06)}
      input,textarea{width:100%;padding:10px;margin:6px 0;border:1px solid #ddd;border-radius:6px}
      button{background:#007bff;color:#fff;border:none;padding:10px 16px;border-radius:6px;width:100%;margin-top:10px}
      a{color:#007bff;text-decoration:none}
    </style>
  </head>
  <body>
    <div class="box">
      <h2>➕ 添加短剧</h2><br>
      <form action="/admin/save" method="POST">
        短剧ID：<input name="drama_id" required>
        剧名：<input name="title" required>
        简介：<textarea name="intro" rows="4"></textarea>
        总集数：<input name="total_episodes" type="number" required>
        封面链接：<input name="cover">
        <button type="submit">保存</button>
      </form>
      <br>
      <a href="/admin">← 返回后台</a>
    </div>
  </body>
  </html>
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
  res.send(`<div style="padding:30px">服务运行正常 → <a href="/admin">进入管理后台</a></div>`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("服务已启动"));
