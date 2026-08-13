import express from 'express';
import triggerWorkflowRun from './triggerWorkflowRun';
import approveStep from './approveStep';
import webhookTrigger from './webhookTrigger';
const app = express();
app.use(express.json());
app.post('/triggerWorkflowRun', triggerWorkflowRun);
app.post('/approveStep', approveStep);
app.post('/webhookTrigger', webhookTrigger);
app.get('/healthz', (_req, res) => res.status(200).send('ok'));
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Functions server listening on http://localhost:${PORT}`);
});
