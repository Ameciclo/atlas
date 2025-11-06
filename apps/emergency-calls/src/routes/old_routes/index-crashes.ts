// src/modules/traffic-crashes/index.ts
import express from 'express';
import summaryRouter from '.';
import geojsonRouter from './geojson';
import vehiclesRouter from './vehicles';
import streetsSummaryRouter from './streets-summary';

const router = express.Router();

router.use('/summary', summaryRouter);
router.use('/geojson', geojsonRouter);
router.use('/vehicles', vehiclesRouter);
router.use('/streets-summary', streetsSummaryRouter);

export default router;