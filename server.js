const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 🔥 连接 Railway PostgreSQL 数据库
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 自动初始化表（第一次运行会自动创建，不用手动建表）
async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dramas (
      drama_id VARCHAR(50) PRIMARY KEY,
      title VARCHAR(255),
      cover TEXT,
      total INT,
      free_num INT,
      type VARCHAR(100),
      desc TEXT
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
}
initTables();

// ==========================
// 小程序接口
// ==========================

// 获取短剧详情
app.get('/api/drama/detail', async (req, res) => {
  const { openid, drama_id } = req.query;
  const { rows } = await pool.query('SELECT * FROM dramas WHERE drama_id = $1', [drama_id]);
  if (!rows[0]) return res.json({ code: -1 });

  const drama = rows[0];
  const unlockRows = await pool.query(
    'SELECT episode FROM unlocks WHERE openid = $1 AND drama_id = $2',
    [openid, drama_id]
  );
  const unlocked = unlockRows.rows.map(r => r.episode);

  const episodeStatus = [];
  for (let i = 1; i <= drama.total; i++) {
    let status = i <= drama.free_num ? 'free' : unlocked.includes(i) ? 'unlocked' : 'locked';
    episodeStatus.push({ episode: i, status });
  }

  res.json({ code: 0, data: { ...drama, episodeStatus } });
});

// 模拟支付解锁（数据永久存入数据库）
app.post('/api/pay/unlock', async (req, res) => {
  const { openid, drama_id, episode } = req.body;
  await pool.query(
    'INSERT INTO unlocks (openid, drama_id, episode) VALUES ($1, $2, $3)',
    [openid, drama_id, episode]
  );
  res.json({ code: 0, msg: '解锁成功' });
});

// ==========================
// 后台管理接口
// ==========================
app.get('/api/admin/drama/list', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM dramas');
  res.json({ code: 0, data: rows });
});

app.post('/api/admin/drama/save', async (req, res) => {
  const { drama_id, title, cover, total, free_num, type, desc } = req.body;
  await pool.query(
    `INSERT INTO dramas (drama_id, title, cover, total, free_num, type, desc)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (drama_id) DO UPDATE SET title=$2, cover=$3, total=$4, free_num=$5, type=$6, desc=$7`,
    [drama_id, title, cover, total, free_num, type, desc]
  );
  res.json({ code: 0 });
});

app.post('/api/admin/drama/delete', async (req, res) => {
  await pool.query('DELETE FROM dramas WHERE drama_id = $1', [req.body.drama_id]);
  res.json({ code: 0 });
});

// 后台页面
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.get('/', (req, res) => {
  res.send('✅ PostgreSQL 永久存储版运行成功！数据再也不会丢了！');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('✅ 后端启动成功'));
