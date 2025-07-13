import express from "express";
import bodyParser from "body-parser";
import multer from "multer";

import { sequelize } from "./datasource.js";
import { router as imagesRouter } from "./routers/images-router.js";
import { router as commentsRouter } from "./routers/comments-router.js";
import { router as usersRouter } from "./routers/users-router.js";
import { router as authRouter } from "./routers/auth-router.js";

export const app = express();
const PORT = 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("static"));

try {
  await sequelize.authenticate();
  // Automatically detect all of your defined models and create (or modify) the tables for you.
  // This is not recommended for production-use, but that is a topic for a later time!
  await sequelize.sync({ alter: { drop: false } });
  console.log("Connection has been established successfully.");
} catch (error) {
  console.error("Unable to connect to the database:", error);
}

const upload = multer({ dest: "uploads/" });

app.use("/api/auth", authRouter);

app.use("/api/images", imagesRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/users", usersRouter);

app.listen(PORT, (err) => {
  if (err) console.log(err);
  else console.log("HTTP server on http://localhost:%s", PORT);
});
