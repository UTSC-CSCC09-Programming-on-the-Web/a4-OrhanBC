import { Router } from "express";
import { Comment } from "../models/comment.js";
import { Image } from "../models/image.js";
import {
  validateIdParam,
  validatePagination,
  validateCommentInput,
} from "../utils/validators.js";
import { authenticate } from "../middleware/auth.middleware.js";

export const router = Router();

// GET all comments (not tied to a specific image)
router.get("/", authenticate, async (req, res) => {
  try {
    const findOptions = {
      order: [["createdAt", "DESC"]],
    };
    const comments = await Comment.findAll(findOptions);

    res.status(200).json({
      comments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to retrieve comments" });
  }
});

// GET a specific comment by ID
router.get("/:id", authenticate, validateIdParam(), async (req, res) => {
  try {
    const comment = await Comment.findByPk(req.validatedParams.id);

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    res.status(200).json(comment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to retrieve comment" });
  }
});

// DELETE a specific comment
router.delete("/:id", validateIdParam(), authenticate, async (req, res) => {
  try {
    const comment = await Comment.findByPk(req.validatedParams.id);

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    const image = await Image.findByPk(comment.ImageId);

    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    if (comment.UserId !== req.userId && image.UserId !== req.userId) {
      return res
        .status(403)
        .json({ error: "You do not have permission to delete this comment" });
    }

    await comment.destroy();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
});
