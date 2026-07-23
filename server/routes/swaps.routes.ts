import express from "express";
import { asyncHandler } from "../middleware/error.middleware.js";
import { prisma } from "../db.js";
import { generateEmailActionToken, verifyEmailActionToken, generateAdminEmailActionToken, verifyAdminEmailActionToken } from "../auth.js";
import { logAction } from "../services/audit.service.js";
import { getPublicBaseUrl, sendEmailNotification, buildSwapDetailsHtml, buildSwapActionButtons } from "../services/email.service.js";
import { findBookingConflict, describeConflict } from "../services/shift.service.js";
import { authenticate, requireAdmin } from "../middleware/auth.middleware.js";

export const swapsRouter = express.Router();

swapsRouter.get("/api/swaps", authenticate, asyncHandler(async (req: any, res) => {
      let whereClause: any = {};
      if (req.user.role === "EMPLOYEE") {
        const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
        if (emp) {
          whereClause = {
            OR: [
              { requesterId: emp.id },
              { targetId: emp.id },
            ],
          };
        }
      }

      const list = await prisma.swapRequest.findMany({
        where: whereClause,
        include: {
          shift: true,
          targetShift: true,
          requester: { include: { user: true } },
          target: { include: { user: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return res.json(list);
    }));

swapsRouter.post("/api/swaps", authenticate, asyncHandler(async (req: any, res) => {
    const { shiftId, targetId, targetShiftId, reason, comment } = req.body;
    if (!shiftId || !targetId || !reason) {
      return res.status(400).json({ error: "Missing shift, target colleague, or reason" });
    }

    try {
      const requesterEmp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
      if (!requesterEmp) return res.status(400).json({ error: "Employee profile required" });

      if (requesterEmp.id === targetId) {
        return res.status(400).json({ error: "Cannot swap with yourself" });
      }

      const targetEmployee = await prisma.employee.findUnique({
        where: { id: targetId },
        include: { user: true },
      });

      if (!targetEmployee) {
        return res.status(404).json({ error: "Target colleague not found" });
      }

      const requesterShift = await prisma.shift.findUnique({ where: { id: shiftId } });
      if (!requesterShift) {
        return res.status(404).json({ error: "Shift not found" });
      }

      const existingPending = await prisma.swapRequest.findFirst({
        where: {
          shiftId,
          requesterId: requesterEmp.id,
          targetId,
          status: { in: ["PENDING_TARGET", "ACCEPTED_TARGET"] },
        },
      });

      if (existingPending) {
        return res.status(400).json({ error: "An active swap request already exists for this colleague and shift" });
      }

      // The colleague being asked to take over `requesterShift` must not
      // already be working at that moment. Their own shift being offered
      // back (targetShiftId, if any) is excluded since it's the one being
      // vacated as part of this very swap.
      const targetConflict = await findBookingConflict(
        targetId,
        requesterShift,
        targetShiftId ? [targetShiftId] : []
      );
      if (targetConflict) {
        return res.status(409).json({
          error: `Kan geen ruil voorstellen: ${targetEmployee.user.name} is ${describeConflict(targetConflict)}.`,
        });
      }

      const swap = await prisma.swapRequest.create({
        data: {
          shiftId,
          requesterId: requesterEmp.id,
          targetId,
          targetShiftId: targetShiftId || null,
          status: "PENDING_TARGET",
          reason,
          comment,
        },
        include: {
          shift: true,
          requester: { include: { user: true } },
          target: { include: { user: true } },
        },
      });

      // Notify Target Colleague
      await prisma.notification.create({
        data: {
          userId: swap.target.userId,
          title: "Binnenkomend ruilvoorstel",
          message: `${req.user.name} stelt voor om de shift ${swap.shift.name} op ${swap.shift.date} met u te ruilen.`,
          link: "/swaps",
        },
      });

      // Send email to Target Colleague
      try {
        if (swap.target.user.email) {
          const baseUrl = getPublicBaseUrl(req);
          const acceptToken = generateEmailActionToken({ swapId: swap.id, targetUserId: swap.target.userId, response: "ACCEPT" });
          const declineToken = generateEmailActionToken({ swapId: swap.id, targetUserId: swap.target.userId, response: "DECLINE" });
          await sendEmailNotification(
            swap.target.user.email,
            `Ruilvoorstel: ${swap.shift.name} op ${swap.shift.date}`,
            `<h3>Beste ${swap.target.user.name},</h3>
             <p>Uw collega <strong>${req.user.name}</strong> vraagt om de volgende shift te ruilen:</p>
             ${buildSwapDetailsHtml({ ...swap, reason })}
             <p><strong>Actie in de app:</strong> Als u akkoord gaat, klikt u op de knop hieronder. U kunt ook weigeren via de andere knop.</p>
             ${buildSwapActionButtons(baseUrl, `/api/swaps/email-action?token=${encodeURIComponent(acceptToken)}`, `/api/swaps/email-action?token=${encodeURIComponent(declineToken)}`)}
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
            { platformUrl: baseUrl, ctaLabel: "Open ruilvoorstel" }
          );
        }
      } catch (mailErr) {
        console.error("Failed to send swap proposal mail:", mailErr);
      }

      await logAction(req.user.id, "SWAP_REQUEST_CREATE", `Proposed shift swap with colleague ${targetId}`);
      return res.status(201).json(swap);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

swapsRouter.post("/api/swaps/:id/respond", authenticate, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { response, comment } = req.body; // response must be "ACCEPT" or "DECLINE"

    if (response !== "ACCEPT" && response !== "DECLINE") {
      return res.status(400).json({ error: "Response must be ACCEPT or DECLINE" });
    }

    try {
      const swap = await prisma.swapRequest.findUnique({
        where: { id },
        include: {
          shift: true,
          requester: { include: { user: true } },
          target: true,
        },
      });

      if (!swap) return res.status(404).json({ error: "Swap request not found" });

      if (swap.target.userId !== req.user.id) {
        return res.status(403).json({ error: "Forbidden: You are not the target of this swap" });
      }

      // Re-check for a scheduling conflict at accept time: the colleague may
      // have been assigned a new shift after the swap was proposed, so the
      // check at proposal time is not sufficient on its own.
      if (response === "ACCEPT") {
        const conflict = await findBookingConflict(
          swap.targetId,
          swap.shift,
          swap.targetShiftId ? [swap.targetShiftId] : []
        );
        if (conflict) {
          return res.status(409).json({
            error: `U kunt deze ruil niet accepteren: u bent ${describeConflict(conflict)}.`,
          });
        }
      }

      const nextStatus = response === "ACCEPT" ? "ACCEPTED_TARGET" : "REJECTED_TARGET";

      const updated = await prisma.swapRequest.update({
        where: { id },
        data: {
          status: nextStatus,
          comment: comment || swap.comment,
        },
      });

      // Notify Requester
      await prisma.notification.create({
        data: {
          userId: swap.requester.userId,
              title: "Collega reageerde op ruilvoorstel",
              message: `${req.user.name} heeft uw ruilvoorstel voor ${swap.shift.name} op ${swap.shift.date} ${response === "ACCEPT" ? "geaccepteerd" : "geweigerd"}.`,
          link: "/swaps",
        },
      });

      // Send email to Requester
      try {
        if (swap.requester.user.email) {
          const vertaaldResponse = response === "ACCEPT" ? "geaccepteerd" : "geweigerd";
          await sendEmailNotification(
            swap.requester.user.email,
            `Collega heeft gereageerd op uw ruilvoorstel`,
            `<h3>Beste ${swap.requester.user.name},</h3>
             <p>Uw collega <strong>${req.user.name}</strong> heeft uw voorstel om de onderstaande shift te ruilen <strong>${vertaaldResponse}</strong>:</p>
             ${buildSwapDetailsHtml(swap)}
             ${response === "ACCEPT" ? "<p>De aanvraag ligt nu bij de beheerder voor definitieve goedkeuring.</p>" : ""}
             <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
            { platformUrl: getPublicBaseUrl(req), ctaLabel: "Open uw ruilverzoeken" }
          );
        }
      } catch (mailErr) {
        console.error("Failed to send swap response mail:", mailErr);
      }

      if (response === "ACCEPT") {
        // Notify Admins for final approval
        const admins = await prisma.user.findMany({ where: { role: "ADMINISTRATOR" } });
        for (const admin of admins) {
          await prisma.notification.create({
            data: {
              userId: admin.id,
                title: "Ruilvoorstel klaar voor goedkeuring",
                message: `Het ruilvoorstel tussen ${swap.requester.user.name} en ${req.user.name} is geaccepteerd en wacht op beheerdergoedkeuring.`,
              link: "/admin/swaps",
            },
          });

          // Send email to Admin
          try {
            const baseUrl = getPublicBaseUrl(req);
            const approveToken = generateAdminEmailActionToken({ swapId: swap.id, adminUserId: admin.id, response: "APPROVED_ADMIN" });
            const rejectToken = generateAdminEmailActionToken({ swapId: swap.id, adminUserId: admin.id, response: "REJECTED_ADMIN" });
            await sendEmailNotification(
              admin.email,
              `Dienstruil gereed voor goedkeuring`,
              `<h3>Dienstruil wacht op goedkeuring</h3>
               <p>De ruildienst tussen <strong>${swap.requester.user.name}</strong> en <strong>${req.user.name}</strong> is onderling geaccepteerd en vereist uw goedkeuring als beheerder.</p>
               ${buildSwapDetailsHtml(swap)}
               <p><strong>Actie in de app:</strong> U kunt deze ruil direct goedkeuren of weigeren via onderstaande knoppen.</p>
               ${buildSwapActionButtons(baseUrl, `/api/swaps/email-admin-action?token=${encodeURIComponent(approveToken)}`, `/api/swaps/email-admin-action?token=${encodeURIComponent(rejectToken)}`)}
               <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
              { platformUrl: baseUrl, ctaLabel: "Open beheercentrum" }
            );
          } catch (mailErr) {
            console.error("Failed to send swap admin notification mail:", mailErr);
          }
        }
      }

      await logAction(req.user.id, "SWAP_REQUEST_RESPONSE", `Responded ${response} to swap request ${id}`);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

swapsRouter.post("/api/swaps/:id/approve", authenticate, requireAdmin, asyncHandler(async (req: any, res) => {
    const { id } = req.params;
    const { status } = req.body; // "APPROVED_ADMIN" or "REJECTED_ADMIN"

    if (status !== "APPROVED_ADMIN" && status !== "REJECTED_ADMIN") {
      return res.status(400).json({ error: "Status must be APPROVED_ADMIN or REJECTED_ADMIN" });
    }

    try {
      const swap = await prisma.swapRequest.findUnique({
        where: { id },
        include: {
          shift: true,
          targetShift: true,
          requester: { include: { user: true } },
          target: { include: { user: true } },
        },
      });

      if (!swap) return res.status(404).json({ error: "Swap request not found" });

      // Only one administrator needs to approve or reject a swap. If another
      // administrator already resolved it, don't let a second admin silently
      // overwrite that decision (or double-apply the shift swap).
      if (swap.status === "APPROVED_ADMIN" || swap.status === "REJECTED_ADMIN") {
        return res.status(409).json({
          error: `Deze ruil is al ${swap.status === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"} door een andere beheerder.`,
        });
      }

      // A beheerder cannot approve or reject their own swap request
      if (swap.requester.userId === req.user.id || swap.target.userId === req.user.id) {
        return res.status(403).json({ error: "U kunt een ruilaanvraag waarbij u betrokken bent niet zelf goedkeuren of weigeren. Vraag een andere beheerder om dit te doen." });
      }

      if (status === "APPROVED_ADMIN" && swap.status !== "ACCEPTED_TARGET") {
        return res.status(400).json({ error: "Swap can only be approved after the colleague has accepted it" });
      }

      if (status === "APPROVED_ADMIN") {
        // Check both parties for conflicts BEFORE making any changes, excluding
        // the shifts involved in this swap itself (they're being vacated as
        // part of this very operation, so they shouldn't count as a conflict).
        const involvedShiftIds = [swap.shiftId, ...(swap.targetShiftId ? [swap.targetShiftId] : [])];

        const targetConflict = await findBookingConflict(swap.targetId, swap.shift, involvedShiftIds);
        if (targetConflict) {
          return res.status(409).json({
            error: `Ruil kan niet worden goedgekeurd: ${swap.target.user.name} is ${describeConflict(targetConflict)}.`,
          });
        }

        if (swap.targetShiftId && swap.targetShift) {
          const requesterConflict = await findBookingConflict(swap.requesterId, swap.targetShift, involvedShiftIds);
          if (requesterConflict) {
            return res.status(409).json({
              error: `Ruil kan niet worden goedgekeurd: ${swap.requester.user.name} is ${describeConflict(requesterConflict)}.`,
            });
          }
        }
      }

      const updated = await prisma.swapRequest.update({
        where: { id },
        data: { status },
      });

      if (status === "APPROVED_ADMIN") {
        // Swap Assignments in Database!
        // 1. Remove requester from requester shift and assign target
        await prisma.shiftAssignment.deleteMany({
          where: { shiftId: swap.shiftId, employeeId: swap.requesterId },
        });
        await prisma.shiftAssignment.create({
          data: { shiftId: swap.shiftId, employeeId: swap.targetId, status: "ASSIGNED" },
        });

        // 2. If there's a target shift, swap that too
        if (swap.targetShiftId) {
          await prisma.shiftAssignment.deleteMany({
            where: { shiftId: swap.targetShiftId, employeeId: swap.targetId },
          });
          await prisma.shiftAssignment.create({
            data: { shiftId: swap.targetShiftId, employeeId: swap.requesterId, status: "ASSIGNED" },
          });
        }
      }

      // Notify both participants
      await prisma.notification.create({
        data: {
          userId: swap.requester.userId,
          title: `Ruilvoorstel ${status === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"}`,
          message: `Uw ruilvoorstel is ${status === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"} door beheerder ${req.user.name}.`,
          link: "/schedule",
        },
      });

      await prisma.notification.create({
        data: {
          userId: swap.target.userId,
          title: `Ruilvoorstel ${status === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"}`,
          message: `Het ruilvoorstel met ${swap.requester.user.name} is ${status === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"} door beheerder ${req.user.name}.`,
          link: "/schedule",
        },
      });

      // Send email to Requester & Target
      try {
        const vertaaldStatus = status === "APPROVED_ADMIN" ? "GOEDGEKEURD" : "GEWEIGERD";
        const emailBody = `<h3>Beste collega,</h3>
          <p>De ruildienst tussen <strong>${swap.requester.user.name}</strong> en <strong>${swap.target.user.name}</strong> is <strong>${vertaaldStatus}</strong> door beheerder ${req.user.name}.</p>
          ${buildSwapDetailsHtml(swap)}
          <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`;

        if (swap.requester.user.email) {
          await sendEmailNotification(swap.requester.user.email, `Dienstruil ${vertaaldStatus.toLowerCase()} door beheerder`, emailBody, {
            platformUrl: getPublicBaseUrl(req),
            ctaLabel: "Open uw planning",
          });
        }
        if (swap.target.user.email) {
          await sendEmailNotification(swap.target.user.email, `Dienstruil ${vertaaldStatus.toLowerCase()} door beheerder`, emailBody, {
            platformUrl: getPublicBaseUrl(req),
            ctaLabel: "Open uw planning",
          });
        }
      } catch (mailErr) {
        console.error("Failed to send swap resolve emails:", mailErr);
      }

      await logAction(req.user.id, "SWAP_REQUEST_ADMIN_RESOLVE", `Admin resolved swap request ${id} as ${status}`);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }));

swapsRouter.get("/api/swaps/email-action", asyncHandler(async (req, res) => {
    const token = String(req.query.token || "");
    const payload = verifyEmailActionToken(token);

    if (!payload) {
      return res.status(400).send("Deze link is ongeldig of verlopen.");
    }

    try {
      const swap = await prisma.swapRequest.findUnique({
        where: { id: payload.swapId },
        include: {
          shift: true,
          targetShift: true,
          requester: { include: { user: true } },
          target: { include: { user: true } },
        },
      });

      if (!swap) {
        return res.status(404).send("Ruilverzoek niet gevonden.");
      }

      if (swap.target.userId !== payload.targetUserId) {
        return res.status(403).send("Deze link hoort niet bij uw account.");
      }

      if (payload.response === "ACCEPT") {
        if (swap.status === "PENDING_TARGET") {
          await prisma.swapRequest.update({ where: { id: swap.id }, data: { status: "ACCEPTED_TARGET" } });

          await prisma.notification.create({
            data: {
              userId: swap.requester.userId,
              title: "Collega reageerde op ruilvoorstel",
              message: `${swap.target.user.name} heeft uw ruilvoorstel voor ${swap.shift.name} op ${swap.shift.date} via de e-mail geaccepteerd.`,
              link: "/swaps",
            },
          });

          try {
            if (swap.requester.user.email) {
              await sendEmailNotification(
                swap.requester.user.email,
                `Collega heeft uw ruilvoorstel geaccepteerd`,
                `<h3>Beste ${swap.requester.user.name},</h3>
                 <p>Uw collega <strong>${swap.target.user.name}</strong> heeft uw ruilvoorstel via de e-mail geaccepteerd.</p>
                 ${buildSwapDetailsHtml(swap)}
                 <p>De aanvraag ligt nu bij de beheerder voor definitieve goedkeuring.</p>
                 <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
                { platformUrl: getPublicBaseUrl(req), ctaLabel: "Open uw ruilverzoeken" }
              );
            }
          } catch (mailErr) {
            console.error("Failed to send requester email after email accept:", mailErr);
          }

          const admins = await prisma.user.findMany({ where: { role: "ADMINISTRATOR" } });
          for (const admin of admins) {
            await prisma.notification.create({
              data: {
                userId: admin.id,
                title: "Ruilvoorstel klaar voor goedkeuring",
                message: `Het ruilvoorstel tussen ${swap.requester.user.name} en ${swap.target.user.name} is via de e-mail geaccepteerd en wacht op beheerdergoedkeuring.`,
                link: "/admin/swaps",
              },
            });
          }
        }

        return res.send("Bedankt. De ruilaanvraag is geaccepteerd en wacht nu op beheerdergoedkeuring.");
      }

      if (payload.response === "DECLINE") {
        if (swap.status === "PENDING_TARGET") {
          await prisma.swapRequest.update({ where: { id: swap.id }, data: { status: "REJECTED_TARGET" } });

          await prisma.notification.create({
            data: {
              userId: swap.requester.userId,
              title: "Collega reageerde op ruilvoorstel",
              message: `${swap.target.user.name} heeft uw ruilvoorstel voor ${swap.shift.name} op ${swap.shift.date} via de e-mail geweigerd.`,
              link: "/swaps",
            },
          });

          try {
            if (swap.requester.user.email) {
              await sendEmailNotification(
                swap.requester.user.email,
                `Collega heeft uw ruilvoorstel geweigerd`,
                `<h3>Beste ${swap.requester.user.name},</h3>
                 <p>Uw collega <strong>${swap.target.user.name}</strong> heeft uw ruilvoorstel via de e-mail geweigerd.</p>
                 ${buildSwapDetailsHtml(swap)}
                 <p>Met vriendelijke groet,<br>Het Verband Ternat Planner</p>`,
                { platformUrl: getPublicBaseUrl(req), ctaLabel: "Open uw ruilverzoeken" }
              );
            }
          } catch (mailErr) {
            console.error("Failed to send requester email after email decline:", mailErr);
          }
        }
        return res.send("De ruilaanvraag is geweigerd.");
      }

      return res.status(400).send("Ongeldige actie.");
    } catch (error: any) {
      return res.status(500).send(error.message);
    }
  }));

swapsRouter.get("/api/swaps/email-admin-action", asyncHandler(async (req, res) => {
    const token = String(req.query.token || "");
    const payload = verifyAdminEmailActionToken(token);

    if (!payload) {
      return res.status(400).send("Deze link is ongeldig of verlopen.");
    }

    try {
      const swap = await prisma.swapRequest.findUnique({
        where: { id: payload.swapId },
        include: {
          shift: true,
          targetShift: true,
          requester: { include: { user: true } },
          target: { include: { user: true } },
        },
      });

      if (!swap) {
        return res.status(404).send("Ruilverzoek niet gevonden.");
      }

      const admin = await prisma.user.findUnique({ where: { id: payload.adminUserId } });
      if (!admin || admin.role !== "ADMINISTRATOR") {
        return res.status(403).send("Deze link hoort niet bij een beheerder.");
      }

      // Only one administrator needs to approve or reject a swap. If another
      // administrator already resolved it via the app or another email link,
      // don't let this click silently overwrite that decision.
      if (swap.status === "APPROVED_ADMIN" || swap.status === "REJECTED_ADMIN") {
        return res.status(409).send(
          `Deze ruil is al ${swap.status === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"} door een andere beheerder.`
        );
      }

      if (payload.response === "APPROVED_ADMIN" && swap.status !== "ACCEPTED_TARGET") {
        return res.status(400).send("Deze ruil kan pas worden goedgekeurd nadat de collega akkoord heeft gegeven.");
      }

      if (payload.response === "APPROVED_ADMIN") {
        const involvedShiftIds = [swap.shiftId, ...(swap.targetShiftId ? [swap.targetShiftId] : [])];

        const targetConflict = await findBookingConflict(swap.targetId, swap.shift, involvedShiftIds);
        if (targetConflict) {
          return res.status(409).send(
            `Ruil kan niet worden goedgekeurd: ${swap.target.user.name} is ${describeConflict(targetConflict)}.`
          );
        }

        if (swap.targetShiftId && swap.targetShift) {
          const requesterConflict = await findBookingConflict(swap.requesterId, swap.targetShift, involvedShiftIds);
          if (requesterConflict) {
            return res.status(409).send(
              `Ruil kan niet worden goedgekeurd: ${swap.requester.user.name} is ${describeConflict(requesterConflict)}.`
            );
          }
        }
      }

      const updated = await prisma.swapRequest.update({
        where: { id: swap.id },
        data: { status: payload.response },
      });

      if (payload.response === "APPROVED_ADMIN") {
        await prisma.shiftAssignment.deleteMany({ where: { shiftId: swap.shiftId, employeeId: swap.requesterId } });
        await prisma.shiftAssignment.create({ data: { shiftId: swap.shiftId, employeeId: swap.targetId, status: "ASSIGNED" } });

        if (swap.targetShiftId) {
          await prisma.shiftAssignment.deleteMany({ where: { shiftId: swap.targetShiftId, employeeId: swap.targetId } });
          await prisma.shiftAssignment.create({ data: { shiftId: swap.targetShiftId, employeeId: swap.requesterId, status: "ASSIGNED" } });
        }
      }

      const responseLabel = payload.response === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd";
      await prisma.notification.create({
        data: {
          userId: swap.requester.userId,
          title: `Ruilvoorstel ${payload.response === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"}`,
          message: `Uw ruilvoorstel is door beheerder ${admin.name} ${responseLabel}.`,
          link: "/swaps",
        },
      });

      await prisma.notification.create({
        data: {
          userId: swap.target.userId,
          title: `Ruilvoorstel ${payload.response === "APPROVED_ADMIN" ? "goedgekeurd" : "geweigerd"}`,
          message: `De ruil met ${swap.requester.user.name} is door beheerder ${admin.name} ${responseLabel}.`,
          link: "/swaps",
        },
      });

      return res.send(payload.response === "APPROVED_ADMIN" ? "De ruil is goedgekeurd." : "De ruil is geweigerd.");
    } catch (error: any) {
      return res.status(500).send(error.message);
    }
  }));
