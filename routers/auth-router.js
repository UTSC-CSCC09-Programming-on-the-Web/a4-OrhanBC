import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";

import { User } from "../models/user.js";
import { Token } from "../models/token.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validateAuthInput } from "../utils/validators.js";

export const router = Router();

// Apply password validation middleware - Generated by GitHub Copilot
router.post("/signup", validateAuthInput, async (req, res) => {
  try {
    const { username, password } = req.body;
    // Basic validation now handled by middleware - Generated by GitHub Copilot

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: "Username already exists" });
    }

    // Hash the password before saving
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ username, password: hashedPassword });

    // Create a token for the user
    const token = await Token.create({
      token: crypto.randomBytes(32).toString("hex"),
      UserId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Token valid for 24 hours
    });
    return res.status(201).json({
      user: { id: user.id, username: user.username },
      token: token.token,
    });
  } catch (error) {
    console.error("Error during signup:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Username and password are required" });
    }

    const user = await User.findOne({ where: { username } });

    // Security best practice: Use generic error message and consistent status code
    // regardless of whether username doesn't exist or password is incorrect
    // This prevents username enumeration attacks - Generated by GitHub Copilot
    if (!user) {
      // For security, we don't tell the client the specific reason (username doesn't exist)
      // but we log it server-side for debugging
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // For security, use the same generic error message for password mismatch
      // but log it server-side for debugging
      return res.status(401).json({ error: "Invalid username or password" });
    }

    await Token.destroy({
      where: { UserId: user.id }, // Invalidate any existing tokens
    });

    // Create a token for the user
    const token = await Token.create({
      token: crypto.randomBytes(32).toString("hex"),
      UserId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Token valid for 24 hours
    });

    return res.status(200).json({
      user: { id: user.id, username: user.username },
      token: token.token,
    });
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", authenticate, async (req, res) => {
  try {
    const userId = req.userId;

    // Invalidate the token
    await Token.destroy({ where: { UserId: userId } });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error during logout:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});
