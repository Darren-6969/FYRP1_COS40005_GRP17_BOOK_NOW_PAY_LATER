import prisma from "../config/db.js";
import { getCreditHistory, upholdCreditAppeal } from "../services/customer_credit_service.js";

export async function getMyCreditHistory(req, res, next) {
  try {
    const history = await getCreditHistory(req.user.id);
    res.json({ history });
  } catch (error) {
    next(error);
  }
}

export async function createCreditAppeal(req, res, next) {
  try {
    const eventId = Number(req.body?.eventId);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!Number.isInteger(eventId) || !reason) {
      return res.status(400).json({ message: "eventId and reason are required." });
    }
    const event = await prisma.creditProfileEvent.findFirst({
      where: { id: eventId, customerId: req.user.id },
    });
    if (!event) return res.status(404).json({ message: "Credit event not found." });
    const appeal = await prisma.creditAppeal.create({
      data: { customerId: req.user.id, eventId, reason },
    });
    res.status(201).json({ appeal });
  } catch (error) {
    next(error);
  }
}

export async function upholdAppeal(req, res, next) {
  try {
    const result = await upholdCreditAppeal({
      appealId: Number(req.params.id),
      actorUserId: req.user.id,
      resolution: req.body?.resolution,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function listCreditAppeals(req, res, next) {
    try {
      const appeals = await prisma.creditAppeal.findMany({
        where: { status: req.query.status || undefined },
        include: {
          event: { select: { id: true, eventType: true, reason: true, beforeTier: true, afterTier: true, createdAt: true } },
          customer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      res.json({ appeals });
    } catch (error) {
      next(error);
  }
}
