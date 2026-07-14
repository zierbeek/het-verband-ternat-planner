import { prisma } from "./db.js";
import { hashPassword } from "./auth.js";

// Default quick-planning presets. Seeded once so the planning UI has
// something to show out of the box; administrators can rename, retime,
// recolor, reorder, delete, or add extras from that point on.
async function seedDefaultShiftPresets() {
  const presetCount = await prisma.shiftPreset.count();
  if (presetCount > 0) return;

  await prisma.shiftPreset.createMany({
    data: [
      { label: "Voormiddag", startTime: "07:00", endTime: "15:00", color: "#10b981", order: 0 },
      { label: "Namiddag", startTime: "15:00", endTime: "23:00", color: "#f59e0b", order: 1 },
    ],
  });
  console.log("Seeded default shift presets.");
}

// Every user (administrator or employee) needs an Employee profile so they
// can be assigned to shifts, request leave, etc. Older accounts created
// before administrators became assignable may be missing this profile, so
// this back-fills it on every startup. Safe to run repeatedly: it only
// touches users that don't already have one.
async function backfillEmployeeProfiles() {
  const usersWithoutEmployee = await prisma.user.findMany({
    where: { employee: null },
    select: { id: true },
  });

  for (const user of usersWithoutEmployee) {
    await prisma.employee.create({
      data: {
        userId: user.id,
        preferredShifts: "[]",
        preferredColleagues: "[]",
      },
    });
  }

  if (usersWithoutEmployee.length > 0) {
    console.log(`Backfilled Employee profiles for ${usersWithoutEmployee.length} existing user(s).`);
  }
}

export async function seedDatabase() {
  // Runs independently of the admin-account check below so that existing
  // installations upgrading to this feature also get sensible defaults,
  // instead of starting with an empty presets list.
  await seedDefaultShiftPresets();
  await backfillEmployeeProfiles();

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("Database already seeded.");
    return;
  }

  console.log("Seeding database with production ready initial administrator account...");

  // 1. Create a single administrator user
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@homenursing.org",
      passwordHash: hashPassword("admin123"),
      name: "Beheerder",
      role: "ADMINISTRATOR",
    },
  });

  // Administrators also get an Employee profile so they can be assigned to
  // shifts, request leave, etc. just like regular employees.
  await prisma.employee.create({
    data: {
      userId: adminUser.id,
      preferredShifts: "[]",
      preferredColleagues: "[]",
    },
  });

  // 2. Create default settings
  await prisma.setting.createMany({
    data: [
      { key: "org_name", value: "Thuisverpleging Het Verband Ternat", description: "Organisatienaam" },
      { key: "max_hours_limit", value: "48", description: "Absoluut wekelijks urenlimiet" },
      { key: "allow_auto_approve_swaps", value: "false", description: "Dienstruilen automatisch goedkeuren zonder beheerder" },
      { key: "email_service_type", value: "simulation", description: "E-maildienst type: simulation, resend of smtp" },
      { key: "sender_email", value: "noreply@hetverbandternat.be", description: "Afzender e-mailadres" },
    ],
  });

  // 3. Create a clean welcome announcement
  await prisma.announcement.create({
    data: {
      title: "Welkom bij uw nieuwe planningssysteem!",
      content: "Dit is uw vers geïnstalleerde planningsomgeving voor Het Verband Ternat. Als beheerder kunt u via het Beheercentrum nieuwe medewerkers toevoegen, instellingen aanpassen en de planning beheren. Vergeet niet uw wachtwoord aan te passen na de eerste keer inloggen.",
      authorId: adminUser.id,
    },
  });

  console.log("Production ready database successfully seeded.");
}
