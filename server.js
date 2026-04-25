const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================
// 🔥 JSON 永久存储（自动建文件）
// ==========================
const DATA_FILE = path.join(__dirname, 'data.json');

function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return {
      dramaList: [],
      unlockList: []
    };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let data = readData();

// ==========================
// 1. 获取短剧详情（小程序用）
// ==========================
app.get('/api/drama/detail', (req, res) => {
  const { openid, drama_id } = req.query;
  if (!openid || !drama_id) {
    return res.json({ code: -1, msg: '参数错误' });
  }

  const drama = data.dramaList.find(d => d.drama_id === drama_id);
  if (!drama) {
    return res.json({ code: -2, msg: '短剧不存在' });
  }

  const unlockedEpisodes = data.unlockList
    .filter(u => u.openid === openid && u.drama_id === drama_id)
    .map(u => u.episode);

  const episodeStatus = [];
  for (let i = 1; i <= drama.total; i++) {
    let status = i <= drama.free_num 
      ? 'free' 
      : unlockedEpisodes.includes(i) 
        ? 'unlocked' 
        : 'locked';
    episodeStatus.push({ episode: i, status });
  }

  res.json({
    code: 0,
    data: {
      cover: drama.cover,
      title: drama.title,
      total: drama.total,
      type: drama.type,
      desc: drama.desc,
      free_num: drama.free_num,
      episodeStatus
    }
  });
});

// ==========================
// 2. 模拟支付解锁（修复 404）
// ==========================
app.post('/api/pay/unlock', (req, res) => {
  const { openid, drama_id, episode } = req.body;

  if (!openid || !drama_id || !episode) {
    return res.json({ code: -1, msg: '参数不全' });
  }

  const exists = data.unlockList.find(u =>
    u.openid === openid &&
    u.drama_id === drama_id &&
    u.episode === episode
  );

  if (exists) {
    return res.json({ code: 0, msg: '已解锁' });
  }

  data.unlockList.push({ openid, drama_id, episode });
  saveData(data);

  res.json({ code: 0, msg: '解锁成功' });
});

// ==========================
// 3. 后台管理接口
// ==========================
app.get('/api/admin/drama/list', (req, res) => {
  res.json({ code: 0, data: data.dramaList });
});

app.post('/api/admin/drama/save', (req, res) => {
  const item = req.body;
  const index = data.dramaList.findIndex(d => d.drama_id === item.drama_id);
  if (index >= 0) {
    data.dramaList[index] = item;
  } else {
    data.dramaList.push(item);
  }
  saveData(data);
  res.json({ code: 0 });
});

app.post('/api/admin/drama/delete', (req, res) => {
  data.dramaList = data.dramaList.filter(d => d.drama_id !== req.body.drama_id);
  saveData(data);
  res.json({ code: 0 });
});

// ==========================
// 后台页面
// ==========================
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.get('/', (req, res) => {
  res.send('✅ 短剧后台运行成功 - JSON 永久存储');
});

// ==========================
// 启动服务
// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务已启动：端口 ${PORT}`);
});
