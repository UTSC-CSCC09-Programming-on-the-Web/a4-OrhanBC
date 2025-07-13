import { sequelize } from "../datasource.js";
import { DataTypes } from "sequelize";

import { Image } from "./image.js";
import { User } from "./user.js";

export const Comment = sequelize.define("Comment", {
  comment: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

Comment.belongsTo(Image);
Image.hasMany(Comment);

Comment.belongsTo(User);
User.hasMany(Comment);
