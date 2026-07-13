import { prisma } from "./db.js";
import { hashPassword } from "./auth.js";

export async function seedDatabase() {
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
