import { Router } from "express";
import multer from "multer";
import path from "path";
import { Op } from "sequelize";

import {
  validateIdParam,
  validatePagination,
  validateImageInput,
} from "../utils/validators.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { User } from "../models/user.js";
import { Image } from "../models/image.js";

const upload = multer({ dest: "uploads/" });

export const router = Router();

router.get("/", validatePagination, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const cursor = req.query.cursor
      ? parseInt(req.query.cursor, 10)
      : undefined;
    const order = [["id", "DESC"]];

    let where = {};

    if (cursor) {
      where = {
        id: {
          [Op.lt]: cursor,
        },
      };
    }

    const users = await User.findAll({
      where,
      order,
      attributes: ["id", "username"],
      limit: limit + 1,
    });

    const hasNext = users.length > limit;

    const resultUsers = hasNext ? users.slice(0, limit) : users;

    let nextCursor = null;
    if (hasNext) {
      nextCursor = resultUsers[resultUsers.length - 1].id;
    }

    return res.status(200).json({
      users: resultUsers,
      nextCursor,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", validateIdParam(), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ["id", "username"],
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get(
  "/:id/images",
  validateIdParam(),
  validatePagination,
  async (req, res) => {
    try {
      // Get validated parameters
      const userId = parseInt(req.params.id, 10);
      const limit = parseInt(req.query.limit) || 1;
      const cursor = req.query.cursor; // Raw cursor value, validation done in specific logic

      const isLatestRequest = req.query.latest === "true";
      const order = [["id", "DESC"]]; // Only using ID for ordering

      // Handle special case for requesting latest image with navigation
      if (isLatestRequest) {
        const firstImage = await Image.findOne({
          order,
          where: { UserId: userId },
          include: [{ model: User, attributes: ["username"] }],
          limit: 1,
        });

        if (!firstImage) {
          return res.status(404).json({ error: "No images found" });
        }

        const totalCount = await Image.count({ where: { UserId: userId } });

        // Get next image (older than first)
        const nextImage = await Image.findOne({
          where: {
            id: { [Op.lt]: firstImage.id },
            UserId: userId,
          },
          order,
        });

        // Generate next cursor
        let nextCursor = null;
        if (nextImage) {
          nextCursor = nextImage.id.toString();
        }

        // Return in the same format as the standard pagination response
        return res.status(200).json({
          images: [firstImage],
          pagination: {
            hasNext: !!nextImage,
            nextCursor,
            hasPrev: false,
            prevCursor: null,
            total: totalCount,
            position: 1,
          },
        });
      }

      // Build the query conditions for standard pagination
      let where = {
        UserId: userId,
      };

      // If cursor is provided, find images with ID less than or equal to the cursor
      if (cursor) {
        try {
          const cursorId = parseInt(cursor, 10);
          if (isNaN(cursorId)) {
            return res.status(400).json({ error: "Invalid cursor format" });
          }
          where.id = { [Op.lte]: cursorId }; // Ensure we only get images older than the cursor
        } catch (error) {
          console.error("Invalid cursor:", error);
          return res.status(400).json({ error: "Invalid cursor format" });
        }
      }

      // Get one more item than requested to determine if there are more items
      const images = await Image.findAll({
        where,
        order,
        include: [{ model: User, attributes: ["username"] }],
        limit: limit + 1,
      });

      // Check if there are more items
      const hasNext = images.length > limit;

      // Remove the extra item if there are more
      const resultImages = hasNext ? images.slice(0, limit) : images;

      // Generate the next cursor
      let nextCursor = null;
      if (hasNext && resultImages.length > 0) {
        // Use the ID of the excluded next item as the cursor instead of the last shown item
        nextCursor = images[limit].id.toString();
      }

      // Generate the previous cursor
      let prevCursor = null;
      let hasPrev = false;

      if (resultImages.length > 0) {
        // Find if there are any images newer than the first image in our result set
        const firstResultImage = resultImages[0];

        const newerImagesCount = await Image.count({
          where: {
            id: { [Op.gt]: firstResultImage.id },
            UserId: userId,
          },
        });

        hasPrev = newerImagesCount > 0;

        if (hasPrev) {
          // Find the newest image before our current batch for the prev cursor
          const newerImage = await Image.findOne({
            where: {
              id: { [Op.gt]: firstResultImage.id },
            },
            order: [["id", "ASC"]], // Get the closest ID
          });

          if (newerImage) {
            prevCursor = newerImage.id.toString();
          }
        }
      }

      // Get the total count for pagination info
      const totalCount = await Image.count({ where: { UserId: userId } });

      // Calculate position if we have images
      let position = 1;
      if (resultImages.length > 0) {
        const firstResultImage = resultImages[0];
        // Count images that have higher IDs (newer)
        const newerImagesCount = await Image.count({
          where: {
            id: { [Op.gt]: firstResultImage.id },
            UserId: userId,
          },
        });
        position = newerImagesCount + 1;
      }

      res.status(200).json({
        images: resultImages,
        pagination: {
          hasNext,
          nextCursor,
          hasPrev,
          prevCursor,
          total: totalCount,
          position,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to retrieve images" });
    }
  },
);

router.post(
  "/:id/images",
  validateIdParam(),
  upload.single("image"),
  authenticate,
  validateImageInput,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);

      if (req.userId !== userId) {
        return res.status(403).json({
          error: "Forbidden: You can only upload images for your own account",
        });
      }

      if (!req.file) {
        return res.status(422).json({ error: "Image file is required" });
      }

      // Create the image record
      const image = await Image.create({
        title: req.body.title,
        image: req.file,
        UserId: userId,
      });

      res.status(201).json(image);
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);
