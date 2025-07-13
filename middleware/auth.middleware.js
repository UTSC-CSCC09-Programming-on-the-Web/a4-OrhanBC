import { Token } from "../models/token.js";
import { User } from "../models/user.js";

export async function authenticate(req, res, next) {
  try {
    // Extract token from headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    // Validate token
    const tokenRecord = await Token.findOne({
      where: { token },
    });

    if (!tokenRecord) {
      return res.status(401).json({ error: "Invalid token" });
    }

    if (new Date() > tokenRecord.expiresAt) {
      await tokenRecord.destroy(); // Clean up expired token
      return res.status(401).json({ error: "Token expired" });
    }

    // Attach user to request object
    req.userId = tokenRecord.UserId;

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ error: "Unauthorized" });
  }
}
