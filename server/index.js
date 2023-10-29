const express = require('express');
const { rateLimit } = require('express-rate-limit');
const cors = require('cors');
const app = express();

const port = process.env.PORT || 5111;
let clients = [];
let actions = [];
const MAX_N = 50;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const limiter = rateLimit({
  windowMs: 10000,
  limit: 500, // 50 req/s
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

app.use(limiter);
app.use(cors());
app.use(express.json());

app.post('/action', (req, res) => {
  const action = req.body.action;
  const whitelist = ['W', 'A', 'S', 'D', 'Q', 'E', 'T'];

  if (!whitelist.includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }

  // 5% chance to add a T (twerk)
  if (action === 'T') {
    if (Math.random() < 0.05) {
      actions.push('T');
      return res.status(200).json({ status: 'Action added' });
    } else {
      return res.status(400).json({ error: 'Action not added' });
    }
  }

  if (actions.length < MAX_N) {
    actions.push(action);
    return res.status(200).json({ status: 'Action added' });
  } else {
    return res.status(400).json({ error: 'Action queue is full' });
  }
});

app.get('/kill', (req, res) => {
  if (req.query.key !== process.env.MAIN_KEY) return res.status(403).send('no');
  clients = [];
  actions = [];
  res.send('ok');
});

app.get('/info', (_req, res) => {
  const used = process.memoryUsage().heapUsed / 1024 / 1024;
  res.json({
    memoryUsage: `${Math.round(used * 100) / 100} MB`,
    clientsCount: clients.length,
    actionsCount: actions.length,
    clients: clients.map((c) => c.id),
    actions,
  });
});

app.get('/actions', (req, res) => {
  if (req.query.key !== process.env.MAIN_KEY) return res.status(403).send('no');

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const client = {
    id: Date.now(),
    res,
    ready: false,
  };

  clients.push(client);
  res.write('');

  (async () => {
    await wait(500);
    res.write(' \n');
    await wait(500);
    res.write('P\n');
    await wait(10000);
    res.write('f\n');
    await wait(1500);
    client.ready = true;

    setInterval(() => {
      if (!actions.length) return;
      clients.forEach((client) => {
        if (!client.ready) return;
        client.res.write(`${actions.shift().toLowerCase()}\n`);
      });
    }, 10);
  })();

  req.on('close', () => {
    clients = clients.filter((c) => {
      c.res.write('\t');
      return client.id !== c.id;
    });
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
