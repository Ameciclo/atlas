import { createRouter } from "../../lib/create-app.js";
import causasSecundariasRoutes from "./causas-secundarias/causas-secundarias.index.js";
import citiesByYearRoutes from "./cities-by-year/cities-by-year.index.js";
import filtrosRoutes from "./filtros/filtros.index.js";
import matrixRoutes from "./matrix/matrix.index.js";
import summaryRoutes from "./summary/summary.index.js";

const router = createRouter()
	.route("/", summaryRoutes)
	.route("/", citiesByYearRoutes)
	.route("/", filtrosRoutes)
	.route("/", matrixRoutes)
	.route("/", causasSecundariasRoutes);

export default router;