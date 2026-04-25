const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 内存数据库（Railway 100%兼容）
let dramaList = [];
// 支付订单 + 解锁记录
let payOrderList = [];
let unlockList = [];

// 1. 获取短剧详情
app.get('/api/drama/detail', (req, res) => {
  const { openid, drama_id } = req.query;
  if (!openid || !drama_id) return res.json({ code: -1, msg: '参数错误' });

  const drama = dramaList.find(s => s.drama_id === drama_id);
  if (!drama) return res.json({ code: -2, msg: '短剧不存在' });

  // 查询用户已解锁剧集
  const userUnlocks = unlockList.filter(u =>
    u.openid === openid && u.drama_id === drama_id
  );
  const unlockedEp = userUnlocks.map(u => u.episode);

  const episodeStatus = [];
  for (let i = 1; i <= drama.total; i++) {
    let status = i <= drama.free_num ? 'free' : unlockedEp.includes(i) ? 'unlocked' : 'locked';
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

// 2. 创建支付订单
app.post('/api/drama/create-pay', (req, res) => {
  const { openid, drama_id, episode, amount } = req.body;
  if (!openid || !drama_id || !episode) return res.json({ code: -1 });

  const orderNo = 'P' + Date.now();
  payOrderList.push({
    orderNo, openid, drama_id, episode, amount: amount || 1,
    status: 'unpaid', createTime: Date.now()
  });

  res.json({
    code: 0,
    msg: '订单创建成功',
    data: { orderNo }
  });
});

// 3. 支付成功回调
app.post('/api/drama/pay-success', (req, res) => {
  const { orderNo } = req.body;
  const order = payOrderList.find(o => o.orderNo === orderNo);
  if (!order) return res.json({ code: -1, msg: '订单不存在' });
  if (order.status === 'paid') return res.json({ code: 0, msg: '已支付' });

  order.status = 'paid';
  const { openid, drama_id, episode } = order;
  const exists = unlockList.find(u =>
    u.openid === openid && u.drama_id === drama_id && u.episode === episode
  );
  if (!exists) {
    unlockList.push({ openid, drama_id, episode });
  }

  res.json({ code: 0, msg: '支付成功，已解锁' });
});

// 🔥 新增：模拟支付 一键解锁接口
app.post('/api/pay/unlock', (req, res) => {
  const { openid, drama_id, episode } = req.body;
  if (!openid || !drama_id || !episode) {
    return res.json({ code: -1, msg: '参数缺失' });
  }

  // 判断是否已解锁
  const hasUnlock = unlockList.find(item =>
    item.openid === openid &&
    item.drama_id === drama_id &&
    item.episode === episode
  );

  if (hasUnlock) {
    return res.json({ code: 0, msg: '该集已解锁' });
  }

  // 模拟支付成功，加入解锁列表
  unlockList.push({
    openid,
    drama_id,
    episode
  });

  res.json({
    code: 0,
    msg: '解锁成功'
  });
});

// ========== 后台管理接口（无修改） ==========
app.get('/api/admin/drama/list', (req, res) => {
  res.json({ code: 0, data: dramaList });
});
app.post('/api/admin/drama/save', (req, res) => {
  const item = req.body;
  const idx = dramaList.findIndex(d => d.drama_id === item.drama_id);
  if (idx >= 0) dramaList[idx] = item;
  else dramaList.push(item);
  res.json({ code: 0 });
});
app.post('/api/admin/drama/delete', (req, res) => {
  dramaList = dramaList.filter(d => d.drama_id !== req.body.drama_id);
  res.json({ code: 0 });
});

// 后台静态页面
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.get('/', (req, res) => res.send('支付版短剧后端运行成功 ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('服务启动成功'));
