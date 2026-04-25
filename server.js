const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 连接 Railway PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 自动建表
async function initTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dramas (
        drama_id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255),
        cover TEXT,
        total INT,
        free_num INT,
        type VARCHAR(100),
        descr TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS unlocks (
        id SERIAL PRIMARY KEY,
        openid VARCHAR(100),
        drama_id VARCHAR(50),
        episode INT
      )
    `);
    console.log("✅ 数据库表创建成功");
  } catch (e) {
    console.error("❌ 建表失败", e);
  }
}
initTables();

// 小程序获取短剧
app.get("/api/drama/detail", async (req, res) => {
  try {
    const { openid, drama_id } = req.query;
    const { rows } = await pool.query("SELECT * FROM dramas WHERE drama_id = $1", [drama_id]);
    if (!rows.length) return res.json({ code: -1, msg: "无数据" });

    const drama = rows[0];
    const unlockRes = await pool.query(
      "SELECT episode FROM unlocks WHERE openid = $1 AND drama_id = $2",
      [openid, drama_id]
    );
    const unlocked = unlockRes.rows.map(r => r.episode);

    const episodeStatus = [];
    for (let i = 1; i <= drama.total; i++) {
      let status = i <= drama.free_num ? "free" : unlocked.includes(i) ? "unlocked" : "locked";
      episodeStatus.push({ episode: i, status });
    }

    res.json({ code: 0, data: { ...drama, episodeStatus } });
  } catch (e) {
    res.json({ code: -1 });
  }
});

// 解锁接口（修正版）
app.post("/api/pay/unlock", async (req, res) => {
  try {
    const { openid, drama_id, episode } = req.body;
    // 修正 SQL 语法错误
    await pool.query(
      "INSERT INTO unlocks (openid, drama_id, episode) VALUES ($1, $2, $3)",
      [openid, drama_id, episode]
    );
    res.json({ code: 0, msg: "解锁成功" });
  } catch (e) {
    console.error("解锁接口错误:", e); // 打印错误日志，方便排查
    res.json({ code: -1, msg: "解锁失败" });
  }
});

// 后台列表
app.get("/api/admin/drama/list", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM dramas");
    res.json({ code: 0, data: rows });
  } catch (e) {
    res.json({ code: 0, data: [] });
  }
});

// 后台保存
app.post("/api/admin/drama/save", async (req, res) => {
  try {
    const { drama_id, title, cover, total, free_num, type, descr } = req.body;
    await pool.query(`
      INSERT INTO dramas (drama_id, title, cover, total, free_num, type, descr)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (drama_id) DO UPDATE SET
        title=$2, cover=$3, total=$4, free_num=$5, type=$6, descr=$7
    `, [drama_id, title, cover, total, free_num, type, descr]);
    res.json({ code: 0 });
  } catch (e) {
    res.json({ code: -1 });
  }
});

// 后台删除
app.post("/api/admin/drama/delete", async (req, res) => {
  try {
    await pool.query("DELETE FROM dramas WHERE drama_id = $1", [req.body.drama_id]);
    res.json({ code: 0 });
  } catch (e) {
    res.json({ code: -1 });
  }
});

app.use("/admin", express.static(path.join(__dirname, "admin")));

app.get("/", (req, res) => {
  res.send("✅ 永久数据库运行成功！重启不丢数据！");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✅ 服务启动成功");
});
