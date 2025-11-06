import express from "express";
import summaryRouter from "./summary";
import streetsRouter from "./streets";
import filtersRouter from "./filters";
import citiesRouter from "./cities";

const router = express.Router();

router.use("/summary", summaryRouter);
router.use("/streets", streetsRouter);
router.use("/filters", filtersRouter);
router.use("/filtros", filtersRouter);
router.use("/cities", citiesRouter);

export default router;