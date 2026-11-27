import { Router } from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { openApiSpec } from "../docs/openapi.js";

const router = Router();

// Swagger UI loads its own scripts and styles, which helmet's strict policy would block.
// Everything else on the docs pages keeps helmet's other headers.
router.use((_req, res, next) => {
  res.removeHeader("Content-Security-Policy");
  next();
});
router.use(helmet({ contentSecurityPolicy: false }));

router.get("/openapi.json", (_req, res) => {
  res.json(openApiSpec);
});

router.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: openApiSpec.info.title,
    swaggerOptions: { persistAuthorization: true },
  }),
);

export default router;
